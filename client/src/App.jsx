 import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useUserAuth, useStaffAuth, useGuardAuth } from './context/AuthContext';
import { staffApi, guardApi, userApi } from './lib/db';
import Layout from './components/Layout';
import { PageSpinner } from './components/ui';
import Landing from './pages/auth/Landing';
import Login from './pages/auth/Login';
import StaffLogin from './pages/auth/StaffLogin';
import StaffRegister from './pages/auth/StaffRegister';
import GuardLogin from './pages/auth/GuardLogin';
import GuardRegister from './pages/auth/GuardRegister';
import Register from './pages/auth/Register';
import Profile from './pages/shared/Profile';
import GateLogs from './pages/shared/GateLogs';
import VisitorPasses from './pages/shared/VisitorPasses';
import Scanner from './pages/shared/Scanner';
import UserDashboard from './pages/user/UserDashboard';
import MyVehicles from './pages/user/MyVehicles';
import RegisterVehicle from './pages/user/RegisterVehicle';
import AdminDashboard from './pages/admin/AdminDashboard';
import Registrations from './pages/admin/Registrations';
import AllVehicles from './pages/admin/AllVehicles';
import UsersPage from './pages/admin/UsersPage';
import Reports from './pages/admin/Reports';
import AdminSettings from './pages/admin/Settings';
import CreateAccount from './pages/admin/CreateAccount';

const home = (u) => (u.role === 'admin' ? '/admin' : u.role === 'guard' ? '/guard' : '/app');

// Community portal (student/faculty/staff): guarded by its own session.
function UserGuard({ roles, children }) {
  const { user, logout } = useUserAuth();
  const wrongRole = !!user && roles && !roles.includes(user.role);
  useEffect(() => { if (wrongRole) logout(); }, [wrongRole, logout]);
  if (!user) return <Navigate to="/login" replace />;
  if (wrongRole) return <Navigate to="/login" replace />;
  return children;
}
function UserPublic({ children }) {
  const { user } = useUserAuth();
  return user ? <Navigate to={home(user)} replace /> : children;
}

// Admin (office) portal: guarded by its own, independent session.
function StaffGuard({ children }) {
  const { user, logout } = useStaffAuth();
  const wrongRole = !!user && user.role !== 'admin';
  useEffect(() => { if (wrongRole) logout(); }, [wrongRole, logout]);
  if (!user || wrongRole) return <Navigate to="/admin/login" replace />;
  return children;
}
function StaffPublic({ children }) {
  const { user } = useStaffAuth();
  return user?.role === 'admin' ? <Navigate to="/admin" replace /> : children;
}

// Guard (gate) portal: its own separate URL and independent session — never
// shares a login with the Admin (office) portal.
function GuardScopeGuard({ children }) {
  const { user, logout } = useGuardAuth();
  const wrongRole = !!user && user.role !== 'guard';
  useEffect(() => { if (wrongRole) logout(); }, [wrongRole, logout]);
  if (!user || wrongRole) return <Navigate to="/guard/login" replace />;
  return children;
}
function GuardPublic({ children }) {
  const { user } = useGuardAuth();
  return user?.role === 'guard' ? <Navigate to="/guard" replace /> : children;
}

function UserLayout() {
  const { user, logout } = useUserAuth();
  return <Layout user={user} logout={logout} />;
}
function StaffLayout() {
  const { user, logout } = useStaffAuth();
  return <Layout user={user} logout={logout} />;
}
function GuardLayout() {
  const { user, logout } = useGuardAuth();
  return <Layout user={user} logout={logout} />;
}

function UserProfile() {
  const auth = useUserAuth();
  return <Profile auth={auth} />;
}
function StaffProfile() {
  const auth = useStaffAuth();
  return <Profile auth={auth} />;
}
function GuardProfile() {
  const auth = useGuardAuth();
  return <Profile auth={auth} />;
}

