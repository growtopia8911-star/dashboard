# Handoff: finish the Cloudflare migration

**Read this before doing anything else in this repo.** When every box below is
checked, delete this file and commit the deletion. A stale instruction file is
worse than no instruction file — the whole reason this exists is that CLAUDE.md
was still telling sessions the site published via GitHub Pages after it didn't.

Written 2026-08-08 from Dhong's machine, after moving the site to Cloudflare.

---

## What already happened

The site moved off GitHub Pages. Nothing about how you work changed:
commit, push `main`, Cloudflare rebuilds. Verified end-to-end on a real push.

| | |
|---|---|
| Live URL | <https://dashboard-coc.pages.dev> |
| Host | Cloudflare Pages, git-connected to this repo |
| Build | none — static files served from the repo root |
| Who can load it | Kevin and Dhong only, via Cloudflare Access |
| Preview builds | every branch gets one, also access-protected |

You authorized the Cloudflare GitHub App on `growtopia8911-star` for this repo
only. Nothing else on your account is exposed to it.

You are **not** a member of Dhong's Cloudflare account, deliberately — that
account also hosts his personal projects. Instead you get an email whenever a
`dashboard` build fails, production or preview. You will hear about breakage
without being able to see anything unrelated. If you hit a failure you cannot
diagnose from the commit alone, ask Dhong to read the build log.

---

## Kevin has to do these — Claude cannot

### 1. Turn off GitHub Pages  (blocking, do this first)

`github.com/growtopia8911-star/dashboard` → **Settings** → **Pages** →
**Source: None**.

Only you can. Dhong has push but not admin (`admin: false` on the API).

Until this is done, <https://growtopia8911-star.github.io/dashboard/> still
serves the entire dashboard to anyone who finds it, and the access restriction
on the new URL protects nothing that isn't already readable one URL over.

It is not an emergency. Everything the page displays comes from the
unauthenticated GitHub API, so it can only ever show **public** repos — nothing
private is leaking. What the old copy does is publicly tie both accounts
together in one indexable page, and leave two live production sites drifting
apart in everyone's bookmarks.

### 2. Log in with the email code, not the Cloudflare button

At <https://dashboard-coc.pages.dev>, enter your email and use the code it
sends.

The **Cloudflare** button will fail for you — it needs a Cloudflare account, and
you don't have one under the allow-listed address. One-time PIN was added
specifically so you would not need one. If the button seems broken, it isn't;
you picked the wrong one.

Sessions last a month, so this is roughly a once-a-month annoyance.

### 3. Reinstall the app

Your installed PWA is bound to the `github.io` origin and will point at a dead
URL once step 1 is done. Uninstall it, open the new URL, install again.

Pins, theme, and the `ghcache:` store are per-origin and will start empty. That
is expected, not a bug — the first load re-fetches from GitHub cold.

---

## What Claude should do

Do not assume any of the above happened. Ask Kevin which he has done, then
**verify each one** and report what you actually observed.

### Verify GitHub Pages is off

Expect `404`. A `200` means it is still live regardless of what the settings
page appears to say.

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://growtopia8911-star.github.io/dashboard/
```

```powershell
try { (Invoke-WebRequest -UseBasicParsing 'https://growtopia8911-star.github.io/dashboard/').StatusCode }
catch { $_.Exception.Response.StatusCode.value__ }
```

Pages can take a few minutes to stop serving after the source is unset. If it
still returns `200` after ~10 minutes, check the repo settings again rather than
assuming propagation.

### Verify the new site is protected

Expect `302` to a `cloudflareaccess.com` URL. A `200` means the lockdown is not
working and should be raised immediately.

```sh
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://dashboard-coc.pages.dev/
```

```powershell
$h = New-Object System.Net.Http.HttpClientHandler; $h.AllowAutoRedirect = $false
$r = (New-Object System.Net.Http.HttpClient($h)).GetAsync('https://dashboard-coc.pages.dev/').Result
"$([int]$r.StatusCode) $($r.Headers.Location)"
```

### Then

- Tick the boxes in the checklist below and commit that change.
- When all three are done, **delete this file** and commit the deletion.
- Do not push unless Kevin asks — that rule still stands (see CLAUDE.md).

---

## Checklist

- [ ] GitHub Pages source set to None, and a request returns 404
- [ ] Kevin has logged in successfully with the email code
- [ ] Kevin has reinstalled the app from the new URL
- [ ] This file deleted

---

## Two things worth knowing, not blocking

**Access config is easy to break by accident.** The "Access policy" toggle in
the Cloudflare Pages project settings covers *preview deployments only*. The
production URL is protected by a separate self-hosted Access application named
"Dashboard", which lists both the bare hostname and the wildcard. It is not
redundant. Deleting it makes the site publicly readable while still looking
protected.

**The 60-requests/hour ceiling is still there.** Moving hosts did not change it:
the GitHub calls still come from the browser, unauthenticated, and the limit is
per IP — so you and Dhong browsing at the same time burn it twice as fast. The
fix is a Cloudflare Worker proxying `api.github.com` with a token, which raises
it to 5,000/hour and would let most of the `ghcache:` TTL machinery and the
budget meter be deleted. Not started. Roughly an hour of work if either of you
wants it.
