import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  runBuild,
  getOutputPdfPath,
  getOutputDocxPath,
  findLatestOutputDir,
  assertFileMinSize,
  assertPdfPages,
  assertDocxHasMedia,
  countFiles,
} from '../helpers.js';

const TIMEOUT = 300000;

describe('Content tests', () => {
  it('example-th PDF has >= 4 pages and >= 50KB', () => {
    runBuild({ files: ['docs/example/example-th.md'] });
    const pdf = getOutputPdfPath('example-th');
    const size = assertFileMinSize(pdf, 50 * 1024);
    const pages = assertPdfPages(pdf, 4);
    expect(pages).toBeGreaterThanOrEqual(4);
    expect(size).toBeGreaterThanOrEqual(50 * 1024);
  }, TIMEOUT);

  it('example-th DOCX has embedded media (diagrams)', () => {
    const docx = getOutputDocxPath('example-th');
    expect(assertDocxHasMedia(docx)).toBe(true);
  }, TIMEOUT);

  it('example-th diagram folder has 3 PNG + 3 SVG, each PNG >= 10KB', () => {
    const dir = findLatestOutputDir('example-th');
    const pngCount = countFiles(dir, /\.png$/);
    const svgCount = countFiles(dir, /\.svg$/);
    expect(pngCount).toBe(3);
    expect(svgCount).toBe(3);
    for (let i = 1; i <= 3; i++) {
      const png = path.join(dir, `${String(i).padStart(3, '0')}.png`);
      assertFileMinSize(png, 10 * 1024);
    }
  }, TIMEOUT);
});
