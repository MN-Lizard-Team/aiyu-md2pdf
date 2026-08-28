import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import {
  PROJECT_ROOT,
  ASSETS_DIR,
  DOCS_DIR,
  BUILD_DIR,
  RESULT_DIR,
  DIAGRAMS_DIR,
  getAssetPath,
  getPreamblePath,
  getMermaidThemePath,
  getPuppeteerConfigPath,
  getReferenceDocxPath,
  randomSuffix,
  createBuildId,
  basenameNoExt,
  isSafeShellArg,
} from '../../src/paths.js';

describe('paths', () => {
  it('PROJECT_ROOT is absolute (equals CWD)', () => {
    expect(path.isAbsolute(PROJECT_ROOT)).toBe(true);
    expect(PROJECT_ROOT).toBe(process.cwd());
  });

  it('ASSETS_DIR is absolute and ends with assets', () => {
    expect(path.isAbsolute(ASSETS_DIR)).toBe(true);
    expect(path.basename(ASSETS_DIR)).toBe('assets');
  });

  it('ASSETS_DIR points to the package assets (contains preamble.tex)', () => {
    expect(fs.existsSync(path.join(ASSETS_DIR, 'preamble.tex'))).toBe(true);
  });

  it('DOCS_DIR is under CWD/docs', () => {
    expect(DOCS_DIR).toBe(path.join(PROJECT_ROOT, 'docs'));
  });

  it('BUILD_DIR is under CWD/build', () => {
    expect(BUILD_DIR).toBe(path.join(PROJECT_ROOT, 'build'));
  });

  it('DIAGRAMS_DIR is under RESULT_DIR/diagrams', () => {
    expect(DIAGRAMS_DIR).toBe(path.join(RESULT_DIR, 'diagrams'));
  });

  it('getAssetPath joins ASSETS_DIR + name', () => {
    expect(getAssetPath('preamble.tex')).toBe(path.join(ASSETS_DIR, 'preamble.tex'));
  });

  it('getPreamblePath returns assets/preamble.tex', () => {
    expect(getPreamblePath()).toBe(path.join(ASSETS_DIR, 'preamble.tex'));
  });

  it('getMermaidThemePath returns assets/mermaid-theme.txt', () => {
    expect(getMermaidThemePath()).toBe(path.join(ASSETS_DIR, 'mermaid-theme.txt'));
  });

  it('getPuppeteerConfigPath returns assets/puppeteer-config.json', () => {
    expect(getPuppeteerConfigPath()).toBe(path.join(ASSETS_DIR, 'puppeteer-config.json'));
  });

  it('getReferenceDocxPath returns assets/reference.docx', () => {
    expect(getReferenceDocxPath()).toBe(path.join(ASSETS_DIR, 'reference.docx'));
  });
});

describe('randomSuffix', () => {
  it('generates a string of the requested length', () => {
    expect(randomSuffix(6)).toHaveLength(6);
    expect(randomSuffix(8)).toHaveLength(8);
  });

  it('uses only lowercase + digits', () => {
    expect(randomSuffix(20)).toMatch(/^[a-z0-9]+$/);
  });

  it('generates different values on successive calls', () => {
    const a = randomSuffix(12);
    const b = randomSuffix(12);
    expect(a).not.toBe(b);
  });
});

describe('createBuildId', () => {
  it('creates unique non-empty identifiers', () => {
    const first = createBuildId();
    const second = createBuildId();
    expect(first).toMatch(/^\d+-\d+-[a-f0-9]+$/);
    expect(first).not.toBe(second);
  });
});

describe('shell arguments', () => {
  it('rejects command metacharacters and control characters', () => {
    expect(isSafeShellArg('normal/path.md')).toBe(true);
    expect(isSafeShellArg('bad & command.md')).toBe(false);
    expect(isSafeShellArg('bad\ncommand.md')).toBe(false);
  });
});

describe('basenameNoExt', () => {
  it('strips .md extension', () => {
    expect(basenameNoExt('docs/file.md')).toBe('file');
  });

  it('strips any extension', () => {
    expect(basenameNoExt('/path/to/document.txt')).toBe('document');
  });

  it('handles files with no extension', () => {
    expect(basenameNoExt('README')).toBe('README');
  });

  it('handles dotfiles', () => {
    expect(basenameNoExt('.gitignore')).toBe('.gitignore');
  });
});
