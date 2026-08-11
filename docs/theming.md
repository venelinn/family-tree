# Theming

Light and dark, chosen on `/settings` or left to follow the operating system.

## The rule

**Components name the role, never the colour.** `var(--surface-container)`, not
`#fff`; `var(--on-surface-variant)`, not `#64748b`.

That is the whole design. Because every element asks for a role, the dark theme
is a change to one file — `styles/_theme-dark.scss` — rather than a `dark:`
variant bolted onto every element in the app. A new component gets dark mode for
free as long as it uses tokens, and the way to notice one that doesn't is that
its colours stop responding to the setting.

## The three files

Colour is a layered system, and each layer is a file:

| File | Holds | Edited by |
| --- | --- | --- |
| `tokens/*.json` | The palette, and the roles it plays in light | Hand |
| `styles/_css-variables.css` | The same, as CSS custom properties | **Style Dictionary — never by hand** |
| `styles/_theme-dark.scss` | The same roles, dark | Hand |
| `styles/_compat.scss` | Pre-token names aliased onto the new ones | Shrinks, then dies |

`pnpm build-dictionary` regenerates the middle one; `dev` and `build` run it
first, so it is never stale. `_base-variables.scss` (SCSS variables, for
breakpoints) and `variables.js` come out of the same build.

## The token set

Two groups. The **semantic layer** is generic UI — anything that could exist in
any app:

| Use | Token |
| --- | --- |
| Page background | `--background`, `--surface` |
| Card / panel / raised surface | `--surface-container`, and `-lowest` / `-low` / `-high` / `-highest` |
| Translucent panel over scrolling content | `--surface-veil` |
| Primary text and icons | `--on-surface` |
| Secondary text, muted icons | `--on-surface-variant` |
| Four further steps of emphasis | `--on-surface-soft`, `--on-surface-faint`, `--on-surface-ghost` |
| Hairline border or divider | `--outline-variant` (weakest: `--outline-subtle`) |
| Stronger border | `--outline` |
| Primary button fill, active toggle | `--primary` (`--primary-hover`), text on it `--on-primary` |
| Pale brand tint | `--primary-container`, text `--on-primary-container` |
| Inverted, e.g. a tooltip | `--inverse-surface` / `--inverse-on-surface` |
| Error text or icon | `--error`; filled `--on-error`; tinted `--error-container` / `--on-error-container` |

The **domain layer** is this app and no other:

| Group | Tokens | For |
| --- | --- | --- |
| Sex | `male-*` `female-*` (`-line` `-soft` `-ink` `-solid`) | Person cards and avatars |
| Root | `root-ring` `root-line` `root-soft` `root-ink` | The person the chart is centred on |
| Branch | `branch-ring` `branch-line` `branch-soft` `branch-soft-hover` `branch-ink` | Selection ring, collapse bars |
| Canvas | `canvas-dot` `edge-spouse` `edge-descent` `union` `ribbon` | React Flow, drawn from TypeScript |

Below both sits the raw palette — `--color-slate-200`, `--color-rose-600`. It is
the vocabulary the other two are written in. **Components never name it
directly**: it is not overridden in dark, so `background: var(--color-white)`
paints a stark white panel on a dark page.

`--surface` and `--surface-container-high` are the same colour in light and
deliberately different in dark: one is the page, the other is a hover state on a
panel that sits *above* the page. Collapsing them works until the first dark
hover, which then darkens instead of lifting.

This app's accent is ink itself — a primary button is the one inverted surface —
so `--primary` flips with the theme rather than staying a fixed brand hue.

## How the choice is applied

The preference is one of three values — `system`, `light`, `dark` — stored in a
cookie and read on the server, exactly like the locale. `app/layout.tsx` stamps
it as `data-theme` on `<html>`, and `_theme-dark.scss` turns it into tokens:

```scss
:root[data-theme="dark"] { @include dark-tokens; }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { @include dark-tokens; }
}
```

`system` matches the first rule not at all and the second one whenever the OS is
dark — so the OS decides, and a change to it is picked up live, with no
JavaScript involved. Both entry points share one mixin; duplicating the token
list instead is how the two halves of a theme drift apart.

`dark-tokens` also sets `color-scheme: dark`, which themes the native controls
for free: the depth slider, the "deceased" checkbox and the scrollbars follow
along without being styled.

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

1. Add the raw value to `tokens/colors.json` if the palette doesn't have it.
2. Give it a role in `tokens/semantic.json` (generic) or `tokens/domain.json`
   (this app) — as a `{color.reference}`, not a second copy of the hex.
3. Add the dark counterpart to the `dark-tokens` mixin in
   `styles/_theme-dark.scss`. Skip this only when the colour is deliberately
   theme-independent, like a selection ring.

Two things to avoid:

- **Don't reach past the role to the palette.** `var(--color-slate-100)` gives
  you no way to decide what it should become in dark; `var(--surface-dim)` does.
- **Don't name a token after its colour.** Same reason, one level up.

## The migration

Components are still styled with Tailwind utilities — `bg-panel`,
`text-ink-muted` — and are moving to `.module.scss` one at a time. Those utility
names come from the pre-token era, and `styles/_compat.scss` keeps them alive by
aliasing the old role names onto the new ones:

```scss
--panel: var(--surface-container);
--ink-muted: var(--on-surface-variant);
```

So a converted component and an unconverted one sitting side by side read the
same colour and re-theme together. **New work uses the semantic names**; each
alias is deleted along with the last component that needed it, and the file goes
when Tailwind does. See `rules/css-styling.mdc` for how to write the modules.
