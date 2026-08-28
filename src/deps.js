import { spawnSync } from 'node:child_process';

const REQUIRED_TOOLS = ['pandoc', 'mmdc', 'xelatex'];

function executableName(cmd) {
  return process.platform === 'win32' && cmd === 'mmdc' ? 'mmdc.cmd' : cmd;
}

export function commandExists(cmd) {
  const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
  const args = [executableName(cmd)];
  const result = spawnSync(lookup, args, { stdio: 'ignore', windowsHide: true });
  return result.status === 0;
}

export function toolVersion(cmd) {
  const result = spawnSync(executableName(cmd), ['--version'], {
    encoding: 'utf-8', windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout) return '';
  return result.stdout.split(/\r?\n/)[0].trim();
}

export function checkDeps() {
  const missing = [];
  const found = {};
  for (const tool of REQUIRED_TOOLS) {
    if (commandExists(tool)) found[tool] = toolVersion(tool);
    else missing.push(tool);
  }
  return { missing, found };
}

export { REQUIRED_TOOLS };
