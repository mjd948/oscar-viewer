/*
 * Copies hls.js's prebuilt Web Worker into public/ so the player can load it
 * with `workerPath` instead of hls.js's inline blob-worker bootstrap.
 *
 * The inline path does not survive this project's bundling: hls.js stringifies
 * a bootstrap function, and once webpack has wrapped the module the stringified
 * source references helpers that do not exist in worker scope (a ReferenceError
 * from the blob: URL). hls.js then silently falls back to transmuxing on the
 * main thread, which is what made several video widgets stutter the whole page.
 * `workerPath` loads a real file with `new Worker(url)` and never goes through
 * the bundler at all.
 *
 * Copied at build time rather than committed so the worker can never drift from
 * the installed hls.js version — a mismatch here breaks playback in ways that
 * look like a server problem.
 */
const fs = require('fs');
const path = require('path');

const source = require.resolve('hls.js/dist/hls.worker.js');
const publicDir = path.resolve(__dirname, '..', 'public');
const target = path.join(publicDir, 'hls.worker.js');

fs.mkdirSync(publicDir, {recursive: true});
fs.copyFileSync(source, target);

const {version} = require('hls.js/package.json');
console.log(`[copy-hls-worker] hls.js ${version} worker -> ${path.relative(process.cwd(), target)}`);
