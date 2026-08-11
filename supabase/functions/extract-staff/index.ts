// Supabase Edge Function: extract-staff
//
// Server-side Gemini extraction for the HMSP Registration flow.
// The Gemini API key lives ONLY in Supabase function secrets (GEMINI_API_KEY)
// — never in the client bundle, so GitHub secret scanning can't block deploys.
//
// Request:  { images: string[] }  // base64-encoded image data (no data: prefix)
// Response: { data: <extraction JSON> }  |  { error: string }
//
// Invoked from the dashboard via supabase.functions.invoke('extract-staff').

import { GoogleGenAI, Type } from 'npm:@google/genai@2.2.0'
import { corsHeaders } from '../_shared/cors.ts'
import { detectMimeType } from './mime.ts'

const MODEL = 'gemini-flash-latest'

const apiKey = Deno.env.get('GEMINI_API_KEY')
if (!apiKey) {
  throw new Error('GEMINI_API_KEY secret is not set on this function.')
}

const ai = new GoogleGenAI({ apiKey })

export const extractionSchema = {
  type: Type.OBJECT,
  properties: {
    pncRegistrationNumber: {
      type: Type.STRING,
      description: 'PNC/PN&MC registration or license number (e.g., PK-K-22-A-290169). Mandatory.',
    },
    pncLicenseExpiryDate: {
      type: Type.STRING,
      description: 'Expiry date of the PNC license card in YYYY-MM-DD format. Mandatory.',
    },
    pncLicenseIssueDate: {
      type: Type.STRING,
      description: 'Issue/renewal date of the PNC license card in YYYY-MM-DD format, if visible.',
    },
    identity: {
      type: Type.OBJECT,
      properties: {
        fullName: { type: Type.STRING, description: 'Full legal name. Mandatory.' },
        fatherHusbandName: { type: Type.STRING },
        cnicNumber: { type: Type.STRING, description: 'CNIC XXXXX-XXXXXXX-X format. Mandatory.' },
        dateOfBirth: { type: Type.STRING, description: 'YYYY-MM-DD' },
        gender: { type: Type.STRING, enum: ['Male', 'Female', 'Other'] },
        maritalStatus: { type: Type.STRING, enum: ['Single', 'Married', 'Divorced'] },
        mobileNumber: { type: Type.STRING, description: '+92 XXX XXXXXXX. Mandatory.' },
        whatsappNumber: { type: Type.STRING, description: '+92 XXX XXXXXXX' },
        religion: {
          type: Type.STRING,
          description: 'Extract Muslim/Christian/Other from Form 49 checkboxes',
        },
        emergencyContact: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            relationship: { type: Type.STRING },
            phone: { type: Type.STRING },
          },
        },
      },
    },
    professional_profile: {
      type: Type.OBJECT,
      properties: {
        positionApplied: {
          type: Type.STRING,
          enum: [
            'R/N',
            'BSN',
            'Aid Nurse',
            'Midwife',
            'DPT',
            'ICU/Anes',
            'Doctor',
            'Attendant',
            'Babysitter',
          ],
        },
        experienceYears: { type: Type.NUMBER },
        shiftPreference: { type: Type.STRING, enum: ['Day', 'Night', '24 hrs'] },
        topSkills: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Top 3 clinical skills from CV',
        },
      },
    },
    geographic_data: {
      type: Type.OBJECT,
      properties: {
        areaTown: { type: Type.STRING },
        district: {
          type: Type.STRING,
          enum: [
            'Nazimabad (Central)',
            'Gulshan (East)',
            'Karachi South',
            'Orangi (West)',
            'Keamari',
            'Korangi',
            'Malir',
          ],
        },
        completeAddress: { type: Type.STRING },
        addressFromBill: {
          type: Type.STRING,
          description: 'Address extracted from Electricity Bill',
        },
        reconciliationAlert: {
          type: Type.BOOLEAN,
          description: 'True if document addresses or names mismatch',
        },
      },
    },
    financial_reference: {
      type: Type.OBJECT,
      properties: {
        expectedSalaryPKR: { type: Type.NUMBER },
        preferredPayment: { type: Type.STRING, enum: ['Cash', 'JazzCash', 'EasyPesa', 'Bank'] },
        bankDetails: {
          type: Type.OBJECT,
          properties: {
            bankName: { type: Type.STRING },
            accountNo: { type: Type.STRING },
            accountTitle: { type: Type.STRING },
            iban: { type: Type.STRING },
          },
        },
      },
    },
    audit_metadata: {
      type: Type.OBJECT,
      properties: {
        acknowledgmentSigned: {
          type: Type.BOOLEAN,
          description: "Signed 'Employee Acknowledgment' regarding duty abandonment",
        },
        policyCheck: {
          type: Type.STRING,
          enum: ['Pass', 'Fail'],
          description: 'Overall policy compliance status',
        },
        criticalMissingInfo: {
          type: Type.BOOLEAN,
          description:
            'True if Full Name, CNIC, Mobile, or PNC Registration Number is missing/illegible',
        },
        missingFieldsList: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            "List of missing mandatory fields (e.g., ['fullName', 'cnicNumber', 'mobileNumber', 'pncRegistrationNumber'])",
        },
        reconciliationDetails: {
          type: Type.STRING,
          description:
            'Brief explanation of any name/address mismatches found across the 4 documents',
        },
        dataConfidence: { type: Type.STRING, enum: ['High', 'Low'] },
      },
    },
  },
  required: [
    'pncRegistrationNumber',
    'pncLicenseExpiryDate',
    'identity',
    'professional_profile',
    'geographic_data',
    'financial_reference',
    'audit_metadata',
  ],
}

