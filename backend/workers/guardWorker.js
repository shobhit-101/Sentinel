module.exports = {
  execute: async (job) => {
    // 1. Extract the evidence and the rules from the payload
    const { currentValue, targetValue, condition, emailTo, metricName } = job.payload;

    // 🛡️ Fail-Fast Validation (Email is NO LONGER required here)
    if (currentValue === undefined || targetValue === undefined || !condition) {
      throw new Error("Guard Error: Missing required payload fields (currentValue, targetValue, condition).");
    }

    const metricLabel = metricName || 'Tracked Metric';
    console.log(`[Guard] 🛡️ Evaluating ${metricLabel}: Is ${currentValue} ${condition} ${targetValue}?`);

    // 2. Sanitize data
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
      case 'none': 
        // 🌟 Preparation for Phase 2: Observer Mode
        return { action: 'none', timestamp: new Date() };
      default:
        throw new Error(`Guard Error: Unknown condition '${condition}'`);
    }

    // 4. The Verdict (With Optional Email Handling)
    if (isTriggered) {
      // Did the user actually ask for an email?
      if (emailTo && emailTo.trim() !== '') {
        console.log(`[Guard] 🚨 THRESHOLD MET! Requesting email dispatch.`);
        return {
          action: 'trigger_email',
          evaluatedCurrent: current, 
          evaluatedTarget: target,   
          emailPayload: {
            to: emailTo,
            subject: `🚨 Sentinel Alert: ${metricLabel} crossed your threshold!`,
            body: `Your Sentinel alert has been triggered.\n\nMetric: ${metricLabel}\nCurrent Value: ${currentValue}\nRule: ${condition.replace('_', ' ')} ${targetValue}\n\nLog in to your dashboard to manage your active monitors.`
          },
          timestamp: new Date()
        };
      } else {
        // Silent Mode! Just log it to the database so it shows on the UI
        console.log(`[Guard] 🚨 THRESHOLD MET! (Silent mode - No email provided).`);
        return {
          action: 'threshold_met_log_only',
          evaluatedCurrent: current, 
          evaluatedTarget: target,
          timestamp: new Date()
        };
      }
    }

    console.log(`[Guard] ✅ Condition normal. No action needed.`);
    return {
      action: 'none',
      evaluatedCurrent: current, 
      evaluatedTarget: target,
      timestamp: new Date()
    };
  }
};