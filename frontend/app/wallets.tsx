import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/utils/api';
import { formatRupiah } from '../src/utils/format';
import { useTheme } from '../src/contexts/ThemeContext';
import { fonts } from '../src/constants/fonts';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { Card } from '../src/components/ui/Card';
import { Wallet } from '../src/types';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const WALLET_TYPES = [
  { label: 'Bank / M-Banking', value: 'bank', icon: 'card-outline' },
  { label: 'E-Wallet', value: 'ewallet', icon: 'phone-portrait-outline' },
  { label: 'Tunai / Cash', value: 'cash', icon: 'cash-outline' },
];

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];

export default function WalletsScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [initialBalance, setInitialBalance] = useState('0');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  const loadWallets = useCallback(async () => {
    try {
      const data = await api.getWallets();
      setWallets(data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const resetForm = () => {
    setName('');
    setType('bank');
    setInitialBalance('0');
    setSelectedColor(COLORS[0]);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Peringatan', 'Nama wallet wajib diisi');
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        type,
        initial_balance: parseFloat(initialBalance.replace(/\./g, '')),
        color: selectedColor,
        icon: WALLET_TYPES.find(t => t.value === type)?.icon || 'wallet-outline',
      };

      if (editingId) {
        await api.updateWallet(editingId, payload);
      } else {
        await api.createWallet(payload);
      }
      
      resetForm();
      loadWallets();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Hapus Wallet',
      'Apakah Anda yakin ingin menghapus wallet ini? Seluruh transaksi terkait harus dipindahkan terlebih dahulu.',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteWallet(id);
              loadWallets();
            } catch (error: any) {
              Alert.alert('Gagal', error.message);
            }
          }
        }
      ]
    );
  };

  const handleEdit = (w: Wallet) => {
    setName(w.name);
    setType(w.type);
    setInitialBalance(w.initial_balance.toString());
    setSelectedColor(w.color);
    setEditingId(w.id);
    setIsAdding(true);
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme === 'dark' ? '#1F2937' : '#F3F4F6' }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>Manajemen Dompet</Text>
          <TouchableOpacity 
            onPress={() => setIsAdding(true)} 
            style={[styles.addBtn, { backgroundColor: colors.brand }]}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {isAdding ? (
            <Card style={styles.formCard}>
              <Text style={[styles.formTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {editingId ? 'Edit Dompet' : 'Tambah Dompet Baru'}
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.medium }]}>Nama Dompet</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, fontFamily: fonts.regular }]}
                  placeholder="Contoh: BCA, GoPay, Tunai"
                  placeholderTextColor={colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.medium }]}>Tipe Dompet</Text>
                <View style={styles.typeGrid}>
                  {WALLET_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => setType(t.value)}
                      style={[
                        styles.typeItem,
                        { borderColor: colors.border },
                        type === t.value && { borderColor: colors.brand, backgroundColor: colors.brand + '10' }
                      ]}
                    >
                      <Ionicons name={t.icon as any} size={20} color={type === t.value ? colors.brand : colors.textTertiary} />
                      <Text style={[styles.typeText, { color: type === t.value ? colors.brand : colors.textSecondary, fontFamily: fonts.medium }]}>
                        {t.label.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.medium }]}>Saldo Awal</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, fontFamily: fonts.bold }]}
                  keyboardType="numeric"
                  value={initialBalance}
                  onChangeText={setInitialBalance}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.medium }]}>Warna</Text>
                <View style={styles.colorGrid}>
                  {COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setSelectedColor(c)}
                      style={[
                        styles.colorItem,
                        { backgroundColor: c },
                        selectedColor === c && { borderWidth: 3, borderColor: colors.text }
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity onPress={resetForm} style={styles.cancelBtn}>
                  <Text style={[styles.cancelText, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: colors.brand }]}>
                  <Text style={[styles.saveText, { fontFamily: fonts.semiBold }]}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ) : (
            <View style={styles.walletList}>
              {wallets.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="wallet-outline" size={64} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textTertiary, fontFamily: fonts.medium }]}>Belum ada dompet</Text>
                </View>
              ) : (
                wallets.map((w) => (
                  <TouchableOpacity key={w.id} onPress={() => handleEdit(w)}>
                    <LinearGradient
                      colors={[w.color, w.color + 'CC']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.walletCard}
                    >
                      <View style={styles.walletHeader}>
                        <View style={[styles.walletIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                          <Ionicons name={w.icon as any} size={24} color="#FFF" />
                        </View>
                        <View style={styles.walletInfo}>
                          <Text style={[styles.walletName, { fontFamily: fonts.bold }]}>{w.name}</Text>
                          <Text style={[styles.walletType, { fontFamily: fonts.regular }]}>
                            {WALLET_TYPES.find(t => t.value === w.type)?.label}
                          </Text>
                        </View>
                        {w.is_default && (
                          <View style={styles.defaultBadge}>
                            <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                            <Text style={styles.defaultText}>Utama</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.walletFooter}>
                        <View>
                          <Text style={styles.balanceLabel}>Saldo Aktif</Text>
                          <Text style={[styles.balanceValue, { fontFamily: fonts.bold }]}>{formatRupiah(w.balance)}</Text>
                        </View>
                        {!w.is_default && (
                          <TouchableOpacity onPress={() => handleDelete(w.id)} style={styles.deleteBtn}>
                            <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.8)" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, flex: 1, marginLeft: 15 },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  walletList: { gap: 16 },
  walletCard: { borderRadius: 24, padding: 20, minHeight: 160, justifyContent: 'space-between' },
  walletHeader: { flexDirection: 'row', alignItems: 'center' },
  walletIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  walletInfo: { flex: 1 },
  walletName: { color: '#FFF', fontSize: 18 },
  walletType: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  defaultBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  defaultText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  walletFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 },
  balanceValue: { color: '#FFF', fontSize: 24 },
  deleteBtn: { padding: 8 },
  
  formCard: { padding: 20 },
  formTitle: { fontSize: 18, marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
  typeGrid: { flexDirection: 'row', gap: 10 },
  typeItem: { flex: 1, alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 12, gap: 6 },
  typeText: { fontSize: 11 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorItem: { width: 40, height: 40, borderRadius: 20 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10 },
  cancelBtn: { padding: 12 },
  cancelText: { fontSize: 15 },
  saveBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  saveText: { color: '#FFF', fontSize: 15 },
  empty: { alignItems: 'center', paddingVertical: 100 },
  emptyText: { marginTop: 15, fontSize: 16 },
});
