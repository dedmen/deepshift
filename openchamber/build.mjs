// Builds the OpenChamber extension package in openchamber/ from the shared
// sources. The host never compiles TypeScript, so everything the extension
// ships is built here and committed:
//
//   panel/main.js  — esbuild IIFE bundle of panel/main.ts (the panel page plus
//                    @openchamber/sdk and the shared src/ modules inlined)
//   service/main.js — esbuild CJS bundle of service/main.ts (the Work Status
//                    section's status endpoint; the host runs it directly)
//   plugin/gui.cjs — the OpenCode GUI half, built by opencode/build-opencode.mjs
//                    and copied in so one OpenChamber install also registers
//                    the DeepShift OpenCode plugin
//
// Usage: npm run build:openchamber   (from the repository root)

import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// 1. The OpenCode GUI half (same build the standalone opencode/ package uses).
execFileSync(process.execPath, [join(root, 'opencode/build-opencode.mjs')], { stdio: 'inherit' });
cpSync(join(root, 'opencode/gui.cjs'), join(here, 'plugin/gui.cjs'));

// 2. The panel page, bundled into a single classic script (IIFE): the sandboxed
//    iframe loads main.js with a plain <script> tag, so the SDK and the shared
//    schedule/view-model modules are inlined.
await build({
	entryPoints: [join(here, 'panel/main.ts')],
	outfile: join(here, 'panel/main.js'),
	bundle: true,
	format: 'iife',
	platform: 'browser',
	target: 'es2020',
	sourcemap: false,
	logLevel: 'silent',
});

// 3. The Work Status service, one CJS file the host node runs directly.
await build({
	entryPoints: [join(here, 'service/main.ts')],
	outfile: join(here, 'service/main.js'),
	bundle: true,
	format: 'cjs',
	platform: 'node',
	target: 'node18',
	sourcemap: false,
	logLevel: 'silent',
});

console.log('openchamber/panel/main.js  +  service/main.js  +  plugin/gui.cjs  built');
