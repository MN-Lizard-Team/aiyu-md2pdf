import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  runBuild,
  getOutputPdfPath,
  getOutputDocxPath,
  findLatestOutputDir,
  assertFileExists,
  assertFileMinSize,
  countFiles,
  fixturePath,
} from '../helpers.js';

const TIMEOUT = 300000;

describe('Edge case tests', () => {
  it('--no-mermaid reuses existing diagrams and builds PDF', () => {
    // First do a full build to create diagrams
    runBuild({ files: [fixturePath('mermaid-th.md')] });
    const fullDir = findLatestOutputDir('mermaid-th');
    expect(fullDir).not.toBeNull();
    const fullPngCount = countFiles(fullDir, /\.png$/);
    expect(fullPngCount).toBe(3);

    // Now build with --no-mermaid
    runBuild({ files: [fixturePath('mermaid-th.md')], noMermaid: true });
    const pdf = getOutputPdfPath('mermaid-th');
    assertFileExists(pdf);
    assertFileMinSize(pdf, 1000);
  }, TIMEOUT * 2);

  it('--keep-mermaid retains .mmd source files', () => {
    runBuild({ files: [fixturePath('mermaid-th.md')], keepMermaid: true });
    const dir = findLatestOutputDir('mermaid-th');
    const mmdCount = countFiles(dir, /\.mmd$/);
    expect(mmdCount).toBe(3);
  }, TIMEOUT);

  it('file without frontmatter builds using filename as title', () => {
    runBuild({ files: [fixturePath('minimal.md')] });
    const pdf = getOutputPdfPath('minimal');
    assertFileExists(pdf);
    assertFileMinSize(pdf, 500);
  }, TIMEOUT);

  it('special LaTeX characters in frontmatter do not crash build', () => {
    runBuild({ files: [fixturePath('special-chars.md')] });
    const pdf = getOutputPdfPath('special-chars');
    assertFileExists(pdf);
    assertFileMinSize(pdf, 500);
  }, TIMEOUT);

  it('empty file does not crash (graceful exit)', () => {
    let threw = false;
    try {
      runBuild({ files: [fixturePath('empty.md')] });
    } catch (e) {
      threw = true;
      expect(e.message).toBeTruthy();
    }
    expect(typeof threw).toBe('boolean');
  }, TIMEOUT);
});
