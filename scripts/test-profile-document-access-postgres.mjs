#!/usr/bin/env node
// Real PostgreSQL/RLS tests. No database URL, credentials, or hosted services.
// Requires initdb, pg_ctl, and psql on PATH (or PG_BINDIR).
// --baseline omits only the new hardening migration to demonstrate red tests.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migration = '20260914130000_profile_document_access_hardening.sql';
assert(process.argv.slice(2).every((arg) => arg === '--baseline'), 'Only --baseline is supported');
const baseline = process.argv.includes('--baseline');
const directory = mkdtempSync(join(tmpdir(), 'hf-access-pg-'));
const data = join(directory, 'data');
const env = { PATH: process.env.PATH, HOME: directory, LC_ALL: 'C', LANG: 'C' };
const binary = (name) => process.env.PG_BINDIR ? join(process.env.PG_BINDIR, name) : name;
function run(name, args, input) {
  return spawnSync(binary(name), args, { env, input, encoding: 'utf8', timeout: 60_000, maxBuffer: 8_000_000 });
}
function checked(result, context) {
  assert.equal(result.status, 0, `${context}: ${result.error ?? result.stderr}`);
  return result.stdout.trim();
}
function query(sql) {
  return run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-h', directory, '-U', 'postgres', '-d', 'postgres'], sql);
}
const owner = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';
const legacy = '00000000-0000-4000-8000-000000000004';
const conflict = '00000000-0000-4000-8000-000000000005';
const binding = '00000000-0000-4000-8000-000000000006';
const newAccount = '00000000-0000-4000-8000-000000000007';
const jwt = (id, email = `${id}@example.test`) => `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: id, email, role: 'authenticated' })}';`;
const tests = [];
const test = (name, sql, want, options = {}) => tests.push({ name, sql, want, actor: owner, ...options });
const deny = (name, sql, options = {}) => test(name, sql, undefined, { denied: true, ...options });

deny('family manager cannot overwrite a member auth identity', `UPDATE "User" SET "authUserId" = '${newAccount}' WHERE id = '${member}';`);
deny('family manager cannot clear a member auth identity', `UPDATE "User" SET "authUserId" = NULL WHERE id = '${member}';`);
deny('managed profile cannot acquire a caller-chosen auth identity', `UPDATE "User" SET "authUserId" = '${newAccount}' WHERE id = 'managed';`);
deny('family manager cannot plant an email for later account binding', `UPDATE "User" SET email = 'planted@example.test' WHERE id = '${member}';`);
deny('self cannot rebind auth identity directly', `UPDATE "User" SET "authUserId" = '${newAccount}' WHERE id = '${owner}';`);
deny('self cannot change primary identity', `UPDATE "User" SET id = 'replacement' WHERE id = '${owner}';`);
const aliasFixture = `UPDATE "User" SET "inboundEmailAlias" = 'family-inbox' WHERE id = '${member}'; UPDATE "User" SET "inboundEmailAlias" = 'owner-inbox' WHERE id = '${owner}';`;
deny('family manager cannot clear another profile forwarding alias', `UPDATE "User" SET "inboundEmailAlias" = NULL WHERE id = '${member}';`, { before: aliasFixture });
test('clear-then-claim cannot capture the family forwarding address', `
  DO $$ BEGIN
    BEGIN
      UPDATE "User" SET "inboundEmailAlias" = NULL WHERE id = '${member}';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM public.claim_inbound_email_alias('family-inbox');
    EXCEPTION WHEN unique_violation THEN NULL; END;
  END $$;
  SELECT coalesce((SELECT "inboundEmailAlias" FROM "User" WHERE id = '${member}'), 'none')
    || ':' || (SELECT "inboundEmailAlias" FROM "User" WHERE id = '${owner}');`, 'family-inbox:owner-inbox', { before: aliasFixture });
deny('self alias changes must use the checked RPC', `UPDATE "User" SET "inboundEmailAlias" = 'direct-alias' WHERE id = '${owner}';`);
deny('managed aliases cannot be reassigned by direct profile updates', `UPDATE "User" SET "inboundEmailAlias" = 'direct-managed' WHERE id = 'managed';`);
test('self claim RPC normalizes alias and changes only the caller profile', `
  SELECT public.claim_inbound_email_alias('  My.New_Inbox  ');
  SELECT (SELECT "inboundEmailAlias" FROM "User" WHERE id = '${owner}')
    || ':' || (SELECT "inboundEmailAlias" FROM "User" WHERE id = '${member}');`, 'my-new-inbox\nmy-new-inbox:family-inbox', { before: aliasFixture });
