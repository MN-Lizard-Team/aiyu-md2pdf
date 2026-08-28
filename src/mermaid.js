import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MERMAID_BLOCK_RE = /```\s*mermaid\s*\r?\n([\s\S]*?)```/gi;

function buildHeadingMap(content) {
  const lines = content.split(/\r?\n/);
  const starts = {};
  let currentHeading = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) currentHeading = heading[2].trim();
    if (/^```\s*mermaid\s*$/i.test(line.trim())) starts[i] = currentHeading;
  }
  return starts;
}

function findCaption(content, matchStart, mermaidStarts) {
  const beforeText = content.slice(0, matchStart).trimEnd();
  const beforeLines = beforeText.split(/\r?\n/).slice(-5);

  for (let i = beforeLines.length - 1; i >= 0; i--) {
    const line = beforeLines[i].trim();
    const boldMatch = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (boldMatch) {
      let caption = boldMatch[1].trim();
      if (boldMatch[2]) caption += ` — ${boldMatch[2].trim()}`;
      return caption.replace(/\*\*(.+?)\*\*/g, '$1').trim();
    }
    if (line && line.endsWith(':') && !line.startsWith('#') && !line.startsWith('|') && !line.startsWith('-')) {
      return line.replace(/[:\s]+$/, '').replace(/\*\*(.+?)\*\*/g, '$1').trim();
    }
  }

  const blockLine = content.slice(0, matchStart).split(/\r?\n/).length;
  return mermaidStarts[blockLine] || mermaidStarts[blockLine - 1] || '';
}

function commandName() {
  return process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc';
}

function renderOne(code, idx, assetsDir, themePrefix, puppeteerConfig, filePrefix) {
  const number = String(idx).padStart(3, '0');
  const imgPath = path.join(assetsDir, `${number}.png`);
  const svgPath = path.join(assetsDir, `${number}.svg`);
  const mmdPath = path.join(assetsDir, `${number}.mmd`);
  const fullCode = themePrefix ? `${themePrefix}\n${code}` : code;

  fs.writeFileSync(mmdPath, fullCode, 'utf-8');
  console.log(`  → Rendering ${filePrefix}/${number} (PNG + SVG)...`);

  const pngRes = spawnSync(commandName(), [
    '-i', mmdPath, '-o', imgPath, '-w', '3200', '-H', '2400', '-b', 'white',
    '-p', puppeteerConfig, '--scale', '3',
  ], { timeout: 60000, encoding: 'utf-8', shell: process.platform === 'win32' });
  if (pngRes.status !== 0 || !fs.existsSync(imgPath) || fs.statSync(imgPath).size === 0) {
    throw new Error(`PNG render failed for ${filePrefix}-${number}: ${(pngRes.stderr || '').slice(0, 500)}`);
  }

  const svgRes = spawnSync(commandName(), [
    '-i', mmdPath, '-o', svgPath, '-b', 'white', '-p', puppeteerConfig,
  ], { timeout: 60000, encoding: 'utf-8', shell: process.platform === 'win32' });
  if (svgRes.status !== 0 || !fs.existsSync(svgPath)) {
    console.error(`    ⚠ SVG render failed for ${filePrefix}-${number}`);
  }
  return { imgPath, svgPath };
}

function markdownPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function replaceBlocks(content, replacement) {
  const headings = buildHeadingMap(content);
  let count = 0;
  const rendered = content.replace(MERMAID_BLOCK_RE, (match, code, offset) => {
    count++;
    return replacement(code.trim(), count, offset, headings);
  });
  return { content: rendered, count };
}

export function renderMermaid(content, opts) {
  const { assetsDir, themePath, puppeteerConfigPath, filePrefix, tempMdPath } = opts;
  const themePrefix = fs.existsSync(themePath) ? fs.readFileSync(themePath, 'utf-8').trim() : '';
  const result = replaceBlocks(content, (code, idx, offset, headings) => {
    const { imgPath } = renderOne(code, idx, assetsDir, themePrefix, puppeteerConfigPath, filePrefix);
    const caption = findCaption(content, offset, headings);
    const relPath = markdownPath(path.relative(path.dirname(tempMdPath), imgPath));
    return caption ? `\n![${caption}](${relPath})\n` : `\n![](${relPath})\n`;
  });
  console.log(`  ✓ Rendered ${result.count} mermaid diagrams for ${filePrefix}`);
  return result;
}

export function reuseMermaid(content, opts) {
  const { assetsDir, filePrefix, tempMdPath } = opts;
  const result = replaceBlocks(content, (code, idx, offset, headings) => {
    const number = String(idx).padStart(3, '0');
    const imgPath = path.join(assetsDir, `${number}.png`);
    if (!fs.existsSync(imgPath) || fs.statSync(imgPath).size === 0) {
      throw new Error(`Missing cached Mermaid image for ${filePrefix}-${number}: ${imgPath}`);
    }
    const caption = findCaption(content, offset, headings);
    const relPath = markdownPath(path.relative(path.dirname(tempMdPath), imgPath));
    return caption ? `\n![${caption}](${relPath})\n` : `\n![](${relPath})\n`;
  });
  return result;
}

export function findLatestDiagrams(diagramsDir, basename) {
  if (!fs.existsSync(diagramsDir)) return null;
  const prefix = `${basename}-`;
  const matches = fs.readdirSync(diagramsDir)
    .filter((name) => name.startsWith(prefix))
    .map((name) => path.join(diagramsDir, name))
    .filter((dir) => fs.statSync(dir).isDirectory())
    .filter((dir) => fs.existsSync(path.join(dir, '001.png')))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return matches[0] || null;
}
