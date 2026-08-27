#!/usr/bin/env node
import { program } from 'commander';
import { build } from '../src/index.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

program
  .name('aiyu-md2pdf')
  .description('Convert Markdown → PDF + Word with Mermaid diagrams. Thai & English.')
  .version(pkg.version)
  .argument('[files...]', 'Markdown files to build (default: all .md in docs/)')
  .option('--no-mermaid', 'Skip Mermaid rendering, reuse existing diagrams')
  .option('--keep-mermaid', 'Keep .mmd source files for debugging')
  .action(async (files, opts) => {
    try {
      const result = build({
        files: files.length > 0 ? files : undefined,
        noMermaid: opts.mermaid === false,
        keepMermaid: opts.keepMermaid === true,
      });
      process.exit(result.totalPdfs > 0 ? 0 : 1);
    } catch (err) {
      console.error(`\n✗ Build failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
