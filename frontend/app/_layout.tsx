import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { api } from '../src/utils/api';

SplashScreen.preventAutoHideAsync();

function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const handleDot = (num: string) => {
    if (pin.length < 6) {
      const np = pin + num;
      setPin(np);
      setError('');
      if (np.length === 6) {
        api.verifyPin(np).then(() => onUnlock()).catch(() => { setError('PIN salah'); setPin(''); });
      }
    }
  };
  const keys = ['1','2','3','4','5','6','7','8','9','','0','del'];
  return (
    <SafeAreaView style={[ps.container, { backgroundColor: colors.bg }]}>
      <View style={ps.content}>
        <View style={[ps.iconCircle, { backgroundColor: colors.brand }]}><Text style={ps.lockIcon}>🔒</Text></View>
        <Text style={[ps.title, { color: colors.text, fontFamily: 'Poppins_700Bold' }]}>Masukkan PIN</Text>
        <Text style={[ps.subtitle, { color: colors.textTertiary, fontFamily: 'Poppins_400Regular' }]}>Masukkan 6 digit PIN Anda</Text>
        <View style={ps.dotsRow}>{[0,1,2,3,4,5].map(i => <View key={i} style={[ps.dot, { borderColor: colors.brand }, i < pin.length && { backgroundColor: colors.brand }]} />)}</View>
        {error ? <Text style={[ps.error, { fontFamily: 'Poppins_500Medium' }]}>{error}</Text> : <View style={{ height: 20 }} />}
        <View style={ps.keypad}>{keys.map((k, i) => (
          <TouchableOpacity key={i} testID={`pin-key-${k||'empty'}`} style={[ps.key, { backgroundColor: colors.bgCard }, !k && { backgroundColor: 'transparent' }]}
            onPress={() => { if (k === 'del') { setPin(p => p.slice(0,-1)); setError(''); } else if (k) handleDot(k); }} disabled={!k} activeOpacity={0.6}>
            <Text style={[ps.keyText, { color: colors.text, fontFamily: 'Poppins_600SemiBold' }]}>{k === 'del' ? '⌫' : k}</Text>
          </TouchableOpacity>
        ))}</View>
      </View>
    </SafeAreaView>
  );
}

function AuthGate() {
  const { user, isLoading } = useAuth();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const [pinRequired, setPinRequired] = useState(false);
  const [pinChecked, setPinChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === 'login' || segments[0] === 'register';
    if (!user && !inAuth) router.replace('/login');
    else if (user && inAuth) router.replace('/');
  }, [user, isLoading, segments]);

  useEffect(() => {
    if (user && !pinChecked) {
      api.getSettings().then(s => {
        setPinRequired(s.has_pin);
        if (!s.has_pin) setUnlocked(true);
        setPinChecked(true);
      }).catch(() => { setUnlocked(true); setPinChecked(true); });
    }
  }, [user, pinChecked]);

  // Handle notification tap - navigate to Reports
  useEffect(() => {
    if (Platform.OS === 'web') return;
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.screen === 'reports') {
        router.push('/(tabs)/reports' as any);
      }
    });
    return () => {
      if (notificationResponseListener.current) {
        Notifications.removeNotificationSubscription(notificationResponseListener.current);
      }
    };
  }, [router]);

  if (isLoading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }

  if (user && pinRequired && !unlocked) {
    return <><StatusBar style={theme === 'dark' ? 'light' : 'dark'} /><PinLock onUnlock={() => setUnlocked(true)} /></>;
  }

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-transaction" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  );
}

const ps = StyleSheet.create({
  container: { flex: 1 }, content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  lockIcon: { fontSize: 32 }, title: { fontSize: 24, fontWeight: '700', marginBottom: 6 }, subtitle: { fontSize: 14, marginBottom: 32 },
  dotsRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, backgroundColor: 'transparent' },
  error: { color: '#D34A3E', fontSize: 13, height: 20 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 264, justifyContent: 'center', marginTop: 16 },
  key: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', margin: 8 },
  keyText: { fontSize: 26 },
});
