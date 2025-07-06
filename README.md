# Ontario Sign Association Member Scraper

A Node.js scraper that extracts member directory data from the Ontario Sign Association website, including detailed contact information from individual member profiles.

## Features

- Scrapes all member listings from the directory
- Visits each member's profile page to gather detailed contact information
- Processes profiles in parallel batches for better performance
- Exports data to a CSV file

## Prerequisites

- Node.js v16 or higher
- npm (comes with Node.js)

## Installation

1. Clone this repository or download the files to your computer
2. Open a terminal in the project directory
3. Install dependencies:

```bash
npm install
```

## Usage

1. Run the scraper:

```bash
npm start
```

2. Wait for the scraper to complete. You'll see progress updates in the console.
3. Once finished, the data will be saved to `ontario_sign_association_members.csv` in the same directory.

## Output

The CSV file will contain the following columns:

- Company Name
- Contact Name
- Phone
- Email
- City
- Province
- Website
- Member Type (e.g., "Owner", "Manager", etc.)

## Performance Notes

- The scraper processes profiles in batches of 5 by default to balance speed and resource usage
- A progress indicator shows the current batch and total number of batches
- Network timeouts are set to prevent hanging on slow pages

## Troubleshooting

If you encounter issues:

1. Check your internet connection
2. Make sure the Ontario Sign Association website is accessible
3. If the scraper fails, you can run it again - it will start fresh
4. For persistent issues, try reducing the `BATCH` size in `scraper.js`
