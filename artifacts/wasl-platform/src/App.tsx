import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/Layout';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AuthProvider } from '@/lib/authContext';
import { RequireAuth } from '@/components/RequireAuth';
import EntryExperience from '@/pages/entry-experience';
import Dashboard from '@/pages/dashboard';
import BankDetail from '@/pages/bank-detail';
import Settings from '@/pages/settings';
import Login from '@/pages/login';
import ChangePassword from '@/pages/change-password';
import AdminUsers from '@/pages/admin-users';
import { AdminPinGate } from '@/components/AdminPinGate';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// The cinematic entry experience is a standalone full-screen page (no
// sidebar/chrome). Every other route lives inside the normal app Layout.
function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/change-password">
        <RequireAuth>
          <ChangePassword />
        </RequireAuth>
      </Route>
      <Route path="/">
        <RequireAuth>
          <EntryExperience />
        </RequireAuth>
      </Route>
      <Route path="/portfolio">
        <RequireAuth>
          <Layout><Dashboard /></Layout>
        </RequireAuth>
      </Route>
      <Route path="/bank/:id">
        <RequireAuth>
          <Layout><BankDetail /></Layout>
        </RequireAuth>
      </Route>
      <Route path="/settings">
        <RequireAuth>
          <Layout><Settings /></Layout>
        </RequireAuth>
      </Route>
      <Route path="/admin/users">
        <RequireAuth roles={['super_admin']}>
          <Layout>
            <AdminPinGate>
              <AdminUsers />
            </AdminPinGate>
          </Layout>
        </RequireAuth>
      </Route>
      <Route>
        <Layout><NotFound /></Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
