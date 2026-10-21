# Import all models here so SQLAlchemy's relationship resolution finds every class
# regardless of import order in the rest of the application.
from app.models.user import User  # noqa: F401
from app.models.github import GithubAccount  # noqa: F401
from app.models.repository import Repository  # noqa: F401
from app.models.analysis import AnalysisRun, AnalysisIssue  # noqa: F401
from app.models.review import AIReview, AIComment  # noqa: F401
