import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from '../src/index.js';
import { OUTPUT_DIR, DIAGRAMS_DIR } from '../src/paths.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// __dirname = tests/ , fixtures live in tests/fixtures/
const TESTS_ROOT = __dirname;

/**
 * Run a build and return the output directory for the given basename.
 * With the new flat structure, output is at result/output/{basename}.pdf
 */
export function runBuild(opts = {}) {
  return build(opts);
}

function latestMatchingFile(directory, pattern) {
  if (!fs.existsSync(directory)) return null;
  const matches = fs.readdirSync(directory)
    .filter((name) => pattern.test(name))
    .map((name) => ({ name, mtime: fs.statSync(path.join(directory, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return matches.length ? path.join(directory, matches[0].name) : null;
}

export function findLatestOutputDir(basename) {
  const prefix = `${basename}-`;
  const dirs = fs.existsSync(DIAGRAMS_DIR)
    ? fs.readdirSync(DIAGRAMS_DIR)
      .filter((name) => name.startsWith(prefix))
      .filter((name) => fs.statSync(path.join(DIAGRAMS_DIR, name)).isDirectory())
      .filter((name) => fs.existsSync(path.join(DIAGRAMS_DIR, name, '001.png')))
      .map((name) => ({ name, mtime: fs.statSync(path.join(DIAGRAMS_DIR, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
    : [];
  return dirs.length ? path.join(DIAGRAMS_DIR, dirs[0].name) : null;
}

export function getOutputPdfPath(basename) {
  return latestMatchingFile(OUTPUT_DIR, new RegExp(`^${basename}-.*\\.pdf$`));
}

export function getOutputDocxPath(basename) {
  return latestMatchingFile(OUTPUT_DIR, new RegExp(`^${basename}-.*\\.docx$`));
}

export function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected file to exist: ${filePath}`);
  }
}

export function assertFileNotExists(filePath) {
  if (fs.existsSync(filePath)) {
    throw new Error(`Expected file NOT to exist: ${filePath}`);
  }
}

export function assertFileMinSize(filePath, minBytes) {
  assertFileExists(filePath);
  const size = fs.statSync(filePath).size;
  if (size < minBytes) {
    throw new Error(`File ${filePath} is ${size} bytes, expected >= ${minBytes}`);
  }
  return size;
}

export function assertPdfPages(pdfPath, minPages) {
  assertFileExists(pdfPath);
  const res = spawnSync('pdfinfo', [pdfPath], { encoding: 'utf-8', shell: false });
  if (res.status !== 0) {
    throw new Error(`pdfinfo failed for ${pdfPath}: ${res.stderr}`);
  }
  const match = res.stdout.match(/^Pages:\s+(\d+)/m);
  if (!match) {
    throw new Error(`Could not parse page count from pdfinfo output for ${pdfPath}`);
  }
  const pages = parseInt(match[1], 10);
  if (pages < minPages) {
    throw new Error(`PDF ${pdfPath} has ${pages} pages, expected >= ${minPages}`);
  }
  return pages;
}

export function assertDocxHasMedia(docxPath) {
  assertFileExists(docxPath);
  const res = spawnSync('unzip', ['-l', docxPath], { encoding: 'utf-8', shell: false });
  if (res.status !== 0) {
    throw new Error(`unzip failed for ${docxPath}: ${res.stderr}`);
  }
  if (!res.stdout.includes('word/media/')) {
    throw new Error(`DOCX ${docxPath} has no word/media/ directory (no embedded images)`);
  }
  return true;
}

export function countFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return 0;
  const re = new RegExp(pattern);
  return fs.readdirSync(dir).filter(f => re.test(f)).length;
}

export function fixturePath(name) {
  return path.join(TESTS_ROOT, 'fixtures', name);
}
