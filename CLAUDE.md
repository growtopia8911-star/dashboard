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
`tableMode`, `rateLimited`, `profiles`, `contributorsCache`. Moving a
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

There is no node, npm, or `code` CLI on this machine. Use macOS
JavaScriptCore:

```sh
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc

# syntax check
"$JSC" -e "try { new Function(read('js/markdown.js')); print('OK') } catch(e) { print('ERR '+e) }"

# actually run it — syntax checks alone miss missing dependencies
"$JSC" -e "eval(read('js/util.js')); eval(read('js/markdown.js'));
           print(markdown('# H', {full_name:'a/b', default_branch:'main'}))"
```

Serve the page with `python3 -m http.server`.

## Git

Three worktrees share this repo:

| Folder | Branch | Use |
|---|---|---|
| `~/dashboard` | `main` | home base — merge and publish here |
| `~/dashboard-ui` | `ui-polish` | visual work |
| `~/dashboard-feat` | `functionality` | feature work |

**Run only one Claude session per folder.** Two sessions in one directory
overwrite each other's writes with no warning.

**Pushing `main` publishes a live site** (`github.com/growtopia8911-star/dashboard`,
served via GitHub Pages). Committing is local and safe; pushing is not.

## Notes

Kevin keeps project notes in Obsidian at `/Users/kevin/Documents/Mac Obsidian`.
Nothing reads it automatically — open it only when asked.
