// Builds on app.json. Push notifications on Android need Firebase's google-services.json (see
// https://docs.expo.dev/push-notifications/fcm-credentials/); it's used once it's saved next to this file,
// so builds keep working before then.
const { existsSync } = require("fs");
const { join } = require("path");

module.exports = ({ config }) => {
  const googleServices = join(__dirname, "google-services.json");
  if (!existsSync(googleServices)) return config;

  return { ...config, android: { ...config.android, googleServicesFile: "./google-services.json" } };
};
