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

## Three files

```
data/trees.json                the index: which trees exist, and where each lives
data/tree.json                 the original tree (kept where it was)
data/trees/<slug>.json         new trees, unless you chose somewhere else
```

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

`/welcome`, five steps, and **nothing is written until the last one** — a wizard
that created the file on step one would litter half-configured trees every time
somebody changed their mind.

| Step | Asks | Where it goes |
| --- | --- | --- |
| Name | What to call the tree | `meta.name` |
| Storage | Default location, or a path you type | the file itself |
| Language & appearance | Locale and theme | the existing cookies |
| Start | From you, or empty | whether step 5 appears |
| About you | Name, sex, dates, birthplace | the first person, and `meta.rootPersonId` |

The storage step resolves the path live through `previewStorageAction` and shows
it before you commit, including for the default. If the path lands inside
iCloud, Dropbox, OneDrive or similar, it says so. That is a **warning, not a
block** — syncing is a reasonable backup — but "I didn't realise Documents was
iCloud" is exactly how this data ends up somewhere it was never meant to go.

`/` redirects here when no tree is registered. With trees already registered
`/welcome` redirects home unless `?new` is present, so a stale bookmark can't
offer to build a second tree to someone who just wanted the app.

Starting **empty** is a real option, not a courtesy: someone working from an
archive may want the tree to begin at a great-grandparent, and being forced to
enter themselves first would put the wrong person at the root. Such a tree has
people-less `meta`, so `/` renders the empty state (`EmptyTree`) asking for the
first person instead of a chart.

## Switching trees

The active tree is a **cookie**, read on the server — the same shape as the
locale and the theme, and for a stronger version of the same reason. `lib/data.ts`
loads the tree during the server render, so the choice has to arrive *with* the
request; `localStorage` is only readable after the page has painted, which would
mean rendering one family's chart and then swapping it for another's.

The cookie holds an opaque id and nothing else — no names, no paths.

A stale cookie (the tree was removed, or this is a different browser) falls back
to the first registered tree rather than erroring.

## Settings

**Settings → Family trees** lists every tree with its people count and full
path, and offers:

- **switch** — writes the cookie, revalidates `/` as a layout
- **rename** — writes `meta.name` in the file
- **move file** — `rename(2)`, falling back to copy-then-unlink across devices
- **remove from list** — unregisters it and **leaves the file alone**
- **open an existing tree** — adopt a file from a drive, a stick, a backup

There is deliberately **no delete**. This data is unrecoverable and there is no
undo in the app; the destructive half stays a deliberate act in your own file
manager.

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

## Threat model, honestly

This is a local, single-user tool. The tree actions take a filesystem path from
the user and act on it, because that is the entire point of the feature — which
also means the app writes wherever it is told, as the user running it.

**Run it on your own machine, bound to localhost.** Do not expose it to a
network anyone else is on.
