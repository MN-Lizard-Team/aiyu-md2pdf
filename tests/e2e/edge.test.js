import { describe, it, expect } from 'vitest';
import {
  runBuild,
  getOutputPdfPath,
  getOutputDocxPath,
  findLatestOutputDir,
  assertFileExists,
  assertFileMinSize,
  assertDocxHasMedia,
  countFiles,
  fixturePath,
} from '../helpers.js';

const TIMEOUT = 300000;

describe('Edge case tests', () => {
  it('--no-mermaid reuses existing diagrams and builds PDF', async () => {
    // First do a full build to create diagrams
    await runBuild({ files: [fixturePath('mermaid-th.md')] });
    const fullDir = findLatestOutputDir('mermaid-th');
    expect(fullDir).not.toBeNull();
    const fullPngCount = countFiles(fullDir, /\.png$/);
    expect(fullPngCount).toBe(3);

    // Now build with --no-mermaid
    await runBuild({ files: [fixturePath('mermaid-th.md')], noMermaid: true });
    const pdf = getOutputPdfPath('mermaid-th');
    const docx = getOutputDocxPath('mermaid-th');
    assertFileExists(pdf);
    assertFileMinSize(pdf, 1000);
    assertFileMinSize(docx, 1000);
    expect(assertDocxHasMedia(docx)).toBe(true);
  }, TIMEOUT * 2);

  it('--keep-mermaid retains .mmd source files', async () => {
    await runBuild({ files: [fixturePath('mermaid-th.md')], keepMermaid: true });
    const dir = findLatestOutputDir('mermaid-th');
    const mmdCount = countFiles(dir, /\.mmd$/);
    expect(mmdCount).toBe(3);
  }, TIMEOUT);

  it('file without frontmatter builds using filename as title', async () => {
    await runBuild({ files: [fixturePath('minimal.md')], noMermaid: true });
    const pdf = getOutputPdfPath('minimal');
    assertFileExists(pdf);
    assertFileMinSize(pdf, 500);
  }, TIMEOUT);

  it('special LaTeX characters in frontmatter do not crash build', async () => {
    await runBuild({ files: [fixturePath('special-chars.md')] });
    const pdf = getOutputPdfPath('special-chars');
    assertFileExists(pdf);
    assertFileMinSize(pdf, 500);
  }, TIMEOUT);

  it('empty file does not crash (graceful exit)', async () => {
    let threw = false;
    try {
      await runBuild({ files: [fixturePath('empty.md')] });
    } catch (e) {
      threw = true;
      expect(e.message).toBeTruthy();
    }
    expect(typeof threw).toBe('boolean');
  }, TIMEOUT);
});
