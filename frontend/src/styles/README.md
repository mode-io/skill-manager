# Styles

CSS is organized around **cascade layers** and **feature colocation**. The entry
point is `styles/index.css`; everything else is discovered through it or via
feature-local imports in `main.tsx`.

## Layer order

Declared once in `styles/index.css`, low → high priority:

```
reset → tokens → base → components → features → utilities → overrides
```

Lower layers lose to higher layers regardless of source order. Source order
only resolves ties *within* a layer. Cross-layer cascade is locked — moving a
file in the import list cannot silently change which rule wins.

## Where new rules belong

| New rule styles… | Goes in… | Layer |
|---|---|---|
| an element reset | `styles/reset.css` | `reset` |
| a design token (custom property) | `styles/tokens.css` | `tokens` |
| html / body / scrollbars / selection | `styles/scrollbars.css` or new file in `styles/` | `base` |
| a shared primitive used in ≥ 2 features (e.g. buttons, cards, dialogs) | `styles/components/<thing>.css` | `components` |
| a screen or widget inside one feature | `features/<name>/styles/<what>.css` | `features` |
| a cross-cutting helper class (e.g. `.muted-text`) | `styles/utilities.css` | `utilities` |
| an emergency override | `styles/overrides.css` (create if missing) | `overrides` |

## File conventions

- Wrap each file's contents in `@layer <layer-name> { … }`.
- Kebab-case filenames, one topic per file (`sidebar.css`, not `layout.css`).
- Class names: BEM-ish (`block__elem--mod`). No IDs.
- No `!important` outside the `overrides` layer.
- A feature's CSS never imports another feature's CSS. Share primitives
  through `components/` instead.

## Adding files

- **Shared primitive**: create `styles/components/<name>.css`, wrap in
  `@layer components { … }`, then add an `@import "./components/<name>.css";`
  to `styles/index.css`.
- **Feature-specific style**: create `features/<feature>/styles/<name>.css`,
  wrap in `@layer features { … }`, then add
  `import "./features/<feature>/styles/<name>.css";` to `main.tsx`.

## Current layout

```
frontend/src/styles/
  index.css                # layer declaration + @import wiring
  reset.css                # reset layer
  tokens.css               # tokens layer (design tokens / custom properties)
  scrollbars.css           # base layer
  utilities.css            # utilities layer
  dialogs.css              # components layer (Radix dialog styles)
  components/              # components layer — one file per primitive
    buttons.css
    bulk-bar.css
    cards.css              # generic .skill-card + grid (both skills + MCP cards extend it)
    chips.css              # chips + status badges
    empty-panel.css           # shared empty-state panel
    harness.css            # shared single-harness avatar primitive
    note.css               # shared in-body highlight/note surface
    error-banner.css
    filter.css             # filter bar, pill group, filter trigger
    page.css               # app shell, page header, page chrome
    popup.css              # tooltip, hovercard, and popup-menu surfaces
    sidebar.css            # sidebar + nav magic-bar
    spinner.css
    toast.css
    view-mode-toggle.css

frontend/src/features/
  skills/styles/           # all in features layer
    board.css
    detail.css             # also contains the shared skill-detail modal shell
    list.css               # needs-review skill rows
  mcp/styles/
    pages.css              # in-use / needs-review page-level rules + drift overlay
    detail-sheet.css       # MCP detail sheet (in-use + needs-review)
    edit-dialogs.css       # edit-config + reconcile dialogs
  marketplace/styles/
    cards.css              # .market-card + mcp-card variants
    mcp-detail.css         # MCP marketplace detail modal
    panes.css              # marketplace keep-mounted panes
  settings/styles/
    settings.css

frontend/src/components/
  detail/index.css         # shared detail-view skeleton styles (components layer)
  matrix/matrix.css        # shared extension × harness matrix styles
```

## Debugging cascade

If a rule isn't applying as expected:

1. Open DevTools → Styles → look at the "Cascade Layers" section for the
   element. The highest-priority layer wins, then source order within it.
2. If a `features` rule is being overridden by a `components` rule, the
   layers are in the wrong order in `styles/index.css` — fix it there.
3. If within a layer, swap `@import` order in `index.css` (for components)
   or `main.tsx` (for feature CSS).