const PROMPT = `
  Role: High-Precision Registrar for HMSP Dashboard Karachi (Home Medical Services Provider).
  Task: Analyze the provided images (Employee Form, CNIC, CV, Electricity Bill, and/or PNC License Card) for a medical staffing ledger.
  Extract as much information as possible even if only one document is provided.

  The "Big Four" Mandatory Fields:
  1. fullName
  2. cnicNumber (format: XXXXX-XXXXXXX-X)
  3. mobileNumber (format: +92 XXX XXXXXXX)
  4. pncRegistrationNumber (PNC/PN&MC license number visible on the card front and back)

  DIGIT PRECISION — READ EXACTLY, NEVER GUESS:
  - Transcribe numbers character-for-character from the document. Do not "correct" or "complete" them.
  - Watch look-alike characters: 0 vs O, 1 vs I/l, 7 vs 1, 8 vs B, 5 vs S, 2 vs Z.
  - Documents may print digits in Urdu/Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩ or ۰۱۲۳۴۵۶۷۸۹) — convert them to Western digits 0-9.
  - Write numbers as uninterrupted runs (no spaces between digits).
  - If any digit of a mandatory field is illegible, smudged, cut off, or ambiguous, return null for that field. NEVER guess a digit.

  CANONICAL OUTPUT FORMATS (apply exactly):
  - cnicNumber: XXXXX-XXXXXXX-X (13 digits, dashes after the 5th and 12th). E.g. 42301-0932963-3.
  - mobileNumber / whatsappNumber: +92 3XX XXXXXXX (drop leading 0, +92 prefix, space after +92). E.g. +92 343 2649875.
  - pncRegistrationNumber: keep the printed card format with uppercase letters, e.g. PK-K-22-A-290169, A-54887, PK-S-25-W-366996.
  - All dates: YYYY-MM-DD.

  SPECIAL DOCUMENT — PNC LICENSE CARD:
  - When a PNC (Pakistan Nursing & Midwifery Council) license card is uploaded, it may appear as the front and/or back of a card.
  - Extract the license/registration number (usually formatted like PK-K-22-A-XXXXXX) from BOTH front and back.
  - Extract the "VALID UPTO" or "Expiry" date from the back of the card.
  - Extract the "INITIAL REG. DATE" or "Issue Date" if visible.
  - Cross-reference both sides of the card to ensure the registration number matches on both sides.

  Processing Guidelines:
  1. Document Availability:
     - You may receive 1 to 4 images.
     - Extract data from whatever is available.
     - If a document type is missing, do not complain in reconciliationDetails unless there is a conflict.

  2. Mandatory Field Gatekeeper:
     - Prioritize extracting the "Big Four".
     - If any of the Big Four are missing or unreadable, return null for that field.
     - Set audit_metadata.criticalMissingInfo to true only if one of the "Big Four" is missing.
     - Populate audit_metadata.missingFieldsList with the names of the missing Big Four fields.

  3. Cross-Verification:
     - Identity Sync: Use available documents (CNIC/CV/Form) to verify details.
     - Address Anchor: Extract address from Bill if present, or CV/Form.

  4. Compliance:
     - acknowledgmentSigned: Check if any form or CV mentions acceptance of terms or has a signature.
     - policyCheck: Pass only if at least 3 out of 4 of the Big Four are found.

  5. Reconciliation Details:
     - Use this field to note WHICH documents were found and if any data conflicts (e.g., "Name on CNIC vs CV").
     - Example: "CV provided. CNIC and Bill missing. Extracted basic profile."

  Return the data as valid JSON matching the responseSchema. No preamble.
`

Deno.serve(async (req) => {
  // CORS for the GitHub Pages origin.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { images, mimeTypes } = await req.json()
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: 'No images provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (images.length > 4) {
      return new Response(JSON.stringify({ error: 'Maximum 4 images allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const inlineData = images.map((b64: string, i: number) => ({
      inlineData: { data: b64, mimeType: mimeTypes?.[i] ?? detectMimeType(b64) },
    }))

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ parts: [{ text: PROMPT }, ...inlineData] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: extractionSchema,
      },
    })

    const text = response.text
    if (!text) {
      return new Response(JSON.stringify({ error: 'No response text received from AI' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cleaned = text.trim().replace(/^```json\s*/, '').replace(/```$/, '').trim()
    const data = JSON.parse(cleaned)

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('extract-staff error:', error)
    return new Response(JSON.stringify({ error: 'Extraction failed: ' + (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
