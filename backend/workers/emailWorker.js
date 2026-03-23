const { Resend } = require('resend');

// Initialize Resend using the key from your .env
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = {
  execute: async (job) => {
    const { to, subject, body } = job.payload;

    console.log(`[Resend] Dispatching email to: ${to}`);

    const { data, error } = await resend.emails.send({
      from: 'Sentinel <onboarding@resend.dev>', // Use this default for testing
      to: [to], // Resend expects an array
      subject: subject,
      text: body,
    });

    if (error) {
      // This will trigger your worker's retry/backoff logic!
      throw new Error(`Resend API Error: ${error.message}`);
    }

    return { 
      resendId: data.id, 
      sentAt: new Date() 
    };
  }
};