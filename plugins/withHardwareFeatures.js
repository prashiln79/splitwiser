const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to mark non-essential hardware features as optional (android:required="false").
 *
 * Resolves Google Play Console availability warnings:
 * - android.hardware.screen.portrait (inferred from orientation: portrait, blocks tablets/desktops/XR)
 * - android.hardware.wifi (inferred from network permissions, blocks non-wifi / XR devices)
 * - android.hardware.camera & camera.autofocus (inferred from CAMERA permission)
 */
module.exports = function withHardwareFeatures(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    if (!androidManifest.manifest['uses-feature']) {
      androidManifest.manifest['uses-feature'] = [];
    }

    const nonEssentialFeatures = [
      'android.hardware.screen.portrait',
      'android.hardware.wifi',
      'android.hardware.camera',
      'android.hardware.camera.autofocus',
    ];

    nonEssentialFeatures.forEach((featureName) => {
      const existing = androidManifest.manifest['uses-feature'].find(
        (item) => item.$ && item.$['android:name'] === featureName
      );

      if (existing) {
        existing.$['android:required'] = 'false';
      } else {
        androidManifest.manifest['uses-feature'].push({
          $: {
            'android:name': featureName,
            'android:required': 'false',
          },
        });
      }
    });

    return config;
  });
};

