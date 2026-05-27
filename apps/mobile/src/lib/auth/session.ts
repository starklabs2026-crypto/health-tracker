import { supabase } from '../supabase/client';
import { clearTokens } from './tokenStorage';

/** Revoke Supabase session and clear legacy token storage during migration. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await clearTokens();
}
