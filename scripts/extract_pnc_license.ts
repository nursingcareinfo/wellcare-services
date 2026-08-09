/**
 * Standalone PNC License OCR Extractor
 * Reads pnc_front.jpeg + pnc_back.jpeg, sends to Gemini Flash,
 * extracts PNC Registration Number + Expiry Date (and more).
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { GoogleGenAI, Type } from '@google/genai'
import dotenv from 'dotenv'

dotenv.config({ path: join(process.cwd(), '.env.local') })

const API_KEY =
  process.env.VITE_GEMINI_API_KEY ??
  (() => {
    throw new Error('Set VITE_GEMINI_API_KEY')
  })()

const ai = new GoogleGenAI({ apiKey: API_KEY })

const FRONT_IMAGE = join(process.cwd(), 'assets', 'pnc_front.jpeg')
const BACK_IMAGE = join(process.cwd(), 'assets', 'pnc_back.jpeg')

const pncExtractionSchema = {
  type: Type.OBJECT,
  properties: {
    pncRegistrationNumber: {
      type: Type.STRING,
      description:
        'Pakistan Nursing Council registration / license number. Found on the front and back of the license card.',
    },
    pncLicenseExpiryDate: {
      type: Type.STRING,
      description:
        'Expiry date of the PNC license in YYYY-MM-DD format. Found on the back or bottom of the license card.',
    },
    pncLicenseIssueDate: {
      type: Type.STRING,
      description: 'Issue / renewal date of the PNC license in YYYY-MM-DD format, if visible.',
    },
    fullName: {
      type: Type.STRING,
      description: 'Full name of the nurse as printed on the PNC license.',
    },
    fatherHusbandName: {
      type: Type.STRING,
      description: "Father's or husband's name as printed on the PNC license.",
    },
    cnicNumber: {
      type: Type.STRING,
      description: 'CNIC number in XXXXX-XXXXXXX-X format, if present.',
    },
    dateOfBirth: {
      type: Type.STRING,
      description: 'Date of birth in YYYY-MM-DD format, if present.',
    },
    gender: {
      type: Type.STRING,
      enum: ['Male', 'Female', 'Other'],
    },
    licenseCategory: {
      type: Type.STRING,
      description:
        'PNC license category (e.g., Registered Nurse, Lady Health Visitor, Midwife, etc.).',
    },
    licenseStatus: {
      type: Type.STRING,
      description: 'Current status of the license — Active / Expired / Suspended / Cancelled.',
    },
    rawText: {
      type: Type.STRING,
      description: 'Full raw text transcription of both license sides.',
    },
    extractionConfidence: {
      type: Type.STRING,
      enum: ['High', 'Medium', 'Low'],
      description: 'How confident you are in the extracted data based on image clarity.',
    },
  },
  required: ['pncRegistrationNumber', 'pncLicenseExpiryDate', 'extractionConfidence'],
}

const prompt = `You are a precise document recognition engine for the Pakistan Nursing Council (PNC) license card.
Your ONLY job is to read the provided images of a PNC license (front and back) and return the structured data.

MANDATORY FIELDS — extract these exactly:
1. pncRegistrationNumber  — The PNC registration / license number (e.g., "RN-12345", "LHV-67890", etc.). It is the most important field.
2. pncLicenseExpiryDate   — The expiry date of the license in YYYY-MM-DD format. If only month/year is visible, use the last day of that month.
3. fullName               — Full name on the card.
4. extractionConfidence   — Your confidence in all extracted fields (High / Medium / Low).

IF the license is expired, still return the expiry date.
IF a field is not visible or illegible, return an empty string "" — never null or error.
Do not make up data. If something is unclear, leave it blank.

Return the data as valid JSON matching the responseSchema. No preamble.`

async function main() {
  const t0 = Date.now()

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║        PNC License OCR Extraction — Gemini        ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // ── Load & encode images ──────────────────────────────────────────────
  const encode = (p: string) => readFileSync(p).toString('base64')
  const [frontB64, backB64] = [FRONT_IMAGE, BACK_IMAGE].map(encode)

  console.log('📸 Loaded assets:')
  console.log(
    `   Front: pnc_front.jpeg  (${(readFileSync(FRONT_IMAGE).length / 1024).toFixed(1)} KB)`
  )
  console.log(
    `   Back:  pnc_back.jpeg   (${(readFileSync(BACK_IMAGE).length / 1024).toFixed(1)} KB)\n`
  )
  console.log('⏳ Sending to gemini-flash-latest…')

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: frontB64, mimeType: 'image/jpeg' } },
            { inlineData: { data: backB64, mimeType: 'image/jpeg' } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: pncExtractionSchema,
      },
    })

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`✅ Response received in ${elapsed}s\n`)

    if (!response.text) throw new Error('Empty response from Gemini')

    // Strip potential code-fence wrapping
    let cleaned = response.text
      .trim()
      .replace(/^```json\s*/, '')
      .replace(/```$/, '')
      .trim()
    const data = JSON.parse(cleaned)

    // ── Display results ─────────────────────────────────────────────────
    console.log('╔═══════════════ EXTRACTED DATA ═══════════════╗')
    console.log(`║ Registration # : ${padRight(data.pncRegistrationNumber || 'N/A', 40)}║`)
    console.log(`║ Expiry Date    : ${padRight(data.pncLicenseExpiryDate || 'N/A', 40)}║`)
    console.log(`║ Issue Date     : ${padRight(data.pncLicenseIssueDate || 'N/A', 40)}║`)
    console.log(`║ Full Name      : ${padRight(data.fullName || 'N/A', 40)}║`)
    console.log(`║ Father/Husband : ${padRight(data.fatherHusbandName || 'N/A', 40)}║`)
    console.log(`║ CNIC           : ${padRight(data.cnicNumber || 'N/A', 40)}║`)
    console.log(`║ DOB            : ${padRight(data.dateOfBirth || 'N/A', 40)}║`)
    console.log(`║ Gender         : ${padRight(data.gender || 'N/A', 40)}║`)
    console.log(`║ Category       : ${padRight(data.licenseCategory || 'N/A', 40)}║`)
    console.log(`║ Status         : ${padRight(data.licenseStatus || 'N/A', 40)}║`)
    console.log(`║ Confidence     : ${padRight(data.extractionConfidence || 'N/A', 40)}║`)
    console.log('╠══════════════ RAW TEXT :: START ═════════════╣')
    wrapText(data.rawText || '(none)', 40)
    console.log('╚══════════════ RAW TEXT :: END   ═════════════╝')

    // ── Save JSON ──────────────────────────────────────────────────────
    const outPath = join(process.cwd(), 'scripts', 'pnc_extraction_result.json')
    writeFileSync(outPath, JSON.stringify(data, null, 2))
    console.log(`\n📁 Full JSON saved → ${outPath}`)
  } catch (err: any) {
    console.error('\n❌ Extraction failed:', err.message)
    process.exit(1)
  }
}

function padRight(s: string, width: number): string {
  return s.slice(0, width).padEnd(width)
}
function wrapText(text: string, width: number): void {
  const words = text.split(/\s+/)
  let line = '║   '
  for (const w of words) {
    if (line.length + w.length + 1 > width + 5) {
      console.log(line.padEnd(width + 4) + '║')
      line = '║   ' + w
    } else {
      line += (line.endsWith('║   ') ? '' : ' ') + w
    }
  }
  console.log(line.padEnd(width + 4) + '║')
}

main()
