import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function commandName(command) {
  return process.platform === 'win32' ? `${command}.exe` : command;
}

function resourcePath(...dirs) {
  return dirs.join(path.delimiter);
}

function replaceOutput(tempOutput, output) {
  if (fs.existsSync(output)) fs.rmSync(output, { force: true });
  fs.renameSync(tempOutput, output);
}

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
  fs.writeFileSync(tempPreamble, `${lines.join('\n')}\n`, 'utf-8');
  return tempPreamble;
}

function runPandoc(args, buildDir, logPath) {
  const result = spawnSync(commandName('pandoc'), args, {
    cwd: buildDir,
    encoding: 'utf-8',
    timeout: 120000,
    windowsHide: true,
    shell: process.platform === 'win32',
  });
  const log = `${result.stdout || ''}${result.stderr || ''}`;
  fs.writeFileSync(logPath, log, 'utf-8');
  return { result, log };
}

export function buildPdf(opts) {
  const {
    tempMd, outputPdf, preamblePath, tempPreamblePath,
    buildDir, diagramsDir, scriptDir, basename,
  } = opts;
  const tempOutput = `${outputPdf}.tmp-${process.pid}`;
  const args = [
    '--from=markdown+yaml_metadata_block+pipe_tables+grid_tables',
    '--to=pdf', '--pdf-engine=xelatex',
    '--pdf-engine-opt=-interaction=nonstopmode',
    '--pdf-engine-opt=-halt-on-error',
    '--pdf-engine-opt=-shell-restricted',
    `--include-in-header=${preamblePath}`, `--include-in-header=${tempPreamblePath}`,
    '--toc', '--toc-depth=3', '--number-sections', '--highlight-style=tango',
    `--resource-path=${resourcePath(buildDir, diagramsDir, scriptDir)}`,
    `--metadata=title:${basename}`, '--variable=documentclass:report',
    `--output=${tempOutput}`, tempMd,
  ];
  const { result, log } = runPandoc(args, buildDir, path.join(buildDir, 'pandoc.log'));
  const success = result.status === 0 && fs.existsSync(tempOutput) && fs.statSync(tempOutput).size > 0;
  if (success) replaceOutput(tempOutput, outputPdf);
  else if (fs.existsSync(tempOutput)) fs.rmSync(tempOutput, { force: true });
  return { success, output: outputPdf, log, exitCode: result.status };
}

export function buildDocx(opts) {
  const { tempMd, outputDocx, referenceDocxPath, buildDir, diagramsDir, scriptDir } = opts;
  if (!fs.existsSync(referenceDocxPath)) return { success: false, output: outputDocx, skipped: true };
  const tempOutput = `${outputDocx}.tmp-${process.pid}`;
  const args = [
    '--from=markdown+yaml_metadata_block+pipe_tables+grid_tables', '--to=docx',
    `--reference-doc=${referenceDocxPath}`,
    `--resource-path=${resourcePath(buildDir, diagramsDir, scriptDir)}`,
    `--output=${tempOutput}`, tempMd,
  ];
  const { result } = runPandoc(args, buildDir, path.join(buildDir, 'pandoc-docx.log'));
  const success = result.status === 0 && fs.existsSync(tempOutput) && fs.statSync(tempOutput).size > 0;
  if (success) replaceOutput(tempOutput, outputDocx);
  else if (fs.existsSync(tempOutput)) fs.rmSync(tempOutput, { force: true });
  return { success, output: outputDocx, exitCode: result.status };
}
