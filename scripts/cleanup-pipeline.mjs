#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { groupByBucket, scanFiles, testCoverageHints } from './cleanup-lib.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CLEANUP_TMP_ROOT = '/tmp';
const SNAPSHOT_PREFIX = join(CLEANUP_TMP_ROOT, 'healthfolio-cleanup-');

function usage(exitCode = 0) {
  const out = exitCode === 0 ? console.log : console.error;
  out(`Usage:
  node scripts/cleanup-pipeline.mjs classify [--staged] [--json]
  node scripts/cleanup-pipeline.mjs scan [--staged]
  node scripts/cleanup-pipeline.mjs verify [--native] [--dry-run] [--keep-snapshot] [--snapshot /tmp/path]

Commands:
  classify   Bucket dirty or staged files into commit/review groups.
  scan       Fail if dirty/staged files include blocked artifacts or likely secrets.
  verify     Run the cleanup verification gate from a no-space /tmp snapshot.
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {
    command,
    staged: false,
    json: false,
    native: false,
    dryRun: false,
    keepSnapshot: false,
    snapshot: null,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--staged') opts.staged = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--native') opts.native = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--keep-snapshot') opts.keepSnapshot = true;
    else if (arg === '--snapshot') {
      opts.snapshot = rest[index + 1];
      index += 1;
      if (!opts.snapshot) usage(1);
    } else if (arg === '-h' || arg === '--help') usage(0);
    else usage(1);
  }
  return opts;
}

function run(command, args, options = {}) {
  const label = [command, ...args].join(' ');
  if (options.dryRun) {
    console.log(`[dry-run] ${label}`);
    return '';
  }

  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, ...(options.env ?? {}) },
  });

  if (result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    throw new Error(`Command failed (${result.status}): ${label}`);
  }

  return options.capture ? result.stdout : '';
}

function gitLines(args) {
  const output = run('git', args, { capture: true });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function dirtyFiles({ staged = false } = {}) {
  if (staged) return gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACMRDT']);

  return [
    ...gitLines(['diff', '--name-only', '--diff-filter=ACMRDT']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ].filter((file, index, all) => all.indexOf(file) === index);
}

function reviewFiles() {
  return [...dirtyFiles({ staged: false }), ...dirtyFiles({ staged: true })].filter(
    (file, index, all) => all.indexOf(file) === index,
  );
}

function allSnapshotFiles() {
  return [
    ...gitLines(['ls-files']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ].filter((file, index, all) => all.indexOf(file) === index);
}

function quote(file) {
  return file.includes("'") ? `"${file.replaceAll('"', '\\"')}"` : `'${file}'`;
}

function classify(opts) {
  const files = dirtyFiles({ staged: opts.staged });
  const groups = groupByBucket(files);

  if (opts.json) {
    console.log(JSON.stringify(groups, null, 2));
    return;
  }

  if (files.length === 0) {
    console.log(opts.staged ? 'No staged files.' : 'No dirty files.');
    return;
  }

  console.log(`${opts.staged ? 'Staged' : 'Dirty'} files: ${files.length}`);
  for (const group of groups) {
    console.log(`\n## ${group.bucket.title} (${group.bucket.id})`);
    console.log(group.bucket.description);
    for (const file of group.files) console.log(`  ${file}`);
    console.log(`  stage: git add -- ${group.files.map(quote).join(' ')}`);
  }

  const hints = testCoverageHints(files);
  if (hints.length > 0) {
    console.log('\nTest/review hints:');
    for (const hint of hints) console.log(`  - ${hint}`);
  }
}

function scanFileSet(files, label) {
  if (files.length === 0) {
    console.log(`No ${label} files to scan.`);
    return true;
  }

  const { blockedPaths, secretFindings } = scanFiles(files, ROOT);
  if (blockedPaths.length === 0 && secretFindings.length === 0) {
    console.log(`Cleanup scan passed for ${files.length} ${label} file(s).`);
    return true;
  }

  if (blockedPaths.length > 0) {
    console.error('Blocked generated/local artifact paths:');
    for (const item of blockedPaths) console.error(`  ${item.file} (${item.reason})`);
  }
  if (secretFindings.length > 0) {
    console.error('Possible secret findings:');
    for (const item of secretFindings) {
      console.error(`  ${item.file}:${item.line} ${item.type}: ${item.preview}`);
    }
  }
  return false;
}

function scan(opts) {
  const files = dirtyFiles({ staged: opts.staged });
  const ok = scanFileSet(files, opts.staged ? 'staged' : 'dirty');
  if (!ok) process.exit(1);
}

