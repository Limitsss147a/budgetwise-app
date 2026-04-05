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

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [nameFocus, setNameFocus] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [pwFocus, setPwFocus] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) { setError('Isi semua field'); return; }
    if (password.length < 6) { setError('Password minimal 6 karakter'); return; }
    setLoading(true); setError('');
    try { await register(name.trim(), email.trim(), password); }
    catch (e: any) { setError(e.message || 'Registrasi gagal'); }
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
      <View style={[s.blob, s.blob3]} />

      <SafeAreaView style={s.safe} testID="register-screen">
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
              <Text style={[s.appTagline, { fontFamily: fonts.regular }]}>Buat akun untuk mulai mencatat</Text>
            </View>

            {/* Glass Card */}
            <BlurView intensity={isDark ? 30 : 20} tint={isDark ? 'dark' : 'light'} style={s.glassOuter}>
              <View style={[s.card, { backgroundColor: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.12)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.25)' }]}>

                <Text style={[s.cardTitle, { fontFamily: fonts.bold }]}>Daftar</Text>
                <Text style={[s.cardSubtitle, { fontFamily: fonts.regular }]}>Buat akun gratis sekarang</Text>

                {/* Error */}
                {error ? (
                  <View style={s.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#FCA5A5" />
                    <Text style={[s.errorText, { fontFamily: fonts.medium }]}>{error}</Text>
                  </View>
                ) : null}

                {/* Nama */}
                <Text style={[s.label, { fontFamily: fonts.semiBold }]}>Nama Lengkap</Text>
                <View style={[s.inputRow, nameFocus && s.inputFocused]}>
                  <Ionicons name="person-outline" size={18} color={nameFocus ? '#10B981' : 'rgba(255,255,255,0.4)'} />
                  <TextInput
                    testID="register-name-input"
                    style={[s.input, { fontFamily: fonts.regular }]}
                    placeholder="Nama Anda"
                    value={name}
                    onChangeText={setName}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    onFocus={() => setNameFocus(true)}
                    onBlur={() => setNameFocus(false)}
                  />
                </View>

                {/* Email */}
                <Text style={[s.label, { fontFamily: fonts.semiBold }]}>Email</Text>
                <View style={[s.inputRow, emailFocus && s.inputFocused]}>
                  <Ionicons name="mail-outline" size={18} color={emailFocus ? '#10B981' : 'rgba(255,255,255,0.4)'} />
                  <TextInput
                    testID="register-email-input"
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
                    testID="register-password-input"
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

                {/* Password strength hint */}
                <Text style={[s.hint, { fontFamily: fonts.regular }]}>
                  Password minimal 6 karakter
                </Text>

                {/* Submit */}
                <TouchableOpacity
                  testID="register-submit-button"
                  style={[s.btn, loading && s.btnDisabled]}
                  onPress={handleRegister}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGradient}>
                    {loading
                      ? <ActivityIndicator color="#FFF" />
                      : <>
                          <Ionicons name="person-add-outline" size={20} color="#FFF" />
                          <Text style={[s.btnText, { fontFamily: fonts.semiBold }]}>Daftar Sekarang</Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                {/* Footer */}
                <View style={s.footerRow}>
                  <Text style={[s.footerText, { fontFamily: fonts.regular }]}>Sudah punya akun?</Text>
                  <TouchableOpacity testID="go-to-login" onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Text style={[s.footerLink, { fontFamily: fonts.semiBold }]}> Masuk</Text>
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
  blob2: { width: 200, height: 200, bottom: 80, right: -60, backgroundColor: 'rgba(5,150,105,0.1)' },
  blob3: { width: 150, height: 150, top: '40%', right: -40, backgroundColor: 'rgba(16,185,129,0.07)' },

  header: { alignItems: 'center', marginBottom: 32 },
  logoRing: { width: 76, height: 76, borderRadius: 24, borderWidth: 2, padding: 3, marginBottom: 16, justifyContent: 'center', alignItems: 'center' },
  logoGradient: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  appName: { fontSize: 34, color: '#FFFFFF', letterSpacing: -0.5 },
  appTagline: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 6 },

  glassOuter: { borderRadius: 24, overflow: 'hidden' },
  card: { borderRadius: 24, padding: 28, borderWidth: 1 },
  cardTitle: { fontSize: 26, color: '#FFF', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 20 },

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

  hint: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 8 },

  btn: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.6 },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  btnText: { fontSize: 16, color: '#FFF' },

  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  footerLink: { fontSize: 14, color: '#10B981' },
});
