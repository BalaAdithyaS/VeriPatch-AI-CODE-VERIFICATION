import subprocess
from pathlib import Path
from sqlalchemy.orm import Session
from github import Github, Auth, GithubException
from urllib.parse import urlparse

from app.core.encryption import decrypt_string

# Import all models so SQLAlchemy resolves cross-model relationships
import app.models  # noqa: F401
from app.models.review import AIComment
from app.models.repository import Repository
from app.models.github import GithubAccount
from app.models.analysis import AnalysisIssue  # noqa: F401 – needed for relationship resolution
from app.core.workspace import WorkspaceManager
from app.core.sandbox import SandboxManager


class PRCreator:
    @staticmethod
    def create_pr(repo_id: str, comment_id: str, db: Session) -> str:
        """
        Creates a PR on GitHub for the given verified comment.

        Flow:
          1. Validate comment + repo + credentials.
          2. Decrypt token and verify push permissions.
          3. Check if a PR already exists for this branch (idempotent).
          4. Reset workspace to main to avoid stale-branch state.
          5. Apply patch to a fresh feature branch.
          6. Commit + push (force-push when remote branch already exists).
          7. Create PR via GitHub API, or retrieve existing open PR.
          8. Persist pr_url and return it.

        Raises ValueError with a human-readable message on any failure.
        """
        # ── 1. Validate comment ────────────────────────────────────────────────
        comment = db.query(AIComment).filter(AIComment.id == comment_id).first()
        if not comment:
            raise ValueError("Comment not found.")
        if not comment.is_verified:
            raise ValueError("Comment has not been verified — cannot create PR.")
        if not comment.suggested_fix or not comment.suggested_fix.strip():
            raise ValueError("No suggested fix available for this comment.")

        # ── 2. Validate repo + credentials ────────────────────────────────────
        repo = db.query(Repository).filter(Repository.id == repo_id).first()
        if not repo:
            raise ValueError("Repository not found.")

        account = db.query(GithubAccount).filter(
            GithubAccount.id == repo.github_account_id
        ).first()
        if not account or not account.encrypted_credentials:
            raise ValueError(
                "GitHub account credentials are missing. "
                "Reconnect your GitHub account in the dashboard."
            )

        try:
            token = decrypt_string(account.encrypted_credentials)
        except Exception:
            raise ValueError(
                "Failed to decrypt GitHub credentials. "
                "Reconnect your GitHub account in the dashboard."
            )

        workspace_path = WorkspaceManager.get_workspace_path(repo_id)
        if not workspace_path.exists():
            raise ValueError(
                "Repository workspace not found. "
                "Please re-clone the repository from the dashboard."
            )

        # ── 3. Verify push permission via API before touching git ─────────────
        try:
            auth = Auth.Token(token)
            g = Github(auth=auth)
            gh_repo = g.get_repo(repo.full_name)
        except GithubException as e:
            status = e.status if hasattr(e, "status") else "unknown"
            if status == 401:
                raise ValueError(
                    "GitHub token is invalid or expired. "
                    "Generate a new token and update it in the dashboard."
                )
            elif status == 404:
                raise ValueError(
                    f"Repository '{repo.full_name}' not found on GitHub, "
                    "or your token lacks Metadata read permission."
                )
            raise ValueError(f"GitHub API error ({status}): {e.data.get('message', str(e))}")
        except Exception as e:
            raise ValueError(f"GitHub authentication failed: {str(e)}")

        if not gh_repo.permissions.push:
            raise ValueError(
                "Your GitHub token does not have write (push) access to "
                f"'{repo.full_name}'. "
                "Update the token's repository permissions: "
                "Contents → Read & write, Pull requests → Read & write."
            )

        branch_name = f"fix-veripatch-{comment_id}"
        base_branch = repo.default_branch or "main"

        # ── 4. Check for an already-open PR (idempotent) ─────────────────────
        try:
            existing_prs = list(gh_repo.get_pulls(
                state="open",
                head=f"{gh_repo.owner.login}:{branch_name}",
                base=base_branch,
            ))
            if existing_prs:
                pr_url = existing_prs[0].html_url
                comment.pr_url = pr_url
                db.commit()
                return pr_url
        except GithubException:
            pass  # Non-fatal — continue and attempt PR creation

        # ── 5. Prepare workspace: ensure we are on base branch and clean ──────
        try:
            # Abort any in-progress merge/rebase
            subprocess.run(
                ["git", "checkout", base_branch],
                cwd=str(workspace_path),
                check=True,
                capture_output=True,
            )
            # Delete local feature branch if it already exists (stale from prev run)
            local_branches = subprocess.run(
                ["git", "branch"],
                cwd=str(workspace_path),
                capture_output=True,
                text=True,
            ).stdout
            if branch_name in local_branches:
                subprocess.run(
                    ["git", "branch", "-D", branch_name],
                    cwd=str(workspace_path),
                    capture_output=True,
                )
        except subprocess.CalledProcessError as e:
            raise ValueError(
                f"Could not switch workspace to '{base_branch}'. "
                f"Git error: {e.stderr.decode('utf-8', errors='ignore').strip() if e.stderr else str(e)}"
            )

        # ── 6. Create feature branch, apply patch, commit, push ──────────────
        try:
            # Create fresh branch from current HEAD (base branch)
            subprocess.run(
                ["git", "checkout", "-b", branch_name],
                cwd=str(workspace_path),
                check=True,
                capture_output=True,
            )

            # Apply the suggested fix
            SandboxManager._apply_patch(
                workspace_path,
                comment.file_path,
                comment.line_number,
                comment.suggested_fix,
            )

            # Configure bot identity
            subprocess.run(
                ["git", "config", "user.name", "VeriPatch Bot"],
                cwd=str(workspace_path),
                check=True,
                capture_output=True,
            )
            subprocess.run(
                ["git", "config", "user.email", "bot@veripatch.dev"],
                cwd=str(workspace_path),
                check=True,
                capture_output=True,
            )

            # Stage + commit
            subprocess.run(
                ["git", "add", "."],
                cwd=str(workspace_path),
                check=True,
                capture_output=True,
            )
            rule_id = (comment.issue.rule_id if comment.issue and comment.issue.rule_id else "Code Improvement")
            commit_msg = f"fix: auto-repair by VeriPatch [{rule_id}] in {comment.file_path}:{comment.line_number}"
            result = subprocess.run(
                ["git", "commit", "-m", commit_msg],
                cwd=str(workspace_path),
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                # Nothing staged (patch produced no diff) — still safe to PR if branch pushed
                if "nothing to commit" in result.stdout or "nothing to commit" in result.stderr:
                    raise ValueError(
                        "The suggested fix produced no code changes — patch may already be applied."
                    )
                raise subprocess.CalledProcessError(result.returncode, "git commit", result.stderr.encode())

            # Push — force-push to overwrite any stale remote branch
            parsed_url = urlparse(repo.clone_url)
            auth_url = f"https://{token}@{parsed_url.netloc}{parsed_url.path}"
            push_result = subprocess.run(
                ["git", "push", "--force", auth_url, branch_name],
                cwd=str(workspace_path),
                capture_output=True,
                text=True,
                timeout=60,
            )
            if push_result.returncode != 0:
                err = push_result.stderr.strip()
                if "403" in err or "Permission" in err or "denied" in err:
                    raise ValueError(
                        "Push was rejected — your GitHub token lacks Contents write permission. "
                        f"Repository: {repo.full_name}. "
                        "Update token permissions: Contents → Read & write."
                    )
                raise ValueError(f"Git push failed: {err[:400]}")

        except ValueError:
            raise
        except subprocess.CalledProcessError as e:
            err = e.stderr.decode("utf-8", errors="ignore").strip() if e.stderr else str(e)
            raise ValueError(f"Git operation failed: {err[:400]}")
        except subprocess.TimeoutExpired:
            raise ValueError("Git push timed out after 60 seconds. Check your network connection.")
        finally:
            # Always return workspace to base branch and remove local feature branch
            subprocess.run(
                ["git", "checkout", base_branch],
                cwd=str(workspace_path),
                capture_output=True,
            )
            subprocess.run(
                ["git", "branch", "-D", branch_name],
                cwd=str(workspace_path),
                capture_output=True,
            )

        # ── 7. Create Pull Request via GitHub API ─────────────────────────────
        try:
            pr_body = (
                f"This pull request was autonomously generated and sandbox-verified "
                f"by **VeriPatch** to address a code quality issue.\n\n"
                f"**File:** `{comment.file_path}` — line {comment.line_number}\n\n"
                f"### AI Explanation\n{comment.comment}\n\n"
                f"### Suggested Fix\n```python\n{comment.suggested_fix}\n```\n\n"
                f"---\n*Created automatically by VeriPatch. Review before merging.*"
            )
            pr = gh_repo.create_pull(
                title=f"fix({rule_id}): {comment.file_path}:{comment.line_number}",
                body=pr_body,
                head=branch_name,
                base=base_branch,
            )
            pr_url = pr.html_url

        except GithubException as e:
            status = e.status if hasattr(e, "status") else "unknown"
            msg = e.data.get("message", str(e)) if hasattr(e, "data") else str(e)
            errors = e.data.get("errors", []) if hasattr(e, "data") else []

            # Handle "PR already exists" gracefully
            if status == 422 and any(
                "pull request already exists" in str(err).lower() for err in errors
            ):
                existing_prs = list(gh_repo.get_pulls(
                    state="open",
                    head=f"{gh_repo.owner.login}:{branch_name}",
                    base=base_branch,
                ))
                if existing_prs:
                    pr_url = existing_prs[0].html_url
                else:
                    raise ValueError(
                        "A pull request already exists for this branch but could not be retrieved."
                    )
            elif status == 403:
                raise ValueError(
                    "GitHub API refused to create PR — token lacks Pull requests write permission. "
                    "Update: Pull requests → Read & write."
                )
            elif status == 422:
                raise ValueError(
                    f"GitHub rejected the PR ({msg}). "
                    f"Details: {errors}"
                )
            else:
                raise ValueError(f"GitHub API error while creating PR ({status}): {msg}")

        # ── 8. Persist and return ─────────────────────────────────────────────
        comment.pr_url = pr_url
        db.commit()
        return pr_url
