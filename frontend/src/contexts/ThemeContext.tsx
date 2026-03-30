import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    AsyncStorage.getItem('theme').then(t => { if (t && themes[t]) setTheme(t); });
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    AsyncStorage.setItem('theme', next);
  };

  const setThemeMode = (mode: string) => {
    if (themes[mode]) { setTheme(mode); AsyncStorage.setItem('theme', mode); }
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: themes[theme], toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
