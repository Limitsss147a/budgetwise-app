import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Platform, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../src/utils/api';
import { formatRupiah } from '../src/utils/format';
import { useTheme } from '../src/contexts/ThemeContext';
import { fonts } from '../src/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Toast from 'react-native-toast-message';
import type { Goal, Wallet } from '../src/types';

export default function GoalsScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [color, setColor] = useState('#10B981');
  const [icon, setIcon] = useState('flag');
  
  // Contribute state
  const [contributeAmount, setContributeAmount] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [g, w] = await Promise.all([api.getGoals(), api.getWallets()]);
      setGoals(g);
      setWallets(w);
      if (w.length > 0 && !selectedWalletId) setSelectedWalletId(w[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedWalletId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleCreate = async () => {
    if (!name.trim() || !targetAmount) {
      Toast.show({ type: 'error', text1: 'Isi nama dan target tabungan' });
      return;
    }
    const amt = parseFloat(targetAmount.replace(/\D/g, ''));
    if (amt <= 0) return;
    
    try {
      await api.createGoal({ name: name.trim(), target_amount: amt, color, icon });
      Toast.show({ type: 'success', text1: 'Target berhasil dibuat' });
      setShowAddModal(false);
      setName(''); setTargetAmount('');
      loadData();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Gagal membuat target', text2: e.message });
    }
  };

  const handleContribute = async () => {
    if (!selectedGoal || !contributeAmount || !selectedWalletId) return;
    const amt = parseFloat(contributeAmount.replace(/\D/g, ''));
    if (amt <= 0) return;
    
    try {
      await api.contributeGoal(selectedGoal.id, { wallet_id: selectedWalletId, amount: amt });
      Toast.show({ type: 'success', text1: 'Tabungan berhasil ditambahkan' });
      setShowContributeModal(false);
      setContributeAmount('');
      loadData();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Gagal menabung', text2: e.message });
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Hapus Target', 'Yakin ingin menghapus target tabungan ini? Riwayat transaksi tabungan akan tetap ada, namun target akan dihapus.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try {
          await api.deleteGoal(id);
          Toast.show({ type: 'success', text1: 'Target dihapus' });
          loadData();
        } catch {
          Toast.show({ type: 'error', text1: 'Gagal menghapus' });
        }
      }}
    ]);
  };

  const isDark = theme === 'dark';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={isDark ? ['#0A1210', '#111827', '#0A1210'] : ['#F8FAFC', '#F1F5F9', '#EFF6FF']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[st.blob, { top: -50, left: -50, backgroundColor: colors.brand, opacity: isDark ? 0.08 : 0.12 }]} />
        <View style={[st.blob, { bottom: 100, right: -50, backgroundColor: '#10B981', opacity: isDark ? 0.05 : 0.08 }]} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <View style={st.header}>
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>Target Tabungan</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={st.addBtn}>
            <Ionicons name="add" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color={colors.brand} />
        ) : (
          <ScrollView
            contentContainerStyle={st.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.brand} />}
          >
            {goals.length === 0 ? (
              <View style={st.empty}>
                <Ionicons name="flag-outline" size={64} color={colors.textTertiary} />
                <Text style={{ fontSize: 16, fontFamily: fonts.semiBold, color: colors.textSecondary, marginTop: 16 }}>Belum ada target tabungan</Text>
                <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>Buat target untuk mulai menyisihkan uang Anda.</Text>
                <TouchableOpacity style={[st.primaryBtn, { backgroundColor: colors.brand, marginTop: 20 }]} onPress={() => setShowAddModal(true)}>
                  <Text style={{ color: '#FFF', fontFamily: fonts.semiBold }}>Buat Target Baru</Text>
                </TouchableOpacity>
              </View>
            ) : (
              goals.map(g => {
                const progress = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
                return (
                  <View key={g.id} style={st.glassWrapper}>
                    <BlurView intensity={isDark ? 30 : 70} tint={isDark ? 'dark' : 'light'} style={st.goalCard}>
                      <View style={st.goalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View style={[st.goalIcon, { backgroundColor: g.color + '20' }]}>
                            <Ionicons name={g.icon as any} size={20} color={g.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[st.goalName, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{g.name}</Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: fonts.regular }}>{formatRupiah(g.current_amount)} / {formatRupiah(g.target_amount)}</Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => handleDelete(g.id)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                          <Ionicons name="trash-outline" size={18} color={colors.expense} />
                        </TouchableOpacity>
                      </View>
                      
                      <View style={st.progressWrap}>
                        <View style={[st.progressBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                          <View style={[st.progressFill, { width: `${progress}%`, backgroundColor: g.color }]} />
                        </View>
                        <Text style={[st.progressText, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{progress}%</Text>
                      </View>
                      
                      {progress < 100 ? (
                        <TouchableOpacity 
                          style={[st.contributeBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                          onPress={() => { setSelectedGoal(g); setShowContributeModal(true); }}
                        >
                          <Ionicons name="add-circle-outline" size={18} color={colors.brand} />
                          <Text style={{ color: colors.brand, fontFamily: fonts.semiBold, fontSize: 13 }}>Top-up Tabungan</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[st.contributeBtn, { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'transparent' }]}>
                          <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
                          <Text style={{ color: '#4ADE80', fontFamily: fonts.bold, fontSize: 13 }}>Target Tercapai!</Text>
                        </View>
                      )}
                    </BlurView>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Modal Add Goal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: colors.text, fontFamily: fonts.bold }]}>Buat Target Baru</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}><Ionicons name="close" size={24} color={colors.textTertiary} /></TouchableOpacity>
            </View>
            <View style={st.inputGroup}>
              <Text style={[st.label, { color: colors.textSecondary }]}>Nama Target</Text>
              <TextInput style={[st.input, { color: colors.text, backgroundColor: colors.bgSecondary, borderColor: colors.border }]} placeholder="Cth: Beli Laptop Baru" placeholderTextColor={colors.textTertiary} value={name} onChangeText={setName} />
            </View>
            <View style={st.inputGroup}>
              <Text style={[st.label, { color: colors.textSecondary }]}>Target Dana</Text>
              <TextInput style={[st.input, { color: colors.text, backgroundColor: colors.bgSecondary, borderColor: colors.border }]} placeholder="Rp 0" placeholderTextColor={colors.textTertiary} value={targetAmount} onChangeText={setTargetAmount} keyboardType="numeric" />
            </View>
            <TouchableOpacity style={[st.primaryBtn, { backgroundColor: colors.brand, marginTop: 10 }]} onPress={handleCreate}>
              <Text style={{ color: '#FFF', fontFamily: fonts.semiBold, fontSize: 15 }}>Buat Target</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Contribute */}
      <Modal visible={showContributeModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: colors.text, fontFamily: fonts.bold }]}>Top-up Tabungan</Text>
              <TouchableOpacity onPress={() => { setShowContributeModal(false); setContributeAmount(''); }}><Ionicons name="close" size={24} color={colors.textTertiary} /></TouchableOpacity>
            </View>
            {selectedGoal && <Text style={{ color: colors.textSecondary, marginBottom: 16, fontFamily: fonts.regular }}>Menabung untuk: <Text style={{ fontFamily: fonts.semiBold }}>{selectedGoal.name}</Text></Text>}
            <View style={st.inputGroup}>
              <Text style={[st.label, { color: colors.textSecondary }]}>Nominal</Text>
              <TextInput style={[st.input, { color: colors.text, backgroundColor: colors.bgSecondary, borderColor: colors.border }]} placeholder="Rp 0" placeholderTextColor={colors.textTertiary} value={contributeAmount} onChangeText={setContributeAmount} keyboardType="numeric" />
            </View>
            <View style={st.inputGroup}>
              <Text style={[st.label, { color: colors.textSecondary }]}>Dari Wallet</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
                {wallets.map(w => (
                  <TouchableOpacity key={w.id} style={[st.walletSelect, { backgroundColor: colors.bgSecondary, borderColor: colors.border }, selectedWalletId === w.id && { borderColor: colors.brand, backgroundColor: colors.brand + '20' }]} onPress={() => setSelectedWalletId(w.id)}>
                    <Ionicons name={w.icon as any} size={16} color={w.color} />
                    <View style={{ marginLeft: 6 }}>
                      <Text style={{ color: colors.text, fontSize: 12, fontFamily: fonts.medium }}>{w.name}</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: fonts.regular }}>{formatRupiah(w.balance)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <TouchableOpacity style={[st.primaryBtn, { backgroundColor: colors.brand, marginTop: 10 }]} onPress={handleContribute}>
              <Text style={{ color: '#FFF', fontFamily: fonts.semiBold, fontSize: 15 }}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  blob: { position: 'absolute', width: 300, height: 300, borderRadius: 150, filter: Platform.OS === 'ios' ? 'blur(60px)' : 'none' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 20, flex: 1 },
  addBtn: { padding: 4 },
  scroll: { padding: 20, paddingBottom: 60 },
  empty: { alignItems: 'center', marginTop: 80, padding: 20 },
  glassWrapper: { borderRadius: 20, overflow: 'hidden', marginBottom: 16, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  goalCard: { padding: 16 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  goalIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  goalName: { fontSize: 16, marginBottom: 2 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  progressBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', marginRight: 12 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 13, width: 36, textAlign: 'right' },
  contributeBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, marginBottom: 8, fontFamily: fonts.medium },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: fonts.medium },
  primaryBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  walletSelect: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginRight: 10, minWidth: 120 },
});
