import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const cloudflareWasmAssetPlugin = require('../scripts/metro-cloudflare-wasm-assets.js') as (asset: Record<string, unknown>) => Record<string, unknown>;

describe('Cloudflare WASM asset routing', () => {
  it('moves Expo SQLite wasm outside node_modules paths', () => {
    const asset = cloudflareWasmAssetPlugin({
      type: 'wasm',
      fileSystemLocation: '/repo/node_modules/expo-sqlite/web/wa-sqlite',
      httpServerLocation: '/_expo/plugins/expo-sqlite/assets/node_modules/expo-sqlite/web/wa-sqlite',
    });

    expect(asset.httpServerLocation).toBe('/wasm/expo-sqlite');
  });

  it('leaves unrelated assets unchanged', () => {
    const input = {
      type: 'png',
      fileSystemLocation: '/repo/assets/icon.png',
      httpServerLocation: '/assets',
    };

    expect(cloudflareWasmAssetPlugin(input)).toEqual(input);
  });
});
