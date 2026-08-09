# Intake Share Widget Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a share button in the HMSP dashboard so staff can copy the intake form URL or send it directly via WhatsApp with a pre-composed message.

**Architecture:** A floating action button (FAB) in `App.tsx` and a header button in `PatientIntakesView.tsx` both open a `ShareIntakeModal`. The modal uses `navigator.clipboard` for copy and `wa.me` protocol for WhatsApp. No backend calls, no new DB columns.

**Tech Stack:** React 19, TypeScript, TailwindCSS 4, motion (for animations), lucide-react (icons)

---
### Task 1: Create ShareIntakeModal component

**Files:**
- Create: `src/components/ShareIntakeModal.tsx`

**Step 1: Write the component**

Create `src/components/ShareIntakeModal.tsx`:

```tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Copy, Check, ExternalLink, Share2 } from 'lucide-react'

const INTAKE_URL = 'https://nursingcareinfo.github.io/hmsp-dashboard/intake.html'

const WHATSAPP_TEXT = encodeURIComponent(
  'HMSP Patient Intake Form\n\n' +
  'Dear Patient, please fill this digital form to register for our home medical services. ' +
  'The form includes our service agreement and terms & conditions.\n\n' +
  'Link: ' + INTAKE_URL
)

const WHATSAPP_URL = `https://wa.me/?text=${WHATSAPP_TEXT}`

interface ShareIntakeModalProps {
  open: boolean
  onClose: () => void
}

export default function ShareIntakeModal({ open, onClose }: ShareIntakeModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(INTAKE_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select the input text
    }
  }

  const handleWhatsApp = () => {
    window.open(WHATSAPP_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-black border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Share2 size={16} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Share Intake Form</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                    Send link to patient via WhatsApp
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X size={14} className="text-slate-400" />
              </button>
            </div>

            {/* URL display */}
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">
                Intake Form URL
              </p>
              <p className="text-sm text-slate-300 font-mono truncate">{INTAKE_URL}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 text-sm text-white font-medium transition-all"
              >
                {copied ? (
                  <>
                    <Check size={16} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy Link
                  </>
                )}
              </button>
              <button
                onClick={handleWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl py-3 text-sm text-black font-bold transition-all"
              >
                <ExternalLink size={16} />
                WhatsApp
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

**Step 2: Verify the file compiles**

Run: `npm run lint` — no type errors.

---

### Task 2: Add FAB to App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Read App.tsx to find import section and session check**

Read `src/App.tsx`. After the existing imports, add the ShareIntakeModal import. Find the `session` conditional rendering area and add the FAB.

**Step 2: Add import**

Add after the last import line:
```tsx
import ShareIntakeModal from './components/ShareIntakeModal'
```

**Step 3: Add state and FAB**

After the `session` check in the return (where the authenticated UI renders), add:
```tsx
{/* Share Intake FAB */}
<button
  onClick={() => setShowShare(true)}
  className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 flex items-center justify-center transition-all hover:scale-105"
>
  <Share2 size={20} />
</button>
<ShareIntakeModal open={showShare} onClose={() => setShowShare(false)} />
```

And add state near the top of the component:
```tsx
const [showShare, setShowShare] = useState(false)
```

**Step 4: Run diagnostics**

Run: `npm run lint` — no errors.

---

### Task 3: Add Share button to PatientIntakesView header

**Files:**
- Modify: `src/components/PatientIntakesView.tsx`

**Step 1: Read PatientIntakesView.tsx**

Find the header/title area where the view title is rendered.

**Step 2: Add share button**

Add a button next to the view title:
```tsx
import ShareIntakeModal from './ShareIntakeModal'
// ...
const [showShare, setShowShare] = useState(false)
// In the header area:
<button
  onClick={() => setShowShare(true)}
  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-slate-300 transition-all"
>
  <Share2 size={14} />
  Share Intake Link
</button>
<ShareIntakeModal open={showShare} onClose={() => setShowShare(false)} />
```

**Step 3: Run diagnostics**

Run: `npm run lint` — no errors.

---

### Task 4: Build verification

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds.

**Step 2: Commit**

```bash
git add src/components/ShareIntakeModal.tsx src/App.tsx src/components/PatientIntakesView.tsx
git commit -m "feat: add intake share widget with WhatsApp link"
```

---

## Summary

| Task | File | Action |
|------|------|--------|
| 1 | `src/components/ShareIntakeModal.tsx` | Create — modal with Copy + WhatsApp buttons |
| 2 | `src/App.tsx` | Modify — add FAB + import + state |
| 3 | `src/components/PatientIntakesView.tsx` | Modify — add share button in header |
| 4 | — | Build verification + commit |