test('self ensure RPC creates a forwarding alias when absent', `
  DO $$ BEGIN PERFORM public.ensure_inbound_email_alias(); END $$;
  SELECT "inboundEmailAlias" ~ '^hf-[a-f0-9]{18}$' FROM "User" WHERE id = '${owner}';`, 't');
test('self ensure RPC preserves an existing claimed alias', `SELECT public.ensure_inbound_email_alias(); SELECT public.ensure_inbound_email_alias();`, 'owner-inbox\nowner-inbox', { before: aliasFixture });
deny('self claim RPC still rejects a family alias collision', `SELECT public.claim_inbound_email_alias('family-inbox');`, { before: aliasFixture, code: '23505' });
test('self and managed demographics remain editable', `WITH changed AS (UPDATE "User" SET name = 'Edited', "bloodGroup" = 'O+' WHERE id IN ('${owner}', 'managed') RETURNING id) SELECT count(*) FROM changed;`, '2');
test('accepted member demographics remain editable', `WITH changed AS (UPDATE "User" SET name = 'Edited' WHERE id = '${member}' RETURNING id) SELECT count(*) FROM changed;`, '1');
deny('direct user insert stays unavailable', `INSERT INTO "User" (id, "authUserId", name, dob, sex, "unitsPreference", "residencyRegion") VALUES ('${newAccount}', '${newAccount}', 'Fake', now(), 'other', 'metric', 'US');`, { actor: newAccount });
deny('RPC does not claim an existing profile via matching email', `SELECT public.upsert_app_user_profile('Collision');`, { actor: newAccount, email: 'member@example.test' });
deny('RPC rejects legacy id bound to a different auth identity', `SELECT public.upsert_app_user_profile('Conflict');`, { actor: conflict });
deny('RPC rejects a binding whose profile id belongs to another live auth user', `SELECT public.upsert_app_user_profile('Conflict');`, { actor: binding });
test('JWT profile resolver rejects contradictory identity from either side', `SELECT coalesce(public.current_app_user_id(), 'none');`, 'none', { actor: binding });
deny('RPC rejects split legacy-id and authUserId matches', `SELECT public.upsert_app_user_profile('Split');`, { actor: legacy, before: `INSERT INTO "User" (id, "authUserId", name, dob, sex, "unitsPreference", "residencyRegion") VALUES ('split', '${legacy}', 'Split', now(), 'other', 'metric', 'US');` });
test('RPC safely binds a legacy id without email matching', `SELECT public.upsert_app_user_profile('Legacy updated'); SELECT "authUserId" || ':' || name FROM "User" WHERE id = '${legacy}';`, `${legacy}\n${legacy}:Legacy updated`, { actor: legacy });
test('RPC preserves nullable update argument semantics', `SELECT public.upsert_app_user_profile('  ', NULL, NULL, NULL, NULL, false); SELECT name || ':' || sex || ':' || "unitsPreference" || ':' || "bloodGroup" FROM "User" WHERE id = '${owner}';`, `${owner}\nOwner:other:metric:O+`);
test('RPC explicitly clears blood group and trims name', `SELECT public.upsert_app_user_profile('  Updated  ', NULL, NULL, NULL, NULL, true); SELECT name || ':' || ("bloodGroup" IS NULL)::text FROM "User" WHERE id = '${owner}';`, `${owner}\nUpdated:true`);
test('RPC creates a fresh self profile', `SELECT public.upsert_app_user_profile('New'); SELECT "authUserId" FROM "User" WHERE id = '${newAccount}';`, `${newAccount}\n${newAccount}`, { actor: newAccount });
deny('RPC rejects a deleted auth user token', `SELECT public.upsert_app_user_profile('Deleted');`, { actor: newAccount, before: `DELETE FROM auth.users WHERE id = '${newAccount}';`, code: '28000' });

