import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Generate a temp preamble with document-specific escaped values.
 */
export function writeTempPreamble(buildDir, basename, fields) {
  const tempPreamble = path.join(buildDir, `${basename}-preamble.tex`);
  const lines = [
    '% Auto-generated preamble with document metadata',
    `\\renewcommand{\\docTitle}{${fields.title}}`,
    `\\renewcommand{\\docSubtitle}{${fields.subtitle}}`,
    `\\renewcommand{\\docAuthor}{${fields.author}}`,
    `\\renewcommand{\\docDate}{${fields.date}}`,
    `\\renewcommand{\\docType}{${fields.document}}`,
  ];
  fs.writeFileSync(tempPreamble, lines.join('\n') + '\n', 'utf-8');
  return tempPreamble;
}

/**
 * Build PDF via pandoc + xelatex.
 * Returns { success, output, log }.
 */
export function buildPdf(opts) {
  const {
    tempMd, outputPdf, preamblePath, tempPreamblePath,
    buildDir, diagramsDir, scriptDir, basename,
  } = opts;

  const args = [
    '--from=markdown+yaml_metadata_block+pipe_tables+grid_tables',
    '--to=pdf',
    '--pdf-engine=xelatex',
    '--pdf-engine-opt=-interaction=nonstopmode',
    '--pdf-engine-opt=-halt-on-error',
    '--pdf-engine-opt=-shell-escape',
    `--include-in-header=${preamblePath}`,
    `--include-in-header=${tempPreamblePath}`,
    '--toc',
    '--toc-depth=3',
    '--number-sections',
    '--highlight-style=tango',
    `--resource-path=${buildDir}:${diagramsDir}:${scriptDir}`,
    `--metadata=title:${basename}`,
    '--variable=documentclass:report',
    `--output=${outputPdf}`,
    tempMd,
  ];

  const logPath = path.join(buildDir, 'pandoc.log');
  const shell = process.platform === 'win32';
  const res = spawnSync('pandoc', args, {
    cwd: buildDir,
    shell,
    encoding: 'utf-8',
    timeout: 120000,
  });

  const log = (res.stdout || '') + (res.stderr || '');
  fs.writeFileSync(logPath, log, 'utf-8');

  if (res.status !== 0) {
    return { success: false, output: outputPdf, log, exitCode: res.status };
  }
  return { success: true, output: outputPdf, log, exitCode: 0 };
}

/**
 * Build DOCX via pandoc + reference.docx.
 * Returns { success, output }.
 */
export function buildDocx(opts) {
  const {
    tempMd, outputDocx, referenceDocxPath,
    buildDir, diagramsDir, scriptDir,
  } = opts;

  if (!fs.existsSync(referenceDocxPath)) {
    return { success: false, output: outputDocx, skipped: true };
  }

  const args = [
    '--from=markdown+yaml_metadata_block+pipe_tables+grid_tables',
    '--to=docx',
    `--reference-doc=${referenceDocxPath}`,
    `--resource-path=${buildDir}:${diagramsDir}:${scriptDir}`,
    `--output=${outputDocx}`,
    tempMd,
  ];

  const shell = process.platform === 'win32';
  const res = spawnSync('pandoc', args, {
    cwd: buildDir,
    shell,
    encoding: 'utf-8',
    timeout: 120000,
  });

  if (res.status !== 0 || !fs.existsSync(outputDocx)) {
    return { success: false, output: outputDocx, exitCode: res.status };
  }
  return { success: true, output: outputDocx, exitCode: 0 };
}
