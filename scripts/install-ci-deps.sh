#!/usr/bin/env bash
#
# install-ci-deps.sh — Install system dependencies for CI (Linux/ubuntu-latest)
#
# Installs: pandoc, xelatex (texlive), mermaid-cli, poppler-utils, shellcheck, unzip, Sarabun font
#
set -euo pipefail

echo "=========================================="
echo "  Installing CI dependencies (apt + npm)"
echo "=========================================="

# --- System packages ---
echo "[1/3] Installing apt packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  pandoc \
  texlive-xetex \
  texlive-lang-thai \
  texlive-fonts-extra \
  texlive-latex-extra \
  texlive-fonts-recommended \
  poppler-utils \
  shellcheck \
  unzip \
  fonts-noto-core \
  2>/dev/null
echo "  ✓ apt packages installed"

# --- Sarabun font (not in apt, download from Google Fonts) ---
echo "[2/3] Installing Sarabun font..."
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
echo "[3/3] Installing Mermaid CLI (npm)..."
MMDC_VERSION="11.4.2"
npm install -g "@mermaid-js/mermaid-cli@${MMDC_VERSION}"
echo "  ✓ Mermaid CLI @ ${MMDC_VERSION} installed"

# --- Verify ---
echo ""
echo "=========================================="
echo "  Verification"
echo "=========================================="
echo "  pandoc:   $(pandoc --version | head -1)"
echo "  xelatex:  $(xelatex --version 2>&1 | head -1)"
echo "  mmdc:     $(mmdc --version 2>&1 | head -1)"
echo "  pdfinfo:  $(pdfinfo -v 2>&1 | head -1)"
echo "  shellcheck: $(shellcheck --version | head -1)"
echo "  Sarabun:  $(fc-list | grep -i sarabun | head -1)"
echo "=========================================="
