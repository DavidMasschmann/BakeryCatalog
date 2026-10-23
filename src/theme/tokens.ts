export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  chipBackground: string;
  chipText: string;
  /** Backing plate for the maroon monogram, which is too dark on a dark header. */
  logoBackground: string;
  shadow: string;
};

export const palettes: Record<ColorScheme, ThemeColors> = {
  light: {
    // Cream paper + the monogram's rouge (#773141, sampled from assets/icon.png).
    background: '#f7f1e6',
    surface: '#fffcf6',
    surfaceAlt: '#efe6d8',
    border: '#e3d7c6',
    text: '#2b1f20',
    textMuted: '#6e5d59',
    primary: '#773141',
    onPrimary: '#fff8f1',
    danger: '#b3261e',
    chipBackground: '#f6e4e7',
    chipText: '#773141',
    logoBackground: '#fffcf6',
    shadow: '#000000',
  },
  dark: {
    // Warm charcoal + a rose tint of the same rouge, so both themes feel related.
    background: '#141110',
    surface: '#1f1a18',
    surfaceAlt: '#2b2421',
    border: '#3c332f',
    text: '#f2ebe5',
    textMuted: '#a99c96',
    primary: '#e8a5b3',
    // Dark text on the light-primary button.
    onPrimary: '#241016',
    danger: '#ff8a80',
    chipBackground: '#3a2128',
    chipText: '#f2b8c3',
    logoBackground: '#f2e9dd',
    shadow: '#000000',
  },
};

export type ThemeMode = 'system' | 'light' | 'dark';
