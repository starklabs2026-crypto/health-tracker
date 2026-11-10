import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const native = 'apps/mobile/ios/HealthFolio/SwiftUIPrototype/';
const suites = {
  session: ['NativeSupabaseConfig.swift', 'NativeSupabaseError.swift', 'NativeSupabaseSession.swift', 'NativeSessionCoordinator.swift'],
  trends: ['TrendChartData.swift'],
  profile: ['FamilyProfileRole.swift', 'HealthFolioProfile.swift'],
};
const tests = { session: 'test-healthfolio-session.swift', trends: 'test-healthfolio-trend-data.swift', profile: 'test-healthfolio-profile.swift' };
const suite = process.argv[2] ?? 'session';
if (!suites[suite]) throw new Error(`Unknown suite: ${suite}`);
const temporary = mkdtempSync(join(tmpdir(), 'healthfolio-native-tests-'));
try {
  const executable = join(temporary, suite);
  const compile = spawnSync('swiftc', [...suites[suite].map((file) => native + file), 'scripts/' + tests[suite], '-o', executable], { cwd: root, stdio: 'inherit' });
  if (compile.error) throw compile.error;
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const run = spawnSync(executable, [], { cwd: temporary, stdio: 'inherit', timeout: 30_000 });
    if (run.error) throw run.error;
    process.exitCode = run.status ?? 1;
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
