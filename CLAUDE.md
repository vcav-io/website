# vcav.io Website

Public website for the Vault Family at vcav.io.

## Build & Dev

```bash
npm install
npm run dev       # Local dev server
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

## Stack

- **Astro** — static site framework, zero JS by default
- **Vanilla TypeScript** — simulation engine (no React/Preact)
- **CSS custom properties** — design system in `src/styles/global.css`
- **Fonts:** Inter (body), JetBrains Mono (code/vault panel) via @fontsource

## Structure

```
src/
  layouts/Layout.astro           — base HTML shell
  pages/index.astro              — single page, all sections
  components/simulation/         — three-panel vault simulation
    types.ts                     — simulation type definitions
    scenario.ts                  — structured scenario data (editable)
    engine.ts                    — playback state machine
    renderer.ts                  — DOM updates + animations
    Simulation.astro             — Astro component wrapper
  components/sections/           — content sections below simulation
  styles/global.css              — design tokens + reset
```

## Deployment

Hosted on Vercel. Pushes to `main` auto-deploy.

## Guardrails

- Only AgentVault + VFC are public. VCAV is private / in development.
- Protocol details must match shipped code in `vcav-io/agentvault` and `vcav-io/vfc`.
- No analytics, tracking, or cookies.