test('lab-only grant hides prescription documents', `SELECT id FROM "Document" WHERE "ownerUserId" = '${member}' ORDER BY id;`, 'member-lab');
test('lab-only grant hides prescription and unlinked readings', `SELECT id FROM "ParameterReading" WHERE "userId" = '${member}' ORDER BY id;`, 'member-lab-reading');
test('timeline RPC cannot leak forbidden or unlinked readings', `SELECT "readingId" FROM public.parameter_timeline('marker', '${member}');`, 'member-lab-reading');
test('grants are not reciprocal document permissions', `SELECT count(*) FROM "Document" WHERE "ownerUserId" = '${owner}';`, '0', { actor: member });
test('unrelated profiles remain hidden', `SELECT count(*) FROM "Document";`, '0', { actor: outsider });
test('revoked grants deny documents and readings', `SELECT (SELECT count(*) FROM "Document" WHERE "ownerUserId" = '${member}') || ':' || (SELECT count(*) FROM "ParameterReading" WHERE "userId" = '${member}');`, '0:0', { before: `UPDATE "FamilyLink" SET status = 'revoked', "revokedAt" = now() WHERE id = 'accepted';` });
test('empty permissions do not grant documents', `SELECT count(*) FROM "Document" WHERE "ownerUserId" = '${member}';`, '0', { before: `DELETE FROM "FamilyLink" WHERE id = 'accepted'; INSERT INTO "FamilyLink" (id,"ownerUserId","memberUserId",role,permissions,status,"inviteToken") VALUES ('empty','${owner}','${member}','caregiver','{"docTypes":[]}','pending','empty-token'); ${jwt(member)} SELECT public.accept_family_invite('empty-token');`, setupOutput: 'empty' });
test('self can read every own document and unlinked reading', `SELECT (SELECT count(*) FROM "Document" WHERE "ownerUserId" = '${member}') || ':' || (SELECT count(*) FROM "ParameterReading" WHERE "userId" = '${member}');`, '3:3', { actor: member });
test('managed profile keeps unlinked readings', `SELECT id FROM "ParameterReading" WHERE "userId" = 'managed' ORDER BY id;`, 'managed-lab-reading\nmanaged-unlinked');
test('family readings disappear when their source is soft-deleted', `SELECT count(*) FROM "ParameterReading" WHERE id = 'member-lab-reading';`, '0', { before: `UPDATE "Document" SET "deletedAt" = now() WHERE id = 'member-lab';` });
test('timeline excludes family readings with a soft-deleted source', `SELECT count(*) FROM public.parameter_timeline('marker', '${member}');`, '0', { before: `UPDATE "Document" SET "deletedAt" = now() WHERE id = 'member-lab';` });
test('managed readings also respect source soft deletion', `SELECT count(*) FROM "ParameterReading" WHERE id = 'managed-lab-reading';`, '0', { before: `UPDATE "Document" SET "deletedAt" = now() WHERE id = 'managed-lab';` });
test('self retains reading access for a soft-deleted source', `SELECT count(*) FROM "ParameterReading" WHERE id = 'member-lab-reading';`, '1', { actor: member, before: `UPDATE "Document" SET "deletedAt" = now() WHERE id = 'member-lab';` });
test('mismatched reading owner cannot expose another profile document', `SELECT count(*) FROM "ParameterReading" WHERE id = 'mismatch';`, '0', { before: `INSERT INTO "ParameterReading" (id,"userId","documentId","parameterId",value,unit,"recordedAt","createdByUserId") VALUES ('mismatch','${owner}','member-rx','marker',42,'u',now(),'${owner}');` });
deny('a family client cannot insert a forbidden document type', `INSERT INTO "Document" ("ownerUserId","uploadedByUserId","fileType","docType") VALUES ('${member}','${owner}','application/pdf','prescription');`);
deny('a family client cannot reclassify allowed document to forbidden type', `UPDATE "Document" SET "docType" = 'prescription' WHERE id = 'member-lab';`);
test('forbidden document cannot be relabeled into visibility', `WITH changed AS (UPDATE "Document" SET "docType" = 'lab_report' WHERE id = 'member-rx' RETURNING id) SELECT count(*) FROM changed;`, '0');
deny('a reading cannot be attached to a forbidden document', `INSERT INTO "ParameterReading" ("userId","documentId","parameterId",value,unit,"recordedAt","createdByUserId") VALUES ('${member}','member-rx','marker',42,'u',now(),'${owner}');`);
deny('a family client cannot unlink a reading to bypass document permissions', `UPDATE "ParameterReading" SET "documentId" = NULL WHERE id = 'member-lab-reading';`);
deny('accepted client cannot transfer a document into self ownership', `UPDATE "Document" SET "ownerUserId" = '${owner}' WHERE id = 'member-lab';`);
deny('accepted client cannot transfer a document into a managed profile', `UPDATE "Document" SET "ownerUserId" = 'managed' WHERE id = 'member-lab';`);
deny('ownership and type cannot be changed together to bypass a grant', `UPDATE "Document" SET "ownerUserId" = '${owner}', "docType" = 'prescription' WHERE id = 'member-lab';`);
deny('accepted reading cannot be transferred into self-owned unlinked data', `UPDATE "ParameterReading" SET "userId" = '${owner}', "documentId" = NULL WHERE id = 'member-lab-reading';`);
deny('client cannot change document id used by canonical storage authorization', `UPDATE "Document" SET id = 'renamed-own-document' WHERE id = 'own-lab';`);
deny('client cannot forge uploader identity to claim a foreign orphan object', `
  INSERT INTO "Document" (id,"ownerUserId","uploadedByUserId","fileType","docType") VALUES ('orphan-id','${owner}','${owner}','application/pdf','lab_report');
  UPDATE "Document" SET "uploadedByUserId" = '${outsider}' WHERE id = 'orphan-id';`, {
  before: `INSERT INTO storage.objects (bucket_id,name) VALUES ('medical-documents','${outsider}/documents/orphan-id/report.pdf');`
});
test('forged uploader and id cannot expose a foreign canonical orphan path', `
  DO $$ BEGIN
    BEGIN
      UPDATE "Document" SET "fileUrl" = NULL, id = 'orphan-id', "uploadedByUserId" = '${outsider}' WHERE id = 'own-lab';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END $$;
  SELECT count(*) FROM storage.objects WHERE name = '${outsider}/documents/orphan-id/report.pdf';`, '0', {
  before: `INSERT INTO storage.objects (bucket_id,name) VALUES ('medical-documents','${outsider}/documents/orphan-id/report.pdf');`
});
test('trusted service can reconcile document identifiers and uploader provenance', `
  UPDATE "Document" SET id = 'trusted-new-id', "uploadedByUserId" = '${outsider}' WHERE id = 'own-lab';
  SELECT id || ':' || "uploadedByUserId" FROM "Document" WHERE id = 'trusted-new-id';`, `trusted-new-id:${outsider}`, { role: 'service_role' });
