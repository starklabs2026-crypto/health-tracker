# Backend Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the shipped SwiftUI Assistant through authenticated Supabase Edge Functions with a stable structured response and backend-controlled configuration.

**Architecture:** Add `assistant-config` and `assistant-response` functions. The response function authenticates the caller, authorizes the selected profile, fetches only that profile's records/readings, calls OpenAI with backend-held configuration, validates source ids, and returns a stable JSON object. Add a Swift decoding/client bridge and retain the current local answer path as a fallback.

**Tech Stack:** Supabase Edge Functions, Deno TypeScript, Supabase service-role server client, OpenAI Responses API, Swift Concurrency, SwiftUI, Node regression scripts.

## Global Constraints

- Never place `OPENAI_API_KEY` or backend prompt configuration in the iOS bundle.
- Preserve profile authorization: authenticated user or active `FamilyLink` member only.
- Return only source document ids authorized for the selected profile.
- Keep `responseSchemaVersion` at `1` for this release.
- Limit questions to 2,000 characters and history to six bounded messages.
- Use `store: false` for OpenAI requests.
- Keep the existing local Assistant as fallback when remote configuration or response calls fail.
- Do not add dependencies to the mobile app.

---

### Task 1: Add failing contract and authorization regression tests

**Files:**
- Create: `scripts/test-healthfolio-backend-assistant-regressions.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: source files created by later tasks.
- Produces: executable checks for function names, stable response fields, authentication/profile guards, OpenAI privacy settings, source-id validation, and Swift remote bridge wiring.

- [ ] **Step 1: Write the failing test**

Create a Node script that reads the expected Edge Function and Swift files, asserts both function directories exist, and checks for these required patterns: bearer-token validation, `FamilyLink` access check, selected `profileId` in the request body, `store: false`, `responseSchemaVersion`, source-id allow-list filtering, and Swift calls to both function paths. Assert the package script exists.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node scripts/test-healthfolio-backend-assistant-regressions.mjs
```

Expected: FAIL because the Assistant Edge Functions, Swift remote models, and client bridge do not exist yet.

- [ ] **Step 3: Add the package script**

Add:

```json
"test:backend-assistant": "node scripts/test-healthfolio-backend-assistant-regressions.mjs"
```

- [ ] **Step 4: Run the test again**

Run the same command and confirm it still fails for missing implementation files rather than a test syntax error.

### Task 2: Implement backend Assistant configuration and response functions

**Files:**
- Create: `supabase/functions/_shared/assistant.ts`
- Create: `supabase/functions/assistant-config/index.ts`
- Create: `supabase/functions/assistant-response/index.ts`
- Modify: `supabase/functions/README.md`

**Interfaces:**
- Consumes: authenticated Supabase bearer tokens, `User`, `FamilyLink`, `Document`, `ParameterReading`, and `ParameterCatalog` rows.
- Produces: `assistant-config` contract `{version, enabled, responseSchemaVersion, maxQuestionCharacters}` and `assistant-response` contract `{answer, sourceRecordIds, isRefusal, configVersion, responseSchemaVersion}`.

- [ ] **Step 1: Add shared backend configuration helpers**

Define environment-backed values with these defaults:

```ts
ASSISTANT_ENABLED !== 'false'
ASSISTANT_CONFIG_VERSION ?? '1'
ASSISTANT_MODEL ?? 'gpt-4.1-mini'
ASSISTANT_MAX_QUESTION_CHARACTERS ?? '2000'
ASSISTANT_MAX_OUTPUT_TOKENS ?? '1200'
ASSISTANT_REQUEST_TIMEOUT_MS ?? '45000'
```

Keep the default system policy in the Edge Function, allow `ASSISTANT_SYSTEM_PROMPT` to override it, and export the JSON schema plus response text extraction helpers.

- [ ] **Step 2: Implement authenticated config response**

Require `POST`, require a valid bearer token through `admin.auth.getUser(token)`, and return only public operational config. Do not return the prompt or API key.

- [ ] **Step 3: Implement authenticated profile-scoped context loading**

Resolve the authenticated app `User`, select the requested profile or the primary profile, authorize managed profiles through an active `FamilyLink`, and query only that profile's non-deleted documents and readings. Join reading labels from `ParameterCatalog`; omit storage paths and auth identifiers.

- [ ] **Step 4: Implement the OpenAI structured response call**

Send a system policy, bounded history, current question, and serialized selected-profile context to the Responses API. Use `store: false`, the configured model, strict JSON schema output, and an abort timeout. Return a generic 502 error when the provider fails.

- [ ] **Step 5: Validate and return the stable response**

Require a non-empty answer and boolean refusal flag. Intersect returned source ids with the authorized document ids. Include the backend config and schema versions.

- [ ] **Step 6: Document deployment and environment controls**

Document:

