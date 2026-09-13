# AI Money — Project Context

## What this project is
AI Money is an AI-powered personal finance mobile app. Users track transactions, visualize spending through interactive charts, set savings goals, and get insights from an AI financial coach that reasons over their real data.

## Tech stack
- Frontend: React Native + Expo (TypeScript), Expo Router for navigation
- Backend: Supabase (Postgres, Auth) — decision on FastAPI vs Supabase Edge Functions for AI Coach logic still pending
- AI: TBD (likely Gemini or similar cost-efficient LLM)

## Design system — read before writing any UI
This app uses a warm, premium visual style. Always follow this palette and style:

- Background: warm cream/beige (#F5EFE6 or similar warm off-white), never pure white or dark mode
- Primary accent: terracotta/burnt-orange (for balance cards, primary buttons, highlights)
- Secondary accent: soft coral/salmon (for alerts, secondary highlights)
- Text: dark charcoal/near-black, never pure black
- Chart colors: muted sage green and dusty blue as tertiary colors, avoid bright primary colors
- Typography: bold/large numbers for hero stats, rounded or soft sans-serif font, never sharp/geometric
- Cards: fully rounded corners (~20-24px radius), soft minimal shadows, icons inside colored circular badges
- Layout: hero/balance card dominant at top, horizontal scrollable cards for goals, animated number counters and progress rings throughout

Always check `src/constants/theme.ts` for the exact color/spacing values before hardcoding any styling.

## Conventions
- All screens live in `src/app/` (file-based routing via Expo Router)
- Reusable UI goes in `src/components/`
- Reusable logic (non-UI) goes in `src/hooks/`
- Keep code minimal — prefer simple, direct solutions over over-engineered abstractions
- Explain what you're doing in plain terms when making changes, since I'm learning as we build

## What NOT to do
- Don't install new dependencies without asking first
- Don't restructure the folder layout without explaining why
- Don't generate large amounts of code in one go — build incrementally, one screen/feature at a time
