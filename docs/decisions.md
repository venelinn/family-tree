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
sharing one.

## Neither target has a server

Once it was decided the web app would never read the repo's `data/`, it had no
server-side storage — and therefore nothing for a server to do. Both targets
became static exports, which removed eight `"use server"` modules, the photo
route handler, and the cookies that backed theme, locale and tree selection.

What that cost, honestly: the cookie reads were what made `<html data-theme>`
correct in the first byte of HTML, and that is gone. A blocking inline script in
`<head>` takes its place — the very thing the cookie existed to avoid. It is a
fair trade in an app served from local disk, and the comments at each site say
so rather than quietly implying the old reasoning was wrong.

What it bought: one deployment shape for both, no hosting bill, and a privacy
promise that is structural rather than asserted. There is no server to send
anything to on either side.

## Two stores, one interface

`TreeStore` was always the seam. It now has two implementations —
`LocalTreeStore` over files, `IndexedTreeStore` over IndexedDB — sharing
`SnapshotTreeStore`, which holds every row-editing method over a
read-modify-write of the whole tree.

The **registry** could not be shared the same way, and that is the interesting
part. It is built on paths: adopt a file, move it, convert it to a bundle, warn
when it lands in iCloud. None of that means anything in a browser origin. So
`registry.ts` is a dispatcher over two implementations rather than one module
with a swappable backend, `TreeSummary.file` is optional, and the UI hides the
path row, Move and Open when it is absent — following the data rather than
testing which platform it is on.

**A Supabase store must implement `TreeStore` directly, not extend
`SnapshotTreeStore`.** Whole-snapshot read-modify-write is correct for one writer
and wrong for several: two people editing one tree would overwrite each other
wholesale instead of row by row.

## Exports carry photos, base64, in one JSON file

The first version carried only the rows, so a tree exported from the desktop and
imported into a browser arrived with every name and date and no faces —
technically a tree, and not what anybody wanted.

A zip would be the tidier container and base64 costs about a third in size on top
of bytes that are already compressed. It was chosen anyway: no dependency, no
streaming, and the export stays one file somebody can see is one file. A personal
tree's photos are tens of megabytes, not hundreds. `collectPhotos` /
`restorePhotos` is the seam to replace when that stops being true.

Photos are keyed by the same content-addressed name both stores use, so importing
writes each blob back under the name the rows already point at — no reference
rewriting, and duplicates across trees collapse on their own.

Costs, stated plainly: Rust in the toolchain, per-OS builds (you cannot build a
Windows `.exe` on a Mac), `git push` no longer ships the desktop app to anyone,
and unsigned builds warn on first open until there is an Apple Developer
account. macOS is the only target for now — Windows needs `lib/store/path.ts` to
learn about backslashes and drive letters, and nothing else.

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

**Rejected:** `next-themes`. The preference was a server-read cookie, which gave
a correct `<html data-theme>` in the first byte of HTML with no provider, no
blocking script and no dependency.

That premise is gone — there is no server render on either target now — so the
blocking script is back, as `themeInitScript` in `lib/theme.ts`. It is ~200 bytes
inline and reads local storage before first paint. `next-themes` stays rejected:
it would be a dependency to do the same two lines.

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
