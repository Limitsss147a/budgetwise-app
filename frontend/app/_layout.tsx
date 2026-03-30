import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { api } from '../src/utils/api';

function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleDot = (num: string) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      setError('');
      if (newPin.length === 6) {
        api.verifyPin(newPin).then(() => onUnlock()).catch(() => {
          setError('PIN salah. Coba lagi.');
          setPin('');
        });
      }
    }
  };

  const handleDelete = () => { setPin(p => p.slice(0, -1)); setError(''); };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del'];

  return (
    <SafeAreaView style={ps.container}>
      <View style={ps.content}>
        <View style={ps.iconCircle}>
          <Text style={ps.lockIcon}>🔒</Text>
        </View>
        <Text style={ps.title}>Masukkan PIN</Text>
        <Text style={ps.subtitle}>Masukkan 6 digit PIN Anda</Text>
        <View style={ps.dotsRow}>
          {[0,1,2,3,4,5].map(i => (
            <View key={i} style={[ps.dot, i < pin.length && ps.dotFilled]} />
          ))}
        </View>
        {error ? <Text style={ps.error}>{error}</Text> : <View style={{ height: 20 }} />}
        <View style={ps.keypad}>
          {keys.map((key, idx) => (
            <TouchableOpacity
              key={idx}
              testID={`pin-key-${key || 'empty'}`}
              style={[ps.key, !key && ps.keyHidden]}
              onPress={() => { if (key === 'del') handleDelete(); else if (key) handleDot(key); }}
              disabled={!key}
              activeOpacity={0.6}
            >
              <Text style={[ps.keyText, key === 'del' && ps.delText]}>
                {key === 'del' ? '⌫' : key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasPIN, setHasPIN] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then(s => { setHasPIN(s.has_pin); if (!s.has_pin) setIsUnlocked(true); })
      .catch(() => setIsUnlocked(true))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F6' }}>
        <ActivityIndicator size="large" color="#1A4D2E" />
      </View>
    );
  }

  if (hasPIN && !isUnlocked) {
    return (
      <>
        <StatusBar style="dark" />
        <PinLock onUnlock={() => setIsUnlocked(true)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-transaction" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F6' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1A4D2E', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  lockIcon: { fontSize: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A4D2E', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#7D7D7D', marginBottom: 32 },
  dotsRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#1A4D2E', backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: '#1A4D2E' },
  error: { color: '#D34A3E', fontSize: 13, height: 20, marginBottom: 0 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 264, justifyContent: 'center', marginTop: 16 },
  key: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', margin: 8, backgroundColor: '#FFFFFF', shadowColor: '#1A4D2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  keyHidden: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  keyText: { fontSize: 26, fontWeight: '600', color: '#1A4D2E' },
  delText: { fontSize: 22 },
});
