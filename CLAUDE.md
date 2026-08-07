# Dashboard

A static page showing GitHub repos, activity, and stats for two users
(`growtopia8911-star`, `utexasdhong`). Vanilla JS, no framework, no build
step, no dependencies. Open `index.html` and it runs.

## Files

| File | Contents |
|---|---|
| `index.html` | markup + the main app script |
| `styles.css` | all styling |
| `js/util.js` | `esc()` — shared by the page and the renderer |
| `js/markdown.js` | README renderer |

Visual work belongs in `styles.css`. Feature work belongs in the main
script in `index.html`.

## Constraints — read before refactoring

**Script load order is `util.js` → `markdown.js` → main.** They are plain
globals, not ES modules, deliberately: the page must still work when opened
over `file://`. Reordering the tags or converting to modules breaks it.

**The main script is one `(function () { ... })()`.** Its functions share
mutable locals — `repos`, `pins`, `activeFilter`, `sortMode`, `query`,
`tableMode`, `rateLimited`, `profiles`, `contributorsCache`, `langColors`.
`langColors` is written by `renderLanguages()` and read by `render()`, so
that order of calls in `load()` matters. Moving a
function out of that closure breaks every reference to those. Splitting it
further needs a real state refactor, not a copy-paste.

**Before extracting anything, check the functions it calls, not just the
variables it touches.** `markdown()` looked self-contained by a variable
grep but depended on `esc()`, which lived inside the IIFE — extracting it
threw a ReferenceError at runtime while passing every syntax check.

**GitHub allows 60 unauthenticated requests/hour per IP.** Every optional
fetch is capped (`CONTRIB_LIMIT`, `ACTIVITY_REPOS`, `POOL_SIZE`) and cached
in localStorage with a TTL. Adding uncapped fetches will rate-limit the
page for real visitors.

## Verifying changes

Neither machine has node, npm, or a `code` CLI.

### macOS

Use macOS JavaScriptCore:

```sh
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc

# syntax check
"$JSC" -e "try { new Function(read('js/markdown.js')); print('OK') } catch(e) { print('ERR '+e) }"

# actually run it — syntax checks alone miss missing dependencies
"$JSC" -e "eval(read('js/util.js')); eval(read('js/markdown.js'));
           print(markdown('# H', {full_name:'a/b', default_branch:'main'}))"
```

Serve the page with `python3 -m http.server`.

### Windows

**There is no JavaScript runtime at all** — no node, and JavaScriptCore is
macOS-only, so the `jsc` recipe above does not port. There is no
command-line syntax check. Verify in the browser instead: open DevTools
(`F12`) → Console. That runs the real environment, so it catches missing
dependencies the same way the `jsc` eval does — the `markdown()`/`esc()`
class of bug surfaces there as a ReferenceError.

Serve with **`python`, not `python3`**. `python3` resolves to a Microsoft
Store alias stub that prints an install prompt and exits without serving:

```powershell
cd C:\Users\growt\dashboard
python -m http.server          # Python 3.12.10 — then open http://localhost:8000
```

## Git

Three worktrees share this repo, on **both** machines:

| Branch | Use | macOS | Windows |
|---|---|---|---|
| `main` | home base — merge and publish here | `~/dashboard` | `C:\Users\growt\dashboard` |
| `ui-polish` | visual work | `~/dashboard-ui` | `C:\Users\growt\dashboard-ui` |
| `functionality` | feature work | `~/dashboard-feat` | `C:\Users\growt\dashboard-feat` |

Open a session on the folder for the branch you want; don't
`git checkout` between branches inside one folder.

**Worktrees are never pushed or pulled** — they live in `.git` and are
per-machine. On a fresh clone the extra folders will be missing. That is
expected. Recreate them rather than falling back to branch switching:

```sh
git worktree add ../dashboard-ui ui-polish
git worktree add ../dashboard-feat functionality
```

**Nothing syncs between the two machines on its own.** Push before leaving
one, pull before starting on the other.

**"Pull" always means all three worktrees**, never just the current
folder — the other two go stale silently and the next merge conflicts.
Same for "push". Don't make the user ask three times:

```sh
git -C ~/dashboard pull && git -C ~/dashboard-ui pull && git -C ~/dashboard-feat pull
```

Report which folders moved and which were already current. If a pull is
anything other than a fast-forward, stop and say so before continuing.

After pulling, **re-read this file** — the copy loaded at session start is
the pre-pull one, and a stale copy is exactly what the pull was for.

**When the user signals they're done** — "getting off", "heading out",
"done for now", "am I good" — check every worktree for uncommitted and
unpushed work before answering, and say what you found. Unpushed work is
invisible from the other machine: it pulls, gets "Already up to date", and
the two diverge silently.

```sh
for d in dashboard dashboard-ui dashboard-feat; do git -C ~/$d status -sb; done
git log --branches --not --remotes --oneline    # unpushed commits, all branches
```

A **SessionStart hook** (`.claude/hooks/check-sync.sh`) covers the other
end — it fetches and warns if any worktree is behind or has unpushed
commits. It stays silent when everything is clean.

**Run only one Claude session per folder.** Two sessions in one directory
overwrite each other's writes with no warning.

**Pushing `main` publishes a live site** (`github.com/growtopia8911-star/dashboard`,
served via GitHub Pages). Committing is local and safe; pushing is not.

**Commit each feature yourself as you finish it** — don't wait to be asked.
Kevin queues features back-to-back and never pauses, so any convention that
needs him to say a word at a feature boundary silently never fires. When a
feature is done and verified: `git add -A`, commit with a message describing
what the feature does, say one line naming the message so he can flag a bad
one, then start the next feature. One commit per feature, not one per
session — the point is a restore point that works on its own.

Never `git commit -am` — it silently skips new files. And never push or merge
as part of this; those stay separate asks.

## Notes

Project notes live in Obsidian. One vault, synced between both machines by
Obsidian Sync:

| Machine | Path |
|---|---|
| macOS | `/Users/kevin/PC & Mac Vault` |
| Windows | `C:\Users\growt\Documents\PC & Mac Vault` |

Same vault, same contents — edits on one machine appear on the other.
Nothing reads it automatically — open it only when asked.

Both paths are listed because this file is committed and travels to the
other machine — a single hardcoded Mac path would send the Windows
session looking somewhere that doesn't exist. Same reasoning that keeps
`*.code-workspace` in `.gitignore`.

`~/Documents/Mac Obsidian` on the Mac is the **old** vault. Nothing
written there syncs. It was moved out of `~/Documents` on 2026-08-07 so
iCloud would leave it alone.

**"Take notes" / "note this" / "write this down" means the vault**, not
this file and not Claude's memory. Read the relevant existing note first
and extend it in its own voice; only start a new note when nothing fits.
Say which note and which section was changed.

Update this file too when the thing learned is a rule about *this repo* —
but say so, rather than doing it silently instead of the vault.

Notes on the whole workflow live in `Starting a project/Parallel Sessions
Workflow.md`; notes on this project live in `Projects/Projects
Dashboard.md`.
