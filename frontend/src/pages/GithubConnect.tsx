import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import {
  GitBranch, Key, Eye, EyeOff, CheckCircle2,
  ChevronDown, ChevronUp, ExternalLink, Loader2, ArrowLeft,
} from 'lucide-react';

const SECURITY_ITEMS = [
  'Token encrypted at rest using industry-standard encryption',
  'Repository access scoped to selected repositories only',
  'VeriPatch never exposes your token after submission',
  'Revoke access from GitHub at any time',
];

const PERMISSIONS = [
  { scope: 'Contents',      level: 'Read & write', note: 'Apply patches to branches' },
  { scope: 'Pull requests', level: 'Read & write', note: 'Create pull requests' },
  { scope: 'Metadata',      level: 'Read-only',    note: 'List repositories' },
];

export default function GithubConnect() {
  const [pat, setPat] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<{ connected: boolean; username: string | null } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    try {
      const response = await api.get('/github/status');
      setStatus(response.data);
    } catch (err) {
      console.error('Failed to fetch github status', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/github/connect', { personal_access_token: pat });
      fetchStatus();
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to connect GitHub account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full px-6 py-8 max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-[12px] mb-6 transition-colors"
        style={{ color: 'var(--subtle)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left explanation */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="w-9 h-9 rounded border flex items-center justify-center"
              style={{ background: 'var(--elevated)', borderColor: 'var(--border)' }}
            >
              <GitBranch className="w-5 h-5" style={{ color: 'var(--text)' }} />
            </div>
            <div>
              <h1 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>Connect GitHub</h1>
              <p className="text-[11px]" style={{ color: 'var(--subtle)' }}>Personal Access Token</p>
            </div>
          </div>

          <p className="text-[12px] leading-relaxed mb-5" style={{ color: 'var(--muted)' }}>
            Give VeriPatch access to the repositories you want to analyze. Your token is encrypted before storage and never returned to the browser.
          </p>

          {/* Security checklist */}
          <div className="space-y-2 mb-5">
            {SECURITY_ITEMS.map(item => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
                <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{item}</span>
              </div>
            ))}
          </div>

          {/* Required permissions */}
          <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div
              className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ background: 'var(--elevated)', borderBottom: '1px solid var(--border)', color: 'var(--subtle)' }}
            >
              Required permissions
            </div>
            {PERMISSIONS.map((p, i) => (
              <div
                key={p.scope}
                className="px-3 py-2 flex items-center justify-between"
                style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
              >
                <div>
                  <span className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>{p.scope}</span>
                  <span className="text-[11px] ml-2" style={{ color: 'var(--subtle)' }}>{p.note}</span>
                </div>
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded font-mono"
                  style={{ background: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                >
                  {p.level}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right form */}
        <div className="lg:col-span-3">
          <div className="rounded border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {status?.connected ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-[13px] font-semibold text-zinc-200">
                    {status.username?.charAt(0)?.toUpperCase() ?? 'G'}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{status.username}</p>
                    <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--success)' }}>
                      <CheckCircle2 className="w-3 h-3" /> Connected to GitHub
                    </p>
                  </div>
                </div>
                <p className="text-[12px] mb-5" style={{ color: 'var(--muted)' }}>
                  Your GitHub account is linked. You can import repositories and create pull requests.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Link
                    to="/github/repositories"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    Browse repositories
                  </Link>
                  <button
                    onClick={() => setStatus(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] border transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                  >
                    Reconnect
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h2 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text)' }}>
                  Connect your GitHub account
                </h2>
                <p className="text-[12px] mb-5" style={{ color: 'var(--muted)' }}>
                  Generate a Fine-Grained Personal Access Token from GitHub and paste it below.
                </p>

                {error && (
                  <div
                    className="mb-4 px-3 py-2.5 rounded border text-[12px]"
                    style={{ background: '#3f1111', borderColor: '#7f1d1d', color: '#fca5a5' }}
                  >
                    {error}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                    Personal Access Token
                  </label>
                  <div className="relative">
                    <Key
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                      style={{ color: 'var(--subtle)' }}
                    />
                    <input
                      type={showPat ? 'text' : 'password'}
                      required
                      value={pat}
                      onChange={e => setPat(e.target.value)}
                      placeholder="github_pat_xxxxxxxxxxxx"
                      className="w-full pl-9 pr-10 py-2 rounded border text-[13px] outline-none font-mono transition-colors"
                      style={{ background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--text)' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPat(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--subtle)' }}
                      aria-label={showPat ? 'Hide token' : 'Show token'}
                    >
                      {showPat ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px]" style={{ color: 'var(--subtle)' }}>
                    Token is encrypted before storage and never returned to the browser after submission.
                  </p>
                </div>

                {/* Help accordion */}
                <button
                  type="button"
                  onClick={() => setHelpOpen(o => !o)}
                  className="flex items-center gap-1.5 text-[12px] mb-4 transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  How to create a token
                  {helpOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {helpOpen && (
                  <div
                    className="mb-4 p-3 rounded border text-[12px] space-y-1"
                    style={{ background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                  >
                    <p>1. Go to <strong style={{ color: 'var(--text)' }}>github.com → Settings → Developer settings → Fine-grained tokens</strong></p>
                    <p>2. Click <strong style={{ color: 'var(--text)' }}>Generate new token</strong></p>
                    <p>3. Select your repository under <strong style={{ color: 'var(--text)' }}>Repository access</strong></p>
                    <p>4. Under <strong style={{ color: 'var(--text)' }}>Repository permissions</strong> set Contents → Read &amp; write, Pull requests → Read &amp; write</p>
                    <p>5. Copy the generated token and paste it above</p>
                    <a
                      href="https://github.com/settings/personal-access-tokens/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 mt-2"
                      style={{ color: 'var(--accent)' }}
                    >
                      Open GitHub token settings <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !pat}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded text-[13px] font-medium text-white disabled:opacity-60 transition-all"
                  style={{ background: 'var(--accent)' }}
                >
                  {loading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting...</>
                    : <><GitBranch className="w-3.5 h-3.5" /> Connect GitHub</>
                  }
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
