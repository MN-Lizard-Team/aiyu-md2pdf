#!/usr/bin/env bash
#
# install-ci-deps.sh — Install system dependencies for CI (Linux/ubuntu-latest)
#
# Installs: TinyTeX (xelatex), pandoc, mermaid-cli, poppler-utils, shellcheck, unzip, Sarabun font
#
set -euo pipefail

echo "=========================================="
echo "  Installing CI dependencies"
echo "=========================================="

# --- apt packages (pandoc, poppler, shellcheck only — no texlive) ---
echo "[1/4] Installing apt packages..."
sudo apt-get update -qq
sudo apt-get install -y \
  pandoc \
  poppler-utils \
  shellcheck \
  unzip \
  wget
echo "  ✓ apt packages installed"

# --- TinyTeX (xelatex) — lighter than texlive-full, faster install ---
echo "[2/4] Installing TinyTeX..."
wget -qO- "https://yihui.org/tinytex/install-bin-unix.sh" | sh
export PATH="$HOME/.TinyTeX/bin/x86_64-linux:$PATH"
# Install required LaTeX packages. fmtutil can return 1 after installing packages,
# so validate the actual .sty files instead of masking every installation error.
set +e
tlmgr install \
  latexmk fontspec polyglossia fancyhdr fancyvrb lastpage xecjk environ \
  trimspaces ulem pgfplots booktabs longtable caption graphics tools ec xcolor \
  geometry hyperref url etoolbox enumitem titlesec tocloft adjustbox float \
  >"$HOME/tlmgr-install.log" 2>&1
tlmgr_status=$?
set -e
tail -5 "$HOME/tlmgr-install.log"
if [ "$tlmgr_status" -ne 0 ]; then
  echo "  ⚠ tlmgr exited with $tlmgr_status; checking required packages"
fi
for package in polyglossia enumitem titlesec tocloft adjustbox float; do
  if ! kpsewhich "${package}.sty" >/dev/null 2>&1; then
    echo "ERROR: required LaTeX package missing: ${package}.sty"
    exit 1
  fi
done
# Verify xelatex actually works
if ! command -v xelatex >/dev/null 2>&1; then
  echo "ERROR: xelatex not found after TinyTeX install"
  exit 1
fi
echo "  ✓ TinyTeX installed"

# --- Sarabun font ---
echo "[3/4] Installing Sarabun font..."
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

# --- Mermaid CLI (npm, pinned version) ---
echo "[4/4] Installing Mermaid CLI (npm)..."
MMDC_VERSION="11.16.0"
npm install -g "@mermaid-js/mermaid-cli@${MMDC_VERSION}"
echo "  ✓ Mermaid CLI @ ${MMDC_VERSION} installed"

# --- Verify ---
echo ""
echo "=========================================="
echo "  Verification"
echo "=========================================="
export PATH="$HOME/.TinyTeX/bin/x86_64-linux:$PATH"
echo "  pandoc:     $(pandoc --version | head -1)"
echo "  xelatex:    $(xelatex --version 2>&1 | head -1)"
echo "  mmdc:       $(mmdc --version 2>&1 | head -1)"
echo "  pdfinfo:    $(pdfinfo -v 2>&1 | head -1)"
echo "  shellcheck: $(shellcheck --version | head -1)"
echo "  Sarabun:    $(fc-list | grep -i sarabun | head -1)"
echo "=========================================="
