import { describe, it, expect } from 'vitest'
import { detectMimeType } from './mime.ts'

// Real base64 headers: PNG 1x1, JPEG 1x1, GIF 1x1
const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const JPEG_1PX =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=='
const GIF_1PX = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='

describe('detectMimeType', () => {
  it('detects PNG from magic bytes', () => {
    expect(detectMimeType(PNG_1PX)).toBe('image/png')
  })

  it('detects JPEG from magic bytes', () => {
    expect(detectMimeType(JPEG_1PX)).toBe('image/jpeg')
  })

  it('detects GIF from magic bytes', () => {
    expect(detectMimeType(GIF_1PX)).toBe('image/gif')
  })

  it('falls back to default when the header is unknown', () => {
    expect(detectMimeType('aGVsbG8gd29ybGQ=')).toBe('image/jpeg')
  })

  it('honors a custom fallback', () => {
    expect(detectMimeType('aGVsbG8=', 'image/png')).toBe('image/png')
  })
})
