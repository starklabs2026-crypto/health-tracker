import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const api = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift');
const config = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseConfig.swift');
const appModel = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift');
const rootView = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioRootView.swift');
const profileView = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileNativeView.swift');
const assistantPolicy = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/AssistantPrompt.swift');
const assistantStore = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/AssistantChatLocalStore.swift');

assert.match(
  api,
  /requestPasswordReset[\s\S]*code_challenge[\s\S]*code_challenge_method[\s\S]*savePasswordRecoveryVerifier\(codeVerifier\)/,
  'Password reset must securely persist a PKCE verifier only after Supabase accepts the recovery request.',
);
assert.match(
  api,
  /requestPasswordReset[\s\S]*passwordRecoveryCallbackURL[\s\S]*redirect_to/,
  'Password reset callbacks must carry an explicit recovery marker.',
);
assert.match(config, /passwordRecoveryCallbackURL[\s\S]*flow=recovery/);
assert.match(
  api,
  /func isPasswordRecoveryCallback[\s\S]*params\["flow"\] == "recovery"[\s\S]*params\["type"\] == "recovery"/,
  'Only explicitly marked recovery callbacks may consume the stored PKCE verifier.',
);
assert.doesNotMatch(
  api,
  /params\["code"\][\s\S]*savedPasswordRecoveryVerifier\(\) != nil/,
  'A stale reset verifier must not classify an unrelated OAuth code callback as recovery.',
);
assert.doesNotMatch(
  api,
  /UserDefaults\.standard\.(set|string|removeObject)[^\n]*passwordRecoveryVerifierKey/,
  'The PKCE verifier must not be stored in unprotected UserDefaults.',
);
assert.match(
  api,
  /completeAuthCallback[\s\S]*savedPasswordRecoveryVerifier\(\)[\s\S]*session\(fromCallbackURL: url, codeVerifier: verifier\)[\s\S]*if isRecovery \{[\s\S]*snapshot = try\? await loadDashboard/,
  'A recovery callback containing an auth code must exchange it with the persisted PKCE verifier.',
);
assert.match(
  appModel,
  /let callback = try await supabase\.completeAuthCallback\(url\)[\s\S]*isPasswordResetRequired = callback\.isRecovery[\s\S]*if let snapshot = callback\.snapshot/,
  'A successful recovery exchange must present reset even when dashboard hydration is unavailable.',
);
assert.match(
  rootView,
  /trimmingCharacters[\s\S]*normalizedPath == "callback"/,
  'Auth callback routing must accept callback paths with or without a trailing slash.',
);
assert.match(
  profileView,
  /Label\("Change password", systemImage: "key"\)/,
  'Signed-in Profile must expose Change password.',
);
const profileBusyGuard = profileView.match(/private var isBusy: Bool \{([^}]+)\}/)?.[1];
assert.ok(profileBusyGuard, 'Profile must declare its operation guard.');
assert.doesNotMatch(profileBusyGuard, /model\.isLoadingData/,
  'An unrelated dashboard refresh must not disable profile editing, Close, or Sign out.');
assert.match(profileBusyGuard, /isSavingProfile.*activeOperation.*isSwitchingProfile.*isMergingProfile/,
  'Profile mutations must still prevent overlapping local operations.');
assert.match(profileView, /ProfileManagementRow\([\s\S]*?isBusy: isBusy \|\| model\.isLoadingData/,
  'Family role and merge actions must wait for existing dashboard reads.');

const scopeGuard = appModel.indexOf('if !isMedicalAssistantQuestion(lower)');
const noRecords = appModel.indexOf('if records.isEmpty', scopeGuard);
assert.ok(scopeGuard >= 0 && noRecords > scopeGuard, 'Unrelated prompts must be rejected before record fallback.');
assert.match(
  appModel,
  /I can only help with medical information in your HealthFolio records/,
  'The assistant must provide a clear medical-scope refusal.',
);
assert.match(
  appModel,
  /return Array\(matching\.prefix\(limit\)\)/,
  'Record relevance must not fall back to arbitrary recent records for unmatched questions.',
);
assert.match(
  appModel,
  /AssistantQuestionPolicy\.isMedicalQuestion/,
  'The assistant must use the boundary-aware medical question policy.',
);
assert.doesNotMatch(
  appModel,
  /\(\[record\.title, record\.fileName\] \+ record\.metrics/,
  'Record titles and filenames must not widen assistant medical scope.',
);
assert.doesNotMatch(
  appModel,
  /if record\.status == \.ready[\s\S]{0,120}score \+= 2/,
  'Ready/value state alone must not make an unrelated record relevant.',
);
assert.doesNotMatch(
  appModel,
  /Report-based age estimate:/,
  'Assistant replies must not present a derived report-based age as record-backed medical information.',
);
assert.match(
  appModel,
  /private func metricMatchScore[\s\S]*AssistantQuestionPolicy\.recordMatchScore/,
  'Metric retrieval must use the same generic-word filtering as assistant scope.',
);
assert.doesNotMatch(
  appModel,
  /let selected = relevant\.isEmpty \? Array\(records\.sorted/,
  'A named marker that is absent must not fall back to arbitrary recent records.',
);
assert.match(
  appModel,
  /private func latestRecordAnswer\(question: String\)[\s\S]*assistantTokens\(question\)[\s\S]*relevantRecords\(for: question/,
  'Latest-record answers must ground non-generic questions in matching records.',
);
assert.match(
  appModel,
  /assistantResponseTask\?\.cancel\(\)[\s\S]*activateAssistantHistory/,
  'Profile changes must cancel in-flight assistant work before loading profile-scoped history.',
);
assert.match(
  assistantStore,
  /load\([\s\S]*profileKey: String[\s\S]*save\([\s\S]*profileKey: String[\s\S]*clearAll/,
  'Assistant history persistence must be profile-keyed and support privacy cleanup.',
);
assert.match(
  assistantPolicy,
  /components\(separatedBy: CharacterSet\.alphanumerics\.inverted\)[\s\S]*containsTerm\(/,
  'Assistant topic matching must use normalized word boundaries instead of raw substrings.',
);

assert.match(
  api,
  /retryTransientFailure \?\? \(method == "GET" \|\| method == "HEAD"\)/,
  'Read-only network requests must retry one transient failure.',
);
assert.match(
  api,
  /transientHTTPStatusCodes[\s\S]*429[\s\S]*500[\s\S]*502[\s\S]*503[\s\S]*504[\s\S]*attempt < maximumAttempts/,
  'Read-only requests must retry transient HTTP responses as well as URL errors.',
);
assert.match(
  api,
  /private func authenticatedSession[\s\S]*sessions\.session/,
  'Authentication must use the shared coordinator; its refresh behavior is exercised by test:ios-session.',
);
assert.match(
  api,
  /async let documentsRequest[\s\S]*async let readingsRequest[\s\S]*async let catalogRequest/,
  'Dashboard document, reading, and catalog loads must start concurrently.',
);

console.log('Auth, assistant, and network regression checks passed.');
