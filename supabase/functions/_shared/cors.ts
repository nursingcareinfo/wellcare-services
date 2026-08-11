// Shared CORS headers for HMSP edge functions.
// The dashboard is served from nursingcareinfo.github.io (GitHub Pages).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
