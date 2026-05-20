const axios = require('axios');

module.exports = {
  execute: async (job) => {
    const { type, symbol } = job.payload;
    const apiKey = process.env.NINJAS_API_KEY;

    console.log(`[API-Worker] Fetching ${type} data...`);

    try {
      // 🌟 CODEFORCES API — list the upcoming contests
      if (type === 'codeforces') {
        const url = 'https://codeforces.com/api/contest.list';
        const response = await axios.get(url);

        if (response.data.status !== 'OK') throw new Error("Codeforces API failed");

        // All not-yet-started contests, soonest first, capped at 10.
        const upcoming = response.data.result
          .filter(c => c.phase === 'BEFORE')
          .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
          .slice(0, 10);

        if (upcoming.length === 0) {
          return { value: "No upcoming Codeforces contests scheduled.", source: "codeforces_api", timestamp: new Date() };
        }

        const tz = job.timezone || 'UTC';
        const lines = upcoming.map(c => {
          const when = new Date(c.startTimeSeconds * 1000).toLocaleString('en-US', {
            timeZone: tz, weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
          const totalMin = Math.round(c.durationSeconds / 60);
          const dur = totalMin >= 60
            ? `${Math.floor(totalMin / 60)}h${totalMin % 60 ? ' ' + (totalMin % 60) + 'm' : ''}`
            : `${totalMin}m`;
          return `• ${c.name}\n  ${when} (${tz}) · ${dur}`;
        });

        const valueString = `${upcoming.length} upcoming contest(s):\n\n${lines.join('\n\n')}`;

        console.log(`[API-Worker] ✅ Captured ${upcoming.length} upcoming Codeforces contests`);
        return { value: valueString, source: "codeforces_api", timestamp: new Date() };
      }

      // 🌟 THE HACK: If the user asks for "binance_gold", use the public crypto API
      if (type === 'binance_gold') {
        const url = 'https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT';
        const response = await axios.get(url);
        
        console.log(`[API-Worker] ✅ Captured Binance PAXG (Gold): $${response.data.price}`);
        return {
          value: parseFloat(response.data.price), 
          source: "binance_public_api",
          timestamp: new Date()
        };
      }

      // 🛡️ The Standard API Ninjas Logic (For Stocks/Crypto)
      if (!apiKey) throw new Error("NINJAS_API_KEY is missing in .env");

      const endpoints = {
        crypto: `https://api.api-ninjas.com/v1/cryptoprice?symbol=${symbol}`,
        stock: `https://api.api-ninjas.com/v1/stockprice?ticker=${symbol}`
      };

      const url = endpoints[type];
      if (!url) throw new Error(`Unsupported API type: ${type}`);

      const response = await axios.get(url, { headers: { 'X-Api-Key': apiKey } });
      const rawValue = response.data.price;

      if (rawValue === undefined || rawValue === null) {
        throw new Error(`API returned no price for symbol: ${symbol}`);
      }

      const numericValue = parseFloat(rawValue);

      console.log(`[API-Worker] ✅ Captured: $${numericValue}`);
      
      return { 
        value: numericValue, 
        source: "api_ninjas", 
        timestamp: new Date() 
      };

    } catch (err) {
      const body = err.response?.data;
      const apiMsg = body?.error || body?.message;
      if (apiMsg && !err.message.includes(apiMsg)) {
        err.message = `${err.message}: ${apiMsg}`;
      }
      console.error(`[API-Worker] ❌ Failed: ${err.message}`);
      throw err;
    }
  }
};