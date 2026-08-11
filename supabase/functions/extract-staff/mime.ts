// Magic-byte MIME type detection from base64-encoded image data.
//
// Gemini's inlineData requires a correct mimeType — the old code hardcoded
// 'image/jpeg', which breaks PNG/WebP uploads. Sniff the header instead.

const SIGNATURES: Array<[string, string]> = [
  // base64 of PNG header \x89PNG\r\n\x1a\n
  ['image/png', 'iVBORw0KGgo'],
  // base64 of JPEG header \xff\xd8\xff
  ['image/jpeg', '/9j/'],
  // base64 of GIF87a / GIF89a header
  ['image/gif', 'R0lGOD'],
  // base64 of RIFF....WEBP header
  ['image/webp', 'UklGR'],
]

/** Sniff the MIME type of a base64 image string, falling back when unknown. */
export function detectMimeType(base64: string, fallback = 'image/jpeg'): string {
  const head = base64.slice(0, 16)
  for (const [mime, signature] of SIGNATURES) {
    if (head.startsWith(signature)) return mime
  }
  return fallback
}
