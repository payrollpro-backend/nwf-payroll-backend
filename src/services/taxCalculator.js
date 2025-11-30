// src/services/taxCalculator.js

/**
 * Safe number helper – if not numeric, treat as 0
 */
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
 * - Uses:
 *   employee.federalWithholdingRate   (decimal: 0.15 = 15%)
 *   employee.stateWithholdingRate     (decimal: 0.05 = 5%)
 *   employee.extraWithholdingFederal  (flat $ per check)
 *   employee.extraWithholdingState    (flat $ per check)
 *   employee.exemptFederal / exemptState (boolean)
 *
 * Returns an object with:
 * - federalIncomeTax
 * - stateIncomeTax
 * - socialSecurityEmployee
 * - medicareEmployee
 * - totalTaxes
 * - netPay
 */
function computeTaxesForPaycheck(employee, grossPay) {
  const gross = safeNumber(grossPay);

  // read settings off employee (with defaults)
  const federalRateRaw = safeNumber(employee.federalWithholdingRate);
  const stateRateRaw   = safeNumber(employee.stateWithholdingRate);

  const extraFed  = employee.exemptFederal ? 0 : safeNumber(employee.extraWithholdingFederal);
  const extraState = employee.exemptState ? 0 : safeNumber(employee.extraWithholdingState);

  const federalRate = employee.exemptFederal ? 0 : federalRateRaw;
  const stateRate   = employee.exemptState ? 0 : stateRateRaw;

  // income tax
  const federalIncomeTax = gross * federalRate + extraFed;
  const stateIncomeTax   = gross * stateRate + extraState;

  // basic FICA (employee side)
  const SOCIAL_SECURITY_RATE = 0.062;  // 6.2%
  const MEDICARE_RATE        = 0.0145; // 1.45%

  const socialSecurityEmployee = gross * SOCIAL_SECURITY_RATE;
  const medicareEmployee       = gross * MEDICARE_RATE;

  const totalTaxes = federalIncomeTax + stateIncomeTax + socialSecurityEmployee + medicareEmployee;
  const netPay = gross - totalTaxes;

  return {
    federalIncomeTax,
    stateIncomeTax,
    socialSecurityEmployee,
    medicareEmployee,
    totalTaxes,
    netPay,
  };
}

module.exports = {
  computeTaxesForPaycheck,
};
