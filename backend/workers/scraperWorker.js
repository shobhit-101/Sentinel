const puppeteer = require('puppeteer');
const UserAgent = require('user-agents');

module.exports = {
  execute: async (job) => {
    const { url, selector, label = "Data" } = job.payload;
    
    // Check our routing context to know how strict we should be
    const hasGuard = job.payload.guard && job.payload.guard.targetValue !== undefined && job.payload.guard.targetValue !== '';
    const hasAI = job.payload.aiInstructions && job.payload.aiInstructions.trim() !== '';

    console.log(`[Scrape-Worker] 🕵️ Investigating (Stealth Mode): ${url}`);
    
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--blink-settings=imagesEnabled=false'
      ] 
    });

    try {
      const page = await browser.newPage();
      
      const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
      await page.setUserAgent(userAgent);

      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      console.log(`[Scrape-Worker] Waiting for selector: ${selector}...`);
      await page.waitForSelector(selector, { timeout: 15000 });

      const extractedText = await page.$eval(selector, el => el.textContent.trim());

      if (!extractedText) {
        throw new Error(`Selector "${selector}" was found, but it contained no text.`);
      }

      // 🧹 The Buzzsaw (Sanitization)
      const cleanString = extractedText.replace(/[^\d.-]/g, '');
      let numericValue = parseFloat(cleanString);

      // 🧠 Context-Aware Validation
      if (isNaN(numericValue)) {
        // Only crash if we strictly need a number for the Guard and ARE NOT using AI
        if (hasGuard && !hasAI) {
           throw new Error(`Extracted text "${extractedText}" could not be converted to a valid number for threshold comparison.`);
        }
        numericValue = null; // Safe fallback for AI/Observer mode
      }

      console.log(`[Scrape-Worker] 🎯 Captured ${label}: ${hasAI ? 'Raw Text for AI' : '$' + numericValue}`);

      return {
        value: numericValue || extractedText, // Fallback to raw text if it's not a number
        originalText: extractedText,          // Always keep the raw text for the AI bridge
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