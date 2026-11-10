# Backend Assistant Design

**Date:** 2026-07-17

## Goal

Move HealthFolio's Assistant intelligence behind authenticated Supabase Edge Functions so model choice, prompts, safety policy, response style, and operational controls can change without an iOS build, while keeping SwiftUI responsible for presentation and local history.

## Architecture

The app calls `assistant-config` to learn whether the remote Assistant is enabled and which response contract version it supports. It calls `assistant-response` with the selected profile id, the current question, and a bounded conversation history. The function authenticates the caller, authorizes access to the selected profile through the existing family-link rule, loads only that profile's documents and readings, and sends a minimized medical context to OpenAI.

The function returns stable structured JSON. Source ids are validated against the authorized document set before returning them. The OpenAI key, model, system prompt, token limit, timeout, enablement switch, and config version remain Edge Function secrets/environment values. The SwiftUI app uses the remote response when available and falls back to its existing local records-first answer path when the backend is disabled or temporarily unreachable.

## Stable Contracts

`assistant-config` returns:

```json
{
  "version": "1",
  "enabled": true,
  "responseSchemaVersion": "1",
  "maxQuestionCharacters": 2000
}
```

`assistant-response` accepts:

```json
{
  "profileId": "optional-selected-profile-id",
  "question": "What changed in my latest blood report?",
  "history": [{"role": "user", "content": "..."}]
}
```

It returns:

```json
{
  "answer": "...",
  "sourceRecordIds": ["document-id"],
  "isRefusal": false,
  "configVersion": "1",
  "responseSchemaVersion": "1"
}
```

## Safety and Privacy

- The Edge Function validates the Supabase bearer token before reading any profile data.
- A requested profile must be the authenticated user's profile or an active managed family profile.
- File URLs, storage paths, auth identifiers, and unrelated profiles are excluded from model context.
- OpenAI requests use `store: false` and the service key never enters the app bundle.
- The model must answer only from the supplied HealthFolio context, refuse unrelated questions, avoid diagnosis/prescribing, and return only source ids from the supplied context.
- Provider failures return a generic temporary-unavailable response to the client and do not expose provider payloads.

## Compatibility

The first app build establishes the remote bridge. Future prompt/model/policy/config changes can be deployed through Supabase while preserving the JSON contract. A new app build is still required for UI changes, a new response schema that the app cannot decode, streaming, new interaction controls, or callback/configuration changes embedded in Swift.

## Verification

Regression coverage must prove authentication is required, cross-profile access is rejected, source ids are bounded to authorized records, the response contract is stable, the app sends the selected profile id, and local fallback remains available when remote Assistant calls fail.
