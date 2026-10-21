import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { Folder, File, ChevronRight, ChevronDown, Download, Play, RefreshCw, AlertCircle, Activity, X, Sparkles, Code2, CheckCircle2, XCircle, GitPullRequest, ExternalLink } from 'lucide-react';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

interface Issue {
  id: string;
  tool: string;
  file_path: string;
  line_number: number;
  column_number: number | null;
  rule_id: string | null;
  message: string;
  severity: string;
}

interface AIComment {
  id: string;
  file_path: string;
  line_number: number;
  comment: string;
  suggested_fix: string | null;
  issue_id: string | null;
  is_verified: boolean | null;
  pr_url: string | null;
}

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  
  const [status, setStatus] = useState<string>('loading');
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis State
  const [issues, setIssues] = useState<Issue[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  
  // AI Review State
  const [comments, setComments] = useState<AIComment[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [creatingPrId, setCreatingPrId] = useState<string | null>(null);
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [creatingAllPRs, setCreatingAllPRs] = useState(false);
  const [prProgress, setPrProgress] = useState<{ done: number; total: number; errors: number } | null>(null);
  const [prError, setPrError] = useState<string | null>(null);

  // Panel State
  const [activePanel, setActivePanel] = useState<'none' | 'issues' | 'ai'>('none');

  useEffect(() => {
    checkStatus();
  }, [id]);

  const checkStatus = async () => {
    try {
      const res = await api.get(`/workspaces/${id}/status`);
      setStatus(res.data.status);
      if (res.data.status === 'cloned') {
        fetchTree();
        fetchIssues();
        fetchComments();
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch workspace status");
    }
  };

  const handleClone = async () => {
    try {
      setStatus('cloning');
      await api.post(`/workspaces/${id}/clone`);
      const interval = setInterval(async () => {
        const res = await api.get(`/workspaces/${id}/status`);
        if (res.data.status === 'cloned') {
          clearInterval(interval);
          setStatus('cloned');
          fetchTree();
        }
      }, 2000);
    } catch (err) {
      console.error(err);
      setError("Failed to start cloning");
      setStatus('not_cloned');
    }
  };

  const fetchTree = async () => {
    try {
      const res = await api.get(`/workspaces/${id}/tree`);
      setTree(res.data.tree);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchIssues = async () => {
    try {
      const res = await api.get(`/workspaces/${id}/issues`);
      if (res.data?.issues) setIssues(res.data.issues);
    } catch (err) {
      console.log("No issues found");
    }
  };

  const fetchComments = async () => {
    try {
      const res = await api.get(`/workspaces/${id}/reviews/latest`);
      if (res.data?.comments) setComments(res.data.comments);
    } catch (err) {
      console.log("No AI reviews found");
    }
  };

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      const res = await api.post(`/workspaces/${id}/analyze`);
      setIssues(res.data.issues);
      setActivePanel('issues');
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAIReview = async () => {
    try {
      setReviewing(true);
      const res = await api.post(`/workspaces/${id}/review`);
      setComments(res.data.comments);
      setActivePanel('ai');
    } catch (err) {
      console.error(err);
    } finally {
      setReviewing(false);
    }
  };

  const handleVerify = async (commentId: string) => {
    try {
      setVerifyingId(commentId);
      const res = await api.post(`/workspaces/${id}/comments/${commentId}/verify`);
      
      if (res.data.error) {
        alert("Verification failed: " + res.data.error);
        return false;
      }
      
      // Update local state (use functional update to avoid stale closures in loop)
      setComments(prev => prev.map(c => 
        c.id === commentId ? { ...c, is_verified: res.data.is_verified } : c
      ));
      return true;
    } catch (err) {
      return false;
    } finally {
      setVerifyingId(null);
    }
  };

  const handleVerifyAll = async () => {
    setVerifyingAll(true);
    // Find all unverified comments that have a suggested fix
    const unverified = comments.filter(c => c.is_verified === null && c.suggested_fix);
    
    // Process them sequentially to avoid Git lock conflicts
    for (const comment of unverified) {
      const success = await handleVerify(comment.id);
      if (!success) {
        break; // Stop iterating to prevent a cascade of network errors
      }
    }
    setVerifyingAll(false);
  };

  const handleCreateAllPRs = async () => {
    setCreatingAllPRs(true);
    setPrError(null);
    
    // Snapshot unsubmitted list at start
    const unsubmitted = comments.filter(c => c.is_verified === true && !c.pr_url);
    setPrProgress({ done: 0, total: unsubmitted.length, errors: 0 });
    
    let done = 0;
    let errors = 0;
    
    for (const comment of unsubmitted) {
      const result = await handleCreatePR(comment.id, true /* batch mode */);
      done++;
      if (!result.success) errors++;
      setPrProgress({ done, total: unsubmitted.length, errors });
    }
    
    if (errors > 0 && errors === unsubmitted.length) {
      setPrError(`All ${errors} PR creation attempts failed. Check GitHub token permissions.`);
    } else if (errors > 0) {
      setPrError(`${errors} of ${unsubmitted.length} PRs failed. The rest were created successfully.`);
    }
    
    setCreatingAllPRs(false);
  };

  const handleCreatePR = async (commentId: string, batchMode = false): Promise<{ success: boolean; pr_url?: string; error?: string }> => {
    try {
      if (!batchMode) {
        setPrError(null);
      }
      setCreatingPrId(commentId);
      
      // 90-second timeout to prevent indefinite hangs
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000);
      
      let res: any;
      try {
        res = await api.post(
          `/workspaces/${id}/comments/${commentId}/pr`,
          {},
          { signal: controller.signal }
        );
      } finally {
        clearTimeout(timeoutId);
      }
      
      if (res.data.error) {
        if (!batchMode) {
          setPrError('PR creation failed: ' + res.data.error);
        }
        return { success: false, error: res.data.error };
      }
      
      const pr_url = res.data.pr_url;
      
      // Use functional update to avoid stale closure over comments
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, pr_url } : c
      ));
      
      return { success: true, pr_url };
      
    } catch (err: any) {
      let msg: string;
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        msg = 'Request timed out after 90 seconds. The server may still be processing — check GitHub for the branch.';
      } else if (err.response) {
        msg = `Server error ${err.response.status}: ${err.response.data?.detail || err.response.statusText}`;
      } else {
        msg = err.message || 'Network error';
      }
      if (!batchMode) {
        setPrError('PR creation failed: ' + msg);
      }
      return { success: false, error: msg };
    } finally {
      setCreatingPrId(null);
    }
  };

  const handleFileSelect = async (path: string) => {
    setSelectedFile(path);
    setLoadingFile(true);
    setFileContent('');
    try {
      const res = await api.get(`/workspaces/${id}/file?path=${encodeURIComponent(path)}`);
      setFileContent(res.data.content);
    } catch (err) {
      setFileContent('// Error loading file contents or file is binary.');
    } finally {
      setLoadingFile(false);
    }
  };

  const handleIssueClick = (path: string) => {
    handleFileSelect(path);
  };

  const FileTreeItem = ({ node, level = 0 }: { node: TreeNode, level?: number }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isDir = node.type === 'directory';
    const isSelected = selectedFile === node.path;

    return (
      <div className="w-full">
        <div
          className="flex items-center py-1 cursor-pointer text-[12px] transition-colors duration-150"
          style={{
            paddingLeft: `${level * 10 + 8}px`,
            paddingRight: '8px',
            background: isSelected ? 'rgba(99,102,241,0.12)' : undefined,
            color: isSelected ? '#818CF8' : 'var(--muted)',
            borderRight: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
          }}
          onClick={() => {
            if (isDir) setIsOpen(!isOpen);
            else handleFileSelect(node.path);
          }}
          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--elevated)'; }}
          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''; }}
        >
          <span className="w-4 flex items-center justify-center shrink-0" style={{ color: 'var(--subtle)' }}>
            {isDir ? (isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />) : null}
          </span>
          {isDir
            ? <Folder className="w-3.5 h-3.5 mr-1.5 shrink-0" style={{ color: 'var(--accent)' }} />
            : <File className="w-3.5 h-3.5 mr-1.5 shrink-0" style={{ color: 'var(--subtle)' }} />
          }
          <span className="truncate">{node.name}</span>
        </div>
        {isDir && isOpen && node.children && (
          <div className="w-full">
            {node.children.map((child, i) => (
              <FileTreeItem key={i} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (status === 'loading') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)', color: 'var(--accent)' }}>
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="text-[12px] font-medium tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Loading workspace...</span>
      </div>
    );
  }

  if (status === 'not_cloned' || status === 'cloning') {
    return (
      <div className="min-h-full flex items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
        <div
          className="p-8 rounded-xl border text-center max-w-sm w-full"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div
            className="w-14 h-14 rounded-lg flex items-center justify-center mx-auto mb-5"
            style={{ background: 'var(--elevated)' }}
          >
            <Download className="w-7 h-7" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-[15px] font-semibold mb-2" style={{ color: 'var(--text)' }}>Workspace Not Initialized</h2>
          <p className="text-[13px] mb-6 leading-relaxed" style={{ color: 'var(--muted)' }}>
            This repository needs to be cloned to the VeriPatch environment before analysis can begin.
          </p>
          {error && (
            <div className="mb-4 px-3 py-2 rounded text-xs bg-red-950/50 border border-red-700/30 text-red-300 text-left">
              {error}
            </div>
          )}
          <button
            onClick={handleClone}
            disabled={status === 'cloning'}
            className="w-full py-2.5 px-4 text-white rounded text-[13px] font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {status === 'cloning'
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Cloning workspace...</>
              : <><Play className="w-4 h-4" /> Initialize workspace</>
            }
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ color: 'var(--text)' }}>
      {/* Workspace toolbar */}
      <div
        className="h-11 border-b flex items-center px-4 justify-between shrink-0 z-20"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium" style={{ color: 'var(--muted)' }}>Workspace Explorer</span>
          <div className="w-px h-4" style={{ background: 'var(--border)' }} />
          <button
            onClick={() => setActivePanel(activePanel === 'issues' ? 'none' : 'issues')}
            className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded transition-colors ${activePanel === 'issues' || issues.length > 0 ? 'bg-amber-500/10 text-amber-400' : ''}`}
            style={activePanel !== 'issues' && issues.length === 0 ? { color: 'var(--muted)' } : undefined}
          >
            <AlertCircle className="w-3.5 h-3.5" /> {issues.length} Issues
          </button>
          <button
            onClick={() => setActivePanel(activePanel === 'ai' ? 'none' : 'ai')}
            className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded transition-colors ${activePanel === 'ai' || comments.length > 0 ? 'bg-purple-500/10 text-purple-400' : ''}`}
            style={activePanel !== 'ai' && comments.length === 0 ? { color: 'var(--muted)' } : undefined}
          >
            <Sparkles className="w-3.5 h-3.5" /> {comments.length} AI Comments
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded transition-colors disabled:opacity-50"
            style={{ background: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            {analyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
          <button
            onClick={handleAIReview}
            disabled={reviewing || issues.length === 0}
            title={issues.length === 0 ? 'Run Analysis first' : 'Request AI Code Review'}
            className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded text-white transition-all disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {reviewing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {reviewing ? 'Reviewing...' : 'AI Review'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-950/60 border-b border-red-800/40 text-xs text-red-300 flex items-center justify-between shrink-0">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className="w-56 flex flex-col shrink-0 border-r"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div
            className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest border-b"
            style={{ color: 'var(--subtle)', borderColor: 'var(--border)' }}
          >
            Explorer
          </div>
          <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
            {tree.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 py-8" style={{ color: 'var(--subtle)' }}>
                <Folder className="w-7 h-7 opacity-30" />
                <span className="text-[12px]">No files found.</span>
              </div>
            ) : (
              tree.map((node, i) => <FileTreeItem key={i} node={node} />)
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col bg-[#0d1117] relative overflow-hidden">
          {selectedFile ? (
            <>
              <div className="h-12 border-b border-slate-800/60 bg-slate-900/40 flex items-center px-5 shrink-0 shadow-sm">
                <File className="w-4 h-4 text-indigo-400 mr-2.5" />
                <span className="text-sm font-medium text-slate-300 tracking-wide">{selectedFile}</span>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar p-6 relative">
                {loadingFile ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <pre className="text-sm font-mono text-slate-300 whitespace-pre-wrap leading-relaxed tab-size-4">
                    <code>{fileContent}</code>
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 flex-col opacity-50 select-none">
              <Folder className="w-20 h-20 mb-6 text-slate-700" />
              <p className="text-lg tracking-wide font-medium">Select a file to view its contents</p>
            </div>
          )}

          {/* Bottom Panel */}
          {activePanel !== 'none' && (
            <div className="h-80 border-t border-slate-700/80 bg-slate-900/95 backdrop-blur-xl flex flex-col shrink-0 shadow-[0_-15px_50px_rgba(0,0,0,0.5)] z-30 transition-transform duration-300 ease-in-out">
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800 bg-slate-950/50">
                <div className="flex gap-6">
                  <button 
                    onClick={() => setActivePanel('issues')}
                    className={`text-sm font-semibold flex items-center gap-2 pb-2.5 -mb-[11px] border-b-2 transition-colors ${activePanel === 'issues' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    <AlertCircle className="w-4 h-4" /> Static Analysis
                  </button>
                  <button 
                    onClick={() => setActivePanel('ai')}
                    className={`text-sm font-semibold flex items-center gap-2 pb-2.5 -mb-[11px] border-b-2 transition-colors ${activePanel === 'ai' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    <Sparkles className="w-4 h-4" /> AI Feedback
                  </button>
                </div>
                <button onClick={() => setActivePanel('none')} className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto custom-scrollbar">
                {/* Static Analysis Tab */}
                {activePanel === 'issues' && (
                  issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-3">
                       <CheckCircle2 className="w-10 h-10 text-green-500/20" />
                       <span className="text-slate-400 tracking-wide">No issues found! Your code is pristine.</span>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-800/40 text-slate-400 sticky top-0 z-10 shadow-sm backdrop-blur-md">
                        <tr>
                          <th className="px-6 py-3 font-medium uppercase tracking-wider text-xs">Severity</th>
                          <th className="px-6 py-3 font-medium uppercase tracking-wider text-xs">File</th>
                          <th className="px-6 py-3 font-medium uppercase tracking-wider text-xs">Line</th>
                          <th className="px-6 py-3 font-medium uppercase tracking-wider text-xs">Tool/Rule</th>
                          <th className="px-6 py-3 font-medium uppercase tracking-wider text-xs w-full">Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {issues.map(issue => (
                          <tr 
                            key={issue.id} 
                            className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                            onClick={() => handleIssueClick(issue.file_path)}
                          >
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                issue.severity === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                issue.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}>
                                {issue.severity}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-slate-300 font-medium">{issue.file_path.split('/').pop()}</td>
                            <td className="px-6 py-3 text-slate-400 font-mono">{issue.line_number}</td>
                            <td className="px-6 py-3 text-slate-400">{issue.tool} <span className="text-slate-500">{issue.rule_id ? `(${issue.rule_id})` : ''}</span></td>
                            <td className="px-6 py-3 text-slate-300 truncate max-w-lg" title={issue.message}>{issue.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {/* AI Reviews Tab */}
                {activePanel === 'ai' && (
                  comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-4">
                      <div className="w-16 h-16 bg-purple-500/5 rounded-full flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-purple-500/40" />
                      </div>
                      <p className="tracking-wide">No AI reviews yet. Run a Static Analysis, then request an AI Review.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      {/* Progress & Error Banner */}
                      {creatingAllPRs && prProgress && (
                        <div className="px-5 py-2 bg-indigo-950/60 border-b border-indigo-700/40 shrink-0">
                          <div className="flex justify-between text-xs text-indigo-300 mb-1.5">
                            <span className="font-medium">Creating PRs… {prProgress.done}/{prProgress.total}</span>
                            {prProgress.errors > 0 && <span className="text-amber-400">{prProgress.errors} failed</span>}
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${Math.round((prProgress.done / prProgress.total) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {!creatingAllPRs && prError && (
                        <div className="px-5 py-2.5 bg-red-950/50 border-b border-red-700/30 shrink-0 flex items-start gap-3">
                          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                          <span className="text-xs text-red-300 leading-relaxed">{prError}</span>
                          <button onClick={() => setPrError(null)} className="ml-auto text-red-500 hover:text-red-300 shrink-0"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                      <div className="px-5 py-2 border-b border-slate-800/60 bg-slate-900/50 flex justify-between items-center shrink-0">
                        <span className="text-xs font-medium text-slate-400">
                          {comments.filter(c => c.is_verified === null && c.suggested_fix).length} unverified, {comments.filter(c => c.is_verified === true && !c.pr_url).length} verified without PR
                        </span>
                        <div className="flex gap-2">
                          {comments.filter(c => c.is_verified === null && c.suggested_fix).length > 0 && (
                            <button
                              onClick={handleVerifyAll}
                              disabled={verifyingAll || verifyingId !== null}
                              className="flex items-center gap-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 border border-slate-700 shadow-sm"
                            >
                              {verifyingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                              {verifyingAll ? 'Verifying All...' : 'Verify All in Sandbox'}
                            </button>
                          )}
                          {creatingAllPRs ? (
                            <span className="text-xs font-medium text-indigo-300 flex items-center gap-2">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              {prProgress ? `${prProgress.done}/${prProgress.total}` : 'Creating…'}
                            </span>
                          ) : comments.filter(c => c.is_verified === true && !c.pr_url).length > 0 && (
                            <button
                              onClick={handleCreateAllPRs}
                              disabled={creatingAllPRs || creatingPrId !== null}
                              className="flex items-center gap-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 border border-indigo-500 shadow-sm shadow-indigo-900/20"
                            >
                              <GitPullRequest className="w-3.5 h-3.5" />
                              Create All PRs
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto divide-y divide-slate-800/60">
                        {comments.map(comment => (
                        <div key={comment.id} className="p-6 hover:bg-slate-800/20 transition-colors group">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-purple-500/10 rounded-md">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                              </div>
                              <button 
                                onClick={() => handleIssueClick(comment.file_path)}
                                className="text-sm font-semibold text-slate-200 hover:text-indigo-400 transition-colors flex items-center gap-2"
                              >
                                {comment.file_path} <span className="text-slate-500 font-mono font-normal">:{comment.line_number}</span>
                              </button>
                            </div>
                            
                            {/* Verification & PR Actions */}
                            {comment.suggested_fix && (
                              <div className="flex items-center gap-3">
                                {/* Verification Status */}
                                {comment.is_verified === true && (
                                  <span className="flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-500/10 px-2.5 py-1.5 rounded-lg border border-green-500/20 shadow-sm">
                                    <CheckCircle2 className="w-4 h-4" /> Verified
                                  </span>
                                )}
                                {comment.is_verified === false && (
                                  <span className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20 shadow-sm">
                                    <XCircle className="w-4 h-4" /> Failed
                                  </span>
                                )}
                                {comment.is_verified === null && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleVerify(comment.id); }}
                                    disabled={verifyingId === comment.id}
                                    className="flex items-center gap-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 border border-slate-700 shadow-sm hover:shadow"
                                  >
                                    {verifyingId === comment.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                    {verifyingId === comment.id ? 'Verifying...' : 'Verify in Sandbox'}
                                  </button>
                                )}

                                {/* PR Status */}
                                {comment.is_verified === true && !comment.pr_url && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleCreatePR(comment.id); }}
                                    disabled={creatingPrId === comment.id}
                                    className="flex items-center gap-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 shadow-md shadow-indigo-900/20 hover:shadow-indigo-900/40 border border-indigo-500"
                                  >
                                    {creatingPrId === comment.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GitPullRequest className="w-3.5 h-3.5" />}
                                    {creatingPrId === comment.id ? 'Creating...' : 'Create PR'}
                                  </button>
                                )}
                                {comment.pr_url && (
                                  <a
                                    href={comment.pr_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700 shadow-sm"
                                  >
                                    <GitPullRequest className="w-3.5 h-3.5" /> View PR <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <p className="text-sm text-slate-300 mb-4 ml-9 leading-relaxed">{comment.comment}</p>
                          
                          {comment.suggested_fix && (
                            <div className="ml-9 border border-slate-700/60 rounded-xl overflow-hidden bg-[#0d1117] shadow-inner">
                              <div className="bg-slate-800/40 px-4 py-2 text-xs font-semibold text-slate-400 border-b border-slate-700/60 flex items-center gap-2">
                                <Code2 className="w-4 h-4" /> Suggested Fix
                              </div>
                              <pre className="p-4 text-sm font-mono text-green-400 overflow-x-auto leading-relaxed">
                                <code>{comment.suggested_fix}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
