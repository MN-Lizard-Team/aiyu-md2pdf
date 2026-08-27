import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MERMAID_BLOCK_RE = /```mermaid\r?\n([\s\S]*?)```/g;

/**
 * Build a map of mermaid block start positions → nearest preceding heading.
 */
function buildHeadingMap(content) {
  const lines = content.split('\n');
  const starts = {};
  let currentHeading = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) currentHeading = hm[2].trim();
    if (line.trim() === '```mermaid') starts[i] = currentHeading;
  }
  return starts;
}

/**
 * Generate a caption from the nearest bold label or heading.
 */
function findCaption(content, matchStart, mermaidStarts) {
  const beforeText = content.slice(0, matchStart).trimEnd();
  const beforeLines = beforeText.split('\n').slice(-5);

  for (let i = beforeLines.length - 1; i >= 0; i--) {
    const bl = beforeLines[i].trim();
    const boldMatch = bl.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (boldMatch) {
      let cap = boldMatch[1].trim();
      if (boldMatch[2]) cap += ' — ' + boldMatch[2].trim();
      return cap.replace(/\*\*(.+?)\*\*/g, '$1').trim();
    }
    if (bl && bl.endsWith(':') && !bl.startsWith('#') && !bl.startsWith('|') && !bl.startsWith('-')) {
      return bl.replace(/[:\s]+$/, '').replace(/\*\*(.+?)\*\*/g, '$1').trim();
    }
  }

  // Fall back to nearest heading
  const lineIdx = beforeText.split('\n').length - 1;
  let closest = null;
  for (const startIdx of Object.keys(mermaidStarts).map(Number).sort((a, b) => a - b)) {
    if (startIdx <= lineIdx) closest = startIdx;
  }
  if (closest !== null) {
    return mermaidStarts[closest].replace(/\*\*(.+?)\*\*/g, '$1').trim();
  }
  return '';
}

/**
 * Render a single mermaid block to PNG + SVG.
 * Returns { imgPath, svgPath } or throws on failure.
 */
function renderOne(code, idx, assetsDir, themePrefix, puppeteerConfig, filePrefix) {
  const imgName = `${String(idx).padStart(3, '0')}.png`;
  const svgName = `${String(idx).padStart(3, '0')}.svg`;
  const imgPath = path.join(assetsDir, imgName);
  const svgPath = path.join(assetsDir, svgName);
  const mmdPath = path.join(assetsDir, `${String(idx).padStart(3, '0')}.mmd`);

  const fullCode = themePrefix ? themePrefix + '\n' + code : code;
  fs.writeFileSync(mmdPath, fullCode, 'utf-8');

  console.log(`  → Rendering ${filePrefix}/${String(idx).padStart(3, '0')} (PNG + SVG)...`);

  const shell = process.platform === 'win32';
  const pngRes = spawnSync('mmdc', [
    '-i', mmdPath, '-o', imgPath,
    '-w', '3200', '-H', '2400', '-b', 'white',
    '-p', puppeteerConfig, '--scale', '3',
  ], { timeout: 60000, shell, encoding: 'utf-8' });

  if (pngRes.status !== 0 || !fs.existsSync(imgPath)) {
    throw new Error(`PNG render failed for ${filePrefix}-${String(idx).padStart(3, '0')}: ${(pngRes.stderr || '').slice(0, 500)}`);
  }

  const svgRes = spawnSync('mmdc', [
    '-i', mmdPath, '-o', svgPath,
    '-b', 'white', '-p', puppeteerConfig,
  ], { timeout: 60000, shell, encoding: 'utf-8' });

  if (svgRes.status !== 0) {
    console.error(`    ⚠ SVG render failed for ${filePrefix}-${String(idx).padStart(3, '0')}`);
  }

  return { imgPath, svgPath };
}

/**
 * Render all mermaid blocks in content to images.
 * Returns { content: renderedMarkdown, count }.
 *
 * @param {string} content - markdown source
 * @param {object} opts - { assetsDir, themePath, puppeteerConfigPath, filePrefix, tempMdPath }
 */
export function renderMermaid(content, opts) {
  const { assetsDir, themePath, puppeteerConfigPath, filePrefix, tempMdPath } = opts;

  let themePrefix = '';
  if (fs.existsSync(themePath)) {
    themePrefix = fs.readFileSync(themePath, 'utf-8').trim();
  }

  const mermaidStarts = buildHeadingMap(content);
  let count = 0;

  const rendered = content.replace(MERMAID_BLOCK_RE, (match, code, offset) => {
    count++;
    const idx = count;
    const { imgPath } = renderOne(
      code.trim(), idx, assetsDir, themePrefix, puppeteerConfigPath, filePrefix,
    );
    const caption = findCaption(content, offset, mermaidStarts);
    const relPath = path.relative(path.dirname(tempMdPath), imgPath);
    return caption
      ? `\n![${caption}](${relPath})\n`
      : `\n![](${relPath})\n`;
  });

  console.log(`  ✓ Rendered ${count} mermaid diagrams for ${filePrefix}`);
  return { content: rendered, count };
}

/**
 * Find the existing diagram folder for a basename.
 * With the new flat structure, diagrams are at diagramsDir/{basename}/ directly.
 * Returns the diagram dir path or null.
 */
export function findLatestDiagrams(diagramsDir, basename) {
  const dir = path.join(diagramsDir, basename);
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    return dir;
  }
  return null;
}
