import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { fonts } from '../src/constants/fonts';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { colors, theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [pwFocus, setPwFocus] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Isi semua field'); return; }
    setLoading(true); setError('');
    try { await login(email.trim(), password); }
    catch (e: any) { setError(e.message || 'Login gagal'); }
    finally { setLoading(false); }
  };

  const isDark = theme === 'dark';

  return (
    <View style={s.root}>
      {/* Background Gradient */}
      <LinearGradient
        colors={isDark ? ['#060D09', '#0A1A12', '#060D09'] : ['#0A2918', '#1A4D2E', '#0A2918']}
        style={StyleSheet.absoluteFill}
      />
      {/* Decorative blobs */}
      <View style={[s.blob, s.blob1]} />
      <View style={[s.blob, s.blob2]} />

      <SafeAreaView style={s.safe} testID="login-screen">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Logo & Title */}
            <View style={s.header}>
              <View style={[s.logoRing, { borderColor: 'rgba(16,185,129,0.4)' }]}>
                <LinearGradient colors={['#10B981', '#059669']} style={s.logoGradient}>
                  <Ionicons name="wallet" size={32} color="#FFF" />
                </LinearGradient>
              </View>
              <Text style={[s.appName, { fontFamily: fonts.bold }]}>BudgetWise</Text>
              <Text style={[s.appTagline, { fontFamily: fonts.regular }]}>Kelola keuanganmu dengan cerdas</Text>
            </View>

            {/* Glass Card */}
            <BlurView intensity={isDark ? 30 : 20} tint={isDark ? 'dark' : 'light'} style={s.glassOuter}>
              <View style={[s.card, { backgroundColor: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.12)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.25)' }]}>

                <Text style={[s.cardTitle, { fontFamily: fonts.bold, color: '#FFF' }]}>Masuk</Text>
                <Text style={[s.cardSubtitle, { fontFamily: fonts.regular }]}>Selamat datang kembali!</Text>

                {/* Error */}
                {error ? (
                  <View style={s.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#FCA5A5" />
                    <Text style={[s.errorText, { fontFamily: fonts.medium }]}>{error}</Text>
                  </View>
                ) : null}

                {/* Email */}
                <Text style={[s.label, { fontFamily: fonts.semiBold }]}>Email</Text>
                <View style={[s.inputRow, emailFocus && s.inputFocused]}>
                  <Ionicons name="mail-outline" size={18} color={emailFocus ? '#10B981' : 'rgba(255,255,255,0.4)'} />
                  <TextInput
                    testID="login-email-input"
                    style={[s.input, { fontFamily: fonts.regular }]}
                    placeholder="email@example.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    onFocus={() => setEmailFocus(true)}
                    onBlur={() => setEmailFocus(false)}
                  />
                </View>

                {/* Password */}
                <Text style={[s.label, { fontFamily: fonts.semiBold }]}>Password</Text>
                <View style={[s.inputRow, pwFocus && s.inputFocused]}>
                  <Ionicons name="lock-closed-outline" size={18} color={pwFocus ? '#10B981' : 'rgba(255,255,255,0.4)'} />
                  <TextInput
                    testID="login-password-input"
                    style={[s.input, { fontFamily: fonts.regular }]}
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPw}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    onFocus={() => setPwFocus(true)}
                    onBlur={() => setPwFocus(false)}
                  />
                  <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </View>

                {/* Submit */}
                <TouchableOpacity
                  testID="login-submit-button"
                  style={[s.btn, loading && s.btnDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGradient}>
                    {loading
                      ? <ActivityIndicator color="#FFF" />
                      : <>
                          <Ionicons name="log-in-outline" size={20} color="#FFF" />
                          <Text style={[s.btnText, { fontFamily: fonts.semiBold }]}>Masuk</Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                {/* Footer */}
                <View style={s.footerRow}>
                  <Text style={[s.footerText, { fontFamily: fonts.regular }]}>Belum punya akun?</Text>
                  <TouchableOpacity testID="go-to-register" onPress={() => router.push('/register')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Text style={[s.footerLink, { fontFamily: fonts.semiBold }]}> Daftar</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </BlurView>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  blob: { position: 'absolute', borderRadius: 999 },
  blob1: { width: 280, height: 280, top: -80, left: -80, backgroundColor: 'rgba(16,185,129,0.15)' },
  blob2: { width: 200, height: 200, bottom: 60, right: -60, backgroundColor: 'rgba(5,150,105,0.1)' },

  header: { alignItems: 'center', marginBottom: 36 },
  logoRing: { width: 76, height: 76, borderRadius: 24, borderWidth: 2, padding: 3, marginBottom: 16, justifyContent: 'center', alignItems: 'center' },
  logoGradient: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  appName: { fontSize: 34, color: '#FFFFFF', letterSpacing: -0.5 },
  appTagline: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 6 },

  glassOuter: { borderRadius: 24, overflow: 'hidden' },
  card: { borderRadius: 24, padding: 28, borderWidth: 1 },
  cardTitle: { fontSize: 26, color: '#FFF', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 12,
    padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { fontSize: 13, color: '#FCA5A5', flex: 1 },

  label: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8, marginTop: 16, letterSpacing: 0.5, textTransform: 'uppercase' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14,
    paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  inputFocused: { borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.08)' },
  input: { flex: 1, fontSize: 15, color: '#FFFFFF', paddingVertical: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) },

  btn: { marginTop: 28, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.6 },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  btnText: { fontSize: 16, color: '#FFF' },

  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  footerLink: { fontSize: 14, color: '#10B981' },
});
