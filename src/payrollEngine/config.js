// payrollEngine/config.js
module.exports = {
  taxYear: 2025,

  // Social Security wage base – FILL FROM IRS PUB 15 / OFFICIAL SOURCE
  socialSecurityWageBase: 168600, // example value, confirm for 2025

  socialSecurityRateEmployee: 0.062,
  medicareRateEmployee: 0.0145,

  // You can add more config per pay frequency, etc.
  payFrequenciesPerYear: {
    weekly: 52,
    biweekly: 26,
    semimonthly: 24,
    monthly: 12,
  },
};

