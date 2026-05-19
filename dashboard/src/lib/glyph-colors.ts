/**
 * Deterministic muted-palette glyph backgrounds.
 * 12 colours sampled from the Stations_en_direct.html reference (Frame 1).
 * Hash function: djb2-lite — fast, good distribution, no dependencies.
 */
export const GLYPH_PALETTE = [
  '#5e7d8a',
  '#6f9a8a',
  '#7a8a9a',
  '#8c7a72',
  '#9a8a6f',
  '#a06f8a',
  '#7a9a8a',
  '#9a7a6f',
  '#8a6f9a',
  '#8a9a6f',
  '#6f8a9a',
  '#9a6f7a',
] as const;

export function glyphColor(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  }
  return GLYPH_PALETTE[Math.abs(h) % GLYPH_PALETTE.length];
}
