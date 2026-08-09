# HMSP Dashboard - Technical Context

This document provides essential technical context for AI agents working on the HMSP (Home Medical Services Provider) Dashboard.

## Project Overview

HMSP Dashboard is a high-performance management interface for healthcare staffing in Karachi, Pakistan. It facilitates staff registration (via AI-powered OCR), patient record management, shift scheduling, and financial ledger tracking.

### Core Mission
To provide a robust, manual-management interface for medical services, ensuring data integrity through cross-document verification and real-time financial transparency.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6
- **Styling**: Tailwind CSS 4 (using `@theme` and CSS variables)
- **State/Animations**: Motion (formerly framer-motion), state-based routing in `App.tsx`
- **Backend/Database**: Supabase (PostgreSQL)
- **AI Integration**: Google Gemini API (`gemini-flash-latest`) via `@google/genai`
- **Icons**: Lucide-React

## Directory Structure

- `src/App.tsx`: Main layout, navigation, and view routing.
- `src/components/`: UI views for different modules (Staff, Patients, OCR, Finance, etc.).
- `src/services/`: Business logic and API integration:
  - `geminiService.ts`: Multimodal OCR extraction schema and logic.
  - `staffService.ts`, `patientService.ts`, etc.: Supabase data operations.
- `src/lib/`:
  - `supabase.ts`: Supabase client initialization.
  - `utils.ts`: Shared helper functions (CNIC/Phone formatting, tailwind-merge).
- `supabase_schema.sql`: Source of truth for database tables and views.

## Building and Running

### Prerequisites
- Node.js (Latest LTS recommended)
- A Supabase project and Gemini API key

### Commands
- `npm install`: Install project dependencies.
- `npm run dev`: Start the development server at `http://localhost:3000`.
- `npm run build`: Generate a production build in the `dist/` directory.
- `npm run lint`: Run TypeScript type checking (`tsc --noEmit`).

### Environment Variables
Create a `.env.local` file with the following:
```env
GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Development Conventions

### 1. Data Integrity & Validation
The project uses strict regex for Pakistani identity formats:
- **CNIC**: `XXXXX-XXXXXXX-X`
- **Phone**: `+92 XXX XXXXXXX`
Always use the cleaning utilities in `src/components/OCRView.tsx` or `src/lib/utils.ts` before committing to the database.

### 2. Styling Patterns
- Use **Tailwind CSS 4** utility classes.
- Prefer the semantic CSS variables defined in `src/index.css` (e.g., `var(--color-bg)`, `var(--color-brand)`).
- Use the `.glass-card` and `.btn-primary` component classes for consistent UI.

### 3. AI Service (Gemini)
- The extraction schema is defined in `src/services/geminiService.ts`.
- When updating the registrar's capabilities, ensure the prompt and schema are aligned.
- Gemini is used as a "High-Precision Registrar" to reason across multiple document images.

### 4. Database Views
The dashboard relies on PostgreSQL views for real-time calculations:
- `real_time_margin_view`: Daily profit/margin per patient.
- `staff_accrual_view`: Monthly earnings, penalties, and advances per staff member.

### 5. HMR Caution
In certain environments (like AI Studio), HMR is disabled via the `DISABLE_HMR` environment variable in `vite.config.ts`. Do not modify this without verifying the environment.
