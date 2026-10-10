// Only structured hex colors reach CSS; URLs and arbitrary CSS are never accepted.
export const DEFAULT_COVER_THEME = Object.freeze({ mode: 'default' });
export const DEFAULT_COVER_BACKGROUND = 'linear-gradient(180deg, #dce4f2 0%, #e9ecf4 22%, #f5f3ee 55%, #f7f2e8 100%)';

export function isCoverColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function validateCoverTheme(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some((key) => !['mode', 'color', 'colorEnd'].includes(key))) return null;
  if (value.mode === 'default') return { mode: 'default' };
  if (!['solid', 'gradient'].includes(value.mode) || !isCoverColor(value.color)) return null;
  if (value.mode === 'gradient' && !isCoverColor(value.colorEnd)) return null;
  return value.mode === 'solid'
    ? { mode: 'solid', color: value.color.toLowerCase() }
    : { mode: 'gradient', color: value.color.toLowerCase(), colorEnd: value.colorEnd.toLowerCase() };
}

export function normalizeCoverTheme(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return validateCoverTheme(parsed) || { ...DEFAULT_COVER_THEME };
  } catch (_error) {
    return { ...DEFAULT_COVER_THEME };
  }
}

export function coverThemeBackground(value) {
  const theme = normalizeCoverTheme(value);
  if (theme.mode === 'solid') return theme.color;
  if (theme.mode === 'gradient') return `linear-gradient(135deg, ${theme.color} 0%, ${theme.colorEnd} 100%)`;
  return DEFAULT_COVER_BACKGROUND;
}
