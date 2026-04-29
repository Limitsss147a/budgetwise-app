import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Switch, ActivityIndicator, Platform, Modal, Pressable } from 'react-native';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../src/utils/api';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { fonts } from '../../src/constants/fonts';
import { requestNotificationPermissions, scheduleWeeklyReport, cancelWeeklyReport, sendTestNotification, getDayName } from '../../src/services/notifications';
import type { Settings } from '../../src/types';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [weeklyDay, setWeeklyDay] = useState(1);
  const [weeklyHour, setWeeklyHour] = useState(9);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [pinError, setPinError] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [hasBiometricHardware, setHasBiometricHardware] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const [s, bio] = await Promise.all([
        api.getSettings(),
        AsyncStorage.getItem('biometric_enabled')
      ]);
      setSettings(s);
      setProfileName(s.profile_name || user?.name || '');
      setWeeklyEnabled(s.weekly_report_enabled || false);
      setWeeklyDay(s.weekly_report_day || 1);
      setWeeklyHour(s.weekly_report_hour || 9);
      setBiometricEnabled(bio === 'true');
      
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      setHasBiometricHardware(hasHardware);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { loadSettings(); }, [loadSettings]));

  const handleSaveName = async () => {
    setProfileError('');
    try {
      await api.updateSettings({ profile_name: profileName });
      Toast.show({ type: 'success', text1: 'Nama profil disimpan' });
    } catch { setProfileError('Gagal menyimpan profil'); }
  };

  const handleSetPin = async () => {
    setPinError('');
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setPinError('PIN harus 6 digit angka'); return;
    }
    try {
      await api.setPin(newPin);
      setShowPinSetup(false); setNewPin('');
      Toast.show({ type: 'success', text1: 'PIN berhasil diatur' });
      loadSettings();
    } catch { setPinError('Gagal mengatur PIN'); }
  };

  const handleRemovePin = () => {
    Alert.alert('Hapus PIN', 'Yakin ingin menghapus PIN keamanan?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try { 
          await api.removePin(); 
          Toast.show({ type: 'success', text1: 'PIN dihapus' }); 
          loadSettings(); 
        } catch { Toast.show({ type: 'error', text1: 'Gagal menghapus PIN' }); }
      }},
    ]);
  };

  const handleBackup = async () => {
    try {
      const data = await api.getBackup();
      const summary = `${data.transactions.length} transaksi, ${data.categories.length} kategori, ${data.budgets.length} anggaran`;
      if (Platform.OS === 'web') {
        Alert.alert('Backup Berhasil', summary);
        return;
      }
      const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      const fileUri = `${FileSystem.cacheDirectory}budgetwise-backup-${ts}.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Simpan Backup BudgetWise' });
      } else {
        Alert.alert('Backup Tersimpan', `${summary}\nFile: ${fileUri}`);
      }
    } catch (e: any) {
      console.error('[Settings] backup error', e);
      Toast.show({ type: 'error', text1: 'Gagal backup data', text2: e?.message });
    }
  };

  const handleReset = () => {
    Alert.alert('Reset Data', 'PERINGATAN: Semua data akan dihapus permanen. Lanjutkan?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        try { 
          await api.resetData(); 
          Toast.show({ type: 'success', text1: 'Semua data telah direset' }); 
          loadSettings(); 
        } catch { Toast.show({ type: 'error', text1: 'Gagal mereset data' }); }
      }},
    ]);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      setShowLogoutConfirm(false);
      router.replace('/login');
    } catch (error) {
      console.error('[Settings] Logout failed:', error);
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const handleToggleWeeklyReport = async (enabled: boolean) => {
    setWeeklyEnabled(enabled);
    if (enabled) {
      if (Platform.OS === 'web') {
        Toast.show({ type: 'info', text1: 'Notifikasi hanya tersedia di mobile' });
        setWeeklyEnabled(false);
        return;
      }
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Izin Ditolak', 'Aktifkan izin notifikasi di Pengaturan perangkat');
        setWeeklyEnabled(false);
        return;
      }
      await scheduleWeeklyReport(weeklyDay, weeklyHour);
      await api.updateSettings({ weekly_report_enabled: true, weekly_report_day: weeklyDay, weekly_report_hour: weeklyHour });
      Toast.show({ type: 'success', text1: `Laporan dijadwalkan ${getDayName(weeklyDay)} ${weeklyHour}:00` });
    } else {
      await cancelWeeklyReport();
      await api.updateSettings({ weekly_report_enabled: false });
    }
  };

  const handleDayChange = async (newDay: number) => {
    setWeeklyDay(newDay);
    if (weeklyEnabled) {
      await scheduleWeeklyReport(newDay, weeklyHour);
      await api.updateSettings({ weekly_report_day: newDay });
    }
  };

  const handleHourChange = async (newHour: number) => {
    setWeeklyHour(newHour);
    if (weeklyEnabled) {
      await scheduleWeeklyReport(weeklyDay, newHour);
      await api.updateSettings({ weekly_report_hour: newHour });
    }
  };

  const handleTestNotification = async () => {
    if (Platform.OS === 'web') {
      Toast.show({ type: 'info', text1: 'Notifikasi hanya tersedia di mobile' });
      return;
    }
    const granted = await requestNotificationPermissions();
    if (!granted) {
      Alert.alert('Izin Ditolak', 'Aktifkan izin notifikasi di Pengaturan perangkat');
      return;
    }
    await sendTestNotification();
    Toast.show({ type: 'success', text1: 'Notifikasi contoh terkirim!' });
  };

  const handleToggleBiometric = async (val: boolean) => {
    try {
      if (val) {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!enrolled) {
          Alert.alert('Gagal', 'Belum ada data biometrik di perangkat ini');
          return;
        }
      }
      setBiometricEnabled(val);
      await AsyncStorage.setItem('biometric_enabled', String(val));
      Toast.show({ type: 'success', text1: val ? 'Biometrik diaktifkan' : 'Biometrik dinonaktifkan' });
    } catch (e) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Gagal mengatur biometrik' });
    }
  };

  if (loading) {
    return <SafeAreaView style={[st.container, { backgroundColor: colors.bg }]}><View style={st.center}><ActivityIndicator size="large" color={colors.brand} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[st.container, { backgroundColor: colors.bg }]} testID="settings-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
        <Text style={[st.screenTitle, { color: colors.text, fontFamily: fonts.bold }]}>Pengaturan</Text>

        {/* Profil */}
        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Profil</Text>
          <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={st.profileRow}>
              <View style={[st.avatar, { backgroundColor: colors.brand }]}>
                <Ionicons name="person" size={28} color={colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.emailText, { color: theme === 'dark' ? '#D1D5DB' : colors.textSecondary, fontFamily: fonts.regular }]}>{user?.email || ''}</Text>
                <TextInput testID="profile-name-input" style={[st.nameInput, { color: colors.text, backgroundColor: colors.bgSecondary, fontFamily: fonts.medium }]} placeholder="Nama Anda"
                  value={profileName} onChangeText={t => { setProfileName(t); setProfileError(''); }} placeholderTextColor={colors.textTertiary} />
                {profileError ? <Text style={{ color: colors.expense, fontSize: 11, marginTop: 4, fontFamily: fonts.medium }}>{profileError}</Text> : null}
              </View>
              <TouchableOpacity testID="save-profile-btn" style={[st.saveNameBtn, { backgroundColor: colors.accent }]} onPress={handleSaveName}>
                <Text style={[st.saveNameText, { fontFamily: fonts.semiBold }]}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Investasi (Moved from Tab Bar) */}
        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Investasi</Text>
          <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <TouchableOpacity testID="go-to-portfolio-btn" style={st.settingRow} onPress={() => router.push('/(tabs)/portfolio')}>
              <Ionicons name="pie-chart-outline" size={20} color={colors.brand} />
              <Text style={[st.settingLabel, { color: colors.text, fontFamily: fonts.medium }]}>Portofolio Saham</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tampilan */}
        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Tampilan</Text>
          <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={st.settingRow}>
              <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={20} color={colors.brand} />
              <Text style={[st.settingLabel, { color: colors.text, fontFamily: fonts.medium }]}>Mode Gelap</Text>
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

        {/* Notifikasi */}
        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Notifikasi</Text>
          <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={st.settingRow}>
              <Ionicons name="notifications-outline" size={20} color={colors.brand} />
              <Text style={[st.settingLabel, { color: colors.text, fontFamily: fonts.medium }]}>Laporan Mingguan</Text>
              <Switch
                testID="weekly-report-toggle"
                value={weeklyEnabled}
                onValueChange={handleToggleWeeklyReport}
                trackColor={{ false: colors.border, true: colors.brand }}
                thumbColor={weeklyEnabled ? colors.accent : '#f4f3f4'}
              />
            </View>
            {weeklyEnabled && (
              <>
                <View style={[st.divider, { backgroundColor: colors.border }]} />
                <View style={{ paddingVertical: 8 }}>
                  <Text style={[st.subLabel, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Hari Pengiriman</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {[1,2,3,4,5,6,7].map(d => (
                      <TouchableOpacity key={d} testID={`day-${d}`}
                        style={[st.dayPill, { backgroundColor: colors.bgSecondary, borderColor: colors.border }, weeklyDay === d && { backgroundColor: colors.brand, borderColor: colors.brand }]}
                        onPress={() => handleDayChange(d)}>
                        <Text style={[st.dayText, { color: colors.textTertiary, fontFamily: fonts.medium }, weeklyDay === d && { color: colors.textInverse }]}>{getDayName(d)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{ paddingVertical: 8 }}>
                  <Text style={[st.subLabel, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Jam Pengiriman</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {[7,8,9,10,12,14,17,19,21].map(h => (
                      <TouchableOpacity key={h} testID={`hour-${h}`}
                        style={[st.dayPill, { backgroundColor: colors.bgSecondary, borderColor: colors.border }, weeklyHour === h && { backgroundColor: colors.brand, borderColor: colors.brand }]}
                        onPress={() => handleHourChange(h)}>
                        <Text style={[st.dayText, { color: colors.textTertiary, fontFamily: fonts.medium }, weeklyHour === h && { color: colors.textInverse }]}>{h}:00</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={[st.divider, { backgroundColor: colors.border }]} />
                <TouchableOpacity testID="test-notification-btn" style={[st.testNotifBtn, { backgroundColor: colors.bgSecondary }]} onPress={handleTestNotification} activeOpacity={0.7}>
                  <Ionicons name="paper-plane-outline" size={16} color={colors.brand} />
                  <Text style={[st.testNotifText, { color: colors.brand, fontFamily: fonts.semiBold }]}>Kirim Notifikasi Contoh</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Keamanan */}
        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Keamanan</Text>
          <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={st.settingRow}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.brand} />
              <Text style={[st.settingLabel, { color: colors.text, fontFamily: fonts.medium }]}>PIN Keamanan</Text>
              <Text style={[st.settingVal, { color: settings?.has_pin ? colors.income : colors.textTertiary, fontFamily: fonts.medium }]}>
                {settings?.has_pin ? 'Aktif' : 'Nonaktif'}
              </Text>
            </View>

            {settings?.has_pin && hasBiometricHardware && (
              <>
                <View style={[st.divider, { backgroundColor: colors.border }]} />
                <View style={st.settingRow}>
                  <Ionicons name="finger-print-outline" size={20} color={colors.brand} />
                  <Text style={[st.settingLabel, { color: colors.text, fontFamily: fonts.medium }]}>Gunakan Biometrik</Text>
                  <Switch
                    testID="biometric-toggle"
                    value={biometricEnabled}
                    onValueChange={handleToggleBiometric}
                    trackColor={{ false: colors.border, true: colors.brand }}
                    thumbColor={biometricEnabled ? colors.accent : '#f4f3f4'}
                  />
                </View>
              </>
            )}

            <View style={st.pinActions}>
              {settings?.has_pin ? (
                <TouchableOpacity testID="remove-pin-btn" style={[st.dangerBtn, { backgroundColor: colors.expense }]} onPress={handleRemovePin}>
                  <Text style={[st.dangerBtnText, { fontFamily: fonts.semiBold }]}>Hapus PIN</Text>
                </TouchableOpacity>
              ) : !showPinSetup ? (
                <TouchableOpacity testID="set-pin-btn" style={[st.primaryBtn, { backgroundColor: colors.brand }]} onPress={() => setShowPinSetup(true)}>
                  <Text style={[st.primaryBtnText, { fontFamily: fonts.semiBold }]}>Atur PIN</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={st.pinSetupRow}>
                    <TextInput testID="new-pin-input" style={[st.pinInput, { color: colors.text, backgroundColor: colors.bgSecondary, borderColor: colors.border, fontFamily: fonts.semiBold }]} keyboardType="numeric" maxLength={6}
                    secureTextEntry placeholder="6 digit PIN" value={newPin} onChangeText={t => { setNewPin(t); setPinError(''); }} placeholderTextColor={colors.textTertiary} />
                    <TouchableOpacity testID="confirm-pin-btn" style={[st.primaryBtn, { backgroundColor: colors.brand }]} onPress={handleSetPin}>
                      <Text style={[st.primaryBtnText, { fontFamily: fonts.semiBold }]}>Simpan</Text>
                    </TouchableOpacity>
                  </View>
                  {pinError ? <Text style={{ color: colors.expense, fontSize: 11, marginTop: 8, fontFamily: fonts.medium }}>{pinError}</Text> : null}
                  <TouchableOpacity onPress={() => { setShowPinSetup(false); setNewPin(''); setPinError(''); }} style={{ marginTop: 8 }}>
                    <Text style={[st.cancelText, { color: colors.textTertiary, fontFamily: fonts.medium }]}>Batal</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Informasi</Text>
          <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={st.settingRow}>
              <Ionicons name="cash-outline" size={20} color={colors.brand} />
              <Text style={[st.settingLabel, { color: colors.text, fontFamily: fonts.medium }]}>Mata Uang</Text>
              <Text style={[st.settingVal, { color: colors.textTertiary, fontFamily: fonts.regular }]}>IDR (Rupiah)</Text>
            </View>
            <View style={[st.divider, { backgroundColor: colors.border }]} />
            <View style={st.settingRow}>
              <Ionicons name="information-circle-outline" size={20} color={colors.brand} />
              <Text style={[st.settingLabel, { color: colors.text, fontFamily: fonts.medium }]}>Versi Aplikasi</Text>
              <Text style={[st.settingVal, { color: colors.textTertiary, fontFamily: fonts.regular }]}>1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Data */}
        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Data</Text>
          <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <TouchableOpacity testID="backup-btn" style={st.settingRow} onPress={handleBackup}>
              <Ionicons name="cloud-download-outline" size={20} color={colors.brand} />
              <Text style={[st.settingLabel, { color: colors.text, fontFamily: fonts.medium }]}>Backup Data</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            <View style={[st.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity testID="reset-btn" style={st.settingRow} onPress={handleReset}>
              <Ionicons name="trash-outline" size={20} color={colors.expense} />
              <Text style={[st.settingLabel, { color: colors.expense, fontFamily: fonts.medium }]}>Reset Semua Data</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.expense} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity testID="logout-btn" style={[st.logoutBtn, { backgroundColor: colors.bgCard, borderColor: colors.expense }]} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={colors.expense} />
          <Text style={[st.logoutText, { color: colors.expense, fontFamily: fonts.semiBold }]}>Keluar dari Akun</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutConfirm} transparent animationType="fade" onRequestClose={() => setShowLogoutConfirm(false)}>
        <View style={st.modalOverlay}>
          <Pressable style={st.modalBackdrop} onPress={() => !loggingOut && setShowLogoutConfirm(false)} />
          <View style={[st.confirmDialog, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(239,68,68,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="log-out-outline" size={26} color={colors.expense} />
              </View>
              <Text style={[st.confirmTitle, { color: colors.text, fontFamily: fonts.bold }]}>Keluar dari Akun</Text>
              <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                Yakin ingin keluar dari akun Anda?
              </Text>
            </View>
            <View style={st.confirmActions}>
              <TouchableOpacity
                style={[st.confirmBtn, { borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
              >
                <Text style={[st.confirmBtnText, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.confirmBtn, { backgroundColor: colors.expense }]}
                onPress={confirmLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[st.confirmBtnText, { color: '#FFF', fontFamily: fonts.semiBold }]}>Keluar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 140 },
  screenTitle: { fontSize: 24, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  card: { borderRadius: 14, padding: 16, borderWidth: 1 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  emailText: { fontSize: 12, marginBottom: 4 },
  nameInput: { flex: 1, fontSize: 15, padding: 8, borderRadius: 8 },
  saveNameBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  saveNameText: { fontSize: 13, color: '#FFF' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  settingLabel: { flex: 1, fontSize: 14 },
  settingVal: { fontSize: 13 },
  divider: { height: 1, marginVertical: 12 },
  pinActions: { marginTop: 12 },
  pinSetupRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pinInput: { flex: 1, fontSize: 16, padding: 10, borderRadius: 8, borderWidth: 1, letterSpacing: 8, textAlign: 'center', minWidth: 150 },
  primaryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { fontSize: 13, color: '#FFF' },
  dangerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: 'flex-start' },
  dangerBtnText: { fontSize: 13, color: '#FFF' },
  cancelText: { fontSize: 13, paddingVertical: 10 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 8, borderWidth: 1.5, marginTop: 4 },
  logoutText: { fontSize: 16 },
  subLabel: { fontSize: 12 },
  dayPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginRight: 8 },
  dayText: { fontSize: 12 },
  testNotifBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 8, marginTop: 4 },
  testNotifText: { fontSize: 13 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  confirmDialog: { width: '100%', maxWidth: 340, borderRadius: 20, padding: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  confirmTitle: { fontSize: 20, textAlign: 'center' },
  confirmActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  confirmBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { fontSize: 15 },
});
