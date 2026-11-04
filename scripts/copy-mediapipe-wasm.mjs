// Copies MediaPipe's WebAssembly runtime into public/ so the app serves it itself, at exactly
// the version in package.json. Runs automatically after `pnpm install`.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join(root, 'public', 'mediapipe', 'wasm');

mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log(`Copied MediaPipe wasm to ${to}`);
