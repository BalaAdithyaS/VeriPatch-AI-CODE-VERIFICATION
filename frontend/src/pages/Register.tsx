import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { Shield, ArrowRight, Loader2 } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', { name, email, password });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left brand panel */}
      <div
        className="hidden lg:flex lg:w-80 xl:w-96 flex-col justify-between p-10 border-r shrink-0"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-12">
            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>VERIPATCH</p>
              <p className="text-[9px] tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.15em' }}>CODE. CHECKED.</p>
            </div>
          </div>
          <h2 className="text-lg font-semibold mb-3 leading-snug" style={{ color: 'var(--text)' }}>
            Start analyzing your code today
          </h2>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            Create your account to connect repositories, run analyses, and get AI-assisted code review with sandbox-verified fixes.
          </p>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--subtle)' }}>VeriPatch — developer infrastructure tooling</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>VERIPATCH</span>
          </div>

          <h1 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text)' }}>Create account</h1>
          <p className="text-[13px] mb-6" style={{ color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link to="/login" className="hover:underline" style={{ color: 'var(--accent)' }}>Sign in</Link>
          </p>

          {error && (
            <div
              className="mb-4 px-3 py-2.5 rounded border text-[12px]"
              style={{ background: '#3f1111', borderColor: '#7f1d1d', color: '#fca5a5' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className="w-full px-3 py-2 rounded border text-[13px] outline-none transition-colors"
                style={{ background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 rounded border text-[13px] outline-none transition-colors"
                style={{ background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded border text-[13px] outline-none transition-colors"
                style={{ background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded text-[13px] font-medium text-white transition-all disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {loading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating account...</>
                : <>Create account <ArrowRight className="w-3.5 h-3.5" /></>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
