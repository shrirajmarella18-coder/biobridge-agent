import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548.957 9s.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, authError } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setPending(true);
    try {
      if (mode === 'signup') await signUpWithEmail(email, password, name);
      else await signInWithEmail(email, password);
    } catch {
      // useAuth exposes the user-friendly error.
    } finally {
      setPending(false);
    }
  }

  async function google() {
    setMessage(null);
    setPending(true);
    try { await signInWithGoogle(); } catch { /* shown below */ } finally { setPending(false); }
  }

  async function forgotPassword() {
    if (!email.trim()) {
      setMessage('Enter your email first, then click Forgot password.');
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      await resetPassword(email);
      setMessage('Password reset email sent. Check your inbox.');
    } catch { /* useAuth error */ } finally { setPending(false); }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-panel border border-hairline rounded-lg p-8" style={{ animation: 'fadeUp 350ms ease-out forwards' }}>
        <div className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            Pharmaceutical Engineering &amp; Regulatory Documentation
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-content">BioBridge AI</h1>
          <p className="text-xs text-muted mt-2">Technical RAG + live research workspace</p>
        </div>

        <div className="grid grid-cols-2 bg-ink rounded-lg p-1 mt-7 mb-5">
          <button onClick={() => setMode('signin')} className={`py-2 rounded-md text-sm ${mode === 'signin' ? 'bg-panel-active text-content' : 'text-muted'}`}>Log in</button>
          <button onClick={() => setMode('signup')} className={`py-2 rounded-md text-sm ${mode === 'signup' ? 'bg-panel-active text-content' : 'text-muted'}`}>Sign up</button>
        </div>

        <button onClick={google} disabled={pending} className="w-full flex items-center justify-center gap-3 bg-content text-ink font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-white disabled:opacity-60 min-h-[42px]">
          <GoogleIcon /> Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5"><div className="h-px bg-hairline flex-1" /><span className="text-[10px] text-muted font-mono uppercase">or email</span><div className="h-px bg-hairline flex-1" /></div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" autoComplete="name" className="w-full bg-ink border border-hairline rounded-lg px-3 py-2.5 text-sm text-content outline-none focus:border-muted" />
          )}
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email address" autoComplete="email" required className="w-full bg-ink border border-hairline rounded-lg px-3 py-2.5 text-sm text-content outline-none focus:border-muted" />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required className="w-full bg-ink border border-hairline rounded-lg px-3 py-2.5 text-sm text-content outline-none focus:border-muted" />
          <button disabled={pending} className="w-full bg-teal text-ink font-semibold text-sm px-4 py-2.5 rounded-lg disabled:opacity-60 min-h-[42px]">
            {pending ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>

        {mode === 'signin' && <button onClick={forgotPassword} disabled={pending} className="w-full mt-3 text-xs text-muted hover:text-content">Forgot password?</button>}

        {(message || authError) && <p className="mt-4 text-xs text-red-400 font-mono text-center">{message ?? authError}</p>}
        <p className="mt-6 text-xs text-muted leading-relaxed text-center">Your Firebase account controls access to your private BioBridge workspace. Uploaded documents are isolated by your Firebase user ID.</p>
      </div>
    </div>
  );
}
