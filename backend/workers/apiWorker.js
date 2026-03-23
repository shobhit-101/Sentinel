const axios = require('axios');

module.exports = {
  execute: async (job) => {
    const { type, symbol } = job.payload;
    const apiKey = process.env.NINJAS_API_KEY;

    console.log(`[API-Worker] Fetching ${type} data for ${symbol}...`);

    try {
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

      console.log(`[API-Worker] ✅ Captured: ${rawValue}`);
      return { value: rawValue, source: "api_ninjas", timestamp: new Date() };

    } catch (err) {
      console.error(`[API-Worker] ❌ Failed: ${err.message}`);
      throw err; 
    }
  }
};