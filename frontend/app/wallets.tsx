import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/utils/api';
import { formatRupiah, formatAmountInput, parseAmountInput } from '../src/utils/format';
import { useTheme } from '../src/contexts/ThemeContext';
import { fonts } from '../src/constants/fonts';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { Card } from '../src/components/ui/Card';
import { Wallet } from '../src/types';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const WALLET_TYPES = [
  { label: 'Bank / M-Banking', value: 'bank' as const, icon: 'card-outline' },
  { label: 'E-Wallet', value: 'ewallet' as const, icon: 'phone-portrait-outline' },
  { label: 'Tunai / Cash', value: 'cash' as const, icon: 'cash-outline' },
];

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];

export default function WalletsScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Transfer state
  const [isTransferring, setIsTransferring] = useState(false);
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<'bank'|'ewallet'|'cash'>('bank');
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
        initial_balance: parseAmountInput(initialBalance),
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

  const handleTransfer = async () => {
    const amt = parseAmountInput(transferAmount);
    if (amt <= 0) {
      Alert.alert('Gagal', 'Masukkan jumlah transfer yang valid');
      return;
    }
    if (!fromWalletId || !toWalletId || fromWalletId === toWalletId) {
      Alert.alert('Gagal', 'Pilih dompet asal dan tujuan yang berbeda');
      return;
    }

    try {
      setLoading(true);
      await api.transferBalance({
        from_wallet_id: fromWalletId,
        to_wallet_id: toWalletId,
        amount: amt,
        description: transferDesc || 'Transfer antar dompet',
        date: new Date().toISOString(),
      });
      setIsTransferring(false);
      setTransferAmount('');
      setTransferDesc('');
      loadWallets();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && wallets.length === 0) return <LoadingScreen />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme === 'dark' ? '#1F2937' : '#F3F4F6' }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>Manajemen Dompet</Text>
          <View style={styles.headerRight}>
            {wallets.length >= 2 && (
              <TouchableOpacity 
                onPress={() => {
                  setFromWalletId(wallets[0].id);
                  setToWalletId(wallets[1].id);
                  setIsTransferring(true);
                }} 
                style={[styles.actionBtn, { backgroundColor: theme === 'dark' ? '#1F2937' : '#F3F4F6' }]}
              >
                <Ionicons name="swap-horizontal" size={20} color={colors.brand} />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={() => setIsAdding(true)} 
              style={[styles.addBtn, { backgroundColor: colors.brand }]}
            >
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
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
                  value={formatAmountInput(initialBalance)}
                  onChangeText={t => setInitialBalance(t.replace(/\D/g, ''))}
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
                  <TouchableOpacity onPress={() => setIsAdding(true)} style={[styles.emptyBtn, { backgroundColor: colors.brand }]}>
                    <Text style={{ color: '#FFF', fontFamily: fonts.semiBold }}>Tambah Dompet Pertama</Text>
                  </TouchableOpacity>
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
                        <View style={styles.walletActions}>
                           {!w.is_default && (
                              <TouchableOpacity onPress={() => handleDelete(w.id)} style={styles.deleteBtn}>
                                <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.8)" />
                              </TouchableOpacity>
                            )}
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Transfer Modal */}
      <Modal visible={isTransferring} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={theme === 'dark' ? 30 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={styles.modalContent}>
             <Text style={[styles.modalTitle, { color: colors.text, fontFamily: fonts.bold }]}>Pindah Saldo</Text>
             
             <View style={styles.transferRow}>
                <View style={styles.transferCol}>
                   <Text style={[styles.label, { color: colors.textTertiary }]}>Dari</Text>
                   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                      {wallets.map(w => (
                         <TouchableOpacity key={w.id} onPress={() => setFromWalletId(w.id)} style={[styles.pickerItem, { borderColor: fromWalletId === w.id ? colors.brand : colors.border, backgroundColor: fromWalletId === w.id ? colors.brand + '10' : 'transparent' }]}>
                            <Text style={{ color: fromWalletId === w.id ? colors.brand : colors.text, fontFamily: fonts.medium }}>{w.name}</Text>
                         </TouchableOpacity>
                      ))}
                   </ScrollView>
                </View>
                <View style={styles.transferIcon}>
                   <Ionicons name="arrow-forward" size={20} color={colors.textTertiary} />
                </View>
                <View style={styles.transferCol}>
                   <Text style={[styles.label, { color: colors.textTertiary }]}>Ke</Text>
                   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                      {wallets.map(w => (
                         <TouchableOpacity key={w.id} onPress={() => setToWalletId(w.id)} style={[styles.pickerItem, { borderColor: toWalletId === w.id ? colors.brand : colors.border, backgroundColor: toWalletId === w.id ? colors.brand + '10' : 'transparent' }]}>
                            <Text style={{ color: toWalletId === w.id ? colors.brand : colors.text, fontFamily: fonts.medium }}>{w.name}</Text>
                         </TouchableOpacity>
                      ))}
                   </ScrollView>
                </View>
             </View>

             <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textTertiary }]}>Jumlah Transfer</Text>
                <TextInput 
                   style={[styles.input, { color: colors.text, borderColor: colors.border, fontFamily: fonts.bold }]}
                   keyboardType="numeric"
                   placeholder="0"
                   placeholderTextColor={colors.textTertiary}
                   value={formatAmountInput(transferAmount)}
                   onChangeText={t => setTransferAmount(t.replace(/\D/g, ''))}
                />
             </View>

             <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textTertiary }]}>Catatan (Opsional)</Text>
                <TextInput 
                   style={[styles.input, { color: colors.text, borderColor: colors.border, fontFamily: fonts.regular }]}
                   placeholder="Pindah saldo"
                   placeholderTextColor={colors.textTertiary}
                   value={transferDesc}
                   onChangeText={setTransferDesc}
                />
             </View>

             <View style={styles.formActions}>
                <TouchableOpacity onPress={() => setIsTransferring(false)} style={styles.cancelBtn}>
                  <Text style={[styles.cancelText, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleTransfer} style={[styles.saveBtn, { backgroundColor: colors.brand }]}>
                  <Text style={[styles.saveText, { fontFamily: fonts.semiBold }]}>Konfirmasi</Text>
                </TouchableOpacity>
             </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, flex: 1, marginLeft: 15 },
  headerRight: { flexDirection: 'row', gap: 10 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  walletList: { gap: 16 },
  walletCard: { borderRadius: 24, padding: 20, minHeight: 160, justifyContent: 'space-between', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
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
  walletActions: { flexDirection: 'row', gap: 8 },
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
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { marginTop: 15, fontSize: 16, marginBottom: 24 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 24, padding: 24, overflow: 'hidden' },
  modalTitle: { fontSize: 20, marginBottom: 24, textAlign: 'center' },
  transferRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 10 },
  transferCol: { flex: 1 },
  transferIcon: { marginTop: 20 },
  pickerScroll: { marginTop: 8 },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, marginRight: 8 },
});
