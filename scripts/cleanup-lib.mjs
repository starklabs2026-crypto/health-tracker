import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, sep } from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '',
  '.cjs',
  '.css',
  '.env',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.md',
  '.plist',
  '.rb',
  '.sh',
  '.sql',
  '.swift',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yml',
  '.yaml',
]);

const BINARY_EXTENSIONS = new Set([
  '.a',
  '.app',
  '.dSYM',
  '.gif',
  '.ipa',
  '.jpg',
  '.jpeg',
  '.mobileprovision',
  '.p12',
  '.p8',
  '.pdf',
  '.png',
  '.xcarchive',
  '.zip',
]);

export const BUCKETS = [
  {
    id: 'local-generated',
    title: 'Local/generated artifacts',
    description: 'Keep out of commits unless explicitly reviewed as source.',
    matches: [
      /^\.agents(\/|$)/,
      /^skills-lock\.json$/,
      /^docs\/visual-mockups\//,
      /(^|\/)\.DS_Store$/,
      /(^|\/)node_modules\//,
      /(^|\/)\.expo\//,
      /(^|\/)\.turbo\//,
      /(^|\/)build\//,
      /(^|\/)dist\//,
      /(^|\/)DerivedData\//,
      /\.(ipa|xcarchive|dSYM|mobileprovision|p12|p8)$/i,
    ],
  },
  {
    id: 'workspace-deps',
    title: 'Workspace dependencies/build config',
    description: 'Package manifests, lockfiles, workspace config, and CocoaPods config.',
    matches: [
      /^package(-lock)?\.json$/,
      /^apps\/[^/]+\/package\.json$/,
      /^packages\/[^/]+\/package\.json$/,
      /^packages\/[^/]+\/tsconfig\.json$/,
      /^apps\/mobile\/ios\/Podfile(\.lock|\.properties\.json)?$/,
      /^apps\/mobile\/metro\.config\.js$/,
    ],
  },
  {
    id: 'backend-supabase',
    title: 'Backend, Supabase, and shared contracts',
    description: 'API, worker, Supabase functions/migrations, Prisma, and shared contract packages.',
    matches: [
      /^apps\/api\//,
      /^apps\/worker\//,
      /^supabase\//,
      /^packages\/shared-types\//,
      /^packages\/parameter-catalog\//,
      /^packages\/phi-scrubber\//,
    ],
  },
  {
    id: 'mobile-swiftui-native',
    title: 'Active iOS SwiftUI/native surface',
    description: 'The shipped iOS shell and native project wiring.',
    matches: [
      /^apps\/mobile\/ios\/HealthFolio\/SwiftUIPrototype\//,
      /^apps\/mobile\/ios\/HealthFolio\/(AppDelegate|SceneDelegate)\.swift$/,
      /^apps\/mobile\/ios\/HealthFolio\/Info\.plist$/,
      /^apps\/mobile\/ios\/HealthFolio\/LaunchBrand\.storyboard$/,
      /^apps\/mobile\/ios\/HealthFolio\/Images\.xcassets\//,
      /^apps\/mobile\/ios\/HealthFolio\.xcodeproj\//,
    ],
  },
  {
    id: 'mobile-rn-compat',
    title: 'Mobile RN/Expo compatibility surface',
    description: 'Expo Router screens, React Native compatibility files, assets, and mobile config.',
    matches: [
      /^apps\/mobile\/app\//,
      /^apps\/mobile\/src\//,
      /^apps\/mobile\/assets\//,
      /^apps\/mobile\/app\.json$/,
      /^apps\/mobile\/eas\.json$/,
      /^apps\/mobile\/\.easignore$/,
      /^apps\/mobile\/vitest\.config\.ts$/,
    ],
  },
  {
    id: 'cleanup-tooling',
    title: 'Cleanup pipeline tooling',
    description: 'Scripts and tests that support review, scanning, snapshot verification, and commit hygiene.',
    matches: [/^scripts\/cleanup-[^/]+\.mjs$/],
  },
  {
    id: 'docs-handoff',
    title: 'Docs and handoff material',
    description: 'Release notes, reference docs, handoff docs, and workflow documentation.',
    matches: [/^docs\//, /^README\.md$/],
  },
  {
    id: 'review-required',
    title: 'Review-required leftovers',
    description: 'Anything not classified by the known HealthFolio release buckets.',
    matches: [/.*/],
  },
];

export const BLOCKED_PATH_PATTERNS = [
  { pattern: /(^|\/)node_modules\//, reason: 'dependency folder' },
  { pattern: /(^|\/)\.agents(\/|$)/, reason: 'local agent workspace' },
  { pattern: /^skills-lock\.json$/, reason: 'local plugin/skill lockfile' },
  { pattern: /^docs\/visual-mockups\//, reason: 'generated visual mockup asset' },
  { pattern: /(^|\/)build\//, reason: 'generated build output' },
  { pattern: /(^|\/)dist\//, reason: 'generated distribution output' },
  { pattern: /(^|\/)\.expo\//, reason: 'local Expo state' },
  { pattern: /\.(ipa|xcarchive|dSYM|mobileprovision|p12|p8)$/i, reason: 'signed build/signing artifact' },
];

export const SECRET_PATTERNS = [
  { name: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'OpenAI API key', pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: 'Supabase service role assignment',
    pattern: /\bSUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"]?[A-Za-z0-9._-]{20,}/i,
  },
  {
    name: 'generic password assignment',
    pattern: /\b(temp[_ -]?password|password)\s*[:=]\s*['"][^'"\n]{8,}['"]/i,
  },
  {
    name: 'bearer token literal',
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{24,}\b/i,
  },
  {
    name: 'JWT literal',
    pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  },
];

export function normalizePath(filePath) {
  return filePath.split(sep).join('/').replace(/^\.\//, '');
}

export function classifyPath(filePath) {
  const normalized = normalizePath(filePath);
  return BUCKETS.find((bucket) => bucket.matches.some((pattern) => pattern.test(normalized)));
}

export function groupByBucket(files) {
  const groups = new Map(BUCKETS.map((bucket) => [bucket.id, { bucket, files: [] }]));
  for (const file of [...files].map(normalizePath).sort()) {
    const bucket = classifyPath(file);
    groups.get(bucket.id).files.push(file);
  }
  return [...groups.values()].filter((group) => group.files.length > 0);
}

export function isTextFile(filePath) {
  const ext = extname(filePath);
  if (BINARY_EXTENSIONS.has(ext)) return false;
  return TEXT_EXTENSIONS.has(ext);
}

export function scanTextForSecrets(text, filePath = '<text>') {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const secret of SECRET_PATTERNS) {
      if (secret.pattern.test(line)) {
        findings.push({
          file: normalizePath(filePath),
          line: index + 1,
          type: secret.name,
          preview: line.trim().slice(0, 180),
        });
      }
    }
  }
  return findings;
}

export function scanFiles(files, root = process.cwd()) {
  const blockedPaths = [];
  const secretFindings = [];

  for (const file of files.map(normalizePath).sort()) {
    for (const blocked of BLOCKED_PATH_PATTERNS) {
      if (blocked.pattern.test(file)) {
        blockedPaths.push({ file, reason: blocked.reason });
      }
    }

    const fullPath = `${root}/${file}`;
    if (!existsSync(fullPath)) continue;

    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }
    if (!stats.isFile() || stats.size > 2_000_000 || !isTextFile(file)) continue;

    const text = readFileSync(fullPath, 'utf8');
    secretFindings.push(...scanTextForSecrets(text, file));
  }

  return { blockedPaths, secretFindings };
}

export function testCoverageHints(files) {
  const normalized = files.map(normalizePath);
  const hasApiCode = normalized.some(
    (file) => /^apps\/api\/src\/.*\.ts$/.test(file) && !/\.(test|spec)\.ts$/.test(file),
  );
  const hasApiTest = normalized.some((file) => /^apps\/api\/src\/.*\.(test|spec)\.ts$/.test(file));
  const hasMobileLogic = normalized.some(
    (file) =>
      /^apps\/mobile\/(app|src)\/.*\.(ts|tsx)$/.test(file) && !/\.(test|spec)\.tsx?$/.test(file),
  );
  const hasMobileTest = normalized.some((file) =>
    /^apps\/mobile\/.*\.(test|spec)\.tsx?$/.test(file),
  );
  const hasSwiftUI = normalized.some((file) =>
    /^apps\/mobile\/ios\/HealthFolio\/SwiftUIPrototype\/.*\.swift$/.test(file),
  );

  const hints = [];
  if (hasApiCode && !hasApiTest) {
    hints.push('API source changed without an API unit/regression test in the same dirty set.');
  }
  if (hasMobileLogic && !hasMobileTest) {
    hints.push('Mobile app/source changed without a mobile unit/regression test in the same dirty set.');
  }
  if (hasSwiftUI) {
    hints.push('SwiftUI/native changes need a no-space snapshot native build or a documented simulator/device repro.');
  }
  return hints;
}
