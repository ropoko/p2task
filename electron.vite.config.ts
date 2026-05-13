import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

import react from '@vitejs/plugin-react';

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()]
	},
	preload: {
		plugins: [externalizeDepsPlugin()]
	},
	renderer: {
		resolve: {
			alias: {
				'@renderer': resolve('src/renderer/src'),
				'@views': resolve('src/views')
			}
		},
		plugins: [wasm(), topLevelAwait(), react()]
	}
});
