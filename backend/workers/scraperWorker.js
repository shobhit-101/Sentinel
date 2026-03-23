const axios = require('axios');
const cheerio = require('cheerio');
const UserAgent = require('user-agents');

module.exports = {
  execute: async (job) => {
    const { url, selector, label = "Data" } = job.payload;
    
    // Generates a new, real-world browser signature for every run
    const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();

    console.log(`[Scrape-Worker] Investigating: ${url}`);

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.google.com/',
          'DNT': '1' // "Do Not Track" signal
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const extractedText = $(selector).text().trim();

      if (!extractedText) {
        throw new Error(`Selector "${selector}" returned no data. Site might have dynamic JS content.`);
      }

      // Pro Tip: Remove currency symbols and commas so the Guard can read it as a number
      const cleanValue = extractedText.replace(/[^\d.-]/g, '');

      console.log(`[Scrape-Worker] 🎯 Captured ${label}: ${extractedText}`);

      return {
        value: cleanValue, // Numeric value for the Guard
        originalText: extractedText,
        source: "web_scraper",
        timestamp: new Date()
      };

    } catch (err) {
      if (err.response?.status === 403) {
        throw new Error("403 Forbidden: Sentinel was blocked by a bot-bouncer.");
      }
      throw err;
    }
  }
};