const puppeteer = require('puppeteer');
const UserAgent = require('user-agents');

module.exports = {
  execute: async (job) => {
    const { url, selector, label = "Data" } = job.payload;
    
    console.log(`[Scrape-Worker] 🕵️ Investigating (Stealth/Speed Mode): ${url}`);
    
    // 1. Launch browser with optimized performance flags
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu', // Speeds up headless rendering
        '--blink-settings=imagesEnabled=false' // Native image blocking
      ] 
    });

    try {
      const page = await browser.newPage();
      
      // 2. Generate stealth signature
      const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
      await page.setUserAgent(userAgent);

      // 3. 🚀 THE SPEED HACK: Block heavy resources so the page loads instantly
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        // Block images, stylesheets, fonts, and media. Allow scripts (JS), document (HTML), and fetch/xhr (API calls).
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // 4. Navigate (Stop waiting for the network to go idle, just wait for the basic HTML shell)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // 5. The absolute source of truth: Wait exclusively for our specific element to appear
      console.log(`[Scrape-Worker] Waiting for selector: ${selector}...`);
      await page.waitForSelector(selector, { timeout: 15000 });

      // 6. Extract the text
      const extractedText = await page.$eval(selector, el => el.textContent.trim());

      if (!extractedText) {
        throw new Error(`Selector "${selector}" was found, but it contained no text.`);
      }

      // 7. Sanitize and strictly type
      const cleanString = extractedText.replace(/[^\d.-]/g, '');
      const numericValue = parseFloat(cleanString);

      if (isNaN(numericValue)) {
         throw new Error(`Extracted text "${extractedText}" could not be converted to a valid number.`);
      }

      console.log(`[Scrape-Worker] 🎯 Captured ${label}: $${numericValue}`);

      return {
        value: numericValue, 
        originalText: extractedText,
        source: "puppeteer_optimized",
        timestamp: new Date()
      };

    } catch (err) {
      console.error(`[Scrape-Worker] ❌ Failed: ${err.message}`);
      throw err;
    } finally {
      await browser.close();
    }
  }
};