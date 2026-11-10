import type { ConfigContext, ExpoConfig } from 'expo/config';

import identity from './release-identity.json';

/**
 * Account-specific Apple, Expo, and Google identifiers come only from
 * release-identity.json. Fill the YOUR_* / com.ORG placeholders before an
 * organization App Store build. Do not put a real team id or bundle id here.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'HealthFolio',
  owner: identity.easOwner,
  slug: identity.easSlug,
  scheme: identity.urlScheme,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F4F7FA',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: identity.iosBundleIdentifier,
    buildNumber: '78',
    usesAppleSignIn: identity.usesAppleSignIn,
    associatedDomains: identity.associatedDomains,
    infoPlist: {
      NSCameraUsageDescription:
        'HealthFolio uses the camera to scan lab reports, prescriptions, and other health documents you choose to upload.',
      NSPhotoLibraryUsageDescription:
        'HealthFolio lets you select health document images from your photo library for upload and OCR.',
      NSFaceIDUsageDescription:
        'HealthFolio uses Face ID to help protect access to your health records on this device.',
      CFBundleAllowMixedLocalizations: true,
      ITSAppUsesNonExemptEncryption: false,
      HealthFolioGoogleIosClientId: identity.googleIosClientId,
      HealthFolioGoogleWebClientId: identity.googleWebClientId,
    },
  },
  android: {
    package: identity.androidPackage,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F4F7FA',
    },
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
    permissions: ['android.permission.USE_BIOMETRIC', 'android.permission.USE_FINGERPRINT'],
  },
  web: {
    bundler: 'metro',
    output: 'static',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        cameraPermission: 'HealthFolio uses the camera to scan health documents you choose to upload.',
        photosPermission: 'HealthFolio lets you select health document images from your photo library.',
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow HealthFolio to use Face ID to unlock your health records.',
      },
    ],
    'expo-apple-authentication',
    'expo-web-browser',
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: identity.googleIosUrlScheme,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    publicConfig: {
      supabaseUrl: 'https://qojdeuacwkmlxmodeabt.supabase.co',
      supabaseAnonKey: 'sb_publishable_d-pZ2zQvS-0QA5KR5EdloA_KOw1MUoI',
      googleIosClientId: identity.googleIosClientId,
      googleWebClientId: identity.googleWebClientId,
      inboundEmailDomain: 'records.healthfolio.app',
      inboundEmailAddressTemplate: '{alias}@records.healthfolio.app',
    },
    eas: {
      projectId: identity.easProjectId,
    },
  },
});
