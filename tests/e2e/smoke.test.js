import { describe, it } from 'vitest';
import {
  runBuild,
  getOutputPdfPath,
  getOutputDocxPath,
  assertFileExists,
  assertFileMinSize,
} from '../helpers.js';

const TIMEOUT = 300000;

describe('Smoke tests', () => {
  it('builds example-th.md → PDF + DOCX exist and are non-empty', () => {
    runBuild({ files: ['docs/example/example-th.md'] });
    const pdf = getOutputPdfPath('example-th');
    const docx = getOutputDocxPath('example-th');
    assertFileExists(pdf);
    assertFileExists(docx);
    assertFileMinSize(pdf, 1000);
    assertFileMinSize(docx, 1000);
  }, TIMEOUT);

  it('builds example-en.md → PDF + DOCX exist and are non-empty', () => {
    runBuild({ files: ['docs/example/example-en.md'] });
    const pdf = getOutputPdfPath('example-en');
    const docx = getOutputDocxPath('example-en');
    assertFileExists(pdf);
    assertFileExists(docx);
    assertFileMinSize(pdf, 1000);
    assertFileMinSize(docx, 1000);
  }, TIMEOUT);
});
