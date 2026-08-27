import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// src/ -> package root (where assets/ lives, shipped with the npm package)
const PKG_ROOT = path.resolve(__dirname, '..');

// User-facing directories are relative to CWD so the CLI works from anywhere.
// Assets (preamble, theme, reference.docx) are internal to the package and
// always resolve to PKG_ROOT/assets regardless of CWD.
const CWD = process.cwd();

export const PROJECT_ROOT = CWD;
export const ASSETS_DIR = path.join(PKG_ROOT, 'assets');
export const DOCS_DIR = path.join(CWD, 'docs');
export const BUILD_DIR = path.join(CWD, 'build');
export const RESULT_DIR = path.join(CWD, 'result');
export const OUTPUT_DIR = path.join(RESULT_DIR, 'output');
export const DIAGRAMS_DIR = path.join(RESULT_DIR, 'diagrams');

export function getAssetPath(name) {
  return path.join(ASSETS_DIR, name);
}

export function getPreamblePath() {
  return getAssetPath('preamble.tex');
}

export function getMermaidThemePath() {
  return getAssetPath('mermaid-theme.txt');
}

export function getPuppeteerConfigPath() {
  return getAssetPath('puppeteer-config.json');
}

export function getReferenceDocxPath() {
  return getAssetPath('reference.docx');
}

export function ensureDirs() {
  for (const dir of [BUILD_DIR, OUTPUT_DIR, DIAGRAMS_DIR, RESULT_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function randomSuffix(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function basenameNoExt(filePath) {
  return path.basename(filePath, path.extname(filePath));
}
