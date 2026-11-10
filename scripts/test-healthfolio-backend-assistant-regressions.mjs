import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected ${relativePath} to exist`);
  return fs.readFileSync(absolutePath, 'utf8');
}

const shared = read('supabase/functions/_shared/assistant.ts');
const configFunction = read('supabase/functions/assistant-config/index.ts');
const responseFunction = read('supabase/functions/assistant-response/index.ts');
const remoteModels = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/AssistantRemoteModels.swift');
const nativeAPI = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift');
const appModel = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift');
const nativeConfig = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseConfig.swift');
const packageJson = JSON.parse(read('package.json'));
const assistantQuestionBlock = appModel.slice(
  appModel.indexOf('func askHealthFolio'),
  appModel.indexOf('func clearAssistantHistory')
);
const clearAssistantHistoryBlock = appModel.slice(
  appModel.indexOf('func clearAssistantHistory'),
  appModel.indexOf('private func activateAssistantHistory')
);

assert.equal(packageJson.scripts['test:backend-assistant'], 'node scripts/test-healthfolio-backend-assistant-regressions.mjs');

assert.match(shared, /ASSISTANT_MODEL/);
assert.match(shared, /ASSISTANT_SYSTEM_PROMPT/);
assert.match(shared, /assistantErrorResponse/);
assert.match(shared, /responseSchemaVersion/);
assert.match(configFunction, /auth\.getUser\(token\)/);
assert.match(shared, /maxQuestionCharacters/);

assert.match(responseFunction, /Authorization/);
assert.match(responseFunction, /auth\.getUser\(token\)/);
assert.match(responseFunction, /rpc\('assistant_profile_access',\s*\{\s*p_requester_id: requesterId, p_target_id: targetId/);
assert.doesNotMatch(responseFunction, /from\('FamilyLink'\)/);
assert.match(responseFunction, /profileId/);
assert.match(responseFunction, /ParameterReading/);
assert.match(responseFunction, /ParameterCatalog/);
assert.match(responseFunction, /store:\s*false/);
assert.match(responseFunction, /sourceRecordIds/);
assert.match(responseFunction, /authorizedDocumentIds/);
assert.match(responseFunction, /responseSchemaVersion/);
assert.match(configFunction, /assistantErrorResponse/);
assert.match(responseFunction, /assistantErrorResponse/);

assert.match(remoteModels, /struct AssistantRemoteConfig/);
assert.match(remoteModels, /struct AssistantRemoteResponse/);
assert.match(nativeAPI, /assistant-config/);
assert.match(nativeAPI, /assistant-response/);
assert.match(nativeAPI, /requestAssistantResponse/);
assert.match(appModel, /requestAssistantResponse/);
assert.match(appModel, /activeProfileId/);
assert.match(assistantQuestionBlock, /assistantRemoteUnavailableMessage/);
assert.match(assistantQuestionBlock, /compactMap \{ \(sourceId: String\) -> UUID\?/);
assert.match(assistantQuestionBlock, /sourceRecordIds: result\.sourceRecordIds/);
assert.doesNotMatch(assistantQuestionBlock, /self\.records\.first/);
assert.doesNotMatch(assistantQuestionBlock, /answer\(for:/);
assert.match(clearAssistantHistoryBlock, /assistantResponseTask\?\.cancel\(\)/);
assert.match(clearAssistantHistoryBlock, /isAssistantThinking = false/);
assert.doesNotMatch(nativeConfig, /OPENAI_API_KEY/i);
assert.doesNotMatch(nativeConfig, /ASSISTANT_SYSTEM_PROMPT/i);

console.log('Backend Assistant contract and profile-scope checks passed.');
