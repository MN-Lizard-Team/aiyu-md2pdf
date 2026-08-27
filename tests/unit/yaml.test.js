import { describe, it, expect } from 'vitest';
import { parseFrontmatter, extractFields, latexEscape, parseDocument } from '../../src/yaml.js';

describe('parseFrontmatter', () => {
  it('parses valid frontmatter', () => {
    const md = '---\ntitle: "Hello"\nauthor: "Bob"\n---\n\n# Body';
    const { frontmatter, body } = parseFrontmatter(md);
    expect(frontmatter.title).toBe('Hello');
    expect(frontmatter.author).toBe('Bob');
    expect(body.trim()).toBe('# Body');
  });

  it('returns empty object when no frontmatter', () => {
    const { frontmatter, body } = parseFrontmatter('# Just a heading');
    expect(frontmatter).toEqual({});
    expect(body).toBe('# Just a heading');
  });

  it('handles malformed YAML gracefully', () => {
    const md = '---\ntitle: "unterminated\n---\n\nBody';
    const { frontmatter } = parseFrontmatter(md);
    expect(frontmatter).toEqual({});
  });

  it('handles CRLF line endings', () => {
    const md = '---\r\ntitle: "Win"\r\n---\r\n\r\n# Body';
    const { frontmatter, body } = parseFrontmatter(md);
    expect(frontmatter.title).toBe('Win');
    expect(body.trim()).toBe('# Body');
  });

  it('handles empty frontmatter block', () => {
    const md = '---\n---\n\n# Body';
    const { frontmatter } = parseFrontmatter(md);
    expect(frontmatter).toEqual({});
  });
});

describe('extractFields', () => {
  it('extracts all 5 fields', () => {
    const f = extractFields({
      title: 'T', subtitle: 'S', author: 'A', date: 'D', document: 'Doc',
    });
    expect(f).toEqual({ title: 'T', subtitle: 'S', author: 'A', date: 'D', document: 'Doc' });
  });

  it('defaults missing fields to empty string', () => {
    const f = extractFields({ title: 'T' });
    expect(f.title).toBe('T');
    expect(f.subtitle).toBe('');
    expect(f.author).toBe('');
    expect(f.date).toBe('');
    expect(f.document).toBe('');
  });

  it('coerces non-string values to string', () => {
    const f = extractFields({ title: 123, date: true });
    expect(f.title).toBe('123');
    expect(f.date).toBe('true');
  });
});

describe('latexEscape', () => {
  it('escapes backslash first', () => {
    expect(latexEscape('\\')).toBe('\\textbackslash{}');
  });

  it('escapes all special chars', () => {
    expect(latexEscape('&')).toBe('\\&');
    expect(latexEscape('%')).toBe('\\%');
    expect(latexEscape('$')).toBe('\\$');
    expect(latexEscape('#')).toBe('\\#');
    expect(latexEscape('_')).toBe('\\_');
    expect(latexEscape('{')).toBe('\\{');
    expect(latexEscape('}')).toBe('\\}');
  });

  it('escapes tilde and caret', () => {
    expect(latexEscape('~')).toBe('\\textasciitilde{}');
    expect(latexEscape('^')).toBe('\\textasciicircum{}');
  });

  it('does not alter plain text', () => {
    expect(latexEscape('Hello World')).toBe('Hello World');
  });

  it('handles Thai text (no special chars)', () => {
    expect(latexEscape('ภาษาไทย')).toBe('ภาษาไทย');
  });

  it('returns empty string for falsy input', () => {
    expect(latexEscape('')).toBe('');
    expect(latexEscape(null)).toBe('');
    expect(latexEscape(undefined)).toBe('');
  });

  it('blocks LaTeX injection \\input', () => {
    const escaped = latexEscape('\\input{/etc/passwd}');
    expect(escaped).toBe('\\textbackslash{}input\\{/etc/passwd\\}');
    expect(escaped).not.toMatch(/^\\input/);
  });

  it('blocks \\write18 injection', () => {
    const escaped = latexEscape('\\write18{rm -rf /}');
    expect(escaped).toContain('\\textbackslash{}');
    expect(escaped).not.toMatch(/^\\write18/);
  });

  it('handles mixed content', () => {
    const escaped = latexEscape('100% Safe & #1 _test_');
    expect(escaped).toBe('100\\% Safe \\& \\#1 \\_test\\_');
  });
});

describe('parseDocument', () => {
  it('uses fallback title when frontmatter missing', () => {
    const doc = parseDocument('# Just heading', 'fallback.md');
    expect(doc.title).toBe('fallback.md');
    expect(doc.body.trim()).toBe('# Just heading');
  });

  it('returns all escaped fields', () => {
    const md = '---\ntitle: "A & B %"\nauthor: "Bob"\n---\n\nBody';
    const doc = parseDocument(md, 'fallback');
    expect(doc.title).toBe('A & B %'); // parseDocument does NOT escape — escaping is caller's job
    expect(doc.author).toBe('Bob');
  });
});
