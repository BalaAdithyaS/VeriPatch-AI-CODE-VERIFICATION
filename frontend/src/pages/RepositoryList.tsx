import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { GitBranch, FolderGit2, Search, RefreshCw, Lock, Plus, Loader2 } from 'lucide-react';

interface Repo {
  github_id: string;
  name: string;
  full_name: string;
  owner: string;
  private: boolean;
  clone_url: string;
  default_branch: string;
  language: string | null;
}

const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5', TypeScript: '#2b7489', JavaScript: '#f1e05a',
  Go: '#00ADD8', Rust: '#dea584', Java: '#b07219', 'C++': '#f34b7d', C: '#555555',
};

export default function RepositoryList() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [filtered, setFiltered] = useState<Repo[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => { fetchRepos(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(repos.filter(r => r.full_name.toLowerCase().includes(q)));
  }, [search, repos]);

  const fetchRepos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/github/repositories');
      setRepos(response.data);
      setFiltered(response.data);
    } catch (err: any) {
      if (err.response?.status === 400) {
        navigate('/github/connect');
      } else {
        setError('Failed to load repositories');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (repo: Repo) => {
    setImporting(repo.github_id);
    try {
      await api.post('/repositories/', {
        github_repository_id: repo.github_id,
        owner: repo.owner,
        name: repo.name,
        full_name: repo.full_name,
        default_branch: repo.default_branch,
        language: repo.language,
        clone_url: repo.clone_url,
      });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to import repository');
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[15px] font-semibold mb-0.5" style={{ color: 'var(--text)' }}>Import Repository</h1>
          <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
            Select a repository from your GitHub account to import into VeriPatch.
          </p>
        </div>
        <button
          onClick={fetchRepos}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-[12px] transition-colors shrink-0"
          style={{ background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div
          className="mb-4 px-3 py-2.5 rounded border text-[12px]"
          style={{ background: '#3f1111', borderColor: '#7f1d1d', color: '#fca5a5' }}
        >
          {error}
        </div>
      )}

      {/* Search + list */}
      <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        {/* Search bar */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 border-b"
          style={{ background: 'var(--elevated)', borderColor: 'var(--border)' }}
        >
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--subtle)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search repositories..."
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: 'var(--text)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[11px]"
              style={{ color: 'var(--subtle)' }}
            >
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--subtle)' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[13px]">Loading repositories from GitHub...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FolderGit2 className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--border)' }} />
            <p className="text-[13px] font-medium" style={{ color: 'var(--muted)' }}>
              {search ? 'No repositories match your search' : 'No repositories found'}
            </p>
            {!search && (
              <p className="text-[12px] mt-1" style={{ color: 'var(--subtle)' }}>
                Make sure your GitHub account is connected.
              </p>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--surface)' }}>
            {filtered.map((repo, i) => (
              <div
                key={repo.github_id}
                className="flex items-center justify-between px-4 py-3 group transition-colors hover:bg-zinc-800/40"
                style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FolderGit2 className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>
                        {repo.full_name}
                      </span>
                      {repo.private && (
                        <div
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                          style={{ background: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--subtle)' }}
                        >
                          <Lock className="w-2.5 h-2.5" /> Private
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {repo.language && (
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--subtle)' }}>
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: LANG_COLORS[repo.language] ?? '#888' }}
                          />
                          {repo.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: 'var(--subtle)' }}>
                        <GitBranch className="w-3 h-3" />
                        {repo.default_branch}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleImport(repo)}
                  disabled={importing === repo.github_id}
                  className="ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium text-white disabled:opacity-60 transition-all shrink-0"
                  style={{ background: 'var(--accent)' }}
                >
                  {importing === repo.github_id
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing...</>
                    : <><Plus className="w-3.5 h-3.5" /> Import</>
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px]" style={{ color: 'var(--subtle)' }}>
        {filtered.length} {filtered.length === 1 ? 'repository' : 'repositories'} available
      </p>
    </div>
  );
}
