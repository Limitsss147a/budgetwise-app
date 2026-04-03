// src/components/ui/Card.tsx
import * as React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { cn } from "../../lib/utils";
import { useTheme } from "../../contexts/ThemeContext";

const Card = React.forwardRef<View, { style?: ViewStyle; children: React.ReactNode }>(
  ({ style, children, ...props }, ref) => {
    const { colors, theme } = useTheme();
    return (
      <View
        ref={ref}
        style={cn(
          {
            borderRadius: 16,
            borderWidth: 1,
            backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)',
            borderColor: colors.border,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: theme === 'dark' ? 0.2 : 0.05,
            shadowRadius: 12,
            elevation: 4,
          },
          style
        )}
        {...props}
      >
        {children}
      </View>
    );
  }
);
Card.displayName = "Card";

const CardTitle = ({ style, children }: { style?: TextStyle; children: React.ReactNode }) => {
  const { colors } = useTheme();
  return (
    <Text style={cn({ fontSize: 20, textAlign: 'center', color: colors.text, marginBottom: 20 }, style)}>
      {children}
    </Text>
  );
};

export { Card, CardTitle };
