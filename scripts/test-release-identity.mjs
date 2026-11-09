import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const identity = JSON.parse(read('apps/mobile/release-identity.json'));

assert.equal(identity.iosBundleIdentifier, 'com.ORG.healthfolio');
assert.equal(identity.androidPackage, 'com.ORG.healthfolio');
assert.match(identity.appleTeamId, /^YOUR_/);
assert.match(identity.ascAppId, /^YOUR_/);
assert.match(identity.easOwner, /^YOUR_/);
assert.match(identity.easProjectId, /^YOUR_/);
assert.equal(identity.urlScheme, 'healthfolio');
assert.deepEqual(identity.associatedDomains, []);

const appJson = JSON.parse(read('apps/mobile/app.json'));
assert.equal(appJson.expo.ios.bundleIdentifier, identity.iosBundleIdentifier);
assert.equal(appJson.expo.android.package, identity.androidPackage);
assert.equal(appJson.expo.owner, identity.easOwner);
assert.equal(appJson.expo.slug, identity.easSlug);
assert.equal(appJson.expo.scheme, identity.urlScheme);
assert.equal(appJson.expo.extra.eas.projectId, identity.easProjectId);
assert.equal(appJson.expo.extra.publicConfig.googleIosClientId, identity.googleIosClientId);
assert.equal(appJson.expo.extra.publicConfig.googleWebClientId, identity.googleWebClientId);

const appConfig = read('apps/mobile/app.config.ts');
assert.match(appConfig, /release-identity\.json/);
assert.match(appConfig, /identity\.iosBundleIdentifier/);
assert.match(appConfig, /identity\.appleTeamId|identity\.easProjectId/);

const eas = JSON.parse(read('apps/mobile/eas.json'));
assert.equal(eas.submit.production.ios.ascAppId, identity.ascAppId);

const project = read('apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj');
assert.equal([...project.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = com\.ORG\.healthfolio;/g)].length, 2);
assert.equal(
  [...project.matchAll(new RegExp(`DEVELOPMENT_TEAM = ${identity.appleTeamId};`, 'g'))].length,
  2,
);
assert.doesNotMatch(project, /WN432B5HS6|com\.starklabs\.healthfolio|Aditi Somani/);

const infoPlist = read('apps/mobile/ios/HealthFolio/Info.plist');
assert.match(infoPlist, /\$\(PRODUCT_BUNDLE_IDENTIFIER\)/);
assert.match(infoPlist, /\$\(HEALTHFOLIO_GOOGLE_IOS_URL_SCHEME\)/);
assert.doesNotMatch(infoPlist, /com\.starklabs\.healthfolio|249865909043/);

const swiftConfig = read('apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseConfig.swift');
assert.match(swiftConfig, /absoluteSignedStorageURL/);
assert.match(swiftConfig, /\/storage\/v1/);
assert.doesNotMatch(swiftConfig, /249865909043/);

console.log('Release identity placeholders are centralized.');
