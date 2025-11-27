// Simple flat-rate defaults. Tune with your CPA later.
const STATE_TAX_CONFIG = {
  DEFAULT: {
    federalRate: 0.18, // 18% federal withholding
    stateRate: 0.05,   // 5% state withholding
  },

  // No state income tax
  FL: { stateRate: 0.0 },
  TX: { stateRate: 0.0 },
  WA: { stateRate: 0.0 },
  NV: { stateRate: 0.0 },
  WY: { stateRate: 0.0 },
  SD: { stateRate: 0.0 },
  TN: { stateRate: 0.0 },
  AK: { stateRate: 0.0 },

  // Example: GA
  GA: { stateRate: 0.05 },
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