test('pending document insert cannot claim an accepted member orphan by owner prefix', `
  INSERT INTO "Document" (id,"ownerUserId","uploadedByUserId","fileType","docType") VALUES ('orphan-id','${member}','${owner}','application/pdf','lab_report');
  SELECT count(*) FROM storage.objects WHERE name = '${member}/documents/orphan-id/report.pdf';`, '0', {
  before: `INSERT INTO storage.objects (bucket_id,name) VALUES ('medical-documents','${member}/documents/orphan-id/report.pdf');`
});
test('self and managed document and reading CRUD remain available', `
  INSERT INTO "Document" (id,"ownerUserId","uploadedByUserId","fileType","docType") VALUES ('crud','managed','${owner}','application/pdf','prescription');
  INSERT INTO "ParameterReading" (id,"userId","documentId","parameterId",value,unit,"recordedAt","createdByUserId") VALUES ('crud-reading','managed','crud','marker',42,'u',now(),'${owner}');
  UPDATE "Document" SET notes = 'Edited' WHERE id = 'crud';
  UPDATE "ParameterReading" SET value = 43 WHERE id = 'crud-reading';
  SELECT notes || ':' || value::integer FROM "Document" d JOIN "ParameterReading" r ON r."documentId" = d.id WHERE d.id = 'crud';
  DELETE FROM "ParameterReading" WHERE id = 'crud-reading'; DELETE FROM "Document" WHERE id = 'crud';
  SELECT count(*) FROM "Document" WHERE id = 'crud';`, 'Edited:43\n0');