```bash
npx --yes supabase@2.101.0 functions deploy assistant-config --project-ref qojdeuacwkmlxmodeabt
npx --yes supabase@2.101.0 functions deploy assistant-response --project-ref qojdeuacwkmlxmodeabt
npx --yes supabase@2.101.0 secrets set ASSISTANT_MODEL=gpt-4.1-mini ASSISTANT_CONFIG_VERSION=1 ASSISTANT_ENABLED=true
```

Do not include real secret values in documentation or source.

### Task 3: Add the Swift remote response models and API methods

**Files:**
- Create: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/AssistantRemoteModels.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift`
- Modify: `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`
- Create: `scripts/test-healthfolio-assistant-remote-models.swift`
- Modify: `package.json`

**Interfaces:**
- Consumes: the two Edge Function JSON contracts.
- Produces: `AssistantRemoteConfig`, `AssistantRemoteResponse`, `loadAssistantConfig()`, and `requestAssistantResponse(profileId:question:history:)`.

- [ ] **Step 1: Write and run the failing Swift decoder test**

Test that `AssistantRemoteConfig` decodes the four config fields and `AssistantRemoteResponse` decodes the five response fields, including a source id and refusal response. Run the new interpreter-mode package script and confirm it fails because the models do not exist.

- [ ] **Step 2: Implement the Codable models**

Use Foundation-only `Decodable`/`Encodable` structs with explicit fields and no `Any` payloads.

- [ ] **Step 3: Implement API calls**

Add authenticated POST calls to `/assistant-config` and `/assistant-response` using `NativeSupabaseConfig.functionsURL`, pass the active profile id and the last six conversation messages, decode the stable response, and use a 45-second timeout for Assistant calls.

- [ ] **Step 4: Add the Swift file to the Xcode target**

Add the new source file to the HealthFolio target's Swift sources in `project.pbxproj`.

- [ ] **Step 5: Run the decoder test**

Run:

```bash
npm run test:assistant-remote-models
```

Expected: PASS.

### Task 4: Route SwiftUI Assistant through the backend with fallback

**Files:**
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/AssistantNativeView.swift`
- Modify: `scripts/test-healthfolio-backend-assistant-regressions.mjs`

**Interfaces:**
- Consumes: remote config/response methods and existing local `answer(for:)` behavior.
- Produces: remote-first Assistant answers with profile-scoped sources, cancellation, and local fallback.

- [ ] **Step 1: Add backend state and config loading**

Store the latest remote config in the model. During authenticated dashboard loading, fetch config opportunistically without blocking the main dashboard. Use `enabled == false` to select local mode.

- [ ] **Step 2: Replace the local-only answer task**

Keep the current user-message/history behavior. If remote mode is enabled, call `requestAssistantResponse` for the selected profile; map returned source ids to current `HealthRecord` ids; append the structured answer. On timeout, transport failure, disabled config, or schema failure, call the existing local `answer(for:)` method and preserve the same profile-scoped history key.

- [ ] **Step 3: Handle backend limits and visible loading state**

Trim submitted questions to the remote max length, keep the existing send disable state, and change the thinking label to indicate record review without exposing backend details. Do not add a second Assistant UI or alter unrelated SwiftUI screens.

- [ ] **Step 4: Extend static regression coverage**

Assert the app passes the selected `activeProfileId`, calls the remote method before local fallback, cancels in-flight requests on profile changes, and does not embed an OpenAI key or prompt.

- [ ] **Step 5: Run focused tests**

Run the Assistant policy/history/remote model tests and the backend contract regression test. Confirm all pass before broader checks.

### Task 5: Verify, deploy, and document backend operation

**Files:**
- Modify: `supabase/functions/README.md`
- Modify: `docs/healthfolio-build60-functionality-restoration-handoff.md`

**Interfaces:**
- Consumes: implemented functions, tests, and existing project ref `qojdeuacwkmlxmodeabt`.
- Produces: deployed Assistant functions, operational environment instructions, and a reproducible verification record.

- [ ] **Step 1: Run repository checks**

Run:

```bash
git diff --check
plutil -lint apps/mobile/ios/HealthFolio/Info.plist
npm run typecheck --workspace mobile
npm run lint --workspace mobile
npm run test:backend-assistant
npm run test:assistant-remote-models
npm run test:assistant-policy
npm run test:assistant-history
```

- [ ] **Step 2: Deploy the two Edge Functions**

Deploy with the linked project ref and verify the CLI reports both functions successfully deployed. Set only non-secret Assistant controls in the command; never print or commit API keys.

- [ ] **Step 3: Run authenticated smoke checks**

With a test session, verify config returns schema version `1`, the primary profile returns an answer, a permitted managed profile returns only its sources, an unauthorized profile returns 403, unrelated questions are refused, and a disabled/failed backend falls back locally in the app.

- [ ] **Step 4: Review staged scope**

Stage only the two functions, shared helper, Swift bridge/model/app changes, tests, README, handoff, and package scripts. Exclude raw screenshots and generated artifacts.

- [ ] **Step 5: Commit**

Use:

```bash
git commit -m "feat: move assistant intelligence behind edge functions"
```
