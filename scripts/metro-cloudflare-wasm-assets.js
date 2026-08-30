module.exports = function cloudflareWasmAssetPlugin(asset) {
  if (
    asset?.type === 'wasm' &&
    typeof asset.fileSystemLocation === 'string' &&
    asset.fileSystemLocation.includes('expo-sqlite')
  ) {
    return {
      ...asset,
      // Cloudflare Pages automatically excludes static files under any
      // node_modules path. Expo SQLite normally exports its wasm under a
      // node_modules-containing URL, so rewrite just this asset to a clean
      // top-level path that Pages will upload.
      httpServerLocation: '/wasm/expo-sqlite',
    };
  }

  return asset;
};
