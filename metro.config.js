// Learn more: https://docs.expo.dev/guides/customizing-metro
// Required for expo-sqlite on web (wa-sqlite.wasm): https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

module.exports = config;
