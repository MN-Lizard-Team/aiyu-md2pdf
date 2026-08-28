import fs from 'node:fs';
import path from 'node:path';
import {
  PROJECT_ROOT, DOCS_DIR, BUILD_DIR, OUTPUT_DIR, DIAGRAMS_DIR,
  getPreamblePath, getMermaidThemePath, getPuppeteerConfigPath, getReferenceDocxPath,
  ensureDirs, basenameNoExt, createBuildId,
} from './paths.js';
import { parseDocument, latexEscape } from './yaml.js';
import { checkDeps } from './deps.js';
import { renderMermaid, reuseMermaid, findLatestDiagrams } from './mermaid.js';
import { writeTempPreamble, buildPdf, buildDocx } from './pandoc.js';

function findInputFiles(docsDir) {
  const results = [];
  if (!fs.existsSync(docsDir)) return results;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) results.push(full);
    }
  }
  walk(docsDir);
  return results.sort();
}

function cleanupMmdInDir(dir) {
  if (!fs.existsSync(dir)) return 0;
  let failures = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.mmd')) continue;
    try {
      fs.rmSync(path.join(dir, f), { force: true, maxRetries: 3, retryDelay: 500 });
    } catch {
      failures++;
    }
  }
  return failures;
}

function buildOne(sourceMd, opts) {
  const { noMermaid, keepMermaid, buildId } = opts;
  const basename = basenameNoExt(sourceMd);
  const runDir = path.join(BUILD_DIR, buildId, basename);
  const tempMd = path.join(runDir, `${basename}-rendered.md`);
  const docDiagramsDir = path.join(DIAGRAMS_DIR, `${basename}-${buildId}`);
  const outputPdf = path.join(OUTPUT_DIR, `${basename}-${buildId}.pdf`);
  const outputDocx = path.join(OUTPUT_DIR, `${basename}-${buildId}.docx`);

  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(docDiagramsDir, { recursive: true });
  const raw = fs.readFileSync(sourceMd, 'utf-8');
  const doc = parseDocument(raw, basename);
  if (doc.warning) console.warn(`  ⚠ ${doc.warning}`);
  const fields = Object.fromEntries(Object.entries({
    title: doc.title, subtitle: doc.subtitle, author: doc.author,
    date: doc.date, document: doc.document,
  }).map(([key, value]) => [key, latexEscape(value)]));

  console.log('');
  console.log('==========================================');
  console.log(`  Building: ${basename}`);
  console.log(`  PDF:      ${outputPdf}`);
  console.log(`  DOCX:     ${outputDocx}`);
  console.log(`  Diagrams: ${docDiagramsDir}`);
  console.log('==========================================');
  console.log(`  Title:    ${doc.title}`);
  console.log(`  Subtitle: ${doc.subtitle}`);
  console.log(`  Author:   ${doc.author}`);

  let renderedContent = raw;
  let activeDiagramsDir = docDiagramsDir;
  if (noMermaid) {
    console.log('[2/6] Skipping Mermaid rendering (--no-mermaid)');
    activeDiagramsDir = findLatestDiagrams(DIAGRAMS_DIR, basename);
    if (!activeDiagramsDir) throw new Error(`No cached diagrams found for ${basename}`);
    console.log(`  → Reusing diagrams from: ${activeDiagramsDir}`);
    renderedContent = reuseMermaid(raw, {
      assetsDir: activeDiagramsDir, filePrefix: basename, tempMdPath: tempMd,
    }).content;
  } else {
    console.log(`[2/6] Rendering Mermaid diagrams for ${basename}...`);
    renderedContent = renderMermaid(raw, {
      assetsDir: docDiagramsDir, themePath: getMermaidThemePath(),
      puppeteerConfigPath: getPuppeteerConfigPath(), filePrefix: basename, tempMdPath: tempMd,
    }).content;
  }

  fs.writeFileSync(tempMd, renderedContent, 'utf-8');
  const tempPreamble = writeTempPreamble(runDir, basename, fields);
  console.log('[3/6] Building PDF with pandoc + xelatex...');
  const pdfResult = buildPdf({
    tempMd, outputPdf, preamblePath: getPreamblePath(), tempPreamblePath: tempPreamble,
    buildDir: runDir, diagramsDir: activeDiagramsDir, scriptDir: PROJECT_ROOT, basename,
  });
  if (!pdfResult.success) {
    console.error(`ERROR: pandoc failed (exit ${pdfResult.exitCode}). See ${path.join(runDir, 'pandoc.log')}`);
    console.error(pdfResult.log.split('\n').slice(-20).join('\n'));
    throw new Error(`PDF build failed for ${basename}`);
  }
  console.log(`  ✓ PDF generated: ${outputPdf}`);

  console.log('[4/6] Building Word (.docx) with pandoc...');
  const docxResult = buildDocx({
    tempMd, outputDocx, referenceDocxPath: getReferenceDocxPath(), buildDir: runDir,
    diagramsDir: activeDiagramsDir, scriptDir: PROJECT_ROOT,
  });
  if (docxResult.success) console.log(`  ✓ DOCX generated: ${outputDocx}`);
  else if (docxResult.skipped) console.log('  ⚠ No reference.docx found, skipping DOCX');
  else console.log(`  ⚠ DOCX build failed (non-fatal, exit ${docxResult.exitCode})`);

  const cleanupFailures = keepMermaid ? 0 : cleanupMmdInDir(docDiagramsDir);
  return {
    pdf: true, docx: docxResult.success, outputPdf, outputDocx,
    diagramsDir: docDiagramsDir, cleanupFailures,
  };
}