test('managed profile creation RPC remains available', `DO $$ BEGIN PERFORM public.create_managed_profile('New managed', now(), 'other'); END $$; SELECT public.can_manage_user(id) FROM "User" WHERE name = 'New managed';`, 't');
test('managed merge RPC preserves documents and readings', `SELECT public.merge_managed_profile('managed')->>'movedDocuments'; SELECT "ownerUserId" FROM "Document" WHERE id = 'managed-lab'; SELECT "userId" FROM "ParameterReading" WHERE id = 'managed-lab-reading';`, `1\n${owner}\n${owner}`);
test('native managed-to-self reassignment preserves readings', `
  UPDATE "Document" SET "ownerUserId" = '${owner}' WHERE id = 'managed-lab';
  UPDATE "ParameterReading" SET "userId" = '${owner}' WHERE "documentId" = 'managed-lab';
  SELECT count(*) FROM "ParameterReading" WHERE id = 'managed-lab-reading' AND "userId" = '${owner}';`, '1');
test('native self-to-managed reassignment preserves readings', `
  INSERT INTO "ParameterReading" (id,"userId","documentId","parameterId",value,unit,"recordedAt","createdByUserId") VALUES ('self-move','${owner}','own-lab','marker',12,'u',now(),'${owner}');
  UPDATE "Document" SET "ownerUserId" = 'managed' WHERE id = 'own-lab';
  UPDATE "ParameterReading" SET "userId" = 'managed' WHERE "documentId" = 'own-lab';
  SELECT count(*) FROM "ParameterReading" WHERE id = 'self-move' AND "userId" = 'managed';`, '1');
test('self document and reading CRUD remain available', `
  INSERT INTO "Document" (id,"ownerUserId","uploadedByUserId","fileType","docType") VALUES ('self-crud','${owner}','${owner}','application/pdf','prescription');
  INSERT INTO "ParameterReading" (id,"userId","documentId","parameterId",value,unit,"recordedAt","createdByUserId") VALUES ('self-reading','${owner}','self-crud','marker',12,'u',now(),'${owner}');
  UPDATE "Document" SET notes = 'self edited' WHERE id = 'self-crud';
  UPDATE "ParameterReading" SET value = 13 WHERE id = 'self-reading';
  SELECT notes || ':' || value::integer FROM "Document" d JOIN "ParameterReading" r ON r."documentId" = d.id WHERE d.id = 'self-crud';
  DELETE FROM "ParameterReading" WHERE id = 'self-reading'; DELETE FROM "Document" WHERE id = 'self-crud';
  SELECT count(*) FROM "Document" WHERE id = 'self-crud';`, 'self edited:13\n0');
test('accepted grant keeps CRUD within permitted document types', `
  INSERT INTO "Document" (id,"ownerUserId","uploadedByUserId","fileType","docType") VALUES ('accepted-crud','${member}','${owner}','application/pdf','lab_report');
  INSERT INTO "ParameterReading" (id,"userId","documentId","parameterId",value,unit,"recordedAt","createdByUserId") VALUES ('accepted-reading','${member}','accepted-crud','marker',12,'u',now(),'${owner}');
  UPDATE "ParameterReading" SET value = 13 WHERE id = 'accepted-reading';
  SELECT value::integer FROM "ParameterReading" WHERE id = 'accepted-reading';
  DELETE FROM "ParameterReading" WHERE id = 'accepted-reading'; DELETE FROM "Document" WHERE id = 'accepted-crud';
  SELECT count(*) FROM "Document" WHERE id = 'accepted-crud';`, '13\n0');

