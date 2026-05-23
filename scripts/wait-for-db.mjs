// Cross-platform replacement for the playbook's bash `sleep 3` before migrate.
// Polls the Postgres TCP port until it accepts connections (or times out).
import net from 'node:net';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/medical_tracker');
const host = url.hostname;
const port = Number(url.port || 5432);
const timeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS ?? 60_000);

function tryConnect() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(2000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    const fail = () => {
      socket.destroy();
      resolve(false);
    };
    socket.once('error', fail);
    socket.once('timeout', fail);
  });
}

const started = Date.now();
process.stdout.write(`Waiting for Postgres at ${host}:${port} ...`);
while (Date.now() - started < timeoutMs) {
  if (await tryConnect()) {
    process.stdout.write(' up.\n');
    process.exit(0);
  }
  process.stdout.write('.');
  await new Promise((r) => setTimeout(r, 1500));
}
process.stdout.write('\n');
console.error(`Postgres did not become ready within ${timeoutMs}ms. Is Docker Desktop running? Try: npm run db:up`);
process.exit(1);
