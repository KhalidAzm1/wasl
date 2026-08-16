import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/Layout';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AuthProvider } from '@/lib/authContext';
import { RequireAuth } from '@/components/RequireAuth';
import { AdminPinGate } from '@/components/AdminPinGate';
import { PostHogProvider } from '@/providers/PostHogProvider';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';

// ── Lazy-loaded pages — each becomes its own JS chunk ────────────────────────
const NotFound               = lazy(() => import('@/pages/not-found'));
const EntryExperience        = lazy(() => import('@/pages/entry-experience'));
const Dashboard              = lazy(() => import('@/pages/dashboard'));
const BankDetail             = lazy(() => import('@/pages/bank-detail'));
const Settings               = lazy(() => import('@/pages/settings'));
const Meetings               = lazy(() => import('@/pages/meetings'));
const Documents              = lazy(() => import('@/pages/documents'));
const Security               = lazy(() => import('@/pages/security'));
const Login                  = lazy(() => import('@/pages/login'));
const ChangePassword         = lazy(() => import('@/pages/change-password'));
const ForgotPassword         = lazy(() => import('@/pages/forgot-password'));
const ResetPassword          = lazy(() => import('@/pages/reset-password'));
const AdminUsers             = lazy(() => import('@/pages/admin-users'));
const AdminSystemHealth      = lazy(() => import('@/pages/admin-system-health'));
const AdminSystemTests       = lazy(() => import('@/pages/admin-system-tests'));
const AdminSystemTestsReports = lazy(() => import('@/pages/admin-system-tests-reports'));
const AdminPerformance       = lazy(() => import('@/pages/admin-performance'));
const AdminImplementationSettings = lazy(() => import('@/pages/admin-implementation-settings'));
const QuickUpdate            = lazy(() => import('@/pages/QuickUpdate'));

/** Full-screen centered spinner shown while a page chunk is loading */
function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

/** Mounts the SSE listener for real-time invalidation — renders nothing. */
function RealtimeUpdater() {
  useRealtimeUpdates();
  return null;
}

function AppRoutes() {
  return (
    <>
      <RealtimeUpdater />
      <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* ── Public: quick-update form (no auth needed — token carries the permission) */}
        <Route path="/quick-update/:token" component={QuickUpdate} />

      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/change-password">
        <RequireAuth allowMustChangePassword>
          <ChangePassword />
        </RequireAuth>
      </Route>
      <Route path="/">
        <RequireAuth>
          <EntryExperience />
        </RequireAuth>
      </Route>
      <Route path="/portfolio">
        <RequireAuth permission="dashboard_access">
          <Layout><Dashboard /></Layout>
        </RequireAuth>
      </Route>
      <Route path="/bank/:id">
        <RequireAuth permission="dashboard_access">
          <Layout><BankDetail /></Layout>
        </RequireAuth>
      </Route>
      <Route path="/settings">
        <RequireAuth permission="dashboard_access">
          <Layout><Settings /></Layout>
        </RequireAuth>
      </Route>
      <Route path="/meetings">
        <RequireAuth permission="meetings">
          <Layout><Meetings /></Layout>
        </RequireAuth>
      </Route>
      <Route path="/documents">
        <RequireAuth permission="documents">
          <Layout><Documents /></Layout>
        </RequireAuth>
      </Route>
      <Route path="/security">
        <RequireAuth permission="security">
          <Layout><Security /></Layout>
        </RequireAuth>
      </Route>
      <Route path="/admin/users">
        <RequireAuth roles={['super_admin']} permission="user_management">
          <Layout>
            <AdminPinGate>
              <AdminUsers />
            </AdminPinGate>
          </Layout>
        </RequireAuth>
      </Route>
      <Route path="/admin/system-health">
        <RequireAuth roles={['super_admin']} permission="user_management">
          <Layout>
            <AdminPinGate>
              <AdminSystemHealth />
            </AdminPinGate>
          </Layout>
        </RequireAuth>
      </Route>
      <Route path="/admin/system-tests/reports">
        <RequireAuth roles={['super_admin']} permission="user_management">
          <Layout>
            <AdminPinGate>
              <AdminSystemTestsReports />
            </AdminPinGate>
          </Layout>
        </RequireAuth>
      </Route>
      <Route path="/admin/system-tests">
        <RequireAuth roles={['super_admin']} permission="user_management">
          <Layout>
            <AdminPinGate>
              <AdminSystemTests />
            </AdminPinGate>
          </Layout>
        </RequireAuth>
      </Route>
      <Route path="/admin/performance">
        <RequireAuth roles={['super_admin']} permission="user_management">
          <Layout>
            <AdminPinGate>
              <AdminPerformance />
            </AdminPinGate>
          </Layout>
        </RequireAuth>
      </Route>
      <Route path="/admin/implementation-settings">
        <RequireAuth roles={['super_admin']} permission="user_management">
          <Layout>
            <AdminPinGate>
              <AdminImplementationSettings />
            </AdminPinGate>
          </Layout>
        </RequireAuth>
      </Route>
      <Route>
        <Layout><NotFound /></Layout>
      </Route>
    </Switch>
    </Suspense>
    </>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <AuthProvider>
                <PostHogProvider>
                  <AppRoutes />
                </PostHogProvider>
              </AuthProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
