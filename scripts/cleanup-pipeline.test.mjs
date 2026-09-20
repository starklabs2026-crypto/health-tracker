import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import {
  classifyPath,
  groupByBucket,
  scanTextForSecrets,
  testCoverageHints,
} from './cleanup-lib.mjs';

test('verification includes native behavior and Assistant security regressions', () => {
  const result = spawnSync(process.execPath, ['scripts/cleanup-pipeline.mjs', 'verify', '--dry-run'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  for (const suite of [
    'test:ios-session', 'test:ios-profile', 'test:ios-trends', 'test:ios-uploads', 'test:assistant-behavior',
    'test:ingestion-security', 'test:deletion-behavior', 'test:profile-document-access',
    'test:inbound-email-security',
  ]) {
    assert.ok(result.stdout.includes(`npm run ${suite}`), `Missing verification gate: ${suite}`);
  }
});

test('classifies the active SwiftUI shipped surface separately from RN compatibility files', () => {
  assert.equal(
    classifyPath('apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioRootView.swift').id,
    'mobile-swiftui-native',
  );
  assert.equal(classifyPath('apps/mobile/app/(tabs)/home.tsx').id, 'mobile-rn-compat');
});

test('keeps generated review artifacts in the local-generated bucket', () => {
  const groups = groupByBucket([
    'docs/visual-mockups/healthfolio-orange-white-template.png',
    '.agents/review/output.json',
    'skills-lock.json',
  ]);

  assert.deepEqual(
    groups.map((group) => group.bucket.id),
    ['local-generated'],
  );
  assert.equal(groups[0].files.length, 3);
});

test('detects literal credentials without flagging environment variable names alone', () => {
  assert.equal(scanTextForSecrets('const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");').length, 0);

  const fakeKey = `sk-${'abcdefghijklmnopqrstuvwxyz1234567890'}`;
  const findings = scanTextForSecrets(`OPENAI_API_KEY="${fakeKey}"`, 'sample.env');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, 'OpenAI API key');
});

test('emits regression-test hints for source changes without nearby tests', () => {
  assert.deepEqual(testCoverageHints(['apps/api/src/shares/shares.service.ts']), [
    'API source changed without an API unit/regression test in the same dirty set.',
  ]);

  assert.deepEqual(
    testCoverageHints([
      'apps/api/src/shares/shares.service.ts',
      'apps/api/src/shares/shares.service.test.ts',
    ]),
    [],
  );
});
