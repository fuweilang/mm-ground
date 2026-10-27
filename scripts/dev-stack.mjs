import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './dev-banner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = [];

function prefixPipe(name, stream, out) {
  let buf = '';
  stream.on('data', (chunk) => {
    buf += chunk.toString();
    const parts = buf.split('\n');
    buf = parts.pop() ?? '';
    for (const line of parts) out.write(`[${name}] ${line}\n`);
  });
  stream.on('end', () => {
    if (buf) out.write(`[${name}] ${buf}\n`);
  });
}

function run(name, command) {
  const child = spawn(command, {
    cwd: root,
    shell: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  prefixPipe(name, child.stdout, process.stdout);
  prefixPipe(name, child.stderr, process.stderr);
  child.on('exit', (code, signal) => {
    if (signal) console.error(`[${name}] killed by ${signal}`);
    else if (code && code !== 0) console.error(`[${name}] exited ${code}`);
  });
  return child;
}

function waitPort(port, label, timeoutMs = 120_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.connect({ port, host: '127.0.0.1' }, () => {
        socket.end();
        console.log(`[boot] ${label} ready (:${port})`);
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`timeout waiting for ${label} :${port}`));
          return;
        }
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

function shutdown() {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {}
  }
  setTimeout(() => process.exit(0), 300).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  console.log('[boot] 1/3 starting api...');
  run('api', 'pnpm run dev:api');
  await waitPort(3100, 'api');

  console.log('[boot] 2/3 starting web...');
  run('web', 'pnpm run dev:web');
  await waitPort(5202, 'web');

  console.log('[boot] 3/3 starting gateway...');
  run('gw', 'pnpm run dev:gateway');
  await waitPort(5201, 'gateway');

  console.log('[boot] stack up. Ctrl-C to stop all.');
}

main().catch((err) => {
  console.error('[boot]', err.message || err);
  shutdown();
  process.exit(1);
});
