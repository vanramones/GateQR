import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env');
}

// Three fully independent Supabase Auth clients, each with its own storage key.
// This lets a community account (student/faculty/staff), an admin account, and
// a gate guard account all be signed in at the same time, in the same browser
// tab, without one session overwriting another — the Admin Portal (office) and
// the Guard Portal (gate) are completely separate sessions and URLs, and
// signing in to one never signs the others out.
export const supabaseUser = createClient(url, anonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, storageKey: 'gateqr-user-auth' },
});

export const supabaseStaff = createClient(url, anonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, storageKey: 'gateqr-staff-auth' },
});

export const supabaseGuard = createClient(url, anonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, storageKey: 'gateqr-guard-auth' },
});
