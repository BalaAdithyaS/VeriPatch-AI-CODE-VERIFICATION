import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import {
  FolderGit2, Plus, Activity, AlertTriangle,
  CheckCircle2, ChevronRight, Loader2, GitBranch,
} from 'lucide-react';

interface Repo {
  id: string;
  full_name: string;
  owner: string;
  name: string;
  language: string | null;
  default_branch: string;
}

function greeting(name: string) {
  const h = new Date().getHours();
  if (h < 12) return `Good morning, ${name}`;
  if (h < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

function MetricCard({
  label, value, icon: Icon,
}: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div
      className="rounded border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--subtle)' }}
        >
          {label}
        </span>
        <Icon className="w-3.5 h-3.5" style={{ color: 'var(--subtle)' }} />
      </div>
      <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/repositories/')
      .then(res => setRepos(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
            {greeting(firstName)}
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--muted)' }}>
            Monitor code health, analysis runs, findings, and verified repairs.
          </p>
        </div>
        <Link
          to="/github/repositories"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-medium text-white transition-colors shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          <Plus className="w-3.5 h-3.5" />
          Analyze repository
        </Link>
      </div>

      {/* Connection notice */}
      <div
        className="flex items-center justify-between mb-6 px-3 py-2 rounded border text-[12px]"
        style={{ background: 'var(--elevated)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: repos.length > 0 ? 'var(--success)' : 'var(--warning)' }}
          />
          {loading
            ? 'Loading...'
            : repos.length > 0
              ? `${repos.length} ${repos.length === 1 ? 'repository' : 'repositories'} imported`
              : 'No repositories imported — add one to get started.'}
        </div>
        <Link to="/github/connect" className="flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
          Manage <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <MetricCard label="Repositories"    value={loading ? '—' : repos.length} icon={FolderGit2}    />
        <MetricCard label="Active analyses" value="—"                             icon={Activity}       />
        <MetricCard label="Open findings"   value="—"                             icon={AlertTriangle}  />
        <MetricCard label="Verified fixes"  value="—"                             icon={CheckCircle2}   />
      </div>

      {/* Repositories table */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
            Repositories
          </h2>
          <Link to="/github/repositories" className="text-[12px]" style={{ color: 'var(--accent)' }}>
            View all
          </Link>
        </div>
        <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2" style={{ color: 'var(--subtle)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[13px]">Loading...</span>
            </div>
          ) : repos.length === 0 ? (
            <div className="py-12 text-center">
              <FolderGit2 className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--border)' }} />
              <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--muted)' }}>No repositories yet</p>
              <p className="text-[12px] mb-4" style={{ color: 'var(--subtle)' }}>
                Connect GitHub and import a repository to start analyzing code.
              </p>
              <Link
                to="/github/repositories"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Plus className="w-3.5 h-3.5" /> Import repository
              </Link>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--elevated)' }}>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>Repository</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--subtle)' }}>Language</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--subtle)' }}>Branch</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {repos.map((repo, i) => (
                  <tr
                    key={repo.id}
                    className="cursor-pointer group transition-colors hover:bg-zinc-800/30"
                    style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
                    onClick={() => navigate(`/workspaces/${repo.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FolderGit2 className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }} />
                        <span
                          className="font-medium group-hover:text-indigo-400 transition-colors"
                          style={{ color: 'var(--text)' }}
                        >
                          {repo.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {repo.language ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          <span style={{ color: 'var(--muted)' }}>{repo.language}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--subtle)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 font-mono text-[12px]" style={{ color: 'var(--muted)' }}>
                        <GitBranch className="w-3.5 h-3.5" />
                        {repo.default_branch}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className="text-[12px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1"
                        style={{ color: 'var(--accent)' }}
                      >
                        Open <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Workflow strip */}
      <div className="flex items-center flex-wrap gap-1 text-[12px]" style={{ color: 'var(--subtle)' }}>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider"
          style={{ background: 'var(--elevated)', color: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          WORKFLOW
        </span>
        {['Import repository', 'Clone workspace', 'Run analysis', 'AI review', 'Verify fix', 'Create PR'].map((step, i, arr) => (
          <React.Fragment key={step}>
            <span>{step}</span>
            {i < arr.length - 1 && <ChevronRight className="w-3 h-3" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
