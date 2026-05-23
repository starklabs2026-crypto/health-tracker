// Cross-platform replacement for the playbook's bash PHI/console grep check:
//   grep -rE '\b(console\.log|console\.error)\b' apps/ packages/
//     | grep -v '\.test\.' | grep -v phi-scrubber | grep -v dev/
// Fails (exit 1) if raw console.* is used outside the phi-scrubber package,
// test files, or explicitly-dev code. Enforces "never console.log directly".
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOTS = ['apps', 'packages'];
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.turbo', '.expo', 'coverage']);
const CONSOLE_RE = /\bconsole\.(log|error|warn|info|debug)\b/;

/** A path is exempt if it's a test, the phi-scrubber package, or dev-only code. */
function isExempt(relPath) {
  const p = relPath.split(sep).join('/');
  return (
    /\.(test|spec)\./.test(p) ||
    p.includes('phi-scrubber') ||
    p.includes('/dev/') ||
    p.includes('/dev.')
  );
}

const violations = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full);
      continue;
    }
    const dot = entry.lastIndexOf('.');
    if (dot < 0 || !SOURCE_EXT.has(entry.slice(dot))) continue;

    const rel = relative(process.cwd(), full);
    if (isExempt(rel)) continue;

    const lines = readFileSync(full, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (CONSOLE_RE.test(line)) {
        violations.push(`${rel.split(sep).join('/')}:${i + 1}: ${line.trim()}`);
      }
    });
  }
}

for (const root of ROOTS) walk(root);

if (violations.length > 0) {
  console.error('PHI-scan FAILED — raw console.* found outside phi-scrubber/tests/dev:');
  for (const v of violations) console.error('  ' + v);
  console.error(`\n${violations.length} violation(s). Use the phi-scrubber logger instead.`);
  process.exit(1);
}
console.log('PHI-scan passed: no raw console.* outside phi-scrubber, tests, or dev code.');
