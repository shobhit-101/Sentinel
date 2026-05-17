const Groq = require("groq-sdk");

// Initialize Groq with your API key
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

module.exports = {
  execute: async (job) => {
    // 🌟 THE FIX: Support either direct input OR chained input from Scraper (sourceText)
    const textToProcess = job.payload.textToSummarize || job.payload.sourceText;
    
    // The universal fallback prompt, or the user's custom instructions
    const instructions = job.payload.aiInstructions || "You are a helpful assistant. Summarize the text in 3 bullet points. Return a JSON object with a single key 'summary' containing your response.";

    console.log(`[AI-Worker] Processing data with Groq (Llama 3.3)...`);

    // Force JSON output
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          // We append a strict JSON instruction to guarantee parseable output
          content: `${instructions}\n\nIMPORTANT: You must output ONLY valid JSON.` 
        },
        { 
          role: "user", 
          content: textToProcess 
        },
      ],
      model: "llama-3.3-70b-versatile", 
      temperature: 0.2, // Lowered temperature for logic/data extraction reliability
      max_tokens: 1024,
      response_format: { type: "json_object" } // 🌟 The magic flag!
    });

    const rawContent = chatCompletion.choices[0]?.message?.content || "{}";
    let parsedResult = {};
    
    try {
      parsedResult = JSON.parse(rawContent);
    } catch (e) {
      console.error("[AI-Worker] Failed to parse JSON from AI", rawContent);
      parsedResult = { summary: rawContent }; // Safety fallback
    }

    console.log(`[AI-Worker] ✅ AI processing complete.`);

    return {
      ...parsedResult, // Dynamically spread whatever keys the AI generated into the result!
      modelUsed: "llama-3.3-70b-versatile",
      timestamp: new Date(),
    };
  }
};