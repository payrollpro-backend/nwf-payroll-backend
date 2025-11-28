// payrollEngine/federal.js
const config = require("./config");

/**
 * Simple helper to round to cents consistently
 */
function round2(num) {
  return Math.round(num * 100) / 100;
}

/**
 * FICA – Social Security & Medicare (employee portion)
 * @param {object} params
 * @param {number} params.grossWagesCurrent - current period wages subject to FICA
 * @param {number} params.ytdSocialSecurityWages - year-to-date SS wages BEFORE this check
 */
function calculateFICA({ grossWagesCurrent, ytdSocialSecurityWages }) {
  const {
    socialSecurityWageBase,
    socialSecurityRateEmployee,
    medicareRateEmployee,
  } = config;

  // Social Security
  const remainingSSCap = Math.max(
    0,
    socialSecurityWageBase - (ytdSocialSecurityWages || 0)
  );
  const ssTaxable = Math.min(grossWagesCurrent, remainingSSCap);
  const socialSecurity = round2(ssTaxable * socialSecurityRateEmployee);

  // Medicare – no cap at this level, ignoring Additional Medicare for high earners
  const medicare = round2(grossWagesCurrent * medicareRateEmployee);

  return {
    socialSecurity,
    medicare,
  };
}

/**
 * Placeholder: returns standard deduction per pay period
 * You MUST fill the real values from IRS Pub 15-T for each status & frequency.
 */
function getStandardDeductionPerPeriod({ filingStatus, payFrequency }) {
  const annualStdDeduction = {
    single: 14800, // example for 2025 – confirm
    married: 29600, // example
    head: 21900, // example
  }[filingStatus || "single"];

  const perYear = config.payFrequenciesPerYear[payFrequency];
  return annualStdDeduction / perYear;
}

/**
 * Percentage Method brackets structure:
 * Array of { min, max, baseTax, rate }
 * All per pay-period, AFTER standard deduction.
 * YOU must load actual numbers from Pub 15-T.
 */
function getPercentageBrackets({ filingStatus, payFrequency }) {
  // *** PLACEHOLDER – PUT REAL TABLE HERE ***
  // Example: biweekly, single, 2025-style structure.
  if (payFrequency === "biweekly" && filingStatus === "single") {
    return [
      { min: 0, max: 314, baseTax: 0, rate: 0 },
      { min: 314, max: 1104, baseTax: 0, rate: 0.1 },
      { min: 1104, max: 3763, baseTax: 79, rate: 0.12 },
      { min: 3763, max: 8858, baseTax: 366.52, rate: 0.22 },
      { min: 8858, max: 17162, baseTax: 1495.92, rate: 0.24 },
      { min: 17162, max: 0, baseTax: 3417.52, rate: 0.32 }, // max=0 = no upper bound
    ];
  }

  // Default – must be filled for other combinations
  return [];
}

/**
 * Federal income tax withholding using a simplified Percentage Method.
 * DOES NOT implement every special rule (credits, additional tax, etc.).
 *
 * @param {object} params
 * @param {number} params.grossWagesCurrent
 * @param {string} params.payFrequency - "weekly" | "biweekly" | "semimonthly" | "monthly"
 * @param {string} params.filingStatus - "single" | "married" | "head"
 * @param {number} [params.preTaxDeductions] - 401k, health, etc. (total for this period)
 */
function calculateFederalWithholding({
  grossWagesCurrent,
  payFrequency,
  filingStatus = "single",
  preTaxDeductions = 0,
}) {
  const stdDeductionPerPeriod = getStandardDeductionPerPeriod({
    filingStatus,
    payFrequency,
  });

  const taxableWages = Math.max(
    0,
    grossWagesCurrent - preTaxDeductions - stdDeductionPerPeriod
  );

  const brackets = getPercentageBrackets({ filingStatus, payFrequency });

  if (!brackets.length) {
    // If no table defined, fail closed
    return 0;
  }

  const bracket = brackets.find((b) => {
    if (b.max === 0) {
      return taxableWages > b.min;
    }
    return taxableWages > b.min && taxableWages <= b.max;
  });

  if (!bracket) return 0;

  const amountAboveMin = taxableWages - bracket.min;
  const tax = bracket.baseTax + amountAboveMin * bracket.rate;

  return round2(tax);
}

module.exports = {
  calculateFICA,
  calculateFederalWithholding,
};
