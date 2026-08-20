# Console restyle — design

**Date:** 2026-08-20
**Branch:** `ui-polish` (`~/dashboard-ui`, `C:\Users\growt\dashboard-ui`)
**Status:** implemented in `e757b68`

---

## Goal

Replace the current restrained grey-on-black look with a **console** aesthetic:
monospace type throughout, tighter labels, bigger numbers, hairline structure.
The page should read as an instrument panel for two GitHub accounts rather than
as a generic dashboard template.

## Non-goals

- No change to what the page *does*. No new data, no new fetches, no new
  network calls — the 60-requests/hour ceiling makes that a separate decision.
- No framework, no build step, no dependencies. Still opens over `file://`.
- No change to the language-colour series or to what the colours mean.

---

## How the direction was chosen

Three directions were mocked up and compared in the browser:

| | Direction | Outcome |
|---|---|---|
| A | **Sharper** — current design, refined | rejected: safe, no personality |
| B | **Broadsheet** — cream paper, serif, rules not boxes | rejected: reads as editorial, not a developer tool |
| C | **Console** — mono, dense, instrument panel | **chosen** |

C was then refined into three variants:

| | Variant | Outcome |
|---|---|---|
| C1 | **Refined** — better mono, real spacing, faint panel gradients | **chosen** |
| C2 | **Signal** — glow, scanlines, corner crosshair ticks | rejected: has a mood, but effects date |
| C3 | **Blueprint** — dot grid, square corners, dashed rules | rejected: tints the page blue, breaking the colour rule |

**Why C1 over C2.** C2 was the better-looking mockup and the more tempting
pick. It was passed over because its whole effect comes from a scanline overlay
and text-shadow bloom — both of which are fashions with a shelf life, on a page
meant to be looked at daily for years. C1's effect comes from type, spacing and
hairlines, which do not date the same way. C2's corner ticks are cheap to graft
on later if the page ends up feeling too plain.

**The mockups are throwaway.** They live in the session scratchpad, not in the
repo — they were comparison aids, not source. This document is the record.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Light theme | **Removed entirely**, along with the toggle | A console look wants to be dark. Keeping a light variant means maintaining a second palette that contradicts the aesthetic. |
| Mono scope | Everywhere **except README body text** | Repo descriptions are one line and look sharp in mono. READMEs are the longest prose on the site and get tiring. |
| Colour | Unchanged — language data only | The existing rule survives this restyle intact. It is the reason C3 was rejected. |
| Palette temperature | Warm grey → **slightly cool** | `#0c0c0c`/`#ededea` → `#0a0b0d`/`#e4e9ee`. Cool greys read as instrumentation; warm greys read as paper. |

---

## The design

### Type

```
--mono: "Cascadia Code", "JetBrains Mono", ui-monospace,
        SFMono-Regular, Menlo, Consolas, monospace;
```

Base `12.5px` / `1.62` line-height, up from `13px` / `1.55`. Smaller but
looser — the first Console mockup was rejected for feeling cramped, and the
fix is line-height and padding, not size.

| Element | Treatment |
|---|---|
| Hero `h1` | 21px, uppercase, `letter-spacing: .16em` |
| Section headings | 10px, uppercase, `.22em`, trailing hairline rule across the page |
| Tile label | 9.5px, uppercase, `.2em` |
| Tile value | 29px, `-.035em`, `tabular-nums` |
| Card name | 13px, `.02em` |
| Card description | 11.5px, `1.65` line-height |
| Card footer meta | 10.5px, `.06em`, above a hairline |
| README body | **stays sans-serif** — the one exception |

**Font availability differs by machine and this is expected.** Cascadia ships
with Windows Terminal; the Mac falls through to SF Mono. Both are correct
outcomes of the same stack — the page will not look pixel-identical on the two
machines, and should not be "fixed".

### Colour tokens

```
--page:          #0a0b0d
--surface:       #101216
--ink:           #e4e9ee
--ink-2:         #98a2ab
--ink-muted:     #646e77
--border:        rgba(190,210,230,.11)
--border-strong: rgba(190,210,230,.19)
```

Language series `--s1..--s8` keep their current dark-theme values. The
`[data-theme="light"]` block, including its light series values, is deleted.

### Structure

- Radius `10px` → `7px`, and `--radius-sm` `6px` → `4px`.
- Panels, tiles and cards get a faint top-down light gradient
  (`rgba(255,255,255,.035)` → transparent at 55%) over the surface colour, so
  each has a visible top edge instead of being a flat rectangle.
- Buttons get the same gradient at lower strength.
- Tiles gain a footnote line under the number (`+2 this month`, `last 30 days`)
  — the `.foot` class already exists and is already populated.
- Card footer meta is separated by a hairline rather than floating under the
  description.

---

## Files touched

| File | Change |
|---|---|
| `styles.css` | The bulk. New tokens, mono stack, every section's type scale, panel gradients, deletion of the light block. |
| `index.html` | Remove the theme toggle button, the pre-paint theme script, `THEME_KEY`, the click handler, the label restore, and the `t` shortcut. Update `<meta name="theme-color">`. |
| `manifest.json` | `background_color` and `theme_color` → `#0a0b0d`. |
| `sw.js` | Bump `CACHE`. |

**This crosses the styles.css / index.html line deliberately.** `CLAUDE.md`
puts visual work in `styles.css` and feature work in the main script; removing
the theme toggle is a visual decision that can only be carried out in the
script. Recorded here so the crossover does not look like drift later.

---

## Gotchas

**`sw.js` must bump `CACHE` from `dashboard-shell-v1` to `-v2`.** The worker
serves static assets cache-first and only deletes cache buckets whose name no
longer matches. Ship a new `styles.css` under the old name and every installed
copy keeps painting the old design — including Kevin's and Dhong's, which are
exactly the two that matter. The symptom is "it looks right in a fresh browser
and wrong in the app", which is slow to diagnose and trivial to prevent.

**The `t` keyboard shortcut becomes free.** It is currently theme-toggle. Leave
it unbound rather than reassigning it in the same change — a key that silently
starts doing something else is worse than a key that does nothing.

**Two `themeLabel` writes are easy to miss.** One in the click handler, one at
the bottom of the script that syncs the label to the pre-paint theme. Removing
only the handler leaves a `ReferenceError` at startup, which on this project
surfaces only in the browser console — Windows has no JS runtime to catch it
first.

**The refresh handler's comment mentions the theme key** ("pins and theme live
in the same store"). The code itself only clears `CACHE_PREFIX` keys, so it
needs no logic change — but the comment goes stale and should be corrected in
the same pass.

**Existing installed PWAs keep their old `theme_color`** until the manifest is
re-read, which can lag. Not worth chasing; it corrects itself.

---

## Verification

Windows has no JavaScript runtime, so there is no command-line syntax check.

```powershell
cd C:\Users\growt\dashboard-ui
python -m http.server        # NOT python3 — that is a Store alias stub
```

Then <http://localhost:8000> with DevTools open (`F12`) → Console.

Checks:

1. **Console is clean on load** — this is what catches a half-removed theme
   toggle.
2. Press `t` — nothing happens, no error.
3. Press `v` — table view still toggles.
4. Language bar and legend still carry the only colour on the page.
5. Open a repo's README — body text is sans-serif, everything around it mono.
6. Narrow the window to phone width — tiles and cards still reflow.
7. Hard-reload with **Application → Service Workers → Update on reload** ticked,
   to confirm the new shell cache took.

---

Related: the Obsidian note "Projects Dashboard", and `docs/superpowers/specs/2026-08-08-installable-app-design.md`
