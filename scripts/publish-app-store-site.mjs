#!/usr/bin/env node
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const sourceRoot = resolve(repoRoot, 'docs/app-store-site');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'healthfolio-pages-'));
const cloneRoot = join(temporaryRoot, 'site');

try {
  run('gh', ['auth', 'status'], { cwd: repoRoot });
  run('npm', ['run', 'test:app-store-site'], { cwd: repoRoot });

  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  const expectedRemote = 'https://github.com/starklabs2026-crypto/health-tracker.git';
  if (remote !== expectedRemote) {
    throw new Error(`Refusing to publish from unexpected origin: ${remote || '(missing)'}`);
  }

  run('git', [
    'clone',
    '--depth',
    '1',
    '--single-branch',
    '--branch',
    'gh-pages',
    remote,
    cloneRoot,
  ]);

  for (const entry of [
    'index.html',
    'privacy',
    'support',
    'privacy-choices',
    'assets',
    '.nojekyll',
  ]) {
    const destination = join(cloneRoot, entry);
    rmSync(destination, { recursive: true, force: true });
    cpSync(join(sourceRoot, entry), destination, { recursive: true });
  }

  run(process.execPath, [join(repoRoot, 'scripts/test-app-store-site.mjs')], {
    cwd: repoRoot,
    env: { ...process.env, APP_STORE_SITE_ROOT: cloneRoot },
  });

  run(
    'git',
    ['add', '--', 'index.html', 'privacy', 'support', 'privacy-choices', 'assets', '.nojekyll'],
    { cwd: cloneRoot },
  );
  const status = execFileSync('git', ['status', '--porcelain'], {
    cwd: cloneRoot,
    encoding: 'utf8',
  }).trim();

  if (!status) {
    console.log('App Store public site is already current.');
    process.exitCode = 0;
  } else {
    run('git', ['config', 'user.name', 'StarkLabs Release Automation'], { cwd: cloneRoot });
    run('git', ['config', 'user.email', 'starklabs2026@gmail.com'], { cwd: cloneRoot });
    run('git', ['commit', '-m', 'docs: update HealthFolio legal pages'], { cwd: cloneRoot });
    run('git', ['push', 'origin', 'gh-pages'], { cwd: cloneRoot });
    console.log('Published HealthFolio public pages.');
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  }
}