test('storage denies a forbidden file under target profile prefix', `SELECT count(*) FROM storage.objects WHERE name = '${member}/rx.pdf';`, '0');
test('storage denies a forbidden file even under caller uploader prefix', `SELECT count(*) FROM storage.objects WHERE name = '${owner}/documents/member-rx/report.pdf';`, '0');
test('storage permits an allowed source with a storage URI pointer', `SELECT count(*) FROM storage.objects WHERE name = '${member}/lab.pdf';`, '1');
test('storage denies a soft-deleted family source', `SELECT count(*) FROM storage.objects WHERE name = '${member}/lab.pdf';`, '0', { before: `UPDATE "Document" SET "deletedAt" = now() WHERE id = 'member-lab';` });
test('storage denies a soft-deleted managed source', `SELECT count(*) FROM storage.objects WHERE name = 'managed/lab.pdf';`, '0', { before: `UPDATE "Document" SET "deletedAt" = now() WHERE id = 'managed-lab';` });
test('self retains source access after soft deletion', `SELECT count(*) FROM storage.objects WHERE name = '${member}/lab.pdf';`, '1', { actor: member, before: `UPDATE "Document" SET "deletedAt" = now() WHERE id = 'member-lab';` });
test('storage does not allow unknown objects under an accepted member prefix', `SELECT count(*) FROM storage.objects WHERE name = '${member}/unregistered.pdf';`, '0');
test('managed unregistered uploads and self uploads remain available', `INSERT INTO storage.objects (bucket_id,name) VALUES ('medical-documents','managed/new.pdf'),('medical-documents','${owner}/new.pdf'); SELECT count(*) FROM storage.objects WHERE name IN ('managed/new.pdf','${owner}/new.pdf'); UPDATE storage.objects SET metadata = '{"edited":true}' WHERE name = 'managed/new.pdf'; DELETE FROM storage.objects WHERE name IN ('managed/new.pdf','${owner}/new.pdf');`, '2');
test('storage restriction survives duplicate allowed metadata pointing at forbidden file', `SELECT count(*) FROM storage.objects WHERE name = '${member}/rx.pdf';`, '0', { before: `INSERT INTO "Document" (id,"ownerUserId","uploadedByUserId","fileType","docType","fileUrl") VALUES ('duplicate','${owner}','${owner}','application/pdf','lab_report','${member}/rx.pdf');` });
deny('a forged document pointer cannot claim an unregistered foreign file', `INSERT INTO "Document" ("ownerUserId","uploadedByUserId","fileType","docType","fileUrl") VALUES ('${owner}','${owner}','application/pdf','lab_report','${member}/unregistered.pdf');`);
deny('a permitted document cannot be repointed to a forbidden file', `UPDATE "Document" SET "fileUrl" = '${member}/rx.pdf' WHERE id = 'member-lab';`);
test('a storage UPDATE cannot read or overwrite forbidden objects', `WITH changed AS (UPDATE storage.objects SET metadata = '{}' WHERE name = '${member}/rx.pdf' RETURNING name) SELECT count(*) FROM changed;`, '0');
test('a storage DELETE cannot remove forbidden objects', `WITH changed AS (DELETE FROM storage.objects WHERE name = '${member}/rx.pdf' RETURNING name) SELECT count(*) FROM changed;`, '0');
test('upload-then-register flow remains available for a managed profile', `INSERT INTO "Document" (id,"ownerUserId","uploadedByUserId","fileType","docType") VALUES ('upload','managed','${owner}','application/pdf','lab_report'); INSERT INTO storage.objects (bucket_id,name) VALUES ('medical-documents','${owner}/documents/upload/report.pdf'); UPDATE "Document" SET "fileUrl" = '${owner}/documents/upload/report.pdf' WHERE id = 'upload'; SELECT count(*) FROM storage.objects WHERE name = '${owner}/documents/upload/report.pdf';`, '1');
test('pending document metadata still scopes its canonical upload path', `SELECT count(*) FROM storage.objects WHERE name = '${owner}/documents/member-rx/report.pdf';`, '0', { before: `UPDATE "Document" SET "fileUrl" = NULL WHERE id = 'member-rx';` });

