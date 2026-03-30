import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { fonts } from '../src/constants/fonts';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Isi semua field'); return; }
    setLoading(true); setError('');
    try { await login(email.trim(), password); }
    catch (e: any) { setError(e.message || 'Login gagal'); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.container} testID="login-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.headerSection}>
            <View style={s.logo}><Ionicons name="wallet" size={36} color="#FFF" /></View>
            <Text style={[s.appName, { fontFamily: fonts.bold }]}>BudgetWise</Text>
            <Text style={[s.subtitle, { fontFamily: fonts.regular }]}>Kelola keuanganmu dengan cerdas</Text>
          </View>

          <View style={s.card}>
            <Text style={[s.cardTitle, { fontFamily: fonts.bold }]}>Masuk</Text>

            {error ? <View style={s.errorBox}><Ionicons name="alert-circle" size={16} color="#D34A3E" /><Text style={[s.errorText, { fontFamily: fonts.medium }]}>{error}</Text></View> : null}

            <Text style={[s.label, { fontFamily: fonts.semiBold }]}>Email</Text>
            <View style={s.inputRow}>
              <Ionicons name="mail-outline" size={18} color="#7D7D7D" />
              <TextInput testID="login-email-input" style={[s.input, { fontFamily: fonts.regular }]} placeholder="email@example.com"
                value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#B0B0B0" />
            </View>

            <Text style={[s.label, { fontFamily: fonts.semiBold }]}>Password</Text>
            <View style={s.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color="#7D7D7D" />
              <TextInput testID="login-password-input" style={[s.input, { fontFamily: fonts.regular }]} placeholder="Minimal 6 karakter"
                value={password} onChangeText={setPassword} secureTextEntry={!showPw} placeholderTextColor="#B0B0B0" />
              <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color="#7D7D7D" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity testID="login-submit-button" style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={[s.btnText, { fontFamily: fonts.semiBold }]}>Masuk</Text>}
            </TouchableOpacity>

            <View style={s.footerRow}>
              <Text style={[s.footerText, { fontFamily: fonts.regular }]}>Belum punya akun?</Text>
              <TouchableOpacity testID="go-to-register" onPress={() => router.push('/register')}>
                <Text style={[s.footerLink, { fontFamily: fonts.semiBold }]}> Daftar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A4D2E' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  headerSection: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 68, height: 68, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  appName: { fontSize: 32, color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  cardTitle: { fontSize: 22, color: '#1A4D2E', marginBottom: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#D34A3E', flex: 1 },
  label: { fontSize: 13, color: '#7D7D7D', marginBottom: 6, marginTop: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F6', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#F0EBE1', gap: 10 },
  input: { flex: 1, fontSize: 15, color: '#1A4D2E', paddingVertical: 14 },
  btn: { backgroundColor: '#1A4D2E', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, color: '#FFF' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { fontSize: 14, color: '#7D7D7D' },
  footerLink: { fontSize: 14, color: '#E86A33' },
});
