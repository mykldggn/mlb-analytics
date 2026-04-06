/**
 * SVG field geometry for the spray chart component.
 * ViewBox: 600×450. Home plate at (300, 430).
 * Scale: 0.875 SVG units per foot (350 units = 400 ft depth to CF wall).
 *
 * Statcast coordinate system: home plate at (125.42, 198.84).
 * 1 Statcast unit = 2.5 feet (multiply to convert, do NOT divide).
 */

export const FIELD_VIEWBOX = '0 0 600 450'
export const HOME_PLATE_SVG = { x: 300, y: 430 }

// Fair territory: foul lines → outfield wall arc → home plate
// LF pole  ~330 ft at 45° left  → SVG (96, 226)
// LCF ctrl ~375 ft at ~22° left → SVG (162, 78)
// CF       ~400 ft straight     → SVG (300, 80)
// RCF ctrl ~375 ft at ~22° right→ SVG (438, 78)
// RF pole  ~330 ft at 45° right → SVG (504, 226)
export const OUTFIELD_PATH =
  'M 300,430 L 96,226 Q 168,72 300,65 Q 432,72 504,226 Z'

// Infield dirt diamond — 90 ft bases, scale 0.875 SVG/ft
// First:  +55.7 x, -55.7 y  → (356, 374)
// Second: 0 x,  -111.4 y    → (300, 319)
// Third:  -55.7 x, -55.7 y  → (244, 374)
export const INFIELD_DIRT_PATH =
  'M 300,430 L 356,374 L 300,319 L 244,374 Z'

// Foul lines
export const LEFT_FOUL_LINE  = 'M 300,430 L 96,226'
export const RIGHT_FOUL_LINE = 'M 300,430 L 504,226'

// Base positions
export const BASE_SIZE = 8
export const BASES = {
  first:  { x: 356, y: 374 },
  second: { x: 300, y: 319 },
  third:  { x: 244, y: 374 },
  home:   { x: 300, y: 430 },
}

// Pitcher's mound: 60.5 ft from plate → y = 430 - 60.5*0.875 ≈ 377
export const MOUND = { x: 300, y: 377, r: 12 }

/**
 * Convert Statcast hc_x / hc_y to SVG viewport coordinates.
 *
 * Statcast origin: home plate at (125.42, 198.84).
 * 1 Statcast unit = 2.5 feet → multiply (not divide) to get feet.
 * SVG scale: 0.875 SVG units per foot; home plate at (300, 430).
 *
 * Reference checks:
 *   CF HR  (hc_x≈125, hc_y≈40) → ~400 ft → svgY ≈ 80  (near CF wall) ✓
 *   RF single (hc_x≈200, hc_y≈130) → ~185 ft right, ~170 ft deep → right-center ✓
 *   SS groundout (hc_x≈85, hc_y≈155) → ~100 ft left, ~110 ft deep → near 2B left side ✓
 */
export function hitCoordsToSVG(hc_x: number, hc_y: number): { x: number; y: number } {
  const ftX = (hc_x - 125.42) * 2.5        // positive = right field
  const ftY = (198.84 - hc_y) * 2.5        // positive = away from plate
  const scale = 0.875                        // SVG units per foot
  return {
    x: Math.round(300 + ftX * scale),
    y: Math.round(430 - ftY * scale),
  }
}

export const BB_TYPE_COLORS: Record<string, string> = {
  fly_ball:    '#ef4444',  // red
  ground_ball: '#22c55e',  // green
  line_drive:  '#3b82f6',  // blue
  popup:       '#a855f7',  // purple
}

export const EVENT_SYMBOLS: Record<string, string> = {
  home_run: '★',
  double:   '◆',
  triple:   '▲',
  single:   '●',
  field_out: '×',
}
