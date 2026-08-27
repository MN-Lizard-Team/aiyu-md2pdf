import fs from 'node:fs';
import path from 'node:path';
import {
  PROJECT_ROOT, ASSETS_DIR, DOCS_DIR, BUILD_DIR, RESULT_DIR, OUTPUT_DIR, DIAGRAMS_DIR,
  getPreamblePath, getMermaidThemePath, getPuppeteerConfigPath, getReferenceDocxPath,
  ensureDirs, basenameNoExt,
} from './paths.js';
import { parseDocument, latexEscape } from './yaml.js';
import { checkDeps } from './deps.js';
import { renderMermaid, findLatestDiagrams } from './mermaid.js';
import { writeTempPreamble, buildPdf, buildDocx } from './pandoc.js';

/**
 * Find all .md files under docs/ (recursive, sorted).
 */
function findInputFiles(docsDir) {
  const results = [];
  if (!fs.existsSync(docsDir)) return results;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) results.push(full);
    }
  }
  walk(docsDir);
  return results.sort();
}

/**
 * Build one markdown file → PDF + DOCX.
 * Returns { pdf: bool, docx: bool, outputDir: string }.
 */
function buildOne(sourceMd, opts) {
  const { noMermaid, keepMermaid } = opts;
  const basename = basenameNoExt(sourceMd);
  const tempMd = path.join(BUILD_DIR, `${basename}-rendered.md`);

  // Diagrams go to result/diagrams/{basename}/ (flat, overwrites previous)
  // PDF + DOCX go to result/output/ (flat, easy to find)
  const docDiagramsDir = path.join(DIAGRAMS_DIR, basename);
  fs.mkdirSync(docDiagramsDir, { recursive: true });

  const outputPdf = path.join(OUTPUT_DIR, `${basename}.pdf`);
  const outputDocx = path.join(OUTPUT_DIR, `${basename}.docx`);

  console.log('');
  console.log('==========================================');
  console.log(`  Building: ${basename}`);
  console.log(`  PDF:      ${outputPdf}`);
  console.log(`  DOCX:     ${outputDocx}`);
  console.log(`  Diagrams: ${docDiagramsDir}`);
  console.log('==========================================');

  // Parse frontmatter + escape for LaTeX
  const raw = fs.readFileSync(sourceMd, 'utf-8');
  const doc = parseDocument(raw, basename);
  const fields = {
    title: latexEscape(doc.title),
    subtitle: latexEscape(doc.subtitle),
    author: latexEscape(doc.author),
    date: latexEscape(doc.date),
    document: latexEscape(doc.document),
  };

  console.log(`  Title:    ${doc.title}`);
  console.log(`  Subtitle: ${doc.subtitle}`);
  console.log(`  Author:   ${doc.author}`);

  // Stage 2: Mermaid
  let renderedContent = raw;
  let activeDiagramsDir = docDiagramsDir;

  if (noMermaid) {
    console.log('[2/6] Skipping Mermaid rendering (--no-mermaid)');
    const latest = findLatestDiagrams(DIAGRAMS_DIR, basename);
    if (latest) {
      activeDiagramsDir = latest;
      console.log(`  → Reusing diagrams from: ${latest}`);
    } else {
      console.log(`  ⚠ No existing diagrams found for ${basename}; PDF may miss images`);
    }
    // Strip mermaid blocks (replace with image refs to reused dir)
    renderedContent = raw;
  } else {
    console.log(`[2/6] Rendering Mermaid diagrams for ${basename}...`);
    const result = renderMermaid(raw, {
      assetsDir: docDiagramsDir,
      themePath: getMermaidThemePath(),
      puppeteerConfigPath: getPuppeteerConfigPath(),
      filePrefix: basename,
      tempMdPath: tempMd,
    });
    renderedContent = result.content;
  }

  fs.writeFileSync(tempMd, renderedContent, 'utf-8');

  // Temp preamble
  const tempPreamble = writeTempPreamble(BUILD_DIR, basename, fields);

  // Stage 3: PDF
  console.log('[3/6] Building PDF with pandoc + xelatex...');
  const pdfResult = buildPdf({
    tempMd,
    outputPdf,
    preamblePath: getPreamblePath(),
    tempPreamblePath: tempPreamble,
    buildDir: BUILD_DIR,
    diagramsDir: DIAGRAMS_DIR,
    scriptDir: PROJECT_ROOT,
    basename,
  });

  let pdfOk = false;
  if (pdfResult.success) {
    console.log(`  ✓ PDF generated: ${outputPdf}`);
    pdfOk = true;
  } else {
    console.error(`ERROR: pandoc failed (exit ${pdfResult.exitCode}). See ${path.join(BUILD_DIR, 'pandoc.log')}`);
    console.error(pdfResult.log.split('\n').slice(-20).join('\n'));
    throw new Error(`PDF build failed for ${basename}`);
  }

  // Stage 4: DOCX
  console.log('[4/6] Building Word (.docx) with pandoc...');
  const docxResult = buildDocx({
    tempMd,
    outputDocx,
    referenceDocxPath: getReferenceDocxPath(),
    buildDir: BUILD_DIR,
    diagramsDir: DIAGRAMS_DIR,
    scriptDir: PROJECT_ROOT,
  });

  let docxOk = false;
  if (docxResult.success) {
    console.log(`  ✓ DOCX generated: ${outputDocx}`);
    docxOk = true;
  } else if (docxResult.skipped) {
    console.log('  ⚠ No reference.docx found, skipping DOCX');
  } else {
    console.log(`  ⚠ DOCX build failed (non-fatal, exit ${docxResult.exitCode})`);
  }

  // Cleanup .mmd
  if (!keepMermaid) {
    for (const f of fs.readdirSync(activeDiagramsDir)) {
      if (f.endsWith('.mmd')) fs.unlinkSync(path.join(activeDiagramsDir, f));
    }
  }

  return { pdf: pdfOk, docx: docxOk, outputPdf, outputDocx, diagramsDir: docDiagramsDir };
}

