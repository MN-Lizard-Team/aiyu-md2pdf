# Contributing to aiyu-md2pdf

Thank you for your interest in contributing! This document covers the setup, workflow, and conventions for this project.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18 | Runtime + test runner |
| npm | >= 9 | Package manager |
| pandoc | any | Markdown → PDF/DOCX |
| xelatex | any | PDF engine (TeX Live / TinyTeX / MiKTeX) |
| mmdc | 11.4.2 | Mermaid diagram rendering |

See [README.md](README.md#install) for installation instructions per platform.

---

## Getting Started

```bash
# 1. Fork & clone
git clone https://github.com/<your-username>/aiyu-md2pdf.git
cd aiyu-md2pdf

# 2. Install dependencies
npm install

# 3. Verify setup — unit tests should pass without system deps
npm run test:unit

# 4. (Optional) Run e2e tests — requires pandoc + xelatex + mmdc
npm run test:e2e

# 5. Build the example to verify your environment
npm run build:example
```

---

## Development Workflow

### 1. Create a branch

```bash
git checkout -b feat/your-feature
# or
git checkout -b fix/your-bugfix
```

### 2. Make changes

Follow the existing code style. Key conventions:

- **ES Modules** (`import`/`export`) — `"type": "module"` in `package.json`
- **No build step** — pure Node.js, no transpilation
- **Functions over classes** — keep it functional
- **JSDoc comments** on exported functions
- **Cross-platform** — use `node:path`, avoid shell-specific assumptions
- **`spawnSync` with `shell: true`** — for cross-platform command execution

### 3. Write tests

| Test type | When | Where |
|-----------|------|-------|
| Unit | New logic in `src/` | `tests/unit/` |
| E2E | New build behavior | `tests/e2e/` |
| Fixture | New edge case | `tests/fixtures/` |

```bash
# Run tests in watch mode during development
npm run test:watch
```

### 4. Lint

```bash
npm run lint
```

### 5. Run the full test suite

```bash
npm test
```

### 6. Commit

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add support for sequenceDiagram numbering
fix: correct Thai line breaking in DOCX output
docs: update README with Windows install steps
test: add edge case for empty frontmatter
refactor: split pandoc.js into pdf and docx builders
chore: bump vitest to 2.2.0
```

### 7. Push & open a PR

```bash
git push origin feat/your-feature
```

Open a pull request against `main`. Fill in the PR template:

- **Summary** — what changed and why
- **Test plan** — how you verified the change

---

## Project Structure

```
src/
├── index.js     # 6-stage pipeline orchestrator
├── yaml.js      # Frontmatter parsing + LaTeX escaping
├── mermaid.js   # Mermaid render loop
├── pandoc.js    # pandoc invocation (PDF + DOCX)
├── paths.js     # Cross-platform path resolution (CWD vs package root)
└── deps.js      # Check pandoc/xelatex/mmdc exist
bin/
└── cli.js       # CLI entry point (commander.js)
assets/
├── preamble.tex          # LaTeX preamble (fonts, layout, styles)
├── mermaid-theme.txt     # Mermaid theme (B&W high-contrast)
├── puppeteer-config.json # Puppeteer config for mmdc
└── reference.docx        # Word template (Sarabun font)
tests/
├── unit/       # No system deps needed
├── e2e/        # Requires pandoc + xelatex + mmdc
├── fixtures/   # Test input files
└── helpers.js  # Shared test utilities
```

### Path conventions

- **`assets/`** — internal to the package, resolved via `__dirname` (shipped with npm)
- **`docs/`, `build/`, `result/`** — user-facing, resolved via `process.cwd()`
- This separation lets the CLI run from any directory after `npm install -g`

---

## Adding a New Feature

### Example: adding a new CLI flag

1. **`bin/cli.js`** — add the option to commander
2. **`src/index.js`** — thread the option through `build()` and `buildOne()`
3. **`tests/unit/`** — unit test the new behavior (if testable without system deps)
4. **`tests/e2e/`** — e2e test with a fixture
5. **`README.md`** — document the flag in Usage section
6. **`CHANGELOG.md`** — add entry under `[Unreleased]`

### Example: adding a new Mermaid diagram type

Mermaid types are handled automatically by `mmdc`. No code change needed unless you want special caption logic:

1. Add a fixture in `tests/fixtures/` with the new diagram type
2. Add an e2e test verifying the PNG is generated
3. Update `README.md` supported types list if needed

---

## Release Process

Releases are managed by maintainers:

1. Update `version` in `package.json`
2. Update `CHANGELOG.md` with the release date
3. Tag: `git tag v1.0.1 && git push --tags`
4. Publish: `npm publish`
5. Create a GitHub Release from the tag

---

## Questions?

- Open a [Discussion](https://github.com/MN-Lizard-Team/aiyu-md2pdf/discussions) for questions
- Open an [Issue](https://github.com/MN-Lizard-Team/aiyu-md2pdf/issues) for bugs
- Read the [README](README.md) for usage details

---

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
