// payrollEngine/states/georgia.js
const { payFrequenciesPerYear } = require("../config");

/**
 * Placeholder GA table, simplified.
 * Real GA tables need to be pulled from GA DOR.
 */
function getGABracketsPerPeriod({ filingStatus, payFrequency }) {
  // Example based on annual GA brackets, converted to per-period.
  const annualBracketsSingle = [
    { min: 0, max: 750, rate: 0.01 },
    { min: 750, max: 2250, rate: 0.02 },
    { min: 2250, max: 3750, rate: 0.03 },
    { min: 3750, max: 5250, rate: 0.04 },
    { min: 5250, max: 7000, rate: 0.05 },
    { min: 7000, max: 0, rate: 0.0575 }, // 0 = no upper bound
  ];

  const perYear = payFrequenciesPerYear[payFrequency];

  const perPeriodBrackets = annualBracketsSingle.map((b) => ({
    min: b.min / perYear,
    max: b.max === 0 ? 0 : b.max / perYear,
    rate: b.rate,
  }));

  return perPeriodBrackets;
}

/**
 * Simplified GA withholding using a bracket method.
 * @param {object} params
 * @param {number} params.grossWagesCurrent
 * @param {string} params.payFrequency
 * @param {string} params.filingStatus
 */
function calculateGATax({
  grossWagesCurrent,
  payFrequency = "biweekly",
  filingStatus = "single",
}) {
  const brackets = getGABracketsPerPeriod({ filingStatus, payFrequency });

  let remaining = grossWagesCurrent;
  let tax = 0;

  for (const b of brackets) {
    const upper = b.max === 0 ? remaining : b.max;
    const lower = b.min;
    if (remaining <= lower) continue;

    const taxableAtThisRate = Math.min(remaining, upper) - lower;
    if (taxableAtThisRate <= 0) continue;

    tax += taxableAtThisRate * b.rate;
  }

  return Math.round(tax * 100) / 100;
}

module.exports = {
  calculateGATax,
};
