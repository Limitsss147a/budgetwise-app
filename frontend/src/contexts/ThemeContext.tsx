import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import SafeStorage from '../utils/storage';
import { themes, ThemeColors } from '../constants/colors';

interface ThemeContextType {
  theme: string;
  colors: ThemeColors;
  toggleTheme: () => void;
  setThemeMode: (mode: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light', colors: themes.light, toggleTheme: () => {}, setThemeMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    SafeStorage.getItem('theme').then(t => { if (t && themes[t]) setTheme(t); }).catch(() => {});
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    SafeStorage.setItem('theme', next);
  };

  const setThemeMode = (mode: string) => {
    if (themes[mode]) { setTheme(mode); SafeStorage.setItem('theme', mode); }
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: themes[theme], toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
