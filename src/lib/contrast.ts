// Utility functions for WCAG contrast evaluation and color suggestions
// - Parses CSS color strings (hex, rgb, rgba)
// - Computes relative luminance and contrast ratio
// - Provides helpers to check AA/AAA compliance and suggest readable colors

export type RGB = { r: number; g: number; b: number };

function clamp(v: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, v));
}

function hexToRgb(hex: string): RGB | null {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function rgbStringToRgb(rgb: string): RGB | null {
  const m = rgb.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!m) return null;
  const parts = m[1].split(',').map((p) => p.trim());
  if (parts.length < 3) return null;
  const r = clamp(parseFloat(parts[0]));
  const g = clamp(parseFloat(parts[1]));
  const b = clamp(parseFloat(parts[2]));
  // Ignore alpha for luminance
  return { r, g, b };
}

export function parseColor(input: string): RGB | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (s.startsWith('#')) return hexToRgb(s);
  if (s.startsWith('rgb')) return rgbStringToRgb(s);
  // Basic named colors (minimal fallback)
  const named: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    transparent: '#000000', // treat as black for contrast calc with parent
  };
  if (named[s]) return hexToRgb(named[s]);
  return null;
}

function srgbToLinear(c: number) {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: RGB): number {
  // WCAG relative luminance formula
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(colorA: string, colorB: string): number {
  const A = parseColor(colorA);
  const B = parseColor(colorB);
  if (!A || !B) return 0;
  const LA = relativeLuminance(A);
  const LB = relativeLuminance(B);
  const L1 = Math.max(LA, LB);
  const L2 = Math.min(LA, LB);
  return (L1 + 0.05) / (L2 + 0.05);
}

export function isLargeText(fontSizePx?: number, fontWeight?: number): boolean {
  if (!fontSizePx) return false;
  // WCAG: large text is >= 18.66px normal, or >= 14px bold
  return fontSizePx >= 18.66 || (!!fontWeight && fontWeight >= 700 && fontSizePx >= 14);
}

export function meetsAA(bg: string, fg: string, fontSizePx?: number, fontWeight?: number): boolean {
  const ratio = contrastRatio(bg, fg);
  const threshold = isLargeText(fontSizePx, fontWeight) ? 3 : 4.5;
  return ratio >= threshold;
}

export function meetsAAA(bg: string, fg: string, fontSizePx?: number, fontWeight?: number): boolean {
  const ratio = contrastRatio(bg, fg);
  const threshold = isLargeText(fontSizePx, fontWeight) ? 4.5 : 7;
  return ratio >= threshold;
}

export function pickReadableForeground(bg: string): string {
  const whiteRatio = contrastRatio(bg, '#ffffff');
  const blackRatio = contrastRatio(bg, '#000000');
  // Prefer the one with higher ratio
  return whiteRatio >= blackRatio ? '#ffffff' : '#000000';
}

export function ensureContrast(bg: string, fg: string, level: 'AA' | 'AAA' = 'AAA', fontSizePx?: number, fontWeight?: number): string {
  const ok = level === 'AAA' ? meetsAAA(bg, fg, fontSizePx, fontWeight) : meetsAA(bg, fg, fontSizePx, fontWeight);
  if (ok) return fg;
  // Fallback to best of black/white
  return pickReadableForeground(bg);
}

export function suggestMuted(bg: string): string {
  // For dark backgrounds, pick a lighter gray; for light, a darker gray
  const bgLum = relativeLuminance(parseColor(bg) || { r: 0, g: 0, b: 0 });
  return bgLum < 0.5 ? '#cbd5e1' /* slate-300 */ : '#475569' /* slate-600 */;
}

export function suggestAccent(bg: string): string {
  // Choose accent with at least ~3:1 contrast for UI affordances
  const candidates = ['#2563eb', '#7dd3fc', '#22d3ee', '#f59e0b'];
  let best = candidates[0];
  let bestRatio = 0;
  for (const c of candidates) {
    const r = contrastRatio(bg, c);
    if (r > bestRatio) {
      bestRatio = r;
      best = c;
    }
  }
  return best;
}

export type ContrastEvaluation = {
  ratio: number;
  meetsAA: boolean;
  meetsAAA: boolean;
  background: string;
  foreground: string;
};

export function evaluateContrast(bg: string, fg: string, fontSizePx?: number, fontWeight?: number): ContrastEvaluation {
  const ratio = contrastRatio(bg, fg);
  return {
    ratio,
    meetsAA: meetsAA(bg, fg, fontSizePx, fontWeight),
    meetsAAA: meetsAAA(bg, fg, fontSizePx, fontWeight),
    background: bg,
    foreground: fg,
  };
}

export function getCssVar(el: HTMLElement, varName: string, fallback = ''): string {
  const v = getComputedStyle(el).getPropertyValue(varName).trim();
  return v || fallback;
}

export function setCssVars(el: HTMLElement, vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) {
    el.style.setProperty(k, v);
  }
}