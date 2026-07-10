#!/usr/bin/env bash
set -euo pipefail

OWNER="${OWNER:-devcsb}"
REPO="${REPO:-mongsil-dream-veggie-game}"
VISIBILITY="${VISIBILITY:-public}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI(gh)가 필요합니다: https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "먼저 'gh auth login'으로 GitHub에 로그인해 주세요." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init -b main
  git add .
  git commit -m "feat: launch Mongsil dream veggie platform game"
fi

if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "https://github.com/$OWNER/$REPO.git"
  else
    git remote add origin "https://github.com/$OWNER/$REPO.git"
  fi
  git push -u origin main
else
  gh repo create "$OWNER/$REPO" \
    "--$VISIBILITY" \
    --description "몽실이와 꿈채소를 모으는 몽환적인 횡스크롤 웹게임" \
    --source . \
    --remote origin \
    --push
fi

if gh api "repos/$OWNER/$REPO/pages" >/dev/null 2>&1; then
  gh api --method PUT "repos/$OWNER/$REPO/pages" -f build_type=workflow >/dev/null
else
  gh api --method POST "repos/$OWNER/$REPO/pages" -f build_type=workflow >/dev/null
fi

printf '\n배포가 시작되었습니다.\n'
printf '저장소: https://github.com/%s/%s\n' "$OWNER" "$REPO"
printf '게임:   https://%s.github.io/%s/\n' "$OWNER" "$REPO"
