// src/lib/utils.ts
import { StyleSheet } from 'react-native';

/**
 * Utility to combine styles for React Native components.
 * In React Native, simple array spread [style1, style2] is standard.
 */
export function cn(...inputs: any[]) {
  return inputs.flat().filter(Boolean);
}
