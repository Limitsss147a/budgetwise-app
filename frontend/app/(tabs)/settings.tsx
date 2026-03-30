import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/utils/api';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import type { Settings } from '../../src/types';

export default function SettingsScreen() {
  const { colors, theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
      setProfileName(s.profile_name || user?.name || '');
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { loadSettings(); }, [loadSettings]));

  const handleSaveName = async () => {
    try {
      await api.updateSettings({ profile_name: profileName });
      Alert.alert('Berhasil', 'Nama profil disimpan');
    } catch { Alert.alert('Error', 'Gagal menyimpan'); }
  };

  const handleSetPin = async () => {
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      Alert.alert('Error', 'PIN harus 6 digit angka'); return;
    }
    try {
      await api.setPin(newPin);
      setShowPinSetup(false); setNewPin('');
      Alert.alert('Berhasil', 'PIN berhasil diatur');
      loadSettings();
    } catch { Alert.alert('Error', 'Gagal mengatur PIN'); }
  };

  const handleRemovePin = () => {
    Alert.alert('Hapus PIN', 'Yakin ingin menghapus PIN keamanan?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try { await api.removePin(); Alert.alert('Berhasil', 'PIN dihapus'); loadSettings(); }
        catch { Alert.alert('Error', 'Gagal menghapus PIN'); }
      }},
    ]);
  };

  const handleBackup = async () => {
    try {
      const data = await api.getBackup();
      Alert.alert('Backup', `Data berhasil diexport:\n${data.transactions.length} transaksi\n${data.categories.length} kategori\n${data.budgets.length} anggaran`);
    } catch { Alert.alert('Error', 'Gagal backup data'); }
  };

  const handleReset = () => {
    Alert.alert('Reset Data', 'PERINGATAN: Semua data akan dihapus permanen. Lanjutkan?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        try { await api.resetData(); Alert.alert('Berhasil', 'Semua data telah direset'); loadSettings(); }
        catch { Alert.alert('Error', 'Gagal mereset data'); }
      }},
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar dari akun?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading) {
    return <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}><View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} testID="settings-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={[s.screenTitle, { color: colors.text }]}>Pengaturan</Text>

        {/* Profil */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>Profil</Text>
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={s.profileRow}>
              <View style={[s.avatar, { backgroundColor: colors.brand }]}>
                <Ionicons name="person" size={28} color={colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.emailText, { color: colors.textTertiary }]}>{user?.email || ''}</Text>
                <TextInput testID="profile-name-input" style={[s.nameInput, { color: colors.text, backgroundColor: colors.bgSecondary }]} placeholder="Nama Anda"
                  value={profileName} onChangeText={setProfileName} placeholderTextColor={colors.textTertiary} />
              </View>
              <TouchableOpacity testID="save-profile-btn" style={[s.saveNameBtn, { backgroundColor: colors.accent }]} onPress={handleSaveName}>
                <Text style={s.saveNameText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Tampilan */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>Tampilan</Text>
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={s.settingRow}>
              <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={20} color={colors.brand} />
              <Text style={[s.settingLabel, { color: colors.text }]}>Mode Gelap</Text>
              <Switch
                testID="dark-mode-toggle"
                value={theme === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.brand }}
                thumbColor={theme === 'dark' ? colors.accent : '#f4f3f4'}
              />
            </View>
          </View>
        </View>

        {/* Keamanan */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>Keamanan</Text>
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={s.settingRow}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.brand} />
              <Text style={[s.settingLabel, { color: colors.text }]}>PIN Keamanan</Text>
              <Text style={[s.settingVal, { color: settings?.has_pin ? colors.income : colors.textTertiary }]}>
                {settings?.has_pin ? 'Aktif' : 'Nonaktif'}
              </Text>
            </View>
            <View style={s.pinActions}>
              {settings?.has_pin ? (
                <TouchableOpacity testID="remove-pin-btn" style={[s.dangerBtn, { backgroundColor: colors.expense }]} onPress={handleRemovePin}>
                  <Text style={s.dangerBtnText}>Hapus PIN</Text>
                </TouchableOpacity>
              ) : !showPinSetup ? (
                <TouchableOpacity testID="set-pin-btn" style={[s.primaryBtn, { backgroundColor: colors.brand }]} onPress={() => setShowPinSetup(true)}>
                  <Text style={s.primaryBtnText}>Atur PIN</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.pinSetupRow}>
                  <TextInput testID="new-pin-input" style={[s.pinInput, { color: colors.text, backgroundColor: colors.bgSecondary, borderColor: colors.border }]} keyboardType="numeric" maxLength={6}
                    secureTextEntry placeholder="6 digit PIN" value={newPin} onChangeText={setNewPin} placeholderTextColor={colors.textTertiary} />
                  <TouchableOpacity testID="confirm-pin-btn" style={[s.primaryBtn, { backgroundColor: colors.brand }]} onPress={handleSetPin}>
                    <Text style={s.primaryBtnText}>Simpan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowPinSetup(false); setNewPin(''); }}>
                    <Text style={[s.cancelText, { color: colors.textTertiary }]}>Batal</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>Informasi</Text>
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={s.settingRow}>
              <Ionicons name="cash-outline" size={20} color={colors.brand} />
              <Text style={[s.settingLabel, { color: colors.text }]}>Mata Uang</Text>
              <Text style={[s.settingVal, { color: colors.textTertiary }]}>IDR (Rupiah)</Text>
            </View>
            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <View style={s.settingRow}>
              <Ionicons name="information-circle-outline" size={20} color={colors.brand} />
              <Text style={[s.settingLabel, { color: colors.text }]}>Versi Aplikasi</Text>
              <Text style={[s.settingVal, { color: colors.textTertiary }]}>1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Data */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>Data</Text>
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <TouchableOpacity testID="backup-btn" style={s.settingRow} onPress={handleBackup}>
              <Ionicons name="cloud-download-outline" size={20} color={colors.brand} />
              <Text style={[s.settingLabel, { color: colors.text }]}>Backup Data</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity testID="reset-btn" style={s.settingRow} onPress={handleReset}>
              <Ionicons name="trash-outline" size={20} color={colors.expense} />
              <Text style={[s.settingLabel, { color: colors.expense }]}>Reset Semua Data</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.expense} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity testID="logout-btn" style={[s.logoutBtn, { backgroundColor: colors.bgCard, borderColor: colors.expense }]} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={colors.expense} />
          <Text style={[s.logoutText, { color: colors.expense }]}>Keluar dari Akun</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  screenTitle: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  card: { borderRadius: 14, padding: 16, borderWidth: 1 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  emailText: { fontSize: 12, marginBottom: 4 },
  nameInput: { fontSize: 15, fontWeight: '500', padding: 8, borderRadius: 8 },
  saveNameBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  saveNameText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  settingLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  settingVal: { fontSize: 13, fontWeight: '500' },
  divider: { height: 1, marginVertical: 12 },
  pinActions: { marginTop: 12 },
  pinSetupRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pinInput: { flex: 1, fontSize: 16, fontWeight: '600', padding: 10, borderRadius: 8, borderWidth: 1, letterSpacing: 8, textAlign: 'center', minWidth: 150 },
  primaryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  dangerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: 'flex-start' },
  dangerBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  cancelText: { fontSize: 13, fontWeight: '500', paddingVertical: 10 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, marginTop: 4 },
  logoutText: { fontSize: 16, fontWeight: '600' },
});
