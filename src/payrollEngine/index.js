// payrollEngine/index.js
const { calculateFICA, calculateFederalWithholding } = require("./federal");
const { calculateGATax } = require("./states/georgia");

function round2(num) {
  return Math.round(num * 100) / 100;
}

/**
 * Main payroll calculation for a single paycheck.
 *
 * @param {object} input
 * @param {string} input.employeeId
 * @param {number} input.hours
 * @param {number} input.rate
 * @param {string} input.payFrequency - "weekly"|"biweekly"|"semimonthly"|"monthly"
 * @param {string} input.filingStatus - federal filing status
 * @param {string} input.stateCode - e.g. "GA", "FL"
 * @param {number} [input.ytdSocialSecurityWages]
 * @param {number} [input.preTaxDeductions] - 401k, health, etc.
 */
function calculatePaycheck(input) {
  const {
    employeeId,
    hours,
    rate,
    payFrequency,
    filingStatus,
    stateCode,
    ytdSocialSecurityWages = 0,
    preTaxDeductions = 0,
  } = input;

  const gross = round2(hours * rate);

  // 1) Federal FICA
  const fica = calculateFICA({
    grossWagesCurrent: gross,
    ytdSocialSecurityWages,
  });

  // 2) Federal income tax
  const federalTax = calculateFederalWithholding({
    grossWagesCurrent: gross,
    payFrequency,
    filingStatus,
    preTaxDeductions,
  });

  // 3) State income tax (only GA implemented here)
  let stateTax = 0;
  if (stateCode === "GA") {
    stateTax = calculateGATax({
      grossWagesCurrent: gross,
      payFrequency,
      filingStatus,
    });
  }

  // 4) Total deductions
  const totalDeductions = round2(
    federalTax + fica.socialSecurity + fica.medicare + stateTax
  );

  const netPay = round2(gross - totalDeductions);

  return {
    employeeId,
    gross,
    deductions: {
      federalIncomeTax: federalTax,
      socialSecurity: fica.socialSecurity,
      medicare: fica.medicare,
      stateIncomeTax: stateTax,
      total: totalDeductions,
    },
    netPay,
  };
}

module.exports = {
  calculatePaycheck,
};
