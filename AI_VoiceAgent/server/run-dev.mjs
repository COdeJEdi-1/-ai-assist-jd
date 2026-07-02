import { spawn } from 'child_process';

const isWindows = process.platform === 'win32';

function run(command, args, label) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    env: process.env,
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[dev] ${label} exited with code ${code}`);
      process.exit(code);
    }
  });

  return child;
}

const webhook = run('node', ['server/webhookServer.mjs'], 'webhook-server');
const vite = run('npm', ['run', 'dev:vite', '--', '--host', '0.0.0.0', '--port', '5173'], 'vite');

function shutdown() {
  webhook.kill('SIGTERM');
  vite.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
