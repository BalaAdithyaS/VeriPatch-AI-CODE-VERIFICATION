import React, { useState } from 'react';
import { useLocation, useNavigate, Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield, LayoutDashboard, FolderGit2, Activity, AlertTriangle,
  GitPullRequest, History, Settings, GitBranch, LogOut,
  ChevronLeft, ChevronRight, Bell, Search, Menu, ChevronDown,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Overview',      icon: LayoutDashboard, to: '/' },
  { label: 'Repositories',  icon: FolderGit2,      to: '/github/repositories' },
  { label: 'Analyses',      icon: Activity,        to: '/analyses' },
  { label: 'Findings',      icon: AlertTriangle,   to: '/findings' },
  { label: 'Pull Requests', icon: GitPullRequest,  to: '/pull-requests' },
  { label: 'History',       icon: History,         to: '/history' },
];

interface AppShellProps { children: React.ReactNode; }

export default function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  const SidebarInner = () => (
    <div className="flex flex-col h-full relative">
      {/* Wordmark */}
      <div
        className={`flex items-center gap-2.5 px-3 h-11 shrink-0 border-b ${collapsed ? 'justify-center' : ''}`}
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          <Shield className="w-3.5 h-3.5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-[13px] font-bold tracking-tight leading-none" style={{ color: 'var(--text)' }}>VERIPATCH</p>
            <p className="text-[9px] tracking-widest leading-none mt-0.5" style={{ color: 'var(--subtle)', letterSpacing: '0.15em' }}>CODE. CHECKED.</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-1.5 py-2 space-y-px overflow-y-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, to }) => {
          const active = isActive(to);
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors duration-150 ${collapsed ? 'justify-center' : ''}`}
              style={active
                ? { background: 'var(--elevated)', color: 'var(--text)' }
                : { color: 'var(--muted)' }
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && label}
            </NavLink>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-2" style={{ borderTop: '1px solid var(--border)' }} />

      {/* Bottom links */}
      <div className="px-1.5 py-2 space-y-px">
        <Link
          to="/github/connect"
          title={collapsed ? 'GitHub' : undefined}
          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[13px] transition-colors ${collapsed ? 'justify-center' : ''}`}
          style={{ color: 'var(--muted)' }}
        >
          <GitBranch className="w-4 h-4 shrink-0" />
          {!collapsed && 'GitHub'}
        </Link>
        <Link
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[13px] transition-colors ${collapsed ? 'justify-center' : ''}`}
          style={{ color: 'var(--muted)' }}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && 'Settings'}
        </Link>
      </div>

      {/* Account */}
      <div className="p-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={handleLogout}
          title={collapsed ? `Sign out (${user?.name ?? ''})` : undefined}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] transition-colors group hover:bg-zinc-800 ${collapsed ? 'justify-center' : ''}`}
          style={{ color: 'var(--muted)' }}
        >
          <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-[10px] font-semibold text-zinc-200">
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[12px] font-medium truncate leading-none" style={{ color: 'var(--text)' }}>{user?.name ?? 'User'}</p>
                <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--subtle)' }}>{user?.email ?? ''}</p>
              </div>
              <LogOut className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </>
          )}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute right-0 top-14 translate-x-1/2 w-5 h-5 rounded-full border flex items-center justify-center z-20 transition-colors hover:bg-zinc-700"
        style={{ background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--muted)' }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </div>
  );

  const breadcrumb = location.pathname === '/'
    ? 'overview'
    : location.pathname.split('/').filter(Boolean).join(' / ');

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      {/* Sidebar – desktop */}
      <aside
        className={`relative hidden lg:flex flex-col shrink-0 transition-all duration-200 border-r ${collapsed ? 'w-14' : 'w-52'}`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <SidebarInner />
      </aside>

      {/* Sidebar – mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside
            className="relative z-10 w-52 flex flex-col border-r"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <SidebarInner />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center gap-3 h-11 px-4 border-b shrink-0"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <button
            className="lg:hidden p-1 rounded"
            style={{ color: 'var(--muted)' }}
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-[12px] min-w-0 font-mono" style={{ color: 'var(--subtle)' }}>
            <span style={{ color: 'var(--subtle)' }}>veripatch</span>
            <span className="mx-0.5">/</span>
            <span className="truncate" style={{ color: 'var(--muted)' }}>{breadcrumb}</span>
          </div>

          <div className="flex-1" />

          {/* Search pill */}
          <div
            className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded border text-[12px] cursor-pointer"
            style={{ background: 'var(--elevated)', borderColor: 'var(--border)', color: 'var(--subtle)' }}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search...</span>
            <kbd
              className="ml-4 text-[10px] px-1 py-0.5 rounded"
              style={{ background: 'var(--border)', color: 'var(--subtle)' }}
            >
              ⌘K
            </kbd>
          </div>

          {/* Bell */}
          <button
            className="p-1.5 rounded transition-colors hover:bg-zinc-800"
            style={{ color: 'var(--muted)' }}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* User chip */}
          <div className="flex items-center gap-1.5 pl-2 border-l" style={{ borderColor: 'var(--border)' }}>
            <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[11px] font-semibold text-zinc-200">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <span className="hidden sm:block text-[12px] font-medium" style={{ color: 'var(--text)' }}>
              {user?.name ?? 'User'}
            </span>
            <ChevronDown className="w-3 h-3" style={{ color: 'var(--subtle)' }} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
