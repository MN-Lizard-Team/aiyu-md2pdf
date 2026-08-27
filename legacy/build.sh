#!/usr/bin/env bash
#
# build.sh — Convert Markdown → PDF + DOCX with Mermaid diagrams
#
# Usage:
#   ./build.sh                          # Build all .md files in docs/ (recursive)
#   ./build.sh document.md              # Build specific file
#   ./build.sh --no-mermaid document.md # Skip mermaid rendering (use existing PNGs)
#   ./build.sh --keep-mermaid document.md # Keep .mmd source files
#
set -euo pipefail

# --- Paths ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$SCRIPT_DIR/docs"
BUILD_DIR="$SCRIPT_DIR/build"
ASSETS_DIR="$SCRIPT_DIR/assets"
RESULT_DIR="$SCRIPT_DIR/result"
PREAMBLE="$SCRIPT_DIR/preamble.tex"
MERMAID_THEME="$SCRIPT_DIR/mermaid-theme.txt"
PUPPETEER_CONFIG="$SCRIPT_DIR/puppeteer-config.json"
REFERENCE_DOCX="$SCRIPT_DIR/reference.docx"

# --- Environment ---
NODE_BIN="$(dirname "$(which node 2>/dev/null || echo /usr/bin/node)")"
export PATH="$HOME/.TinyTeX/bin/x86_64-linux:$HOME/.local/bin:$NODE_BIN:$PATH"

# --- Flags ---
KEEP_MERMAID=false
NO_MERMAID=false
INPUT_FILES=()
for arg in "$@"; do
  case "$arg" in
    --keep-mermaid) KEEP_MERMAID=true ;;
    --no-mermaid)   NO_MERMAID=true ;;
    -*) echo "Unknown flag: $arg"; exit 1 ;;
    *) INPUT_FILES+=("$arg") ;;
  esac
done

