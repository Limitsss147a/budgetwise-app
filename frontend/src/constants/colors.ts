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
    bg: '#F3F4F6', bgCard: '#FFFFFF', bgSecondary: '#E5E7EB',
    text: '#111827', textSecondary: '#4B5563', textTertiary: '#9CA3AF', textInverse: '#FFFFFF',
    brand: '#10B981', accent: '#10B981', income: '#10B981', expense: '#EF4444',
    border: '#E5E7EB', tabBg: '#FFFFFF',
    chart: ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#14B8A6', '#6366F1', '#EC4899'],
  },
  dark: {
    bg: '#121212', bgCard: '#1E1E1E', bgSecondary: '#2D2D2D',
    text: '#F9FAFB', textSecondary: '#D1D5DB', textTertiary: '#6B7280', textInverse: '#121212',
    brand: '#10B981', accent: '#10B981', income: '#34D399', expense: '#F87171',
    border: '#333333', tabBg: '#1E1E1E',
    chart: ['#34D399', '#60A5FA', '#A78BFA', '#FBBF24', '#F87171', '#2DD4BF', '#818CF8', '#F472B6'],
  },
};
