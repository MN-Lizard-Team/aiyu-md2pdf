# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅        |
| < 1.0   | ❌        |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Please report vulnerabilities privately:

1. Email **aiyu@example.com** with the subject `SECURITY: aiyu-md2pdf`
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You will receive a response within **48 hours**. If the vulnerability is confirmed, a fix will be released within **7 days** for critical issues and **30 days** for moderate issues.

## Security Considerations

### LaTeX Injection

This tool converts Markdown to PDF via pandoc + XeLaTeX. YAML frontmatter values are **LaTeX-escaped** before being injected into the preamble to prevent command injection (`\input`, `\write18`, `\shellescape`).

If you find a way to bypass the escaping in `src/yaml.js` → `latexEscape()`, please report it.

### External Command Execution

The tool spawns external processes:

| Command | Purpose | Risk |
|---------|---------|------|
| `pandoc` | Markdown → PDF/DOCX | Low — no user input in args |
| `xelatex` | PDF engine | Low — `--shell-escape` is enabled by design for font loading |
| `mmdc` | Mermaid → PNG/SVG | Low — writes to temp files only |

> **Note:** `xelatex --shell-escape` is required for Sarabun font loading via `fontspec`. This is a known trade-off. If your environment prohibits `--shell-escape`, this tool will not work.

### Mermaid CLI (mmdc)

`mmdc` uses Puppeteer (Chromium) to render diagrams. The Mermaid code is written to a temporary `.mmd` file and rendered locally. No network requests are made during rendering.

### Dependencies

| Dependency | Version | Pinned? |
|------------|---------|---------|
| `commander` | `^12.1.0` | Minor range |
| `js-yaml` | `^4.1.0` | Minor range |
| `@mermaid-js/mermaid-cli` | `11.4.2` | Exact pin |

Run `npm audit` to check for known vulnerabilities:

```bash
npm audit
```

### File System Access

The tool writes to:

- `./build/` — temporary rendered Markdown + preamble
- `./result/output/` — PDF + DOCX output
- `./result/diagrams/{filename}/` — rendered PNG + SVG diagrams

No files are written outside the current working directory (except `assets/` which is read-only from the package install location).

## Disclosure Timeline

| Day | Action |
|-----|--------|
| 0   | Vulnerability reported |
| 1   | Acknowledgment sent to reporter |
| 7   | Fix developed, tested |
| 7   | Patch release published |
| 14  | Public disclosure (if reporter agrees) |

## Contact

- **Security email:** aiyu@example.com
- **PGP key:** Available on request
- **General issues:** [GitHub Issues](https://github.com/MN-Lizard-Team/aiyu-md2pdf/issues)
