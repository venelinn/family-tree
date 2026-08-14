# Privacy strategy

Where data lives, how it leaves this machine, and what is encrypted when.
[storage.md](storage.md) describes what exists today; this is the plan and the
reasoning behind it.

## The rule

> **Plaintext never leaves the machine. An encrypted archive may go anywhere.**

One sentence resolves most of the questions below. Dropbox, Google Drive, a USB
stick, an email to a cousin — all fine for an encrypted archive, all wrong for
the live tree. It also means the effort goes into exactly one piece of crypto,
at exactly one boundary, instead of being smeared across the whole app.

## 1. Local: where things live

### The tree

Already solved. The registry stores a path per tree, the path may be anywhere,
and the absolute location is shown before anything is written. Files are `0600`,
directories `0700`.

Two things to fix.

**The default data directory is inside the repo.** `dataDir()` falls back to
`process.cwd()/data`, which is the one place `registry.ts`'s own doc comment
says people don't want this data. Gitignored is not the same as elsewhere: a
`git clean -xdf`, a stray `rm -rf` in the wrong checkout, or copying the project
folder all treat it as build output. The default should be outside the working
tree:

```
macOS    ~/Library/Application Support/family-tree
Linux    ${XDG_DATA_HOME:-~/.local/share}/family-tree
```

Neither is synced by default, which the `~/Documents` and `~/Desktop` most
people would otherwise reach for are not — on macOS both are inside iCloud Drive
under the default settings.

`FAMILY_TREE_DATA_DIR` keeps overriding it, and an existing `data/` directory is
adopted where it stands rather than moved, the same way `migrateLegacyTree`
leaves `data/tree.json` alone.

**Encrypted volumes are the honest answer for the paranoid tier.** FileVault
already covers a stolen laptop. For anything beyond that, an APFS encrypted
disk image mounted at `/Volumes/Vault` costs nothing to support — the tree file
already goes wherever it is pointed.

### The photos: make a tree one thing, not two

**Done.** A tree is a `.familytree` folder holding `tree.json`, `photos/` and
`backups/`, so it moves as one item; the browser target keeps the same
content-addressed photos as blobs in IndexedDB. Neither serves them from
`public/`, and neither has a server to serve them from. The reasoning below is
kept because it is why the format looks the way it does.

The gap as it stood: the tree file followed the user anywhere and the photos
stayed in `public/photos/uploads/` on the app's own disk.
[`lib/photos.ts`](../lib/photos.ts) documents this honestly, but it means:

- a tree copied to another machine silently loses every uploaded photo,
- there is nothing coherent to back up or export,
- `public/` is served statically by Next, bypassing every server action, which
  is the one part of the current design that does **not** survive the move to a
  hosted store.

**A tree becomes a directory, not a file:**

```
~/Family/Nikolov.familytree/
├── tree.json                          the store, unchanged in shape
├── photos/
│   └── 8f/3a/8f3a91c2….jpg            content-addressed, EXIF stripped
├── originals/                         opt-in, never included in a share export
└── backups/
    └── 2026-08-10T14-03-11Z.json
```

One item in Finder, so "put my tree on the USB stick" cannot half-succeed. The
registry keeps storing a path; `resolveTargetFile` accepts a `.familytree`
directory alongside the legacy `.json`, and adopting a bare `.json` offers to
convert it.

**Photo filenames become the SHA-256 of the sanitised bytes**, sharded two bytes
deep. Three problems fall out at once: identical photos of a grandparent
attached to four siblings are stored once, the filename stops embedding a person
id (which leaks relationship structure if a single file is shared), and the
"still used by someone else?" check in `removePhoto` becomes a straight
reference count over the hash.

**Photos are served by a route handler, not from `public/`:**

```
GET /photo/[treeId]/[hash]
  → hash must match /^[0-9a-f]{64}$/          reject anything else outright
  → resolve inside that tree's photos/ dir    never a caller-supplied path
  → Cache-Control: private, no-store
```

