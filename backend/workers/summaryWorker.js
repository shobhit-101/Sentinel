const Groq = require("groq-sdk");

// Initialize Groq with your API key
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

module.exports = {
  execute: async (job) => {
    // Support either direct input OR chained input from the Scraper (sourceText)
    const textToProcess = job.payload.textToSummarize || job.payload.sourceText;

    // The user's custom instructions, or a universal fallback. Free-form:
    // whatever the prompt asks for is what gets returned and emailed verbatim.
    const instructions = job.payload.aiInstructions
      || "You are a helpful assistant. Summarize the following text in 3 concise bullet points.";

    console.log(`[AI-Worker] Processing data with Groq (Llama 3.3)...`);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: textToProcess },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 1024,
    });

    const response = chatCompletion.choices[0]?.message?.content?.trim() || "(no response)";

    console.log(`[AI-Worker] ✅ AI processing complete.`);

    return {
      response,
      modelUsed: "llama-3.3-70b-versatile",
      timestamp: new Date(),
    };
  }
};
