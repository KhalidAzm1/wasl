import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/Layout';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import EntryExperience from '@/pages/entry-experience';
import Dashboard from '@/pages/dashboard';
import BankDetail from '@/pages/bank-detail';
import Settings from '@/pages/settings';

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
      <Route path="/" component={EntryExperience} />
      <Route path="/portfolio">
        <Layout><Dashboard /></Layout>
      </Route>
      <Route path="/bank/:id">
        <Layout><BankDetail /></Layout>
      </Route>
      <Route path="/settings">
        <Layout><Settings /></Layout>
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
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
