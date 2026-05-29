import Constants from 'expo-constants';

type PublicRuntimeConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  googleIosClientId?: string;
  googleWebClientId?: string;
};

type ExpoExtra = {
  publicConfig?: PublicRuntimeConfig;
};

const constantsWithManifest = Constants as typeof Constants & {
  manifest2?: { extra?: ExpoExtra };
};

function readEmbeddedConfig(): PublicRuntimeConfig {
  const extra =
    Constants.expoConfig?.extra ??
    constantsWithManifest.manifest2?.extra ??
    {};

  return ((extra as ExpoExtra).publicConfig ?? {}) as PublicRuntimeConfig;
}

const embeddedConfig = readEmbeddedConfig();

export const publicRuntimeConfig = {
  supabaseUrl: embeddedConfig.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey:
    embeddedConfig.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  googleIosClientId:
    embeddedConfig.googleIosClientId ?? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  googleWebClientId:
    embeddedConfig.googleWebClientId ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};
