const fs = require("fs");
const puppeteer = require("puppeteer");
const { stringify } = require("csv-stringify/sync");
const config = require("./config");

async function initBrowser() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  page.setDefaultTimeout(config.NAVIGATION_TIMEOUT);
  return { browser, page };
}

async function extractMemberCards(page) {
  return page.$$eval(config.SELECTORS.MEMBER_CARD, (cards) => {
    const text = (el, sel) =>
      sel
        ? el.querySelector(sel)?.textContent?.trim()
        : el.textContent?.trim() || "";
    const attr = (el, sel, name) =>
      el.querySelector(sel)?.getAttribute(name) || "";

    const dedupe = new Set();
    return cards.reduce((results, card) => {
      const key = card.href || card.textContent;
      if (dedupe.has(key)) return results;
      dedupe.add(key);

      const company =
        text(card, ".company") || text(card, ".org") || text(card);
      const name = text(card, "h3") || text(card, ".name") || "";
      const phone = attr(card, 'a[href^="tel:"]', "href").replace("tel:", "");
      const email = attr(card, 'a[href^="mailto:"]', "href").replace(
        "mailto:",
        ""
      );
      const website = attr(card, ".website a", "href");

      let city = "",
        province = "";
      const addressText = text(card, ".address") || text(card, ".location");
      if (addressText?.includes(",")) {
        const parts = addressText.split(",").map((p) => p.trim());
        province = parts.pop();
        city = parts.pop();
      }

      const memberType = text(card, ".member-type") || text(card, ".type");
      const profileUrl = card.href || "";

      results.push({
        company,
        name,
        phone,
        email,
        city,
        province,
        website,
        memberType,
        profileUrl,
      });
      return results;
    }, []);
  });
}

async function extractProfileDetails(page, url) {
  try {
    await page.goto(url, { waitUntil: config.WAIT_UNTIL });
    await page
      .waitForSelector(config.SELECTORS.PROFILE_CONTENT, {
        timeout: config.SELECTOR_TIMEOUT,
      })
      .catch(() => {});

    return page.evaluate(() => {
      const getText = (sel) =>
        document.querySelector(sel)?.textContent?.trim() || "";
      const getHref = (sel) => document.querySelector(sel)?.href || "";

      return {
        name:
          getText(
            "#FunctionalBlock1_ctl00_ctl00_memberProfile_MemberForm_memberFormRepeater_ctl00_TextBoxLabel10595865"
          ) +
          " " +
          getText(
            "#FunctionalBlock1_ctl00_ctl00_memberProfile_MemberForm_memberFormRepeater_ctl01_TextBoxLabel10595866"
          ),
        email: getText('a[href^="mailto:"]'),
        phone: getText('a[href^="tel:"], .fieldPhone'),
        website: getHref('a[href^="http"]:not([href*="mailto:"])'),
        memberType: getText(".profileHeaderContainer h3"),
        city: getText(
          "#FunctionalBlock1_ctl00_ctl00_memberProfile_MemberForm_memberFormRepeater_ctl08_TextBoxLabel10596140"
        ),
        province: getText(
          "#FunctionalBlock1_ctl00_ctl00_memberProfile_MemberForm_memberFormRepeater_ctl09_TextBoxLabel10596141"
        ),
      };
    });
  } catch (error) {
    console.warn(`Failed to extract details from ${url}`);
    return {};
  }
}

async function processInBatches(items, processFn, batchSize) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(
      `Processing batch ${i / batchSize + 1}/${Math.ceil(
        items.length / batchSize
      )} (${batch.length} items)...`
    );
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);
  }
  return results;
}

function getUniqueFilename(baseName) {
  let counter = 1;
  let fileName = baseName;

  while (fs.existsSync(fileName)) {
    const nameParts = baseName.split(".");
    const ext = nameParts.pop();
    const base = nameParts.join(".");
    fileName = `${base}-${counter}.${ext}`;
    counter++;
  }

  return fileName;
}

function saveToCSV(data, baseFilename) {
  const filename = getUniqueFilename(baseFilename);

  // Filter out any undefined or null members and map to CSV format
  const csvData = data
    .filter((member) => member && member.company) // Only include members with company name
    .map((member) => ({
      "Company Name": member.company || "",
      "Contact Name": member.name || "",
      Phone: member.phone || "",
      Email: member.email || "",
      City: member.city || "",
      Province: member.province || "",
      Website: member.website || "",
      "Member Type": member.memberType || "",
    }));

  if (csvData.length === 0) {
    console.warn("No valid member data found to save");
    return null;
  }

  const csv = stringify(csvData, { header: true });
  fs.writeFileSync(filename, csv);
  console.log(`CSV saved with ${csvData.length} records: ${filename}`);
  return filename;
}

async function scrapeDirectory() {
  const { browser, page } = await initBrowser();
  const allMembers = [];

  try {
    // Scrape directory pages
    let pageIndex = 1;
    while (true) {
      const url =
        pageIndex === 1
          ? config.BASE_URL
          : `${config.BASE_URL}?page=${pageIndex}`;

      console.log(`Navigating to ${url}`);
      await page.goto(url, { waitUntil: config.WAIT_UNTIL });
      await page
        .waitForSelector(config.SELECTORS.MEMBER_CARD, {
          timeout: config.SELECTOR_TIMEOUT,
        })
        .catch(() => {});

      const membersOnPage = await extractMemberCards(page);
      if (membersOnPage.length === 0) {
        console.log("No more members found on this page");
        break;
      }

      console.log(`Found ${membersOnPage.length} members on page ${pageIndex}`);
      allMembers.push(...membersOnPage);
      const nextExists = await page.$('a[rel="next"], .next:not(.disabled)');
      if (!nextExists) break;

      pageIndex++;
    }

    console.log(`Total members scraped from listings: ${allMembers.length}`);

    // Process member profiles
    const processMember = async (member) => {
      if (!member.profileUrl) return member;
      const detailPage = await browser.newPage();
      try {
        const details = await extractProfileDetails(
          detailPage,
          member.profileUrl
        );
        return { ...member, ...details };
      } catch (error) {
        console.error(`Error processing member ${member.profileUrl}:`, error);
        return member;
      } finally {
        await detailPage.close();
      }
    };

    console.log("Processing member profiles...");
    const processedMembers = await processInBatches(
      allMembers,
      processMember,
      config.CONCURRENCY
    );

    // Log some debug info
    console.log(`Total members before filtering: ${processedMembers.length}`);
    const validMembers = processedMembers.filter((m) => m && m.company);
    console.log(`Valid members with company names: ${validMembers.length}`);

    if (validMembers.length === 0) {
      console.error("No valid members found with company names. Raw data:");
      console.log(JSON.stringify(processedMembers, null, 2));
      throw new Error("No valid member data found");
    }

    // Save results
    return saveToCSV(validMembers, config.OUTPUT_FILE);
  } catch (error) {
    console.error("Scraping failed:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeDirectory()
  .then((filename) => {
    if (filename) {
      console.log(`Scraping completed successfully! Data saved to ${filename}`);
    } else {
      console.error("Scraping completed but no data was saved");
    }
  })
  .catch((err) => {
    console.error("Scraping failed:", err);
    process.exit(1);
  });
