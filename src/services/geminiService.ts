import { supabase } from '../lib/supabase'

/**
 * Extract staff data from document images (CNIC, CV, PNC license, bill).
 *
 * Runs server-side in the Supabase Edge Function `extract-staff` — the Gemini
 * API key lives in function secrets, never in the client bundle. The typed
 * extraction schema + prompt live in supabase/functions/extract-staff/index.ts.
 */
export async function extractStaffData(
  imageBase64s: string[],
  mimeTypes?: string[]
): Promise<any> {
  const { data, error } = await supabase.functions.invoke('extract-staff', {
    body: { images: imageBase64s, mimeTypes },
  })

  if (error) {
    console.error('extract-staff invoke error:', error)
    throw error
  }

  if (!data || data.error) {
    throw new Error(data?.error || 'Extraction failed. Please try again.')
  }

  return data.data
}
