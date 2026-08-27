#!/usr/bin/env bash
#
# install-deps.sh — Install all dependencies for md2pdf-template
#
# Installs: pandoc, mermaid-cli, TinyTeX (XeLaTeX), LaTeX packages, Sarabun font
#
set -euo pipefail

echo "=========================================="
echo "  Installing dependencies for md2pdf-template"
echo "=========================================="
echo ""

# --- 1. Pandoc ---
if ! command -v pandoc >/dev/null 2>&1; then
  echo "[1/5] Installing Pandoc..."
  PANDOC_VER="3.1.13"
  PANDOC_URL="https://github.com/jgm/pandoc/releases/download/${PANDOC_VER}/pandoc-${PANDOC_VER}-linux-amd64.tar.gz"
  cd /tmp
  wget -q "$PANDOC_URL" -O pandoc.tar.gz
  tar xzf pandoc.tar.gz
  mkdir -p ~/.local/bin
  cp "pandoc-${PANDOC_VER}/bin/pandoc" ~/.local/bin/
  rm -rf pandoc.tar.gz "pandoc-${PANDOC_VER}"
  echo "  ✓ Pandoc installed"
else
  echo "[1/5] Pandoc already installed: $(pandoc --version | head -1)"
fi

# --- 2. Mermaid CLI ---
# Pin a known-stable version to avoid supply-chain surprises from floating "latest".
MMDC_VERSION="11.4.2"
if ! command -v mmdc >/dev/null 2>&1; then
  echo "[2/5] Installing Mermaid CLI @ ${MMDC_VERSION}..."
  npm install -g "@mermaid-js/mermaid-cli@${MMDC_VERSION}"
  echo "  ✓ Mermaid CLI installed"
else
  echo "[2/5] Mermaid CLI already installed: $(mmdc --version 2>&1 | head -1)"
fi

# --- 3. TinyTeX (XeLaTeX) ---
if ! command -v xelatex >/dev/null 2>&1; then
  echo "[3/5] Installing TinyTeX..."
  wget -qO- "https://yihui.org/tinytex/install-bin-unix.sh" | sh
  export PATH="$HOME/.TinyTeX/bin/x86_64-linux:$HOME/.local/bin:$PATH"
  echo "  ✓ TinyTeX installed"
else
  echo "[3/5] XeLaTeX already installed: $(xelatex --version 2>&1 | head -1)"
fi

export PATH="$HOME/.TinyTeX/bin/x86_64-linux:$HOME/.local/bin:$PATH"

# --- 4. LaTeX packages ---
echo "[4/5] Installing LaTeX packages..."
tlmgr install xetex polyglossia fontspec ctex cjk enumitem booktabs ulem \
  etoolbox xcolor pgf fancyvrb upquote mdframed needspace fancyhdr \
  tocloft titlesec hyperref longtable adjustbox collectbox pgfplots \
  2>/dev/null || echo "  ⚠ Some packages may already be installed"
echo "  ✓ LaTeX packages installed"

# --- 5. Sarabun font ---
echo "[5/5] Installing Sarabun font..."
FONT_DIR="$HOME/.local/share/fonts"
mkdir -p "$FONT_DIR"
FONT_BASE="https://github.com/google/fonts/raw/main/ofl/sarabun"
for font in Sarabun-Regular Sarabun-Bold Sarabun-Italic Sarabun-BoldItalic; do
  if [ ! -f "$FONT_DIR/${font}.ttf" ]; then
    wget -q "$FONT_BASE/${font}.ttf" -O "$FONT_DIR/${font}.ttf"
  fi
done
fc-cache -f
echo "  ✓ Sarabun font installed"

echo ""
echo "=========================================="
echo "  All dependencies installed!"
echo "=========================================="
echo ""
echo "  Add to your ~/.bashrc or ~/.zshrc:"
echo "    export PATH=\"\$HOME/.TinyTeX/bin/x86_64-linux:\$HOME/.local/bin:\$PATH\""
echo ""
echo "  Then run: ./build.sh"
