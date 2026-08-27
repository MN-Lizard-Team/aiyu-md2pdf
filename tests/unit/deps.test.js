import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';

// Mock spawnSync so tests don't actually invoke system commands
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

import { commandExists, toolVersion, checkDeps, REQUIRED_TOOLS } from '../../src/deps.js';

describe('deps', () => {
  beforeEach(() => {
    vi.mocked(spawnSync).mockReset();
  });

  describe('REQUIRED_TOOLS', () => {
    it('includes pandoc, mmdc, xelatex', () => {
      expect(REQUIRED_TOOLS).toContain('pandoc');
      expect(REQUIRED_TOOLS).toContain('mmdc');
      expect(REQUIRED_TOOLS).toContain('xelatex');
    });
  });

  describe('commandExists', () => {
    it('returns true when command -v succeeds', () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 0 });
      expect(commandExists('pandoc')).toBe(true);
    });

    it('returns false when command -v fails', () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 1 });
      expect(commandExists('nonexistent')).toBe(false);
    });

    it('returns false when spawn throws', () => {
      vi.mocked(spawnSync).mockReturnValue({ status: null, error: new Error('ENOENT') });
      expect(commandExists('nonexistent')).toBe(false);
    });
  });

  describe('toolVersion', () => {
    it('returns first line of --version output', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: 'pandoc 3.1.13\nmore lines\n',
      });
      expect(toolVersion('pandoc')).toBe('pandoc 3.1.13');
    });

    it('returns empty string on failure', () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 1, stdout: '' });
      expect(toolVersion('bad')).toBe('');
    });

    it('returns empty string when no stdout', () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: '' });
      expect(toolVersion('bad')).toBe('');
    });
  });

  describe('checkDeps', () => {
    it('reports all found when all exist', () => {
      vi.mocked(spawnSync)
        .mockReturnValueOnce({ status: 0 }) // command -v pandoc
        .mockReturnValueOnce({ status: 0, stdout: 'pandoc 3.1.13\n' }) // pandoc --version
        .mockReturnValueOnce({ status: 0 }) // command -v mmdc
        .mockReturnValueOnce({ status: 0, stdout: 'mmdc 11.4.2\n' }) // mmdc --version
        .mockReturnValueOnce({ status: 0 }) // command -v xelatex
        .mockReturnValueOnce({ status: 0, stdout: 'XeTeX 2026\n' }); // xelatex --version

      const { missing, found } = checkDeps();
      expect(missing).toEqual([]);
      expect(found.pandoc).toBe('pandoc 3.1.13');
      expect(found.mmdc).toBe('mmdc 11.4.2');
      expect(found.xelatex).toBe('XeTeX 2026');
    });

    it('reports missing tools', () => {
      // checkDeps interleaves: commandExists then toolVersion per tool
      vi.mocked(spawnSync)
        .mockReturnValueOnce({ status: 0 })                    // commandExists(pandoc)
        .mockReturnValueOnce({ status: 0, stdout: 'pandoc 3.1.13\n' }) // toolVersion(pandoc)
        .mockReturnValueOnce({ status: 1 })                    // commandExists(mmdc) → missing
        .mockReturnValueOnce({ status: 0 })                    // commandExists(xelatex)
        .mockReturnValueOnce({ status: 0, stdout: 'XeTeX 2026\n' });   // toolVersion(xelatex)

      const { missing, found } = checkDeps();
      expect(missing).toEqual(['mmdc']);
      expect(found.pandoc).toBe('pandoc 3.1.13');
      expect(found.mmdc).toBeUndefined();
    });

    it('reports all missing when none installed', () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 1 });
      const { missing, found } = checkDeps();
      expect(missing).toEqual(['pandoc', 'mmdc', 'xelatex']);
      expect(found).toEqual({});
    });
  });
});
