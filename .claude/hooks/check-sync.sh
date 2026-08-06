#!/bin/sh
# Warns when any worktree is out of sync with GitHub.
#
# Why this exists: the two machines only see each other through GitHub. If work
# is left unpushed on one, the other pulls, gets "Already up to date", and looks
# fine — then both diverge. This catches that at session start instead.
#
# Paths come from `git worktree list`, never hardcoded, so it works unchanged on
# macOS and Windows. Silent when everything is clean; a hook that talks every
# time stops being read.

git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Without this, "behind" is only as fresh as the last fetch — and a push made on
# the other machine is exactly what we're looking for.
git fetch --quiet --no-tags 2>/dev/null

report=$(
  git worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' | while IFS= read -r wt; do
    [ -d "$wt" ] || continue

    branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null) || continue
    [ "$branch" = "HEAD" ] && continue          # detached, nothing to compare

    problems=""

    counts=$(git -C "$wt" rev-list --left-right --count "HEAD...@{upstream}" 2>/dev/null)
    if [ -n "$counts" ]; then
      ahead=$(printf '%s' "$counts" | awk '{print $1}')
      behind=$(printf '%s' "$counts" | awk '{print $2}')
      [ "$ahead" -gt 0 ] 2>/dev/null && problems="$problems, $ahead unpushed"
      [ "$behind" -gt 0 ] 2>/dev/null && problems="$problems, $behind to pull"
    else
      problems="$problems, no upstream set"
    fi

    [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ] &&
      problems="$problems, uncommitted changes"

    [ -n "$problems" ] && printf '  %s -- %s\n' "$branch" "${problems#, }"
  done
)

[ -z "$report" ] && exit 0

# Fold to a single JSON string. Backslashes first, then quotes, then newlines.
esc=$(printf '%s' "$report" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}')

printf '{"systemMessage":"Out of sync with GitHub:\\n%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Git sync check found worktrees out of sync with GitHub:\\n%sTell the user, and offer to pull and/or push all worktrees. Unpushed work is invisible to the other machine."}}\n' "$esc" "$esc"
