# Installable app — design

**Date:** 2026-08-08
**Branch:** `functionality` (`~/dashboard-feat`)
**Status:** implemented — assets in `cb4d3a4`, worker and Install button after

---

## What shipped, and in what order

It landed in two passes, which is worth recording because the middle state was
committed and briefly described as final.

**Pass one (`cb4d3a4`) — assets only.** Six generated icons in `icons/`
including a maskable variant and an SVG, `manifest.json` rewritten (`#131820`,
three icon entries), and five `<head>` tags **replacing** the previous four
rather than being appended. At this point the service worker had been ruled
out: menu-based install needs only a valid manifest over HTTPS, so the worker
looked like cost without benefit.

**Pass two — the worker, after all.** The next request was an in-page Install
button, and that reversed the decision: `beforeinstallprompt` is the only way
a page can trigger a native install, and it fires **only** when a service
worker with a fetch handler is registered. The button could not exist without
it. `sw.js` was built to the routing design below.

**The lesson worth keeping: the worker was never really about offline.** It
was dismissed on offline grounds, then required on install-button grounds.
Menu install genuinely does not need one — that part was correct — but any
in-page install affordance does, and that is not obvious from the outside.

One thing the worker does *not* change: install from the browser menu worked
before it existed and still does. The button is a shortcut, not the mechanism.

---

## Goal

Open the dashboard from an icon on Windows, macOS and phone, in its own
window, instead of searching up the URL in a browser.

Launchability is the whole goal. Offline support is a side effect of how it
is achieved, not a requirement, and no feature is justified by offline alone.

## Non-goals

- **Native packaging.** Electron and Tauri are out — neither machine has node
  or npm, Tauri additionally needs Rust, and both would end the "no build
  step, no dependencies" property the project is built on.
- **Offline data browsing.** Caching API responses in the worker would
  duplicate the existing `ghcache:` localStorage layer and shadow the
  `X-RateLimit-*` headers the meter reads live. Explicitly rejected.
- **Backlog items.** Live-demo button, screenshots, skeletons and `og:` tags
  are tracked in `Projects/Dashboard Feature Backlog.md` and are not part of
  this work.

---

## Current state

Commit `759328c` ("Make the page installable as an app") delivered half of a
PWA:

| Piece | State |
|---|---|
| `manifest.json` | complete — `display: standalone`, `scope`/`start_url` relative, 192 + 512 + maskable icons |
| `icons/` | complete — 32, 180, 192, 512 |
| `<link rel="manifest">`, `apple-touch-icon`, `theme-color` | present in `index.html` |
| **Service worker** | **absent — no `sw.js`, no registration** |

Consequence: iOS "Add to Home Screen" and macOS Safari 17+ "Add to Dock"
already work from the manifest alone. Chrome, Edge and Android Chrome do not
offer a proper install, because they require a registered service worker with
a fetch handler. The Windows PC is the case that is actually broken.

---

## Constraints

These come from `CLAUDE.md` and are non-negotiable:

- **The page must keep working over `file://`.** Service workers do not run
  there at all; registration must be guarded, not merely wrapped in a catch.
- **Scripts are plain globals in a fixed order** (`util.js` → `markdown.js` →
  main). Not ES modules, deliberately, for the same `file://` reason.
- **The main script is one IIFE** whose functions share mutable locals.
  Nothing moves out of that closure.
- **Feature work belongs in the main script**; visual work belongs in
  `styles.css`.
- **60 unauthenticated GitHub requests/hour per IP.** Nothing here may add a
  request or interfere with the existing caps and TTLs.
- **No node, no npm, no `code` CLI** on either machine.

---

## Design

### Files

| File | Change |
|---|---|
| `sw.js` | new, **repo root** |
| `index.html` | registration snippet; Install button markup; handler inside the main IIFE |
| `styles.css` | none expected — the button reuses `.btn` |

`sw.js` must be at the repo root. A worker's scope is capped by its own
directory, so `js/sw.js` could only control `js/`, leaving the page itself
uncontrolled and the install prompt permanently unfired. This is silent when
wrong: the file registers successfully and simply never controls anything.

