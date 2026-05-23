// Cross-platform `db:reset` (the playbook's bash version uses `&&` + `sleep`).
// Tears down the volumes, brings DB + Redis back up, waits, migrates, seeds.
import { spawnSync } from 'node:child_process';

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.error(`Step failed: ${cmd} ${args.join(' ')}`);
    process.exit(res.status ?? 1);
  }
}

run('docker', ['compose', 'down', '-v']);
run('docker', ['compose', 'up', '-d', 'postgres', 'redis']);
run('node', ['scripts/wait-for-db.mjs']);
run('npm', ['run', 'db:migrate']);
run('npm', ['run', 'db:seed']);
console.log('\nDatabase reset complete.');
