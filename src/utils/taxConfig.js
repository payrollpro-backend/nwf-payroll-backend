// utils/taxConfig.js

// Simple default tax config by state.
// These are flat % placeholders — have a CPA help tune them for production.
const STATE_TAX_CONFIG = {
  DEFAULT: {
    federalRate: 0.18, // 18% default federal withholding
    stateRate: 0.05,   // 5% default state tax
  },

  // No state income tax states (stateRate = 0)
  FL: { stateRate: 0.0 }, // Florida
  TX: { stateRate: 0.0 }, // Texas
  WA: { stateRate: 0.0 }, // Washington
  NV: { stateRate: 0.0 }, // Nevada
  WY: { stateRate: 0.0 }, // Wyoming
  SD: { stateRate: 0.0 }, // South Dakota
  TN: { stateRate: 0.0 }, // Tennessee
  AK: { stateRate: 0.0 }, // Alaska

  // Example: Georgia
  GA: { stateRate: 0.05 },
  // Add more states or adjust rates as needed...
};

function getTaxDefaultsForState(stateCode) {
  const code = (stateCode || '').toUpperCase();
  const base = STATE_TAX_CONFIG.DEFAULT;
  const stateCfg = STATE_TAX_CONFIG[code] || {};
  return {
    federalRate: stateCfg.federalRate ?? base.federalRate,
    stateRate: stateCfg.stateRate ?? base.stateRate,
  };
}

module.exports = { STATE_TAX_CONFIG, getTaxDefaultsForState };
