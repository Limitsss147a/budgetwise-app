import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/utils/api';
import type { Settings } from '../../src/types';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
      setProfileName(s.profile_name || '');
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

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

  if (loading) {
    return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color="#1A4D2E" /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.container} testID="settings-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.screenTitle}>Pengaturan</Text>

        {/* Profil */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Profil</Text>
          <View style={s.card}>
            <View style={s.profileRow}>
              <View style={s.avatar}>
                <Ionicons name="person" size={28} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput testID="profile-name-input" style={s.nameInput} placeholder="Nama Anda"
                  value={profileName} onChangeText={setProfileName} placeholderTextColor="#7D7D7D" />
              </View>
              <TouchableOpacity testID="save-profile-btn" style={s.saveNameBtn} onPress={handleSaveName}>
                <Text style={s.saveNameText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Keamanan */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Keamanan</Text>
          <View style={s.card}>
            <View style={s.settingRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#1A4D2E" />
              <Text style={s.settingLabel}>PIN Keamanan</Text>
              <Text style={[s.settingVal, { color: settings?.has_pin ? '#3A6E4B' : '#7D7D7D' }]}>
                {settings?.has_pin ? 'Aktif' : 'Nonaktif'}
              </Text>
            </View>
            <View style={s.pinActions}>
              {settings?.has_pin ? (
                <TouchableOpacity testID="remove-pin-btn" style={s.dangerBtn} onPress={handleRemovePin}>
                  <Text style={s.dangerBtnText}>Hapus PIN</Text>
                </TouchableOpacity>
              ) : !showPinSetup ? (
                <TouchableOpacity testID="set-pin-btn" style={s.primaryBtn} onPress={() => setShowPinSetup(true)}>
                  <Text style={s.primaryBtnText}>Atur PIN</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.pinSetupRow}>
                  <TextInput testID="new-pin-input" style={s.pinInput} keyboardType="numeric" maxLength={6}
                    secureTextEntry placeholder="6 digit PIN" value={newPin} onChangeText={setNewPin} placeholderTextColor="#7D7D7D" />
                  <TouchableOpacity testID="confirm-pin-btn" style={s.primaryBtn} onPress={handleSetPin}>
                    <Text style={s.primaryBtnText}>Simpan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowPinSetup(false); setNewPin(''); }}>
                    <Text style={s.cancelText}>Batal</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Informasi</Text>
          <View style={s.card}>
            <View style={s.settingRow}>
              <Ionicons name="cash-outline" size={20} color="#1A4D2E" />
              <Text style={s.settingLabel}>Mata Uang</Text>
              <Text style={s.settingVal}>IDR (Rupiah)</Text>
            </View>
            <View style={s.divider} />
            <View style={s.settingRow}>
              <Ionicons name="information-circle-outline" size={20} color="#1A4D2E" />
              <Text style={s.settingLabel}>Versi Aplikasi</Text>
              <Text style={s.settingVal}>1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Data */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Data</Text>
          <View style={s.card}>
            <TouchableOpacity testID="backup-btn" style={s.settingRow} onPress={handleBackup}>
              <Ionicons name="cloud-download-outline" size={20} color="#1A4D2E" />
              <Text style={s.settingLabel}>Backup Data</Text>
              <Ionicons name="chevron-forward" size={18} color="#7D7D7D" />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity testID="reset-btn" style={s.settingRow} onPress={handleReset}>
              <Ionicons name="trash-outline" size={20} color="#D34A3E" />
              <Text style={[s.settingLabel, { color: '#D34A3E' }]}>Reset Semua Data</Text>
              <Ionicons name="chevron-forward" size={18} color="#D34A3E" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  screenTitle: { fontSize: 24, fontWeight: '700', color: '#1A4D2E', marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#7D7D7D', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F0EBE1' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1A4D2E', justifyContent: 'center', alignItems: 'center' },
  nameInput: { fontSize: 15, color: '#1A4D2E', fontWeight: '500', padding: 8, backgroundColor: '#F9F9F6', borderRadius: 8 },
  saveNameBtn: { backgroundColor: '#E86A33', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  saveNameText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  settingLabel: { flex: 1, fontSize: 14, color: '#1A4D2E', fontWeight: '500' },
  settingVal: { fontSize: 13, color: '#7D7D7D', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F0EBE1', marginVertical: 12 },
  pinActions: { marginTop: 12 },
  pinSetupRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pinInput: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1A4D2E', padding: 10, backgroundColor: '#F9F9F6', borderRadius: 8, borderWidth: 1, borderColor: '#F0EBE1', letterSpacing: 8, textAlign: 'center', minWidth: 150 },
  primaryBtn: { backgroundColor: '#1A4D2E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  dangerBtn: { backgroundColor: '#D34A3E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: 'flex-start' },
  dangerBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  cancelText: { fontSize: 13, color: '#7D7D7D', fontWeight: '500', paddingVertical: 10 },
});
