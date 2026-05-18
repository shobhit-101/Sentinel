const puppeteer = require('puppeteer');
const UserAgent = require('user-agents');

// Module-level browser handle. Launching Puppeteer per job cost ~15-20s
// of Chromium boot per scrape and held the memory leak this comment used
// to live with. We now launch once on first call and reuse across jobs;
// each job gets a fresh page from the warm browser (~50-100ms).
const LAUNCH_OPTIONS = {
  headless: "new",
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--blink-settings=imagesEnabled=false'
  ]
};

let browserPromise = null;

async function getBrowser() {
  if (browserPromise) return browserPromise;
  console.log('[Scrape-Worker] Launching shared Puppeteer browser...');
  browserPromise = puppeteer.launch(LAUNCH_OPTIONS)
    .then(b => {
      b.on('disconnected', () => {
        console.log('[Scrape-Worker] Browser disconnected; will relaunch on next call.');
        browserPromise = null;
      });
      return b;
    })
    .catch(err => {
      browserPromise = null;
      throw err;
    });
  return browserPromise;
}

async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch (_) { /* ignore */ }
  browserPromise = null;
}

// Best-effort cleanup on graceful shutdown. SIGKILL (Stop-Process -Force
// on Windows) bypasses this and may orphan the Chromium child process;
// that's a known limitation of forced kills, not a regression from the
// pre-pool code.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => {
    closeBrowser().finally(() => process.exit(0));
  });
}

module.exports = {
  execute: async (job) => {
    const { url, selector, label = "Data" } = job.payload;

    const hasGuard = job.payload.guard && job.payload.guard.targetValue !== undefined && job.payload.guard.targetValue !== '';
    const hasAI = job.payload.aiInstructions && job.payload.aiInstructions.trim() !== '';

    console.log(`[Scrape-Worker] 🕵️ Investigating (Stealth Mode): ${url}`);

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
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
      // Close the page but keep the browser warm for the next job.
      try { await page.close(); } catch (_) { /* ignore */ }
    }
  }
};