The fear recorded in `photos.ts` — that a route handler streaming disk paths is
a file-read hole — is right about the general case and avoidable here. The route
never takes a path; it takes an opaque hash from a fixed alphabet and resolves
it against a directory the server chose. That is an allowlist, not path
handling.

## 2. Backup

Three tiers, because they protect against three different things.

| Tier | Protects against | Where |
| --- | --- | --- |
| Snapshots | *you* — a bad merge, a deleted branch of the family | `backups/` in the bundle |
| Archive export | disk failure, theft, fire | anywhere, encrypted |
| Whole-disk backup | everything, incidentally | Time Machine, your business |

**Snapshots are nearly free.** Every mutation already rewrites the whole file
through a temp path and a rename. Copy the previous file into `backups/` before
the rename, keep the last ~20, prune the rest. A few hundred rows of JSON is a
few tens of kilobytes. This is the tier that actually gets used, because the
common disaster is human, not mechanical.

**The archive is the backup primitive**, and everything in §3 and §4 is built on
it. Two forms, same contents:

```
family-tree.tar     plaintext, maximum portability, for a drawer
family-tree.ftz     the same bytes, encrypted, for anywhere else
```

Contents: `tree.json`, `photos/`, and a `manifest.json` recording the format
version, tree metadata, photo count and hashes. Tar rather than zip because a
tar writer is about forty lines and no dependency, photos do not compress, and
`tar -xf` works everywhere without this app. Owning your data means being able
to read it without the program that wrote it.

**Time Machine and the like are not a strategy on their own.** They will happily
back up the tree, and they will also copy it to wherever they are configured to
go. Useful, not sufficient, and not a substitute for an archive you can hand to
someone.

## 3. Cloud: Drive, Dropbox, iCloud

People mean two completely different things by this.

**Syncing the live tree file — no.** Two machines with the folder mounted will
eventually write at once, and `LocalTreeStore`'s promise queue serialises writes
*within one process*, not across two. The failure mode is a conflicted copy at
best and a truncated tree at worst. On top of that the plaintext sits on someone
else's server with names, birth dates and addresses in it. `isCloudSyncedPath`
already warns about this; keep the warning, and extend it to cover the bundle
directory.

**Putting encrypted archives there — yes, and this is the recommended
off-machine backup.** An `.ftz` in Dropbox is an opaque blob. The provider, the
provider's backups, and anyone who compromises the account all get ciphertext.
No sync conflicts either, because each export is a new immutable file.

That asymmetry is the whole cloud story. There is no third option worth
building unless real multi-device sync is wanted, and if it ever is, the shape
is encrypted-blob sync with per-tree last-writer-wins and a conflict copy on
divergence — not CRDTs, which are a lot of machinery for a dataset one household
edits.

## 4. Encryption: what to encrypt, and what not to

Encryption is only meaningful against a stated threat. Three candidates, and
only one of them earns its place now.

**The live tree file — no.** FileVault already covers the stolen-laptop case far
better than app-level encryption would, and `0600` covers other accounts on the
machine. Encrypting it costs real things: hand-editing a tree file stops
working, which `registry.ts` deliberately supports; `assertLooksLikeTree` can no
longer tell a tree from someone's `package.json`; every mutation gains a
passphrase in memory and a prompt on start. Poor trade.

**The archive — yes, mandatory.** This is the only artefact designed to leave
the machine, so it is the only place encryption changes the answer. Password
based, no key files to lose, no accounts:

```
FTZ1                                     magic, 4 bytes, also the GCM AAD
salt          16 bytes, random
nonce         12 bytes, random
ciphertext    the tar
tag           16 bytes
```

`scrypt(password, salt, 32)` at N=2^17, r=8, p=1 → AES-256-GCM. Both are in
`node:crypto`, so no dependency; N=2^17 needs about 128 MB, so `maxmem` has to
be raised past Node's 32 MB default. GCM means a wrong password or a corrupted
file fails loudly rather than producing plausible garbage.

