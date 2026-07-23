const { withAppBuildGradle } = require("expo/config-plugins");

const releaseConfig = `        release {
            if (System.getenv('HAZI_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('HAZI_UPLOAD_STORE_FILE'))
                storePassword System.getenv('HAZI_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('HAZI_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('HAZI_UPLOAD_KEY_PASSWORD')
            }
        }
`;

module.exports = function withHaziAndroidSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let source = mod.modResults.contents;

    if (!source.includes("HAZI_UPLOAD_STORE_FILE")) {
      source = source.replace("    signingConfigs {\n", `    signingConfigs {\n${releaseConfig}`);
    }

    source = source.replace(
      /release \{(\s*\/\/ Caution![\s\S]*?)signingConfig signingConfigs\.debug/,
      "release {$1signingConfig System.getenv('HAZI_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );

    mod.modResults.contents = source;
    return mod;
  });
};