function AdminVisitorPasses() {
  const auth = useStaffAuth();
  return <VisitorPasses auth={auth} api={staffApi} />;
}
function GuardVisitorPasses() {
  const auth = useGuardAuth();
  return <VisitorPasses auth={auth} api={guardApi} />;
}
function AdminGateLogs() { return <GateLogs api={staffApi} />; }
function GuardGateLogs() { return <GateLogs api={guardApi} />; }

// Community portal: the owner sees only the gate activity of their own
// vehicles — enforced by RLS AND filtered client-side for safety.
function UserGateActivity() {
  const { user } = useUserAuth();
  const api = {
    ...userApi,
    listLogs: async () => {
      const [logs, vs] = await Promise.all([userApi.listLogs(), userApi.listVehicles(user.id)]);
      const ids = new Set(vs.map((v) => v.id));
      return logs.filter((l) => ids.has(l.refId));
    },
  };
  return <GateLogs api={api} title="Gate Activity" subtitle="Entry and exit records for your registered vehicles." />;
}

const USER_ROLES = ['student', 'faculty', 'staff'];

function RootRedirect() {
  const { user: staffUser } = useStaffAuth();
  const { user: guardUser } = useGuardAuth();
  const { user: userUser } = useUserAuth();
  if (staffUser) return <Navigate to={home(staffUser)} replace />;
  if (guardUser) return <Navigate to={home(guardUser)} replace />;
  if (userUser) return <Navigate to={home(userUser)} replace />;
  return <Landing />;
}

function NotFound() {
  const { user: staffUser } = useStaffAuth();
  const { user: guardUser } = useGuardAuth();
  const { user: userUser } = useUserAuth();
  const target = staffUser ? home(staffUser) : guardUser ? home(guardUser) : userUser ? home(userUser) : '/';
  return <Navigate to={target} replace />;
}

export default function App() {
  const { loading: userLoading } = useUserAuth();
  const { loading: staffLoading } = useStaffAuth();
  const { loading: guardLoading } = useGuardAuth();
  if (userLoading || staffLoading || guardLoading) return <PageSpinner />;
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<UserPublic><Login /></UserPublic>} />
      <Route path="/register" element={<UserPublic><Register /></UserPublic>} />
      <Route path="/admin/login" element={<StaffPublic><StaffLogin /></StaffPublic>} />
      <Route path="/admin/register" element={<StaffPublic><StaffRegister /></StaffPublic>} />
      <Route path="/guard/login" element={<GuardPublic><GuardLogin /></GuardPublic>} />
      <Route path="/guard/register" element={<GuardPublic><GuardRegister /></GuardPublic>} />

      <Route element={<UserGuard><UserLayout /></UserGuard>}>
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/app" element={<UserGuard roles={USER_ROLES}><UserDashboard /></UserGuard>} />
        <Route path="/app/vehicles" element={<UserGuard roles={USER_ROLES}><MyVehicles /></UserGuard>} />
        <Route path="/app/register" element={<UserGuard roles={USER_ROLES}><RegisterVehicle /></UserGuard>} />
        <Route path="/app/activity" element={<UserGuard roles={USER_ROLES}><UserGateActivity /></UserGuard>} />
      </Route>

      {/* Admin (office) portal — manages registrations, records, and reports. No gate scanner here. */}
      <Route element={<StaffGuard><StaffLayout /></StaffGuard>}>
        <Route path="/admin/profile" element={<StaffProfile />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/registrations" element={<Registrations />} />
        <Route path="/admin/vehicles" element={<AllVehicles />} />
        <Route path="/admin/visitors" element={<AdminVisitorPasses />} />
        <Route path="/admin/logs" element={<AdminGateLogs />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/create-account" element={<CreateAccount />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Route>

      {/* Guard (gate) portal — its own URL and session, dedicated to the gate scanner. */}
      <Route element={<GuardScopeGuard><GuardLayout /></GuardScopeGuard>}>
        <Route path="/guard/profile" element={<GuardProfile />} />
        <Route path="/guard" element={<Scanner />} />
        <Route path="/guard/visitors" element={<GuardVisitorPasses />} />
        <Route path="/guard/logs" element={<GuardGateLogs />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
