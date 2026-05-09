"""Export GitHub data for the business project page.

Run this script whenever you want to refresh the static JSON used by
business/index.html:

    python tools/export_business_github_data.py

Authentication is optional, but recommended to avoid GitHub's low anonymous
rate limit. The script uses GITHUB_TOKEN/GH_TOKEN when present, otherwise it
tries `gh auth token`.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "business-github.json"
DEFAULT_USER = "flathack"
DEFAULT_DAYS = 90


@dataclass(frozen=True)
class ExportConfig:
    user: str
    days: int
    output: Path
    sleep_seconds: float
    token: str | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export repositories, commits and releases from GitHub into a static JSON file.",
    )
    parser.add_argument("--user", default=DEFAULT_USER, help=f"GitHub user or org (default: {DEFAULT_USER})")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"History window in days (default: {DEFAULT_DAYS})")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output JSON path (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.15,
        help="Delay between repository API calls in seconds (default: 0.15)",
    )
    parser.add_argument(
        "--no-gh-token",
        action="store_true",
        help="Do not call `gh auth token`; only use GITHUB_TOKEN/GH_TOKEN if set.",
    )
    return parser.parse_args()


def token_from_gh_cli() -> str | None:
    try:
        result = subprocess.run(
            ["gh", "auth", "token"],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    token = result.stdout.strip()
    return token or None


def get_token(use_gh_cli: bool) -> str | None:
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        return token
    return token_from_gh_cli() if use_gh_cli else None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_github_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def github_json(path: str, config: ExportConfig) -> Any:
    url = f"https://api.github.com/{path.lstrip('/')}"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "flathack-business-export",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if config.token:
        headers["Authorization"] = f"Bearer {config.token}"

    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        message = exc.read().decode("utf-8", "replace")
        rate_hint = ""
        if exc.code == 403:
            rate_hint = " Hint: set GITHUB_TOKEN or run `gh auth login`."
        raise RuntimeError(f"GitHub API error {exc.code} for {url}: {message}{rate_hint}") from exc
    except URLError as exc:
        raise RuntimeError(f"GitHub API connection failed for {url}: {exc}") from exc


def paged(path: str, config: ExportConfig) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    page = 1
    while True:
        separator = "&" if "?" in path else "?"
        chunk = github_json(f"{path}{separator}per_page=100&page={page}", config)
        if not isinstance(chunk, list):
            raise RuntimeError(f"Expected list response for {path}, got {type(chunk).__name__}")
        items.extend(chunk)
        if len(chunk) < 100:
            return items
        page += 1
        time.sleep(config.sleep_seconds)


def slim_repo(repo: dict[str, Any]) -> dict[str, Any]:
    keys = [
        "name",
        "html_url",
        "description",
        "language",
        "stargazers_count",
        "forks_count",
        "updated_at",
        "pushed_at",
        "archived",
        "homepage",
        "fork",
        "open_issues_count",
    ]
    return {key: repo.get(key) for key in keys}


def slim_commit(commit: dict[str, Any]) -> dict[str, Any]:
    inner = commit.get("commit") or {}
    author = inner.get("author") or {}
    return {
        "html_url": commit.get("html_url"),
        "sha": commit.get("sha"),
        "commit": {
            "message": inner.get("message") or "",
            "author": {
                "date": author.get("date"),
                "name": author.get("name"),
            },
        },
    }


def slim_release(release: dict[str, Any]) -> dict[str, Any]:
    date = release.get("published_at") or release.get("created_at")
    label = release.get("tag_name") or release.get("name") or "Release"
    return {
        "tag_name": label,
        "name": release.get("name") or label,
        "published_at": date,
        "html_url": release.get("html_url"),
    }


def recent_releases(releases: list[dict[str, Any]], since: datetime) -> list[dict[str, Any]]:
    recent: list[dict[str, Any]] = []
    for release in releases:
        release_date = parse_github_date(release.get("published_at") or release.get("created_at"))
        if release_date and release_date >= since:
            recent.append(release)
    return recent


def export_data(config: ExportConfig) -> dict[str, Any]:
    since = datetime.now(timezone.utc) - timedelta(days=config.days)
    since_iso = since.isoformat(timespec="seconds").replace("+00:00", "Z")

    raw_repos = paged(f"users/{quote(config.user, safe='')}/repos?sort=updated", config)
    repos = [slim_repo(repo) for repo in raw_repos]
    activity: list[dict[str, Any]] = []

    print(f"Exporting {len(repos)} repositories for {config.user} ({config.days} days)")
    print("Authentication:", "token available" if config.token else "anonymous")

    for repo in repos:
        name = repo["name"]
        encoded_name = quote(name, safe="")
        encoded_since = quote(since_iso, safe="")
        commits = paged(f"repos/{quote(config.user, safe='')}/{encoded_name}/commits?since={encoded_since}", config)
        releases = paged(f"repos/{quote(config.user, safe='')}/{encoded_name}/releases", config)
        releases_in_window = recent_releases(releases, since)

        activity.append(
            {
                "repo": repo,
                "commits": [slim_commit(commit) for commit in commits],
                "releases": [slim_release(release) for release in releases_in_window],
            }
        )
        print(f"- {name}: {len(commits)} commits, {len(releases_in_window)} releases")
        time.sleep(config.sleep_seconds)

    return {
        "generated_at": utc_now_iso(),
        "user": config.user,
        "window_days": config.days,
        "since": since_iso,
        "repos": repos,
        "activity": activity,
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()
    if args.days <= 0:
        print("--days must be greater than 0", file=sys.stderr)
        return 2

    config = ExportConfig(
        user=args.user,
        days=args.days,
        output=args.output,
        sleep_seconds=max(0.0, args.sleep),
        token=get_token(use_gh_cli=not args.no_gh_token),
    )

    try:
        payload = export_data(config)
        write_json(config.output, payload)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    total_commits = sum(len(item["commits"]) for item in payload["activity"])
    total_releases = sum(len(item["releases"]) for item in payload["activity"])
    print(f"Wrote {config.output}")
    print(f"Summary: {len(payload['repos'])} repos, {total_commits} commits, {total_releases} releases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
