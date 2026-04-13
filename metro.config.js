// Learn more: https://docs.expo.dev/guides/customizing-metro
// Required for expo-sqlite on web (wa-sqlite.wasm): https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.resolver.assetExts.push("wasm");

// Metro must watch these packages so it can SHA-1 source files resolved via "react-native" entry
// (e.g. react-native-worklets/src/...). Without this, bundling can fail with "Failed to get the SHA-1".
const extraWatchFolders = [
  "react-native-worklets",
  "react-native-reanimated",
].map((name) => path.resolve(projectRoot, "node_modules", name));
config.watchFolders = [...(config.watchFolders ?? []), ...extraWatchFolders];

module.exports = config;