const serviceCheck = (requester, document) => `SELECT public.can_manage_document_for_user('${requester}', '${document}');`;
test('service helper authorizes self document', serviceCheck(owner, 'own-lab'), 't', { role: 'service_role' });
test('service helper authorizes managed document', serviceCheck(owner, 'managed-lab'), 't', { role: 'service_role' });
test('service helper authorizes accepted document type', serviceCheck(owner, 'member-lab'), 't', { role: 'service_role' });
test('service helper rejects excluded document type despite uploader identity', serviceCheck(owner, 'member-rx'), 'f', { role: 'service_role' });
test('service helper rejects deleted documents', serviceCheck(member, 'member-rx-alt'), 'f', { role: 'service_role' });
test('service helper rejects missing documents', serviceCheck(owner, 'missing'), 'f', { role: 'service_role' });
test('service helper rejects unrelated requester', serviceCheck(outsider, 'member-lab'), 'f', { role: 'service_role' });
test('service helper rejects reverse family access', serviceCheck(member, 'own-lab'), 'f', { role: 'service_role' });
test('service helper rejects revoked grants', serviceCheck(owner, 'member-lab'), 'f', { role: 'service_role', before: `UPDATE "FamilyLink" SET status = 'revoked', "revokedAt" = now() WHERE id = 'accepted';` });
test('service helper rejects deleted requester auth identity', serviceCheck(owner, 'member-lab'), 'f', { role: 'service_role', before: `DELETE FROM auth.users WHERE id = '${owner}';` });
test('service helper rejects soft-deleted requester', serviceCheck(owner, 'member-lab'), 'f', { role: 'service_role', before: `UPDATE "User" SET "deletedAt" = now() WHERE id = '${owner}';` });
test('service helper rejects soft-deleted target', serviceCheck(owner, 'member-lab'), 'f', { role: 'service_role', before: `UPDATE "User" SET "deletedAt" = now() WHERE id = '${member}';` });
test('service helper rejects managed grants after target acquires auth identity', serviceCheck(owner, 'managed-lab'), 'f', { role: 'service_role', before: `UPDATE "User" SET "authUserId" = '${newAccount}' WHERE id = 'managed';` });
test('service helper rejects contradictory requester identity', serviceCheck(conflict, 'conflict-doc'), 'f', { role: 'service_role', before: `INSERT INTO "Document" (id,"ownerUserId","uploadedByUserId","fileType","docType") VALUES ('conflict-doc','${conflict}','${conflict}','application/pdf','lab_report');` });
test('service helper rejects split requester identity', serviceCheck('split', 'split-doc'), 'f', { role: 'service_role', before: `INSERT INTO "User" (id,"authUserId",name,dob,sex,"unitsPreference","residencyRegion") VALUES ('split','${legacy}','Split',now(),'other','metric','US'); INSERT INTO "Document" (id,"ownerUserId","uploadedByUserId","fileType","docType") VALUES ('split-doc','split','split','application/pdf','lab_report');` });
test('service helper rejects the legacy side of a split requester identity', serviceCheck(legacy, 'legacy-doc'), 'f', { role: 'service_role', before: `INSERT INTO "User" (id,"authUserId",name,dob,sex,"unitsPreference","residencyRegion") VALUES ('split','${legacy}','Split',now(),'other','metric','US'); INSERT INTO "Document" (id,"ownerUserId","uploadedByUserId","fileType","docType") VALUES ('legacy-doc','${legacy}','${legacy}','application/pdf','lab_report');` });
deny('authenticated cannot supply arbitrary requester to service helper', serviceCheck(member, 'member-rx'));
deny('anon cannot invoke service helper', serviceCheck(member, 'member-rx'), { role: 'anon' });
deny('authenticated cannot invoke private grant primitive', `SELECT public.profile_document_grant('${member}', '${member}', 'prescription');`);

