import { createRoot } from 'react-dom/client';
import { setAuthTokenGetter } from '@workspace/api-client-react';

import App from './App';
import { supabase } from './lib/supabaseClient';

import './index.css';

// The typed API client attaches this token as `Authorization: Bearer <token>`
// on every request so the backend can identify the caller for audit-log and
// "updated by" tracking, and enforce role checks on protected routes.
setAuthTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});

createRoot(document.getElementById('root')!).render(<App />);
