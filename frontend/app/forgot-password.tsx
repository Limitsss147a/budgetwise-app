import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/contexts/ThemeContext';
import { fonts } from '../src/constants/fonts';
import { api } from '../src/utils/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [email, setEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim() || !recoveryKey.trim() || !newPassword.trim()) {
      Alert.alert('Peringatan', 'Semua kolom wajib diisi');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Peringatan', 'Password baru minimal 8 karakter');
      return;
    }

    try {
      setLoading(true);
      await api.forgotPassword({ 
        email: email.trim(), 
        recovery_key: recoveryKey.trim(), 
        new_password: newPassword 
      });
      Alert.alert(
        'Berhasil', 
        'Password Anda telah berhasil direset. Silakan login menggunakan password baru.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal mereset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { borderColor: colors.border }]}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: colors.brand + '20' }]}>
              <Ionicons name="key-outline" size={32} color={colors.brand} />
            </View>
            <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>Lupa Password?</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
              Gunakan Recovery Key Anda untuk mereset password secara mandiri.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.medium }]}>Email Akun</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, fontFamily: fonts.regular }]}
                placeholder="Masukkan email Anda"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.medium }]}>Recovery Key</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, fontFamily: fonts.bold }]}
                placeholder="BDGT-XXXX-XXXX"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                value={recoveryKey}
                onChangeText={setRecoveryKey}
              />
              <Text style={[styles.hint, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                Masukkan kode pemulihan yang diberikan saat pendaftaran.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.medium }]}>Password Baru</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, fontFamily: fonts.regular }]}
                placeholder="Minimal 8 karakter"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>

            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: colors.brand }, loading && styles.btnDisabled]} 
              onPress={handleReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={[styles.btnText, { fontFamily: fonts.semiBold }]}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24 },
  backBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  header: { marginBottom: 32 },
  iconBox: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, marginBottom: 12 },
  subtitle: { fontSize: 15, lineHeight: 24 },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 16 },
  hint: { fontSize: 12, marginTop: 4 },
  btn: { borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 12 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#FFF', fontSize: 16 },
});
