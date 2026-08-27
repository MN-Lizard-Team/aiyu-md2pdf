import { spawnSync } from 'node:child_process';

const REQUIRED_TOOLS = ['pandoc', 'mmdc', 'xelatex'];

/**
 * Check if a command exists on the system PATH.
 * Uses `command -v` on Unix, `where` on Windows.
 */
export function commandExists(cmd) {
  const isWin = process.platform === 'win32';
  // `command -v` is a shell builtin on Unix, so we need shell:true.
  // `where` is a standalone command on Windows.
  const check = isWin ? 'where' : 'command';
  const args = isWin ? [cmd] : ['-v', cmd];
  const res = spawnSync(check, args, { stdio: 'ignore', shell: true });
  return res.status === 0;
}

/**
 * Get the version string of a tool (first line).
 * Returns '' if the tool is not found or fails.
 */
export function toolVersion(cmd) {
  const res = spawnSync(cmd, ['--version'], { encoding: 'utf-8', shell: true });
  if (res.status !== 0 || !res.stdout) return '';
  return res.stdout.split('\n')[0].trim();
}

/**
 * Check all required tools. Returns { missing: string[], found: {name: version} }.
 */
export function checkDeps() {
  const missing = [];
  const found = {};
  for (const tool of REQUIRED_TOOLS) {
    if (commandExists(tool)) {
      found[tool] = toolVersion(tool);
    } else {
      missing.push(tool);
    }
  }
  return { missing, found };
}

export { REQUIRED_TOOLS };
