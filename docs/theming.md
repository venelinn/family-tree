# Theming

Light and dark, chosen on `/settings` or left to follow the operating system.

## The rule

**Components name the role, never the colour.** `bg-panel`, not `bg-white`;
`text-ink-muted`, not `text-slate-500`.

That is the whole design. Because every element asks for a role, the dark theme
is a change to one file — `app/globals.css` — rather than a `dark:` variant
bolted onto every element in the app. A new component gets dark mode for free as
long as it uses tokens, and the way to notice one that doesn't is that its
colours stop responding to the setting.

The tokens are defined once, as `light-dark()` pairs:

```css
--panel: light-dark(#ffffff, #151e2e);
--ink-muted: light-dark(#64748b, #93a1b5);
```

and handed to Tailwind in an `@theme inline` block, which is what generates
`bg-panel`, `text-ink-muted`, `border-female-line` and the rest.

## The token set

| Group | Tokens | For |
| --- | --- | --- |
| Chrome | `surface` `panel` `panel-veil` `wash` `muted` | Page, raised surfaces, hover states |
| Lines | `line-subtle` `line` `line-strong` | Borders and dividers, three weights |
| Text | `ink` `ink-soft` `ink-muted` `ink-faint` `ink-ghost` | Five steps of emphasis |
| Inverted | `invert` `invert-hover` `on-invert` | Primary buttons, the active "add" toggle |
| Sex | `male-*` `female-*` (`-line` `-soft` `-ink` `-solid`) | Person cards and avatars |
| Root | `root-ring` `root-line` `root-soft` `root-ink` | The person the chart is centred on |
| Branch | `branch-ring` `branch-line` `branch-soft` `branch-soft-hover` `branch-ink` | Selection ring, collapse bars |
| Danger | `danger-soft` `danger-ink` `danger-text` | Errors, Delete |
| Canvas | `canvas-dot` `edge-spouse` `edge-descent` `union` `ribbon` | React Flow, drawn from TypeScript |

`surface` and `wash` are the same colour in light and deliberately different in
dark: one is the page, the other is a hover state on a panel that sits *above*
the page. Collapsing them works until the first dark hover, which then darkens
instead of lifting.

## How the choice is applied

The preference is one of three values — `system`, `light`, `dark` — stored in a
cookie and read on the server, exactly like the locale. `app/layout.tsx` stamps
it as `data-theme` on `<html>`, and three rules in `globals.css` turn it into a
`color-scheme`, which is what `light-dark()` resolves against:

```css
:root                      { color-scheme: light dark; }  /* system */
:root[data-theme="light"]  { color-scheme: light; }
:root[data-theme="dark"]   { color-scheme: dark; }
```

`system` matches neither override, which leaves `light dark` in place and lets
the OS decide — and a change to the OS setting is picked up live, with no
JavaScript involved.

Setting `color-scheme` also themes the native controls for free: the depth
slider, the "deceased" checkbox and the scrollbars follow along without being
styled.

### Why there's no flash, and no inline script

The usual dark-mode blocking script in `<head>` exists because most apps keep
the preference in `localStorage`, which the server can't read. A cookie arrives
*with the request*, so `<html data-theme="dark">` is correct in the first byte
of HTML. Nothing to hydrate, nothing to correct after paint.

### Why the write is a server action

`ThemePicker` calls a server action, so the response carries a fresh render with
the new attribute already on `<html>`. A client-side toggle that wrote the
attribute directly would save a round trip and put the theme in two places — the
DOM and the cookie — with the next server render being the one that's wrong.

Like the locale, the action must `revalidatePath("/", "layout")`. The attribute
lives on the layout, so without it the client router cache serves the chart back
under the old theme.

## The canvas

React Flow is styled from the same palette, which is not obvious because its
colours are set from TypeScript rather than classes. It works because all three
sites take **inline styles**, where a `var()` resolves:

- edge `style.stroke` → `var(--edge-spouse)` / `var(--edge-descent)`
- `<Background color>` → passed through as a custom property on the SVG
- `<MiniMap nodeColor>` → applied as `style.fill` on each `<rect>`

So `TreeCanvas` never needs to know which theme is on, and the memo that builds
the edges has no theme dependency to get stale.

The one thing that *is* passed down is `colorMode`, which styles React Flow's own
chrome — zoom controls, minimap frame, attribution. Our three preferences are
exactly React Flow's three, `system` included, so the cookie value goes straight
through with nothing to resolve. It is the only reason `TreeApp` and `TreeCanvas`
take a `theme` prop at all.

## Adding a colour

Add the token to both blocks in `globals.css` — the `:root` pair and the
`@theme inline` mapping — then use the generated utility. Two things to avoid:

- **Don't use a Tailwind palette class** (`bg-slate-100`, `text-rose-600`). It
  will look right in light and wrong in dark, and nothing will fail to tell you.
- **Don't name a token after its colour.** `--slate-100` gives you no way to
  decide what it should become in dark; `--muted` does.

Watch for collisions with Tailwind's own utilities when naming: `--color-solid`
had to become `--color-invert`, because `border-solid` is already a border-style
utility.

Rings need their offset named too — `ring-offset-surface`. Tailwind's default
offset is white, which draws a halo around every ring on the dark canvas.
