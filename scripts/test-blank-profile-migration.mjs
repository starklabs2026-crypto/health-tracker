#!/usr/bin/env node
// Applies the full migration chain, then checks upsert_app_user_profile.
// Requires initdb, pg_ctl, and psql on PATH (or PG_BINDIR).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'hf-blank-profile-'));
const data = join(directory, 'data');
const env = { PATH: process.env.PATH, HOME: directory, LC_ALL: 'C', LANG: 'C' };
const binary = (name) => (process.env.PG_BINDIR ? join(process.env.PG_BINDIR, name) : name);

function run(name, args, input) {
  return spawnSync(binary(name), args, { env, input, encoding: 'utf8', timeout: 120_000, maxBuffer: 8_000_000 });
}
function checked(result, context) {
  assert.equal(result.status, 0, `${context}: ${result.error ?? result.stderr}`);
  return result.stdout.trim();
}
function query(sql) {
  return run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-h', directory, '-U', 'postgres', '-d', 'postgres'], sql);
}

const existing = '00000000-0000-4000-8000-0000000000a1';
const fresh = '00000000-0000-4000-8000-0000000000a2';
const other = '00000000-0000-4000-8000-0000000000a3';

let started = false;
try {
  checked(run('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '--no-locale', '--encoding=UTF8']), 'initdb');
  checked(run('pg_ctl', ['-D', data, '-l', join(directory, 'postgres.log'), '-o', `-k ${directory} -c listen_addresses='' -c fsync=off -c timezone=UTC`, '-w', 'start']), 'start postgres');
  started = true;
  console.log(checked(query('SELECT version();'), 'PostgreSQL version'));
  checked(query(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT (auth.jwt()->>'sub')::uuid
    $$;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text NOT NULL, metadata jsonb, UNIQUE(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
      SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1]
    $$;
    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
  `), 'auth stubs');

  const migrations = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort();
  for (const name of migrations) {
    checked(query(readFileSync(join(root, 'supabase/migrations', name), 'utf8')), name);
  }
  checked(query(readFileSync(join(root, 'supabase/migrations/20261110115757_blank_new_account_profile_fields.sql'), 'utf8')), 'migration is idempotent');

  checked(query(`
    INSERT INTO auth.users VALUES ('${existing}'), ('${fresh}'), ('${other}');
    INSERT INTO public."User" (id, "authUserId", email, phone, name, dob, sex, "unitsPreference", "bloodGroup", "residencyRegion")
    VALUES (
      '${existing}', '${existing}', 'existing@example.test', '+15551110000', 'Existing Person',
      timestamptz '1991-04-02 00:00:00+00', 'female', 'metric', 'A+', 'US'
    );
  `), 'existing profile fixture');

  const preserved = checked(query(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: existing, email: 'existing@example.test', phone: '+19998887777', role: 'authenticated' })}';
    SELECT public.upsert_app_user_profile(NULL, NULL, NULL, NULL, NULL, false);
    RESET ROLE;
    SELECT dob::text || '|' || sex || '|' || coalesce(phone, 'none') || '|' || name
    FROM public."User" WHERE id = '${existing}';
    COMMIT;
  `), 'existing profile call');
  assert.equal(
    preserved.split('\n').pop(),
    '1991-04-02 00:00:00|female|+15551110000|Existing Person',
    `existing profile was rewritten: ${preserved}`,
  );

  const created = checked(query(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: fresh, email: 'fresh@example.test', phone: '+15552220000', role: 'authenticated' })}';
    SELECT public.upsert_app_user_profile('Fresh Person', NULL, NULL, 'metric', NULL, false);
    RESET ROLE;
    SELECT (dob IS NULL)::text || '|' || (sex IS NULL)::text || '|' || (phone IS NULL)::text || '|' || email
    FROM public."User" WHERE id = '${fresh}';
    COMMIT;
  `), 'new profile call');
  assert.equal(created.split('\n').pop(), 'true|true|true|fresh@example.test', `new profile stored a default: ${created}`);

  const anon = query(`
    BEGIN;
    SET LOCAL ROLE anon;
    SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: fresh, role: 'anon' })}';
    SELECT public.upsert_app_user_profile('Anon');
    COMMIT;
  `);
  assert.notEqual(anon.status, 0, 'anon was allowed to execute the profile RPC');
  assert.match(`${anon.stderr}`, /permission denied|42501/i);

  const stolen = query(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: other, email: 'existing@example.test', phone: '+15551110000', role: 'authenticated' })}';
    SELECT public.upsert_app_user_profile('Taken over');
    COMMIT;
  `);
  assert.notEqual(stolen.status, 0, 'another auth user was allowed to bind an existing profile');
  assert.match(`${stolen.stderr}`, /profile_identity_conflict|42501/);
  const untouched = checked(query(`
    SELECT dob::text || '|' || sex || '|' || phone || '|' || name || '|' || "authUserId"
    FROM public."User" WHERE id = '${existing}';
  `), 'existing profile after rejected call');
  assert.equal(untouched, '1991-04-02 00:00:00|female|+15551110000|Existing Person|' + existing);

  console.log('PASS: new profile stays blank, existing profile is preserved, anon and another user are denied');
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
  rmSync(directory, { recursive: true, force: true });
}
