module.exports = ({ config }) => {
  // Single source of truth: reads version from app.json (or package.json fallback)
  const pkg = require('./package.json');
  const version = config.version || pkg.version || '1.0.0';

  const parts = version.split('.').map((p) => parseInt(p, 10) || 0);
  const major = parts[0] || 0;
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;

  // Standard Android versionCode formula: Major * 10000 + Minor * 100 + Patch
  // Examples:
  //   1.0.0 -> 10000
  //   2.0.1 -> 20001
  //   2.1.0 -> 20100
  const computedVersionCode = major * 10000 + minor * 100 + patch;

  return {
    ...config,
    version,
    android: {
      ...config.android,
      versionCode: computedVersionCode,
    },
  };
};