function copySnapshot(snapshotPath, opts) {
  if (snapshotPath.includes(' ')) {
    throw new Error(`Snapshot path contains spaces: ${snapshotPath}`);
  }
  if (opts.dryRun) {
    console.log(`[dry-run] copy tracked and unignored files to ${snapshotPath}`);
    return;
  }
  if (existsSync(snapshotPath)) rmSync(snapshotPath, { recursive: true, force: true });
  mkdirSync(snapshotPath, { recursive: true });

  const files = allSnapshotFiles();
  for (const file of files) {
    const source = join(ROOT, file);
    if (!existsSync(source)) continue;
    const target = join(snapshotPath, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }

  console.log(`Snapshot: ${snapshotPath} (${files.length} files)`);
}

function verify(opts) {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 20) {
    throw new Error(`Node 20+ is required. Current Node: ${process.version}`);
  }

  const snapshotPath = opts.snapshot
    ? resolve(opts.snapshot)
    : opts.dryRun
      ? join(CLEANUP_TMP_ROOT, 'healthfolio-cleanup-dry-run')
      : mkdtempSync(SNAPSHOT_PREFIX);
  const snapshotRoot = snapshotPath;

  const commands = [
    { command: 'git', args: ['diff', '--check'], cwd: ROOT },
    {
      command: 'plutil',
      args: [
        '-lint',
        'apps/mobile/ios/HealthFolio/Info.plist',
        'apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj',
      ],
      cwd: ROOT,
    },
  ];

  for (const step of commands) run(step.command, step.args, { cwd: step.cwd, dryRun: opts.dryRun });
  if (opts.dryRun) console.log('[dry-run] scan staged, unstaged, and untracked files');
  else if (!scanFileSet(reviewFiles(), 'staged/dirty')) process.exit(1);

  copySnapshot(snapshotRoot, opts);

  const snapshotCommands = [
    ['npm', ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund']],
    ['npm', ['run', 'test:ios-onboarding']],
    ['npm', ['run', 'test:ios-session']],
    ['npm', ['run', 'test:ios-profile']],
    ['npm', ['run', 'test:ios-trends']],
    ['npm', ['run', 'test:ios-uploads']],
    ['npm', ['run', 'test:assistant-behavior']],
    ['npm', ['run', 'test:ingestion-security']],
    ['npm', ['run', 'test:deletion-behavior']],
    ['npm', ['run', 'test:profile-document-access']],
    ['npm', ['run', 'test:inbound-email-security']],
    ['npm', ['run', 'build', '--workspace', '@medical-tracker/shared-types']],
    ['npm', ['run', 'build', '--workspace', '@medical-tracker/parameter-catalog']],
    ['npm', ['run', 'build', '--workspace', '@medical-tracker/phi-scrubber']],
    ['npx', ['prisma', 'generate', '--schema', 'apps/api/prisma/schema.prisma']],
    ['npm', ['run', 'typecheck', '--workspace', 'mobile']],
    ['npm', ['run', 'lint', '--workspace', 'mobile']],
    ['npm', ['run', 'test', '--workspace', 'mobile', '--', '--reporter', 'verbose']],
    ['npm', ['run', 'typecheck', '--workspace', 'api']],
    ['npm', ['run', 'lint', '--workspace', 'api']],
    ['npm', ['run', 'test', '--workspace', 'api', '--', '--reporter', 'verbose']],
  ];

  for (const [command, args] of snapshotCommands) {
    run(command, args, { cwd: snapshotRoot, dryRun: opts.dryRun });
  }

  if (opts.native) {
    const iosDir = join(snapshotRoot, 'apps/mobile/ios');
    const logPath = join(CLEANUP_TMP_ROOT, `healthfolio-cleanup-xcodebuild-${Date.now()}.log`);
    run('pod', ['install'], { cwd: iosDir, dryRun: opts.dryRun });
    const xcodeArgs = [
      '-workspace',
      'HealthFolio.xcworkspace',
      '-scheme',
      'HealthFolio',
      '-configuration',
      'Debug',
      '-sdk',
      'iphonesimulator',
      '-destination',
      'generic/platform=iOS Simulator',
      '-derivedDataPath',
      join(CLEANUP_TMP_ROOT, 'healthfolio-cleanup-dd'),
      'CODE_SIGNING_ALLOWED=NO',
      'build',
    ];
    if (opts.dryRun) {
      console.log(`[dry-run] xcodebuild ${xcodeArgs.join(' ')} > ${logPath}`);
    } else {
      const result = spawnSync('xcodebuild', xcodeArgs, {
        cwd: iosDir,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 100,
      });
      writeFileSync(logPath, `${result.stdout ?? ''}${result.stderr ?? ''}`);
      if (result.status !== 0) {
        console.error(`Native build failed. Log: ${logPath}`);
        const tail = readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-120).join('\n');
        console.error(tail);
        process.exit(result.status ?? 1);
      }
      console.log(`Native build passed. Log: ${logPath}`);
    }
  }

  if (!opts.keepSnapshot && !opts.dryRun) rmSync(snapshotRoot, { recursive: true, force: true });
  console.log(opts.dryRun ? 'Cleanup verification dry-run completed.' : 'Cleanup verification gate passed.');
}

const opts = parseArgs(process.argv.slice(2));
try {
  if (!opts.command) usage(1);
  if (opts.command === 'classify') classify(opts);
  else if (opts.command === 'scan') scan(opts);
  else if (opts.command === 'verify') verify(opts);
  else usage(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
