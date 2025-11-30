// src/services/taxCalculator.js

function safeNumber(val) {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
    return Number(val);
  }
  return 0;
}

/**
 * Compute taxes for a single paycheck based on employee settings.
 *
 * Uses:
 *   employee.federalWithholdingRate   (decimal: 0.15 = 15%)
 *   employee.stateWithholdingRate     (decimal: 0.05 = 5%)
 *   employee.extraWithholdingFederal  (flat $ per check, optional)
 *   employee.extraWithholdingState    (flat $ per check, optional)
 *   employee.exemptFederal            (boolean)
 *   employee.exemptState              (boolean)
 */
function computeTaxesForPaycheck(employee, grossPay) {
  const gross = safeNumber(grossPay);

  const federalRateRaw = safeNumber(employee.federalWithholdingRate);
  const stateRateRaw   = safeNumber(employee.stateWithholdingRate);

  const extraFed  = employee.exemptFederal ? 0 : safeNumber(employee.extraWithholdingFederal);
  const extraState = employee.exemptState ? 0 : safeNumber(employee.extraWithholdingState);

  const federalRate = employee.exemptFederal ? 0 : federalRateRaw;
  const stateRate   = employee.exemptState ? 0 : stateRateRaw;

  const federalIncomeTax = gross * federalRate + extraFed;
  const stateIncomeTax   = gross * stateRate + extraState;

  const SOCIAL_SECURITY_RATE = 0.062;   // 6.2%
  const MEDICARE_RATE        = 0.0145;  // 1.45%

  const socialSecurity = gross * SOCIAL_SECURITY_RATE;
  const medicare       = gross * MEDICARE_RATE;

  const totalTaxes = federalIncomeTax + stateIncomeTax + socialSecurity + medicare;
  const netPay = gross - totalTaxes;

  return {
    federalIncomeTax,
    stateIncomeTax,
    socialSecurity,
    medicare,
    totalTaxes,
    netPay,
  };
}

module.exports = { computeTaxesForPaycheck };
