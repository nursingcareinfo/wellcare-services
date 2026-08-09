# Intake Share Widget — Design Doc

## Problem

Staff needs to send the patient intake form link to new patients via WhatsApp. Currently there's no in-dashboard mechanism to copy or share the intake form URL.

## Design

A floating action button (FAB) visible across the dashboard when logged in, plus a button in the Intakes view header, that opens a share modal with copy-to-clipboard and direct WhatsApp sharing.

### Components

**`ShareIntakeModal.tsx`** — Reusable modal component (~80 lines)
- Read-only input showing `https://nursingcareinfo.github.io/hmsp-dashboard/intake.html`
- "Copy Link" button → clipboard API + toast notification
- "Share on WhatsApp" button → `https://wa.me/?text=` with pre-composed message

**Message template** (English):
> HMSP Patient Intake Form
>
> Dear Patient, please fill this digital form to register for our home medical services. The form includes our service agreement and terms & conditions.
>
> Link: https://nursingcareinfo.github.io/hmsp-dashboard/intake.html

### Placement

1. **FAB** in `App.tsx` — bottom-right, visible when `session` is active. Uses existing `motion` patterns for enter/exit animations.
2. **Button** in `PatientIntakesView.tsx` — header area, "Share Intake Link" with a `Share2` icon.

### Data Flow

No backend calls. No new DB columns. No API keys. The modal is purely client-side:
- Copy → `navigator.clipboard.writeText(url)`
- WhatsApp → `window.open(wa_url, '_blank')`

### What's NOT included (YAGNI)

- No URL shortener
- No tracking params
- No patient-specific pre-fill
- No WhatsApp Business API
- No analytics

### Files changed

- `src/components/ShareIntakeModal.tsx` — new component
- `src/App.tsx` — add FAB import and conditional render
- `src/components/PatientIntakesView.tsx` — add Share button in header
