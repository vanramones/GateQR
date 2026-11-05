import { createContext, useContext, useEffect, useState } from 'react';
import { userApi, staffApi, guardApi } from '../lib/db';
import { supabaseUser, supabaseStaff, supabaseGuard } from '../lib/supabase';

// Three completely independent auth contexts — one for the community portal
// (student/faculty/staff), one for the admin (office) portal, and one for the
// gate guard portal. Each is backed by its own Supabase client/session (see
// lib/supabase.js), so signing in to one never signs the others out, even in
// the same browser tab.
function makeAuthContext(client, api, googleRedirect) {
  const Ctx = createContext(null);

  function Provider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let active = true;
      api.currentUser().then((u) => { if (active) { setUser(u); setLoading(false); } });

      const { data: sub } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') setUser(null);
        else if (event === 'SIGNED_IN' && session) api.currentUser().then(setUser);
      });
      return () => { active = false; sub.subscription.unsubscribe(); };
    }, []);

    const value = {
      user, loading, setUser,
      login: async (e, p) => { const u = await api.login(e, p); setUser(u); return u; },
      register: async (d) => { const u = await api.register(d); setUser(u); return u; },
      registerStaff: async (d) => { const u = await api.registerStaff(d); setUser(u); return u; },
      loginWithGoogle: () => client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + googleRedirect } }),
      logout: async () => { await api.logout(); setUser(null); },
    };
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  return [Provider, () => useContext(Ctx)];
}

const [UserAuthProvider, useUserAuth] = makeAuthContext(supabaseUser, userApi, '/login');
const [StaffAuthProvider, useStaffAuth] = makeAuthContext(supabaseStaff, staffApi, '/admin/login');
const [GuardAuthProvider, useGuardAuth] = makeAuthContext(supabaseGuard, guardApi, '/guard/login');

export { UserAuthProvider, useUserAuth, StaffAuthProvider, useStaffAuth, GuardAuthProvider, useGuardAuth };

export function AuthProvider({ children }) {
  return (
    <UserAuthProvider>
      <StaffAuthProvider>
        <GuardAuthProvider>{children}</GuardAuthProvider>
      </StaffAuthProvider>
    </UserAuthProvider>
  );
}
