# Trees, files and privacy

Where family data is kept, who decides, and what onboarding does on a first run.

## The promise

Nothing in this app sends family data anywhere. There is no account, no server,
no analytics and no network call in the read or write path — the store is a JSON
file that the process opens directly. The only remote requests the project ever
makes are `pnpm photos`, which downloads MyHeritage images *to* your disk, and
Google Fonts at build time.

That was already true before this feature. What was missing was the other half:
letting you decide *where* on disk. A promise you can't verify the location of
isn't much of a promise, so the location is now a choice, shown as an absolute
path before anything is written.

**Both targets make this structural rather than promised.** Neither has a
server: the desktop app is a Tauri window that opens your file directly, and the
web app is a static export whose storage is the visitor's own browser. Both work
with the network cable out. See
[decisions.md](decisions.md#a-desktop-app-as-well-as-a-web-app).

## Where a tree actually lives

Two targets, two answers, and they share no storage at all.

| | Desktop | Web |
| --- | --- | --- |
| A tree is | a `.familytree` folder you chose | a record in this browser's IndexedDB |
| The index is | `<data dir>/trees.json` | the records themselves |
| Default data dir | `~/Library/Application Support/com.venelinnikolov.familytree` | n/a |
| Photos | files inside the bundle | blobs in the same database |
| Survives reinstalling the OS | if you backed the folder up | no |
| Survives clearing site data | yes | **no** |

`FAMILY_TREE_DATA_DIR`, or `<repo>/data`, still applies to the CLI scripts — that
is what `pnpm import` targets. An installed app has no repo to sit inside, which
is why the desktop default cannot be `data/`. Either way that is only the
*default*: a tree may be anywhere, and paths outside the data directory are
stored absolute.

**The web app never reads `data/`.** It cannot — a page has no filesystem. Getting
an existing tree into it means importing a file; see below.

### The browser is not a safe place for the only copy

IndexedDB can be evicted under storage pressure and is deleted outright by
"clear browsing data". `forgetTree` on the web genuinely deletes, unlike its file
counterpart which leaves your folder alone. Onboarding says so on the last step,
and Export sits before Forget in Settings for the same reason.

## Moving a tree between them

One JSON file, carrying the rows **and the photos**, base64-encoded under the
same content-addressed names both stores use — so importing writes each blob back
under the name the rows already point at, with no rewriting of references.

- **Export** — desktop opens a native save dialog; the web downloads. A tree with
  50 photos comes out around 15–20 MB, since base64 costs about a third on top.
- **Import** — always creates a *new* tree, never overwrites. It is the one
  operation that could destroy data nobody asked to lose, and "I have two now" is
  far easier to recover from than "it replaced the wrong one".

A zip would be tidier and is the seam to replace if these files get unwieldy;
base64 was chosen because it needs no dependency and keeps the export one file.

## A tree is a folder

```
data/trees.json                     the index: which trees exist, and where
data/trees/<slug>.familytree/       a tree — one item, wherever you put it
├── tree.json                       the store
├── photos/8f/3a/8f3a….jpg          content-addressed, metadata stripped
└── backups/2026-08-10T14-03-11Z.json
```

Photos used to live under `public/` on the app's own disk, which meant a tree
copied to a USB stick arrived without its pictures. Keeping them inside the
folder is what makes "your data, where you want it" true rather than nearly
true. See [privacy.md](privacy.md) for the reasoning and `lib/store/bundle.ts`
for the layout.

**The `.familytree` suffix is a suggestion, not a requirement.** It is worth
having because it says what the folder is, but it earns nothing from the OS:
macOS shows a folder as a single opaque item only when an installed app declares
that extension, and nothing declares this one. Checked, rather than assumed —
`System Events` reports `package folder: false` for `Test.familytree` and `true`
for `Real.rtfd`.

So what marks a tree as a folder is **being one**, not being called one. Rename
it to plain `Nikolov` and it still opens; `isBundleRoot` stats the path instead
of reading the name. Losing somebody's family history to a suffix they tidied
up is not a failure mode worth keeping.

**Loose `.json` trees still work.** Anything registered before this keeps
reading and writing exactly where it did, with its photos where they were, and
is listed with an offer to convert. Uploads are the one thing they cannot do —
there is nowhere to put the file — so `savePhoto` raises `treeNotABundle` and
Settings says why.

Converting **copies**: the old `.json` and everything under `public/photos` are
left exactly where they are, and the app just stops pointing at them. Same
reasoning as `forgetTree` not deleting.

The **index** holds only `id` and `file`. A tree's name and root person live in
that tree's own file, under `meta`:

```jsonc
{
  "meta": {
    "id": "main",
    "name": "Nikolov",
    "rootPersonId": "@I85@",   // the person every chart opens on
    "createdAt": "…",
    "updatedAt": "…"
  },
  "people": [ … ], "unions": [ … ], "unionChildren": [ … ]
}
```

That split is deliberate: copy the file to another machine and it carries
everything it needs, and the index can be rebuilt by pointing at it again
(**Settings → Open an existing tree**). Nothing important is only in the index.

Paths inside the data directory are stored **relative** to it, so the repo can be
moved or cloned without breaking; paths outside it are absolute.

Files are written `0600` and directories `0700` — owner only. On a shared
machine the default umask would otherwise leave a household's names, birth dates
and addresses world-readable.

### Moving the whole data directory

`FAMILY_TREE_DATA_DIR` relocates the index and the default tree folder in one
go, for keeping everything off the repo's disk entirely:

```sh
FAMILY_TREE_DATA_DIR=/Volumes/Vault/family-tree pnpm dev
```

## Onboarding

`/welcome`, and **nothing is written until the last step** — a wizard that
created the file on step one would litter half-configured trees every time
somebody changed their mind.

| Step | Asks | Where it goes |
| --- | --- | --- |
| Name | What to call the tree | `meta.name` |
| Storage | Default location, or a folder you pick | the file itself — **desktop only** |
| Language & appearance | Locale and theme | `localStorage` |
| Start | From you, or empty | whether the last step appears |
| About you | Name, sex, dates, birthplace | the first person, and `meta.rootPersonId` |

The storage step is **skipped on the web**, where there is nothing to choose: a
browser tree goes in the browser. The start step says so there instead, together
with the warning about clearing site data.

On the desktop the step resolves the path live through `previewStorageAction`
and shows it before you commit, including for the default. If it lands inside
iCloud, Dropbox, OneDrive or similar, it says so. That is a **warning, not a
block** — syncing is a reasonable backup — but "I didn't realise Documents was
iCloud" is exactly how this data ends up somewhere it was never meant to go.

**"Already have a tree?"** sits on the first step, and is the way in for anyone
not starting from scratch: import a file on either target, or open a
`.familytree` folder on the desktop. Both skip the rest of the wizard — a tree
that exists already has a name, a location and a first person. Without it a
fresh install was a dead end, since `/` redirects here and the only other route
in was a `/settings` URL you had to know about.

**The folder picker is a permissions mechanism, not a nicety.** Tauri's
filesystem plugin denies any path outside a granted scope, and choosing through
the native dialog is what grants it — for the fs *and* the asset protocol, which
is what makes the photos loadable. A typed path is refused before the store ever
sees it. `recursive: true` on that dialog matters too: without it the grant stops
at the folder itself and every photo two levels down under `photos/8f/3a/` is
denied.

`/` redirects here when no tree is registered. With trees already registered
`/welcome` redirects home unless `?new` is present, so a stale bookmark can't
offer to build a second tree to someone who just wanted the app.

Starting **empty** is a real option, not a courtesy: someone working from an
archive may want the tree to begin at a great-grandparent, and being forced to
enter themselves first would put the wrong person at the root. Such a tree has
people-less `meta`, so `/` renders the empty state (`EmptyTree`) asking for the
first person instead of a chart.

## Switching trees

The active tree is one id in `localStorage`. It was a cookie, because the tree
was loaded during the *server* render and the choice had to arrive with the
request — reading it after paint would have shown one family's chart and then
swapped it for another's. With the store running in the browser on both targets
that inversion is gone: nothing can render a chart before the client has read
this, because the client is what reads the tree.

It holds an opaque id and nothing else — no names, no paths.

A stale cookie (the tree was removed, or this is a different browser) falls back
to the first registered tree rather than erroring.

## Settings

**Settings → Family trees** lists every tree with its people count and full
path, and offers:

- **switch** — writes the cookie, revalidates `/` as a layout
- **rename** — writes `meta.name` in the file
- **move** — `rename(2)`, falling back to copy-then-unlink across devices
- **keep photos with this tree** — converts a loose `.json` into a folder,
  copying its photos in and stripping their metadata; shown only for the trees
  that need it, and it reports where the previous copy still is
- **remove from list** — unregisters it and **leaves the file alone**
- **open an existing tree** — adopt a `.familytree` folder, or an older `.json`,
  from a drive, a stick, a backup

There is deliberately **no delete**. This data is unrecoverable and there is no
undo in the app; the destructive half stays a deliberate act in your own file
manager.

**Move from Settings, not from Finder.** The registry stores a path, so a folder
dragged somewhere else behind the app's back is reported as missing until you
re-open it. Moving here updates both.

Across filesystems — a USB stick, an external drive — `rename(2)` fails with
`EXDEV` and it falls back to a recursive copy. The source is only removed once
the copy is demonstrably there, and a copy that fails partway takes its own
wreckage with it, so a stick that filled up leaves the original untouched and
the retry unblocked.

### When macOS says no

This app cannot grant itself access to Desktop, Documents or a removable volume.
That permission belongs to whatever runs `next dev` — Terminal, iTerm, your
editor — and macOS prompts *that* process the first time it touches one of those
places. A denial comes back as `EPERM`.

What the app does is stop calling it "Something went wrong": `lib/action-error.ts`
maps `EPERM`/`EACCES`, `ENOSPC` and `EROFS` to messages that name the actual
problem, and the permission one names the System Settings pane to open.

## Adopting a file safely

`adoptTree` validates the **raw** file, not a loaded snapshot, and requires
`people` and `unions` to both be arrays. This matters more than it looks:
`LocalTreeStore.read()` fills missing rows in with empty arrays, so every
well-formed JSON file on the disk otherwise looks like a valid — if empty —
family tree. Since adopting means the next edit rewrites the file wholesale,
pointing this at somebody's `package.json` has to be refused rather than tidied
up. (It wasn't, once, during development. It overwrote the file.)

## Migrating from the single-store version

The first read of the registry adopts a pre-existing `data/tree.json`
automatically:

- it stays **exactly where it is** — `pnpm import` still targets it, and a
  migration that relocates someone's only copy isn't one worth having
- `meta` is added in place; the rows are untouched
- the name comes from the old root person's surname, and is renameable
- `rootPersonId` is seeded with `@I85@`, the constant that used to live in
  `lib/data.ts`

It is idempotent and additive. Verified against the real store: 252 people, 94
unions and 176 parent-child links byte-identical afterwards.

## Photos

Stored as `<sha256-of-the-sanitised-bytes>.<ext>`, sharded two directories deep.
Content addressing pays for itself three times: the same scan attached to four
siblings is one file, the name carries no person id to leak who is related to
whom, and "is anyone else using this?" is a count rather than a path comparison.

Every upload has its metadata removed before it is hashed — GPS coordinates,
timestamps, camera serials. The **pixels are not re-encoded**: these are
archival scans and metadata lives in discardable envelope structures, so
`lib/image-metadata.ts` walks the container and drops them. The compressed
image data comes out byte-identical. AVIF is not accepted, because its metadata
box isn't parsed yet and passing it through unread would be worse than
refusing it.

**How they reach the page differs by target, and neither is a URL to a server** —
there is no server. The store answers `photoSrc(entry)`:

- **Desktop** — an absolute path rewritten by `convertFileSrc` onto Tauri's asset
  protocol, which needs `assetProtocol.enable` *and* the path inside the granted
  scope. Note that `assetProtocol.scope: []` means **deny everything**, not "no
  restriction"; `$APPDATA/**` is granted statically and user-picked folders come
  from the dialog.
- **Web** — an object URL for a blob in IndexedDB, cached per entry. The graph is
  re-read after every edit, so minting a fresh URL each time would leak one per
  photo per keystroke. Caching is safe because the key is a content hash: the
  same name can never mean different bytes.

There used to be a route, `app/photo/[tree]/[name]/route.ts`. It went with the
server. The check it did — 64 hex characters and a known extension before
anything becomes a path — now lives in `isStoredPhoto`, and still runs.

An entry the store cannot resolve is **dropped** rather than rendered as a broken
image. A tree imported into the browser before photos travelled with exports is
exactly that case.

## Backups

A bundle keeps the last 20 copies of `tree.json` in `backups/`, at most one
every 15 minutes. The interval is the point — typing a date is half a dozen
mutations in seconds, and without it those would fill every slot and push out
the copy from before the mistake. Best-effort: a failure here never fails the
edit.

They protect against *you*, not against the disk. Losing the drive is what an
off-machine copy is for.

## Threat model, honestly

This is a local, single-user tool. The tree actions take a filesystem path from
the user and act on it, because that is the entire point of the feature — which
also means the app writes wherever it is told, as the user running it.

**Run it on your own machine, bound to localhost.** Do not expose it to a
network anyone else is on.
