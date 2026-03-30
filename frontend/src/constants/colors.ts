// Tema warna Light dan Dark
export interface ThemeColors {
  bg: string;
  bgCard: string;
  bgSecondary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  brand: string;
  accent: string;
  income: string;
  expense: string;
  border: string;
  tabBg: string;
  chart: string[];
}

export const themes: Record<string, ThemeColors> = {
  light: {
    bg: '#F9F9F6', bgCard: '#FFFFFF', bgSecondary: '#F4EFEB',
    text: '#1A4D2E', textSecondary: '#4A4A4A', textTertiary: '#7D7D7D', textInverse: '#FFFFFF',
    brand: '#1A4D2E', accent: '#E86A33', income: '#3A6E4B', expense: '#D34A3E',
    border: '#F0EBE1', tabBg: '#FFFFFF',
    chart: ['#1A4D2E', '#7D8F69', '#C2A878', '#E86A33', '#4A8B9A', '#9DB0A3', '#D9C7B6', '#F1A075'],
  },
  dark: {
    bg: '#0D1117', bgCard: '#161B22', bgSecondary: '#21262D',
    text: '#E6EDF3', textSecondary: '#8B949E', textTertiary: '#6E7681', textInverse: '#0D1117',
    brand: '#58A67E', accent: '#F0883E', income: '#56D364', expense: '#F85149',
    border: '#30363D', tabBg: '#161B22',
    chart: ['#58A67E', '#7EE787', '#F0883E', '#D2A8FF', '#79C0FF', '#FFA657', '#FF7B72', '#A5D6FF'],
  },
};