export function build(opts = {}) {
  const { files, noMermaid = false, keepMermaid = false, strict = false } = opts;
  ensureDirs();
  const inputFiles = files?.length ? files : findInputFiles(DOCS_DIR);
  if (!inputFiles.length) throw new Error(`No markdown files found in ${DOCS_DIR}/`);

  const basenames = inputFiles.map(basenameNoExt);
  const duplicates = basenames.filter((name, i) => basenames.indexOf(name) !== i);
  if (duplicates.length) throw new Error(`Duplicate output basenames: ${[...new Set(duplicates)].join(', ')}`);

  const { missing, found } = checkDeps();
  if (missing.length) throw new Error(`Missing dependencies: ${missing.join(', ')}`);
  console.log('==========================================');
  console.log('  Markdown → PDF + Word Builder');
  console.log('==========================================');
  console.log('[1/6] Checking tools...');
  for (const [name, version] of Object.entries(found)) console.log(`  ✓ ${name.padEnd(10)} ${version}`);

  const buildId = createBuildId();
  let totalPdfs = 0;
  let totalDocx = 0;
  let cleanupFailures = 0;
  for (const sourceMd of inputFiles) {
    if (!fs.existsSync(sourceMd)) {
      console.error(`ERROR: File not found: ${sourceMd}`);
      continue;
    }
    const result = buildOne(sourceMd, { noMermaid, keepMermaid, buildId });
    if (result.pdf) totalPdfs++;
    if (result.docx) totalDocx++;
    cleanupFailures += result.cleanupFailures;
  }

  console.log('');
  console.log('[5/6] Build summary');
  console.log('==========================================');
  console.log('  BUILD COMPLETE');
  console.log('==========================================');
  console.log(`  PDFs:  ${totalPdfs}`);
  console.log(`  DOCX:  ${totalDocx}`);
  console.log(`  Output files in: ${OUTPUT_DIR}/`);
  console.log(`  Diagrams in:     ${DIAGRAMS_DIR}/`);
  console.log('');
  console.log('[6/6] Cleanup');
  if (keepMermaid) console.log('  ✓ Kept .mmd source files (--keep-mermaid)');
  else if (cleanupFailures) console.log(`  ⚠ Could not remove ${cleanupFailures} intermediate file(s)`);
  else console.log('  ✓ Cleaned .mmd source files');
  if (strict && totalDocx < totalPdfs) {
    throw new Error('Strict mode: one or more DOCX files failed to build');
  }
  return { totalPdfs, totalDocx, buildId };
}
