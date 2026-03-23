const Groq = require("groq-sdk");

// Initialize Groq with your API key
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

module.exports = {
  execute: async (job) => {
    const { textToSummarize, tone = "professional" } = job.payload;

    console.log(`[Summary] Using Groq (Llama 3) to process summary...`);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that provides ${tone} summaries. Use exactly 3 bullet points.`,
        },
        {
          role: "user",
          content: textToSummarize,
        },
      ],
      model: "llama-3.3-70b-versatile", // This is the "Goldilocks" model: fast & smart
      temperature: 0.5,
      max_tokens: 500,
    });

    const summary = chatCompletion.choices[0]?.message?.content || "";

    return {
      summary,
      modelUsed: "llama-3.3-70b-versatile",
      provider: "Groq",
      timestamp: new Date(),
    };
  }
};