const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

config.transformer.assetPlugins = [
  ...(config.transformer.assetPlugins ?? []),
  require.resolve('./scripts/metro-cloudflare-wasm-assets.js'),
];

module.exports = config;
