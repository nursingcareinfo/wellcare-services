# AGENTS.md — HMSP Dashboard

## Project

HMSP (Home Medical Services Provider) — React 19 + Vite + Supabase dashboard for healthcare staff management in Karachi.

## Quick Start

```bash
npm install && npm run dev    # localhost:3000
npm run build                 # production build → dist/
npm run lint                  # TypeScript type check
```

**Dev server**: Port 3000, binds to `0.0.0.0` (local network accessible).

**Build output**: `dist/` with base path `/hmsp-dashboard/`.

## Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 6, TailwindCSS 4
- **AI**: Google Gemini API via `@google/genai` (gemini-flash-latest)
- **Backend**: Supabase (PostgreSQL) at `https://zumysyuenxrylauzvokl.supabase.co`
- **Deployment**: GitHub Pages — auto-deploys on push to main
- **Live URL**: https://nursingcareinfo.github.io/hmsp-dashboard/

### Key Packages

| Package                   | Purpose                                     |
| ------------------------- | ------------------------------------------- |
| `@google/genai`           | Gemini API client (NOT google-generativeai) |
| `motion` + `motion/react` | Animations (import from `motion/react`)     |
| `recharts`                | Charts                                      |
| `date-fns`                | Date utilities                              |
| `react-dropzone`          | File uploads (CNIC, CV, Bill)               |
| `lucide-react`            | Icons                                       |
| `clsx` + `tailwind-merge` | Class name utility (`cn()`)                 |

## Environment Variables

Copy `.env.example` → `.env.local`:

| Variable                    | Required | Notes                                       |
| --------------------------- | -------- | ------------------------------------------- |
| `GEMINI_API_KEY`            | Yes      | Injected at runtime from AI Studio Secrets  |
| `VITE_SUPABASE_URL`         | Yes      | Must have `VITE_` prefix for browser access |
| `VITE_SUPABASE_ANON_KEY`    | Yes      | Must have `VITE_` prefix                    |
| `SUPABASE_SERVICE_ROLE_KEY` | No       | Keep secret — server-side only              |

## Architecture

```
src/main.tsx → src/App.tsx (state-based routing)
src/components/  — 9 view components (Dashboard, Staff, OCR, etc.)
src/services/    — staffService, patientService, shiftService, advanceService, geminiService
src/lib/         — supabase.ts (client), utils.ts (cn, formatPKR, formatCNIC, formatPhone)
```

### View Types (setActiveView in App.tsx)

```
'dashboard' | 'staff' | 'patients' | 'matchmaker' | 'finance' | 'ocr' | 'attendance' | 'memory'
```

### Key Database Tables/Views

- **`employees`** — Staff records with OCR-extracted data, `emp_no` format `NC-KHI-XXXX`
- **`patients`** — Patient records
- **`manual_shifts`** — Staff shift assignments (Morning/Night, Scheduled/Completed/Abandoned)
- **`salary_advances`** — Salary advance requests (Pending/Settled)
- **`real_time_margin_view`** — MTD margin calculated as `daily_margin × 30`

### Supabase Query Pattern

Direct from components/services — no service layer abstraction:

```typescript
import { supabase } from '../lib/supabase'
const { data } = await supabase.from('employees').select('*').eq('is_active', true)
```

## TailwindCSS 4

No `tailwind.config.js` — uses CSS-first config via `@theme {}` in `src/index.css`. Import: `@import "tailwindcss"`. Class shortcuts: `.glass-card`, `.input-field`, `.btn-primary`, `.btn-secondary`.

## Pre-commit Hooks

```bash
pre-commit run --all-files
```

Checks: trailing-whitespace, end-of-file-fixer, check-yaml, check-merge-conflict, check-added-large-files (2MB max), TypeScript type-check (`npm run lint`).

## CI/CD

- **Deploy**: `.github/workflows/deploy.yml` — builds on push to main, sets `TAILWIND_USE_BINARY=0`
- **Pre-commit CI**: `.github/workflows/pre-commit.yml` — runs on PRs and main pushes

## Gotchas

- `console.log` is used throughout codebase — not blocked but discouraged
- Supabase keys **must** have `VITE_` prefix in browser code
- Build base path is `/hmsp-dashboard/` — affects relative asset paths in production
- HMR disabled via `DISABLE_HMR` env var in AI Studio — don't re-enable in vite.config.ts
- CSS variables in `src/index.css` use `--color-*` naming (bg, card, border, ink, brand, etc.)
- `react-dropzone` used for document uploads (CNIC front/back, CV, Electricity Bill) → Gemini OCR

## Kilo Commands (Recommended)

The `.kilo/` directory provides slash commands that simplify common tasks:

| Command         | Action                                 |
| --------------- | -------------------------------------- |
| `/dev`          | Start Vite dev server (port 3000)      |
| `/build`        | Production build + type-check          |
| `/typecheck`    | TypeScript check only (`npm run lint`) |
| `/deploy`       | Deploy to GitHub Pages                 |
| `/db`           | Supabase migration operations          |
| `/seed`         | Seed test data (staff, patients)       |
| `/ai`           | Switch Gemini ↔ Groq, check quota      |
| `/staff`        | Bulk staff operations                  |
| `/staff-manual` | Edit/verify individual staff records   |

Run any command in the Kilo chat. Full docs: `.kilo/COMMANDS.md`

## Pre-commit Setup

```bash
pip install pre-commit && pre-commit install
```

Run manually: `pre-commit run --all-files`
