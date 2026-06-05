"""User workspace path helpers — v12.30."""
import os
from pathlib import Path


def _user_apps_dir(user_id: str) -> Path:
    home = Path(os.environ.get("LLUVIA_HOME", str(Path(__file__).parent.parent)))
    return home / "user_apps" / str(user_id)


def workspace_path(user_id: str, slug: str) -> Path:
    return _user_apps_dir(user_id) / slug