# Default: all .md files in docs/ (recursive)
if [ ${#INPUT_FILES[@]} -eq 0 ]; then
  while IFS= read -r -d '' f; do
    INPUT_FILES+=("$f")
  done < <(find "$DOCS_DIR" -name '*.md' -print0 | sort -z)
fi

if [ ${#INPUT_FILES[@]} -eq 0 ]; then
  echo "ERROR: No markdown files found in $DOCS_DIR/"
  echo "Usage: $0 [options] [file.md ...]"
  exit 1
fi

DIAGRAMS_DIR="$RESULT_DIR/diagrams"
mkdir -p "$BUILD_DIR" "$ASSETS_DIR" "$DIAGRAMS_DIR" "$RESULT_DIR"

echo "=========================================="
echo "  Markdown → PDF + Word Builder"
echo "=========================================="
echo ""

# --- Check tools ---
echo "[1/6] Checking tools..."
command -v pandoc >/dev/null 2>&1 || { echo "ERROR: pandoc not found. Run: ./install-deps.sh"; exit 1; }
command -v mmdc >/dev/null 2>&1 || { echo "ERROR: mmdc (mermaid-cli) not found. Run: ./install-deps.sh"; exit 1; }
command -v xelatex >/dev/null 2>&1 || { echo "ERROR: xelatex not found. Run: ./install-deps.sh"; exit 1; }
echo "  ✓ pandoc:   $(pandoc --version | head -1)"
echo "  ✓ mmdc:     $(mmdc --version 2>&1 | head -1)"
echo "  ✓ xelatex:  $(xelatex --version 2>&1 | head -1)"
echo ""

# --- Render Mermaid diagrams for all input files ---
render_mermaid_for_file() {
  local source_md="$1"
  local temp_md="$2"
  local basename="$3"

  if [ "$NO_MERMAID" = true ]; then
    echo "[2/6] Skipping Mermaid rendering (--no-mermaid)"
    # Reuse the most recent existing diagram folder for this basename
    local latest_dir
    latest_dir=$(ls -td "$DIAGRAMS_DIR/${basename}-"*/ 2>/dev/null | head -1)
    if [ -n "$latest_dir" ] && [ -d "${latest_dir}diagram" ]; then
      DOC_DIAGRAMS_DIR="${latest_dir}diagram"
      echo "  → Reusing diagrams from: $DOC_DIAGRAMS_DIR"
    else
      echo "  ⚠ No existing diagrams found for $basename; PDF may miss images"
    fi
    cp "$source_md" "$temp_md"
    return
  fi

  echo "[2/6] Rendering Mermaid diagrams for $basename..."

  export SOURCE="$source_md" TEMP_MD="$temp_md" ASSETS_DIR="$DOC_DIAGRAMS_DIR" \
         MERMAID_THEME="$MERMAID_THEME" PUPPETEER_CONFIG="$PUPPETEER_CONFIG" \
         FILE_PREFIX="$basename"
  python3 << 'PYEOF'
import re
import os
import subprocess
import sys

source = os.environ.get('SOURCE', '')
temp_md = os.environ.get('TEMP_MD', '')
assets_dir = os.environ.get('ASSETS_DIR', '')
mermaid_theme = os.environ.get('MERMAID_THEME', '')
puppeteer_config = os.environ.get('PUPPETEER_CONFIG', '')
file_prefix = os.environ.get('FILE_PREFIX', 'doc')

with open(source, 'r', encoding='utf-8') as f:
    content = f.read()

theme_prefix = ""
if os.path.exists(mermaid_theme):
    with open(mermaid_theme, 'r', encoding='utf-8') as f:
        theme_prefix = f.read().strip()

counter = [0]

# Build heading map for captions
lines = content.split('\n')
mermaid_starts = {}
current_heading = ''
for i, line in enumerate(lines):
    heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)
    if heading_match:
        current_heading = heading_match.group(2).strip()
    if line.strip() == '```mermaid':
        mermaid_starts[i] = current_heading

def render_mermaid(match):
    code = match.group(1).strip()
    counter[0] += 1
    idx = counter[0]
    img_name = f"{idx:03d}.png"
    svg_name = f"{idx:03d}.svg"
    img_path = os.path.join(assets_dir, img_name)
    svg_path = os.path.join(assets_dir, svg_name)
    mmd_path = os.path.join(assets_dir, f"{idx:03d}.mmd")

    full_code = theme_prefix + "\n" + code if theme_prefix else code

    with open(mmd_path, 'w', encoding='utf-8') as f:
        f.write(full_code)

    print(f"  → Rendering {file_prefix}/{idx:03d} (PNG + SVG)...", flush=True)

    png_cmd = [
        'mmdc', '-i', mmd_path, '-o', img_path,
        '-w', '3200', '-H', '2400', '-b', 'white',
        '-p', puppeteer_config, '--scale', '3',
    ]
    svg_cmd = [
        'mmdc', '-i', mmd_path, '-o', svg_path,
        '-b', 'white', '-p', puppeteer_config,
    ]

    try:
        result = subprocess.run(png_cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(f"PNG render failed: {result.stderr[:500]}")
    except subprocess.TimeoutExpired:
        print(f"    ⚠ Timeout rendering PNG {file_prefix}-{idx:03d}", file=sys.stderr)

    try:
        result = subprocess.run(svg_cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(f"SVG render failed: {result.stderr[:500]}")
    except subprocess.TimeoutExpired:
        print(f"    ⚠ Timeout rendering SVG {file_prefix}-{idx:03d}", file=sys.stderr)

    if not os.path.exists(img_path):
        raise RuntimeError(f"Missing rendered output for {file_prefix}-{idx:03d}")

    # Generate caption from nearest bold label or heading
    caption = ''
    match_start = match.start()
    before_text = content[:match_start].rstrip()
    before_lines = before_text.split('\n')
    for bl in reversed(before_lines[-5:]):
        bl = bl.strip()
        bold_match = re.match(r'^\*\*(.+?):\*\*\s*(.*)$', bl)
        if bold_match:
            caption = bold_match.group(1).strip()
            if bold_match.group(2):
                caption += ' — ' + bold_match.group(2).strip()
            break
        if bl and bl.endswith(':') and not bl.startswith('#') and not bl.startswith('|') and not bl.startswith('-'):
            caption = bl.rstrip(':').strip()
            break

    if not caption:
        line_idx = before_text.count('\n')
        closest = None
        for start_idx in sorted(mermaid_starts.keys()):
            if start_idx <= line_idx:
                closest = start_idx
        if closest is not None:
            caption = mermaid_starts[closest]

    caption = re.sub(r'\*\*(.+?)\*\*', r'\1', caption).strip()

    rel_path = os.path.relpath(img_path, os.path.dirname(temp_md))
    if caption:
        return f'\n![{caption}]({rel_path})\n'
    else:
        return f'\n![]({rel_path})\n'

pattern = r'```mermaid\n(.*?)```'
rendered = re.sub(pattern, render_mermaid, content, flags=re.DOTALL)

with open(temp_md, 'w', encoding='utf-8') as f:
    f.write(rendered)

print(f"  ✓ Rendered {counter[0]} mermaid diagrams for {file_prefix}")
PYEOF
}

# --- Process each input file ---
TOTAL_PDFS=0
TOTAL_DOCX=0

for source_md in "${INPUT_FILES[@]}"; do
  if [ ! -f "$source_md" ]; then
    echo "ERROR: File not found: $source_md"
    continue
  fi

  BASENAME="$(basename "$source_md" .md)"
  TEMP_MD="$BUILD_DIR/${BASENAME}-rendered.md"

  # Create a unique subfolder for this document: {filename}-{random6}
  # Inside: diagram/ (PNG + SVG) and file/ (PDF + DOCX)
  RAND_SUFFIX=$(python3 -c "import random, string; print(''.join(random.choices(string.ascii_lowercase + string.digits, k=6)))")
  DOC_OUTPUT_DIR="$DIAGRAMS_DIR/${BASENAME}-${RAND_SUFFIX}"
  DOC_DIAGRAMS_DIR="$DOC_OUTPUT_DIR/diagram"
  DOC_FILES_DIR="$DOC_OUTPUT_DIR/file"
  mkdir -p "$DOC_DIAGRAMS_DIR" "$DOC_FILES_DIR"

  OUTPUT_PDF="$DOC_FILES_DIR/${BASENAME}.pdf"
  OUTPUT_DOCX="$DOC_FILES_DIR/${BASENAME}.docx"

  echo ""
  echo "=========================================="
  echo "  Building: $BASENAME"
  echo "  Output:   $DOC_OUTPUT_DIR"
  echo "=========================================="

  # Extract YAML frontmatter values for title page and headers
  # Single Python invocation reads all 5 fields and LaTeX-escapes them.
  YAML_FIELDS=()
  while IFS= read -r -d '' field; do
    YAML_FIELDS+=("$field")
  done < <(SOURCE_MD="$source_md" python3 << 'PYEOF' 2>/dev/null || true
import os, sys, yaml

with open(os.environ['SOURCE_MD'], 'r', encoding='utf-8') as f:
    content = f.read()

data = {}
if content.startswith('---'):
    parts = content.split('---', 2)
    if len(parts) >= 3:
        try:
            data = yaml.safe_load(parts[1]) or {}
        except Exception:
            pass

def esc(s):
    """LaTeX-escape special characters so YAML values cannot inject commands."""
    if not s:
        return ''
    s = str(s)
    # Backslash first, then other special chars
    s = s.replace('\\', r'\textbackslash{}')
    for ch in ['&', '%', '$', '#', '_', '{', '}']:
        s = s.replace(ch, '\\' + ch)
    s = s.replace('~', r'\textasciitilde{}')
    s = s.replace('^', r'\textasciicircum{}')
    return s

fields = [data.get(k, '') or '' for k in ['title', 'subtitle', 'author', 'date', 'document']]
for f in fields:
    sys.stdout.write(esc(f) + '\x00')
PYEOF
)
  # Pad to 5 fields in case Python failed
  while [ ${#YAML_FIELDS[@]} -lt 5 ]; do YAML_FIELDS+=(""); done

  DOC_TITLE="${YAML_FIELDS[0]:-$BASENAME}"
  DOC_SUBTITLE="${YAML_FIELDS[1]}"
  DOC_AUTHOR="${YAML_FIELDS[2]}"
  DOC_DATE="${YAML_FIELDS[3]}"
  DOC_TYPE="${YAML_FIELDS[4]}"

  echo "  Title:    $DOC_TITLE"
  echo "  Subtitle: $DOC_SUBTITLE"
  echo "  Author:   $DOC_AUTHOR"

  # Render mermaid
  render_mermaid_for_file "$source_md" "$TEMP_MD" "$BASENAME"

  # Generate a temp preamble with document-specific values
  TEMP_PREAMBLE="$BUILD_DIR/${BASENAME}-preamble.tex"
  {
    echo "% Auto-generated preamble with document metadata"
    echo "\\renewcommand{\\docTitle}{$DOC_TITLE}"
    echo "\\renewcommand{\\docSubtitle}{$DOC_SUBTITLE}"
    echo "\\renewcommand{\\docAuthor}{$DOC_AUTHOR}"
    echo "\\renewcommand{\\docDate}{$DOC_DATE}"
    echo "\\renewcommand{\\docType}{$DOC_TYPE}"
  } > "$TEMP_PREAMBLE"

  # Build PDF
  echo "[3/6] Building PDF with pandoc + xelatex..."
  PANDOC_ARGS=(
    --from=markdown+yaml_metadata_block+pipe_tables+grid_tables
    --to=pdf
    --pdf-engine=xelatex
    --pdf-engine-opt=-interaction=nonstopmode
    --pdf-engine-opt=-halt-on-error
    --pdf-engine-opt=-shell-escape
    --include-in-header="$PREAMBLE"
    --include-in-header="$TEMP_PREAMBLE"
    --toc
    --toc-depth=3
    --number-sections
    --highlight-style=tango
    --resource-path="$BUILD_DIR:$DIAGRAMS_DIR:$SCRIPT_DIR"
    --metadata=title:"${BASENAME}"
    --variable=documentclass:report
    --output="$OUTPUT_PDF"
  )

  cd "$BUILD_DIR"
  pandoc "${PANDOC_ARGS[@]}" "$TEMP_MD" 2>&1 | tee "$BUILD_DIR/pandoc.log"
  # Capture pandoc's exit code (not tee's) — pipefail would mask it via the pipe.
  PANDOC_EXIT=${PIPESTATUS[0]}
  if [ "$PANDOC_EXIT" -ne 0 ]; then
    echo "ERROR: pandoc failed (exit $PANDOC_EXIT). See $BUILD_DIR/pandoc.log"
    tail -20 "$BUILD_DIR/pandoc.log"
    exit 1
  fi
  echo "  ✓ PDF generated: $OUTPUT_PDF"
  TOTAL_PDFS=$((TOTAL_PDFS + 1))

  # Build DOCX
  echo "[4/6] Building Word (.docx) with pandoc..."
  DOCX_ARGS=(
    --from=markdown+yaml_metadata_block+pipe_tables+grid_tables
    --to=docx
    --reference-doc="$REFERENCE_DOCX"
    --resource-path="$BUILD_DIR:$DIAGRAMS_DIR:$SCRIPT_DIR"
    --output="$OUTPUT_DOCX"
  )

  if [ -f "$REFERENCE_DOCX" ]; then
    if pandoc "${DOCX_ARGS[@]}" "$TEMP_MD" 2>&1; then
      [ -f "$OUTPUT_DOCX" ] && echo "  ✓ DOCX generated: $OUTPUT_DOCX" && TOTAL_DOCX=$((TOTAL_DOCX + 1))
    else
      echo "  ⚠ DOCX build failed (non-fatal, exit $?)"
    fi
  else
    echo "  ⚠ No reference.docx found, skipping DOCX"
  fi

  cd "$SCRIPT_DIR"
done

# --- Summary ---
echo ""
echo "[5/6] Build summary"
echo "=========================================="
echo "  BUILD COMPLETE"
echo "=========================================="
echo "  PDFs:  $TOTAL_PDFS"
echo "  DOCX:  $TOTAL_DOCX"
echo ""
echo "  Output files in: $SCRIPT_DIR/"
echo "  Diagrams in:     $DIAGRAMS_DIR/"
echo "=========================================="

# --- Cleanup ---
echo ""
echo "[6/6] Cleanup"
if [ "$KEEP_MERMAID" = false ]; then
  find "$RESULT_DIR" -name '*.mmd' -delete
  echo "  ✓ Cleaned .mmd source files"
fi
