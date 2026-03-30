const { Resend } = require('resend');

// Initialize Resend using the key from your .env
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = {
  execute: async (job) => {
    const { to, subject, body } = job.payload;

    // 🛡️ Fail-Fast Validation
    if (!to || !subject || !body) {
      throw new Error("Missing required email fields (to, subject, or body).");
    }

    console.log(`[Email-Worker] Dispatching email to: ${to}`);

    try {
      const { data, error } = await resend.emails.send({
        from: 'Sentinel Alerts <onboarding@resend.dev>', // Resend testing default
        to: [to], // Resend expects an array
        subject: subject,
        text: body,
      });

      if (error) {
        // This explicitly triggers the exponential backoff in worker.js
        throw new Error(`Resend API Error: ${error.message}`);
      }

      console.log(`[Email-Worker] ✅ Email dispatched successfully (ID: ${data?.id})`);

      // This is saved to MongoDB as 'lastResult' for the React Dashboard
      return { 
        success: true,
        resendId: data?.id, 
        sentAt: new Date() 
      };

    } catch (err) {
      console.error(`[Email-Worker] ❌ Failed: ${err.message}`);
      throw err; 
    }
  }
};