### Worker: cache

Cache name carries a version — `dashboard-shell-v1`. Bump it whenever the
precache list changes.

Precached on `install`: `./`, `index.html`, `styles.css`, `js/util.js`,
`js/markdown.js`, `manifest.json`, `icons/icon-32.png`, `icons/icon-180.png`,
`icons/icon-192.png`, `icons/icon-512.png`.

`activate` deletes every cache whose name is not the current one.

### Worker: fetch routing

Three routes, evaluated in this order.

1. **Cross-origin → pass through untouched.** `api.github.com`,
   `avatars.githubusercontent.com` and `opengraph.githubassets.com` never
   enter the worker's cache. This is what keeps the rate-limit meter reading
   live headers and leaves the `ghcache:` TTL logic as the single source of
   truth for API data.
2. **Navigation requests → network-first**, falling back to cache when the
   network fails. Online, the app always shows the HTML that was last pushed.
3. **Same-origin static assets → cache-first**, falling back to network.
   This is what makes launch feel instant.

Only `GET` is handled; anything else passes through.

### Registration

```js
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}
```

The `file:` check is load-bearing, not defensive dressing. The relative
`"sw.js"` keeps it correct under the GitHub Pages subpath. The silent
`.catch()` matches the existing `catch (e) {}` style in the file.

### Install button

A fourth button in `.hero-actions`, after Refresh, `id="installBtn"`, `hidden`
by default.

- `beforeinstallprompt` → `preventDefault()`, stash the event, unhide.
- click → `prompt()`, then discard the stashed event (single-use) and re-hide.
- `appinstalled` → hide.

On iOS and macOS Safari `beforeinstallprompt` never fires, so the button never
appears — which is correct, since those platforms already install from the
manifest. It surfaces only where it is needed, chiefly the Windows PC.

### Updates

**Update on next launch.** The new worker installs, waits, and takes over the
next time the app is opened. No `skipWaiting`, no auto-reload, no update
toast.

Justified by the routing: navigation requests are already network-first, so
markup is never stale while online. Only cached CSS/JS lag, and only by one
launch. Auto-reload was rejected for yanking the page out from under an open
modal; an update toast was rejected as a second piece of new hero UI, which
the backlog note already flags as crowded.

### Refresh button

Unchanged. It keeps meaning "discard cached *data*" and does not clear the
shell cache. Network-first navigation means the shell cannot go meaningfully
stale, so overloading Refresh would add a concept for an already-solved
problem.

---

## Verification

macOS, per `CLAUDE.md` — syntax check **and** run, because parsing alone
missed the `markdown()`/`esc()` ReferenceError once already:

```sh
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
"$JSC" -e "try { new Function(read('sw.js')); print('OK') } catch(e) { print('ERR '+e) }"
```

Then serve and exercise the real thing:

```sh
python3 -m http.server        # localhost is a secure context; the worker runs
```

Checks that must pass:

1. DevTools → Application → Service Workers: registered and activated.
2. DevTools → Application → Manifest: no installability errors.
3. An install affordance appears in Chrome, and the in-page Install button
   becomes visible.
4. `api.github.com` requests appear in Network as normal, **not** served from
   the worker.
5. The rate-limit meter still renders a live figure.
6. Opening `index.html` directly as a `file://` document still works, with no
   console error.
7. After installing, launching from the icon opens a standalone window.

Windows has no JS runtime at all, so checks there are DevTools-only (`F12`).

---

## Risks

**A stale shell is the main failure mode of this whole feature.** The routing
above is the mitigation; if a future change flips navigation to cache-first
for speed, the dashboard will start showing yesterday's GitHub activity, which
defeats its purpose.

**Scope creep into offline.** Once a worker exists, caching API responses
looks free. It is not — see Non-goals.

---

## Related

- `Projects/Projects Dashboard.md` — the project note
- `Projects/Dashboard Feature Backlog.md` — the open backlog this is not part of
- `Starting a project/Parallel Sessions Workflow.md` — the worktree setup