The cost has to be stated in the UI, not the docs: **lose the password and the
archive is gone.** That is the feature working, and it is also the single most
likely way for someone to lose their family history. Prompt for it twice, show
the strength, and say the sentence out loud on the export screen.

**A vault mode** — passphrase-encrypted tree at rest, unlocked per session — is
a coherent later feature for a shared machine where `0600` is not enough. Not
V1, and it should not block anything above.

## 5. Photo hygiene

**Strip EXIF on ingest.** An iPhone photo carries GPS coordinates, a timestamp,
and a camera serial that links every photo from the same device. For a
photograph of a living relative at home, the coordinates are their address.
Currently [`savePhoto`](../lib/photos.ts) writes the uploaded bytes verbatim.

```
upload → sniff the real type → drop metadata segments → hash → store
                                        └→ originals/ only if asked for
```

**Strip the container's metadata segments; do not re-encode.** Re-encoding is
the usual advice and it is wrong here. These are archival images — a scan of the
only surviving photograph of a great-grandparent — and every re-encode is
generation loss on a file nobody can reshoot. Dropping metadata is a lossless
edit to the container:

| Format | Removed |
| --- | --- |
| JPEG | `APP1`…`APP15` (EXIF, XMP, IPTC, Photoshop) and `COM` |
| PNG | `eXIf`, `tEXt`, `iTXt`, `zTXt`, `tIME` — all ancillary |
| WebP | the `EXIF` and `XMP ` RIFF chunks |
| GIF | comment and application extension blocks |

The pixels are untouched, so this is both safer for the archive and cheaper than
a decode. It also needs no image library, which keeps the dependency list where
it is.

`AVIF` comes off the accepted-types list until its `meta` box is handled;
accepting a format whose metadata is passed through unread is worse than not
accepting it.

**Detect the type from the bytes, not the header.** `TYPES[file.type]` reads the
browser-supplied multipart `Content-Type`. The extension whitelist means this
cannot become path traversal, so the current code is safe — but the comment
claims detection it does not do, and the stripper has to parse the container
anyway, so real magic-byte sniffing comes for free.

Keeping originals is a real want — a scanned document's embedded date can be
genuine provenance. Keep them behind an explicit setting, in `originals/`, and
exclude that directory from any archive meant for someone else.

## 6. Living people

The schema has `deceased` and no notion of privacy, which is correct while the
app is single-user and local: there is no audience to withhold anything from.
It stops being correct at the **export** boundary, which is the first time data
is addressed to someone else.

So put the policy there, not on the record. An export offers to redact anyone
living — `!deceased && !deathDate` — down to initial plus surname, birth year
only, no photos, relationships intact. No `visibility` enum, no per-person
permission model, until there is something to permit.

## Order of work

1. ~~**Strip EXIF.**~~ Done — `lib/image-metadata.ts`, lossless, no dependency.
2. ~~**Bundle the photos with the tree**~~, content-addressed, served by
   `app/photo/[tree]/[name]/route.ts`. Done, with a copy-never-move conversion
   for trees that predate it.
3. ~~**Snapshots** in `backups/`.~~ Done — 20 copies, one per 15 minutes.
4. **Archive export/import**, plaintext tar first — the backup primitive and the
   "your data is yours" story. Next.
5. **Encrypt the archive.** Turns it into the answer for §3 and §4.
6. **Redaction on export.** Only once there is an export to redact.

Still open from the sections above, and deliberately not done yet:

- The default data directory is still `process.cwd()/data` (§1). Moving it is a
  migration, and it should land with the archive work so there is an export to
  fall back on.
- `pnpm photos` still stages into `public/photos/`. Harmless now that `pnpm
  import` takes them into the bundle, but the staging copies are left behind.

Vault mode, sync, and anything with an account stay out until something
concrete asks for them. The current architecture — no network in the data path
at all — is stronger than any of them, and it is worth being deliberate about
giving that up.
