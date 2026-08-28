import yaml from 'js-yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse YAML frontmatter from markdown content.
 * Returns { frontmatter, body } where frontmatter is an object (possibly empty)
 * and body is the markdown content without the frontmatter block.
 */
export function parseFrontmatter(content) {
  const m = content.match(FRONTMATTER_RE);
  if (!m) {
    return { frontmatter: {}, body: content, warning: null };
  }
  let data = {};
  let warning = null;
  try {
    data = yaml.load(m[1]) || {};
    if (typeof data !== 'object' || Array.isArray(data)) {
      warning = 'Frontmatter must be a YAML object';
      data = {};
    }
  } catch (error) {
    warning = `Malformed YAML frontmatter: ${error.message}`;
  }
  return { frontmatter: data, body: content.slice(m[0].length), warning };
}

/**
 * Extract the 5 supported fields from frontmatter.
 * Returns { title, subtitle, author, date, document } with '' defaults.
 */
export function extractFields(frontmatter) {
  const fields = ['title', 'subtitle', 'author', 'date', 'document'];
  const out = {};
  for (const f of fields) {
    out[f] = frontmatter[f] != null ? String(frontmatter[f]) : '';
  }
  return out;
}

/**
 * LaTeX-escape special characters so frontmatter values cannot inject commands.
 * Order matters: backslash first, then other special chars.
 */
export function latexEscape(str) {
  if (!str) return '';
  let s = String(str);
  // Use a placeholder for backslash so the { } we insert aren't re-escaped.
  const BS_PLACEHOLDER = '\u0000BS\u0000';
  s = s.replace(/\\/g, BS_PLACEHOLDER);
  for (const ch of ['&', '%', '$', '#', '_', '{', '}']) {
    s = s.replace(new RegExp('\\' + ch, 'g'), '\\' + ch);
  }
  s = s.replace(/~/g, '\\textasciitilde{}');
  s = s.replace(/\^/g, '\\textasciicircum{}');
  s = s.replace(new RegExp(BS_PLACEHOLDER, 'g'), '\\textbackslash{}');
  return s;
}

/**
 * Read a markdown file, parse frontmatter, and return escaped fields + body.
 */
export function parseDocument(content, fallbackTitle = '') {
  const { frontmatter, body, warning } = parseFrontmatter(content);
  const fields = extractFields(frontmatter);
  return {
    title: fields.title || fallbackTitle,
    subtitle: fields.subtitle,
    author: fields.author,
    date: fields.date,
    document: fields.document,
    body,
    warning,
  };
}
