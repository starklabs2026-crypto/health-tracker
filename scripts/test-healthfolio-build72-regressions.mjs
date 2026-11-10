#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

const recordsView = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/RecordsNativeView.swift');
assert(
  countOccurrences(recordsView, 'Button("Add record"') === 1,
  'Records should expose one Add record action: the toolbar plus button.',
);

const rootView = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioRootView.swift');
assert(!rootView.includes('FirstLaunchSpotlightView'), 'First-launch guide should not use stale hardcoded spotlights.');
assert(!rootView.includes('StrokeStyle(lineWidth: 2, dash'), 'First-launch guide should not draw dashed target boxes.');

const appModel = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift');
assert(appModel.includes('Tap the plus button to import'), 'First-launch copy should point to the single plus button.');
assert(!appModel.includes('Use Add record or the plus button'), 'First-launch copy should not mention the removed Add record button.');

const uploadView = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/UploadRecordsNativeView.swift');
for (const disallowed of ['bank statements', 'insurance forms', 'invoices', 'unrelated documents']) {
  assert(!uploadView.includes(disallowed), `Upload guide should not show negative document copy: ${disallowed}`);
}
assert(
  uploadView.includes('does not look like medical records') || uploadView.includes('does not look medical'),
  'Upload guide should explain that HealthFolio flags non-medical files after upload.',
);

const trendsView = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/TrendsNativeView.swift');
const trendDetailView = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/TrendDetailNativeView.swift');
assert(
  trendsView.includes('import Charts') && trendsView.includes('BarMark('),
  'Trend cards should render per-reading vertical bars with native Swift Charts.',
);
assert(
  trendsView.includes('RectangleMark(') && trendsView.includes('data.referenceBand'),
  'Trend charts should render validated reference intervals as bands.',
);
assert(
  trendsView.includes('LineMark(') && trendsView.includes('PointMark(') && trendDetailView.includes('detailed: true'),
  'Trend detail should use the dated line-and-points rendering mode.',
);

// Rendering checks are structural; execute the production helper for data correctness.
const trendTests = spawnSync(process.execPath, [join(root, 'scripts/test-healthfolio-native-behavior.mjs'), 'trends'], {
  cwd: root,
  stdio: 'inherit',
  timeout: 60_000,
});
if (trendTests.error) throw trendTests.error;
assert(trendTests.status === 0, 'Real TrendChartData behavior tests must pass.');

const ocrFunction = read('supabase/functions/process-document-ocr/index.ts');
assert(ocrFunction.includes('medical_document'), 'OCR schema should classify medical versus non-medical files.');
assert(ocrFunction.includes('unsupported_document'), 'OCR failure state should preserve unsupported-document classification.');
assert(
  ocrFunction.includes('This file does not look like a medical record.'),
  'OCR unsupported copy should use the concise medical-record error.',
);

const nativeApi = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift');
assert(nativeApi.includes('OCRInvocationResponse'), 'Native upload should inspect OCR invocation results.');
assert(
  appModel.includes('This file does not look like a medical record.'),
  'Native upload should normalize unsupported-document copy.',
);

console.log('Build 72 regression checks passed.');
