// src/components/ui/LoadingScreen.tsx
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { fonts } from '../../constants/fonts';

export const LoadingScreen = () => {
  const { theme, colors } = useTheme();

  return (
    <View style={st.container}>
      {/* Premium Background Elements */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={theme === 'dark' ? ['#0A1210', '#111827', '#0A1210'] : ['#F8FAFC', '#F1F5F9', '#EFF6FF']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[st.blob, { top: -50, left: -50, backgroundColor: colors.brand, opacity: theme === 'dark' ? 0.08 : 0.12 }]} />
        <View style={[st.blob, { bottom: 100, right: -50, backgroundColor: '#10B981', opacity: theme === 'dark' ? 0.05 : 0.08 }]} />
      </View>

      <BlurView intensity={theme === 'dark' ? 30 : 50} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
        <View style={st.center}>
          <View style={[st.loaderCircle, { borderColor: colors.brand + '30', borderTopColor: colors.brand }]}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
          <Text style={[st.text, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
            Menyiapkan data Anda...
          </Text>
        </View>
      </BlurView>
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderCircle: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    borderWidth: 3, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.05)'
  },
  text: { fontSize: 13, letterSpacing: 0.5 },
  blob: { position: 'absolute', width: 300, height: 300, borderRadius: 150, filter: Platform.OS === 'ios' ? 'blur(60px)' : 'none' },
});
