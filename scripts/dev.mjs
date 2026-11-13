#!/usr/bin/env node

/**
 * Inicia API e Web em modo desenvolvimento simultaneamente a partir da raiz.
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'cmd.exe' : 'npm';

function spawnWorkspaceDev(workspace) {
  const args = isWindows
    ? ['/d', '/s', '/c', `npm --prefix ${workspace} run dev`]
    : ['--prefix', workspace, 'run', 'dev'];
  return spawn(npmCmd, args, { cwd: rootDir, stdio: 'inherit' });
}

const apiProc = spawnWorkspaceDev('api');
const webProc = spawnWorkspaceDev('web');

let exiting = false;
function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  apiProc.kill('SIGTERM');
  webProc.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
apiProc.on('exit', (code) => {
  if (!exiting) shutdown(code ?? 0);
});
webProc.on('exit', (code) => {
  if (!exiting) shutdown(code ?? 0);
});