let started = false;
try {
  checked(run('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '--no-locale', '--encoding=UTF8']), 'initdb');
  checked(run('pg_ctl', ['-D', data, '-l', join(directory, 'postgres.log'), '-o', `-k ${directory} -c listen_addresses='' -c fsync=off`, '-w', 'start']), 'start postgres');
  started = true;
  console.log(checked(query('SELECT version();'), 'PostgreSQL version'));
  checked(query(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text NOT NULL, metadata jsonb, UNIQUE(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
  `), 'Supabase SQL surface bootstrap');
  const migrations = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql') && name <= migration).sort();
  if (!baseline) assert(migrations.includes(migration), `Missing ${migration}`);
  for (const name of migrations) {
    if (baseline && name === migration) continue;
    checked(query(readFileSync(join(root, 'supabase/migrations', name), 'utf8')), name);
  }
  checked(query(`
    INSERT INTO auth.users VALUES ('${owner}'),('${member}'),('${outsider}'),('${legacy}'),('${conflict}'),('${binding}'),('${newAccount}');
    INSERT INTO "User" (id,"authUserId",email,name,dob,sex,"unitsPreference","bloodGroup","residencyRegion") VALUES
      ('${owner}','${owner}','owner@example.test','Owner',now(),'other','metric','O+','US'),
      ('${member}','${member}','member@example.test','Member',now(),'other','metric',NULL,'US'),
      ('${outsider}','${outsider}','outsider@example.test','Outsider',now(),'other','metric',NULL,'US'),
      ('${legacy}',NULL,'legacy@example.test','Legacy',now(),'other','metric',NULL,'US'),
      ('${conflict}','${binding}','conflict@example.test','Conflict',now(),'other','metric',NULL,'US'),
      ('managed',NULL,NULL,'Managed',now(),'other','metric',NULL,'US');
    INSERT INTO "FamilyLink" (id,"ownerUserId","memberUserId",role,permissions,status,"acceptedAt") VALUES ('managed-grant','${owner}','managed','guardian','{"docTypes":["lab_report","prescription","imaging_report","discharge_summary","vaccination_record","other"]}','active',now());
    INSERT INTO "FamilyLink" (id,"ownerUserId","memberUserId",role,permissions,status,"inviteToken") VALUES ('accepted','${owner}','${member}','caregiver','{"docTypes":["lab_report"]}','pending','token');
    BEGIN; ${jwt(member)} SET LOCAL ROLE authenticated; SELECT public.accept_family_invite('token'); COMMIT;
    INSERT INTO "Document" (id,"ownerUserId","uploadedByUserId","fileType","docType","fileUrl") VALUES
      ('own-lab','${owner}','${owner}','application/pdf','lab_report','${owner}/own.pdf'),
      ('member-lab','${member}','${member}','application/pdf','lab_report','storage://medical-documents/${member}/lab.pdf'),
      ('member-rx','${member}','${owner}','application/pdf','prescription','${owner}/documents/member-rx/report.pdf'),
      ('member-rx-alt','${member}','${member}','application/pdf','prescription','${member}/rx.pdf'),
      ('managed-lab','managed','${owner}','application/pdf','lab_report','managed/lab.pdf');
    -- Keep a second forbidden path without adding a second visible member record.
    UPDATE "Document" SET "deletedAt" = now() WHERE id = 'member-rx-alt';
    INSERT INTO "ParameterCatalog" (id,"canonicalName",unit,panel,"rangeDefault") VALUES ('marker','Marker','u','panel','{}');
    INSERT INTO "ParameterReading" (id,"userId","documentId","parameterId",value,unit,"recordedAt","createdByUserId") VALUES
      ('member-lab-reading','${member}','member-lab','marker',1,'u',now(),'${member}'),
      ('member-rx-reading','${member}','member-rx','marker',2,'u',now(),'${member}'),
      ('member-unlinked','${member}',NULL,'marker',3,'u',now(),'${member}'),
      ('managed-lab-reading','managed','managed-lab','marker',4,'u',now(),'${owner}'),
      ('managed-unlinked','managed',NULL,'marker',5,'u',now(),'${owner}');
    INSERT INTO storage.objects (bucket_id,name) VALUES ('medical-documents','${owner}/own.pdf'),('medical-documents','${member}/lab.pdf'),('medical-documents','${member}/rx.pdf'),('medical-documents','${owner}/documents/member-rx/report.pdf'),('medical-documents','${member}/unregistered.pdf'),('medical-documents','managed/lab.pdf');
  `), 'seed realistic self, managed, and accepted grant fixtures');
  let failed = 0;
  for (const item of tests) {
    const result = query(`BEGIN; ${item.before ?? ''} ${jwt(item.actor, item.email)} SET LOCAL ROLE ${item.role ?? 'authenticated'}; ${item.sql} ROLLBACK;`);
    try {
      if (item.denied) {
        assert.notEqual(result.status, 0, 'operation unexpectedly permitted');
        assert.match(result.stderr, new RegExp(`${item.code ?? '42501'}:`), result.stderr);
      } else {
        assert.equal(checked(result, item.name), [item.setupOutput, item.want].filter((v) => v !== undefined).join('\n'));
      }
      console.log(`PASS ${item.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${item.name}: ${error.message}`);
    }
  }
  console.log(`${tests.length - failed}/${tests.length} passed (${baseline ? 'baseline' : 'hardened'})`);
  process.exitCode = failed ? 1 : 0;
} finally {
  if (started) checked(run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']), 'stop postgres');
  rmSync(directory, { recursive: true, force: true });
}
