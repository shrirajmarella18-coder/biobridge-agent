import { useAuth } from '@/hooks/useAuth';
import LoginPage from '@/pages/LoginPage';
import AppPage from '@/pages/AppPage';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-ink flex items-center justify-center"><p className="text-sm text-muted font-mono animate-pulse-soft">Loading…</p></div>;
  }

  return user ? <AppPage /> : <LoginPage />;
}
