module.exports = {
  CONCURRENCY: 5,
  NAVIGATION_TIMEOUT: 30000,
  SELECTOR_TIMEOUT: 15000,
  WAIT_UNTIL: "networkidle2",
  BASE_URL: "https://www.ontariosignassociation.com/member-directory",
  OUTPUT_FILE: "ontario_sign_association_members.csv",
  SELECTORS: {
    MEMBER_CARD: 'a[href*="/Sys/PublicProfile/"], .member-card',
    PROFILE_CONTENT: "#idContent",
    PROFILE_HEADER: ".profileHeaderContainer h3",
  },
};
