# Purpleberg Terminal — Glass Fintech Redesign

**Date:** 2026-06-26
**Branch:** `redesign/glass-terminal`
**Approach:** Token-first elevation — evolve the central design system (`index.css`),
`ThemeContext`, the 7 shared primitives (`shared.jsx`) and the 4 shell components so the
premium glass language propagates across all 13 screens, then targeted per-screen polish.

## Brief (locked with user)

- **Aesthetic:** Glass Fintech — depth, frosted panels, gradient hairline borders, soft glow, neon-accent charts.
- **Density:** Ultra-dense. The glass lives in surfaces/depth/accents, NOT in extra padding. Data grids stay tight.
- **Brand:** Refined purple (it's "Purpleberg"). `#8b5cf6` stays the brand hue.
- **Theme:** Dark-first hero, light fully polished. Keep the toggle.
- **Type:** Inter (UI) + JetBrains Mono (all numbers/prices/tickers), tabular figures.
- **Glass level:** Balanced / GPU-friendly. `backdrop-filter: blur` on PANELS only, not tiny elements.
- **Motion:** Tasteful + `prefers-reduced-motion`-aware. Tick flash, live pulse, hover glow, staggered entrance, smooth chart draw.
- **Taste:** Best-judgment synthesis (TradingView credibility × exchange energy × Linear/Stripe restraint).

## Non-negotiable guardrails

1. **Functionality is unchanged.** All data fetching/polling, navigation, command palette (Ctrl+K),
   theme toggle, mobile menu, error boundaries, lazy loading — identical behavior. Verify every screen vs baseline.
2. Both themes work; responsive at 375 / 768 / 1024 / 1440.
3. Accessibility kept or improved: AA contrast, visible `:focus-visible` rings, aria labels, reduced-motion.
4. No new heavy dependencies. Stay on React 18 + recharts + lucide.
5. Preserve in-progress EquityAnalysis ratio-units fix.

## Design tokens (source of truth)

### Color — dark (hero)
- Canvas `--c-bg`: `#07070d` + faint radial purple vignette (`--c-bg-vignette`).
- Surfaces (translucent glass, each lighter): `--c-panel`, `--c-card`, `--c-elevated`.
- Glass fills use rgba over the canvas so `backdrop-filter` reads through.
- Borders: `--c-border` (hairline) + `--c-border-gradient` (purple-tinted gradient border image) + `--c-border-light`.
- Purple ramp: brand `--c-purple #8b5cf6`, `--c-purple-light #a78bfa`, active `--c-purple-active #7c5cff`, `--c-purple-dark`, `--c-purple-dim`.
- Glow: `--glow-purple`, `--glow-green`, `--glow-red` (box-shadow tokens for live/active).
- Data semantics unchanged: green `#22c55e` (up), red `#ef4444` (down), gold `#fbbf24` (yields), cyan/blue accents.

### Color — light (polished)
- Bright frosted-white panels on slate `#eef1f6` canvas; same purple system at darker stops for AA.

### Typography
- `--font-sans: "Inter", "Segoe UI", system-ui, sans-serif`
- `--font-mono: "JetBrains Mono", ui-monospace, monospace`
- All numeric cells: `font-variant-numeric: tabular-nums`.

### Glass utilities (index.css)
- `.pb-panel` → glass surface: translucent bg, `backdrop-filter: blur(14px)`, gradient hairline border, top inner-highlight, soft elevation shadow.
- `.pb-glass-hover` → hover lifts glow ring.
- `.pb-live-dot` → pulsing dot.
- `.pb-tick-up` / `.pb-tick-down` → brief flash animation applied on value change.
- All animations wrapped by `@media (prefers-reduced-motion: reduce)` → disabled.

### Motion timings
- Micro-interactions 150–220ms ease-out; entrance stagger 30–50ms/panel; tick flash ~600ms; respect reduced-motion.

## Component plan

| Layer | Files | Changes |
|---|---|---|
| Foundation | `index.css`, `index.html`, `ThemeContext.jsx`, `src/main.jsx` | Tokens, Inter font, glass utilities, vignette, palette parity |
| Primitives | `shared.jsx` | Glass Panel/Header, Badge, MiniTable, DataCell, TabBar, ChgVal (tick flash), LoadingSpinner |
| Shell | `components/TopBar`, `Sidebar`, `BottomBar`, `CommandPalette`, `MobileMenu`, `Clock` | Glass bars, glowing logo, focal search pill, gradient active nav, ticker edge fades |
| Screens | `screens/*.jsx` (13) | Recharts upgrades (gradient fills, glow strokes, glass tooltips, refined grid), bespoke hero cards, glass polish |

## Verification plan
- Preview both servers (backend 3001, frontend 5173). Click through all 13 screens.
- `preview_console_logs` (errors) + `preview_network` (failed) must be clean.
- Test: command palette open/search/select, theme toggle (dark↔light), sidebar collapse, mobile menu + bottom tabs, chart range/type toggles.
- Screenshot dashboard + 2–3 chart screens in dark, light, and 375px mobile; compare to baseline for parity.
- Final pass: `code-reviewer` agent against the branch diff.
