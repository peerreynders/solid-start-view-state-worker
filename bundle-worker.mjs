// file: ./bundle-worker.mjs
import { build } from 'esbuild';

await build({
	entryPoints: ['./src/worker/entry-worker.ts'],
	bundle: true,
	minify: true,
	format: 'iife',
	tsconfig: 'tsconfig.worker.json',
	outfile: './public/view-state-worker.js',
});
