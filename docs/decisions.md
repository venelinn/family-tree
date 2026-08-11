# Decisions

Why things are the way they are — including what was tried and rejected, so it
isn't retried by accident.

## React Flow for rendering, our own code for layout

React Flow is a *renderer*: viewport, pan/zoom, custom nodes as real React
components, edges, handles, minimap. It deliberately does no layout.

That split is the right one here. Cards need photos, gender borders, badges and
buttons — real HTML — which is painful on a canvas-based library like Cytoscape.
And layout needs genealogy-specific constraints no general layouter offers.

**Rejected:** dagre and ELK (can't express spouse adjacency — see
[layout.md](layout.md)); `relatives-tree` (good fit, but its output is line
segments rather than React Flow edges, so we'd give up edge routing); BALKAN
FamilyTreeJS (does everything, $599, proprietary); family-chart (owns the DOM
via d3, customisation means fighting its config).

## `@xyflow/react` v12, not `reactflow` v11

`reactflow` is the old package name and is frozen. v12 is the maintained line and
has measured node dimensions, which matter for variable-height cards.

## Union nodes

A couple is a first-class node. This is the single most load-bearing decision in
the layout — see [layout.md](layout.md#union-nodes).

## Rows, not a document

The store models the tree as `people` / `unions` / `unionChildren` — the shape
Postgres tables would take — rather than as nested JSON.

The point is that moving to Supabase becomes implementing an interface, not
reshaping data. It also makes mutations naturally granular: a full-document write
would be impossible to do safely with concurrent editors.

## One-way import

`pnpm import` replaces the store wholesale. Once you edit in the app,
`data/tree.json` is the system of record and re-importing discards your work.

**Two-way sync with MyHeritage is deliberately not attempted.** Edit in both
places and you need conflict resolution over a graph — which of two conflicting
birth dates wins, what happens when MyHeritage merges a duplicate you also
edited. That's a genuinely hard distributed-systems problem hiding inside a
personal project. Pick one system of record; let the other be read-only.

## Photos downloaded, not hotlinked

MyHeritage image URLs carry an HMAC signature and an expiry about a week out:

```
k=sites_v1&s=516a38a1…91092b4&e=1786863600
```

Only MyHeritage can sign these. There is **no token or session to refresh** —
they 403 with or without a `Referer`, and re-exporting just restarts the same
one-week clock. So `pnpm photos` downloads them once and rewrites the export to
local paths.

## A tree is a folder, not a file

Photos used to live under `public/` while the tree file lived wherever you put
it, so copying a tree to a USB stick left its pictures behind — and `public/` is
served statically, which means no auth check could ever apply to them.

Both are one problem: a tree was two things pretending to be one. It is now a
`.familytree` directory holding `tree.json`, `photos/` and `backups/`, and
photos are read by a route handler instead. Rejected alternative: a sidecar
`<name>.photos/` folder beside the `.json`. Cheaper to build, and it fails the
moment somebody moves only the file — which is exactly the failure being fixed.

## Photo metadata is stripped, but pixels are never re-encoded

The usual way to remove EXIF is to decode the image and write it back out. That
works, and it costs a generation of quality on every upload. These are archival
scans — often the only surviving copy of a photograph — so `lib/image-metadata.ts`
walks the JPEG segments, PNG chunks, RIFF chunks or GIF blocks and drops the
ones that carry metadata. The compressed pixel data is copied through untouched,
verified byte-identical against the 52 real photos in the tree.

It also means no image library. `sharp` would have been the alternative: a
native dependency, a build step, and lossy output, to do less well what 300
lines of byte-pushing does exactly.

ICC profiles and Adobe colour transforms are **kept** — they change how the
picture looks, and dropping them would damage the image to no privacy end.
AVIF is refused rather than passed through, since its metadata box isn't parsed.

## Data stays out of git

`/data` and `/public/photos` are gitignored. The tree holds living relatives'
names, birth dates, birthplaces and email addresses.

For the same reason: **don't paste the export into online GEDCOM converters.**
Writing a parser locally was the same amount of work as writing a mapper for a
converter's output, with none of the exposure.

## A desktop app, as well as a web app

The store writes to the local filesystem, and a hosted Next.js server cannot:
on Netlify or Vercel every request gets an ephemeral container where only `/tmp`
is writable and nothing persists. Hosting the app as it stood would have meant
every save silently vanishing.

The alternative — keep hosting it and reach the user's disk from the browser via
the File System Access API — was rejected because it is Chromium-only, absent
from Safari, Firefox and every mobile browser, and it re-prompts for permission
on each visit unless installed as a PWA.

Tauri resolves it without any of that. The UI is unchanged; a Rust process owns
file access; the whole thing runs offline. There were no outbound calls in the
app to begin with and `next/font` self-hosts Raleway at build time, so nothing
had to be severed.

**The web target stays.** It is not replaced, because a family tree you can open
from a link is worth keeping and because Supabase is still the likely path to
sharing one. The two are kept honest by `lib/store/fs.ts`: one store, one set of
rules, two filesystems underneath.

Costs, stated plainly: Rust in the toolchain, per-OS builds (you cannot build a
Windows `.exe` on a Mac), `git push` no longer ships to everyone, and unsigned
builds warn on first open until there is an Apple Developer account. macOS is the
only target for now — Windows needs `lib/store/path.ts` to learn about
backslashes and drive letters, and nothing else.

## Local store before Supabase

Chosen because schema churn is free locally while the editing UX is still being
designed, git gives versioned history and undo for nothing, and auth + row-level
security is a week of work that makes the tree no better. The seam in
`lib/data.ts` keeps Supabase cheap to reach later.

The counter-argument is real and may win eventually: a family tree nobody else
can see is half a family tree.

## Neighbourhood, not the whole tree

252 people at once is unreadable. The chart shows a neighbourhood around a focus
person and says "N of 252 people", the way MyHeritage does.

## Expansion displaces other expansions

A large expansion closes the user's other open branches. Without it, expansions
accumulate and sprawl the chart until nothing is legible — and the point of a
neighbourhood is that you follow one line at a time.

## Semantic colour tokens, not `dark:` variants

Dark mode could have been added by putting a `dark:` variant next to each of the
~180 palette classes in the app. Instead every element was changed to name a
*role* — `bg-panel`, `text-ink-muted` — and the two palettes live in the token
layer (`tokens/*.json` for light, `styles/_theme-dark.scss` for dark).

The variant approach doubles the class soup on every element, and it fails
silently: miss one and it looks fine until someone opens the app in dark. With
tokens there is one place to look, and a component that skipped them is
conspicuous because its colours don't respond to the setting at all.

**Rejected:** `next-themes`. It solves the flash-of-wrong-theme problem for apps
that keep the preference in `localStorage`. This one already reads a cookie on
the server for the locale, so the same trick gives a correct `<html data-theme>`
in the first byte of HTML — no provider, no blocking script, no dependency.

## Style Dictionary tokens, and a separate dark block

**Supersedes an earlier decision** to write each token once as a `light-dark()`
pair in `app/globals.css`. That was the tighter design — one statement per
token, no way for the two halves to drift — and it is worth knowing why it went.

The tokens are now generated by Style Dictionary from `tokens/*.json`, the same
pipeline used by the other projects in this workspace, so a palette can move
between them and the CSS-Modules conventions in `rules/css-styling.mdc` apply
unchanged. Style Dictionary emits one value per token, which means the second
half of every pair needs somewhere else to live: `styles/_theme-dark.scss`.

What that costs is real — the dark palette is now stated separately from the
light one, and nothing enforces that a new token gets both. Two things keep it
honest: the dark file re-declares only *semantic* names (so an omission shows up
as a light-mode colour on a dark page, not as a missing style), and both entry
points — `[data-theme="dark"]` and the `prefers-color-scheme` query for users on
`system` — share a single `dark-tokens` mixin, so the two *activations* can't
drift even though the two palettes can.

Setting `color-scheme` inside that mixin keeps what the old approach got for
free: the native controls — the depth slider, the checkbox, the scrollbars —
still follow the theme without being styled.

## Reveal bars, not chevrons

The first version used a 36px chevron pill, with collapse hidden behind hover.
Too small to hit, didn't say what it would do or how many people were behind it,
and the collapse action was undiscoverable.

Now: a full-card-width bar labelled `+ 2 parents`, always shown for hidden
branches (that's information, not chrome), and `− parents` on the *selected* card
only, so collapse is available without every card carrying two permanent buttons.