/**
 * Main build entry point.
 * @param {object} opts - { files: string[], noMermaid: bool, keepMermaid: bool }
 * @returns { totalPdfs: number, totalDocx: number }
 */
export function build(opts = {}) {
  const { files, noMermaid = false, keepMermaid = false } = opts;

  ensureDirs();

  console.log('==========================================');
  console.log('  Markdown → PDF + Word Builder');
  console.log('==========================================');
  console.log('');

  // Stage 1: Check tools
  console.log('[1/6] Checking tools...');
  const { missing, found } = checkDeps();
  if (missing.length > 0) {
    console.error(`ERROR: Missing tools: ${missing.join(', ')}`);
    console.error('Run: npm install  (for mmdc) or install pandoc/xelatex system-wide');
    throw new Error(`Missing dependencies: ${missing.join(', ')}`);
  }
  for (const [name, ver] of Object.entries(found)) {
    console.log(`  ✓ ${name.padEnd(10)} ${ver}`);
  }
  console.log('');

  // Resolve input files
  let inputFiles = files && files.length > 0 ? files : findInputFiles(DOCS_DIR);
  if (inputFiles.length === 0) {
    console.error(`ERROR: No markdown files found in ${DOCS_DIR}/`);
    throw new Error('No input files');
  }

  let totalPdfs = 0;
  let totalDocx = 0;

  for (const sourceMd of inputFiles) {
    if (!fs.existsSync(sourceMd)) {
      console.error(`ERROR: File not found: ${sourceMd}`);
      continue;
    }
    const result = buildOne(sourceMd, { noMermaid, keepMermaid });
    if (result.pdf) totalPdfs++;
    if (result.docx) totalDocx++;
  }

  // Stage 5: Summary
  console.log('');
  console.log('[5/6] Build summary');
  console.log('==========================================');
  console.log('  BUILD COMPLETE');
  console.log('==========================================');
  console.log(`  PDFs:  ${totalPdfs}`);
  console.log(`  DOCX:  ${totalDocx}`);
  console.log('');
  console.log(`  Output files in: ${OUTPUT_DIR}/`);
  console.log(`  Diagrams in:     ${DIAGRAMS_DIR}/`);
  console.log('==========================================');

  // Stage 6: Cleanup
  console.log('');
  console.log('[6/6] Cleanup');
  if (!keepMermaid) {
    cleanupMmd(DIAGRAMS_DIR);
    console.log('  ✓ Cleaned .mmd source files');
  } else {
    console.log('  ✓ Kept .mmd source files (--keep-mermaid)');
  }

  return { totalPdfs, totalDocx };
}

function cleanupMmd(dir) {
  if (!fs.existsSync(dir)) return;
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.mmd')) fs.unlinkSync(full);
    }
  }
  walk(dir);
}
