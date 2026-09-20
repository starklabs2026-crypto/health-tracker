#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const siteRoot = resolve(process.env.APP_STORE_SITE_ROOT ?? 'docs/app-store-site');
const pages = [
  'index.html',
  'privacy/index.html',
  'support/index.html',
  'privacy-choices/index.html',
];

for (const page of pages) {
  assert.ok(existsSync(join(siteRoot, page)), `Missing App Store site page: ${page}`);
}

const privacy = read('privacy/index.html');
for (const phrase of [
  'health data',
  'service providers',
  'consent',
  'account deletion',
  'retention',
  'not a medical device',
]) {
  assert.match(privacy.toLowerCase(), new RegExp(phrase), `Privacy policy must cover ${phrase}`);
}

const choices = read('privacy-choices/index.html');
assert.match(choices, /Profile &gt; Privacy &amp; consent &gt; Delete account and data/);

const support = read('support/index.html');
assert.match(support, /starklabs2026@gmail\.com/);
assert.match(support.toLowerCase(), /medical emergency/);

for (const page of pages) {
  const html = read(page);
  assert.doesNotMatch(html, /<script\b/i, `${page} must not run client-side scripts`);
  assert.doesNotMatch(html, /analytics|tracking pixel/i, `${page} must not include tracking`);

  for (const href of html.matchAll(/href="([^"]+)"/g)) {
    const target = href[1];
    if (target.startsWith('https://') || target.startsWith('mailto:') || target.startsWith('#')) {
      continue;
    }
    assert.ok(
      target.startsWith('/health-tracker/'),
      `${page} has unsafe or relative href: ${target}`,
    );
    const relative = target.slice('/health-tracker/'.length);
    const resolvedTarget = relative.endsWith('/')
      ? `${relative}index.html`
      : relative || 'index.html';
    assert.ok(existsSync(join(siteRoot, resolvedTarget)), `${page} links to missing ${target}`);
  }
}

console.log('App Store public site checks passed.');

function read(path) {
  return readFileSync(join(siteRoot, path), 'utf8');
}
