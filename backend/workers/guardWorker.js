module.exports = {
  execute: async (job) => {
    // 1. Extract the evidence and the rules from the payload
    const { currentValue, targetValue, condition, emailTo, metricName } = job.payload;

    console.log(`[Guard] 🛡️ Evaluating ${metricName}: Is ${currentValue} ${condition} ${targetValue}?`);

    // 2. Sanitize data (Strip all currency symbols, commas, and letters before parsing)
    // This makes the Guard bulletproof against formats like "₹5,200.00" or "$45.99"
    const cleanCurrent = String(currentValue).replace(/[^\d.-]/g, '');
    const cleanTarget = String(targetValue).replace(/[^\d.-]/g, '');

    const current = parseFloat(cleanCurrent);
    const target = parseFloat(cleanTarget);

    if (isNaN(current) || isNaN(target)) {
      throw new Error(`Guard Error: Cannot extract valid numbers from (Current: ${currentValue}, Target: ${targetValue})`);
    }

    let isTriggered = false;

    // 3. The Decision Engine
    switch (condition) {
      case 'less_than':
        isTriggered = current < target;
        break;
      case 'greater_than':
        isTriggered = current > target;
        break;
      case 'equals':
        isTriggered = current === target;
        break;
      default:
        throw new Error(`Guard Error: Unknown condition '${condition}'`);
    }

    // 4. The Verdict
    if (isTriggered) {
      console.log(`[Guard] 🚨 THRESHOLD MET! Requesting email dispatch.`);
      return {
        action: 'trigger_email',
        emailPayload: {
          to: emailTo,
          subject: `Sentinel Alert: ${metricName} is now ${currentValue}`,
          body: `Your alert triggered! ${metricName} is currently ${currentValue} (Condition: ${condition} ${targetValue}).`
        },
        timestamp: new Date()
      };
    }

    console.log(`[Guard] ✅ Condition normal. No action needed.`);
    return {
      action: 'none',
      timestamp: new Date()
    };
  }
};