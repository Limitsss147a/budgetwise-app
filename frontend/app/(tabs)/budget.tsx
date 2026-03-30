import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/utils/api';
import { formatRupiah, getCurrentMonth, formatMonthYear, getMonthOffset, formatAmountInput, parseAmountInput } from '../../src/utils/format';
import type { Budget, Category, CategoryBreakdown } from '../../src/types';

export default function BudgetScreen() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selCat, setSelCat] = useState<string>('');
  const [budgetAmt, setBudgetAmt] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [b, c, br] = await Promise.all([
        api.getBudgets(month), api.getCategories('expense'), api.getCategoryBreakdown(month),
      ]);
      setBudgets(b); setCategories(c); setBreakdown(br.breakdown);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [month]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const getBudgetForCat = (catId: string) => budgets.find(b => b.category_id === catId);
  const getSpentForCat = (catId: string) => breakdown.find(b => b.category_id === catId)?.total || 0;

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + getSpentForCat(b.category_id), 0);

  const handleSaveBudget = async () => {
    const amount = parseAmountInput(budgetAmt);
    if (!selCat || amount <= 0) { Alert.alert('Error', 'Pilih kategori dan masukkan jumlah'); return; }
    try {
      await api.createBudget({ category_id: selCat, amount, month });
      setShowModal(false); setBudgetAmt(''); setSelCat('');
      loadData();
    } catch (e) { Alert.alert('Error', 'Gagal menyimpan anggaran'); }
  };

  const handleDeleteBudget = (b: Budget) => {
    Alert.alert('Hapus Anggaran', 'Yakin ingin menghapus anggaran ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try { await api.deleteBudget(b.id); loadData(); } catch { Alert.alert('Error', 'Gagal menghapus'); }
      }},
    ]);
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return '#D34A3E';
    if (pct >= 80) return '#E86A33';
    return '#3A6E4B';
  };

  if (loading) {
    return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color="#1A4D2E" /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.container} testID="budget-screen">
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#1A4D2E" />} contentContainerStyle={s.scroll}>
        <View style={s.headerRow}>
          <Text style={s.screenTitle}>Anggaran</Text>
          <TouchableOpacity testID="add-budget-btn" style={s.addBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Bulan Navigator */}
        <View style={s.monthNav}>
          <TouchableOpacity testID="budget-prev-month" onPress={() => setMonth(m => getMonthOffset(m, -1))}>
            <Ionicons name="chevron-back" size={22} color="#1A4D2E" />
          </TouchableOpacity>
          <Text style={s.monthText}>{formatMonthYear(month)}</Text>
          <TouchableOpacity testID="budget-next-month" onPress={() => setMonth(m => getMonthOffset(m, 1))}>
            <Ionicons name="chevron-forward" size={22} color="#1A4D2E" />
          </TouchableOpacity>
        </View>

        {/* Ringkasan Total */}
        {budgets.length > 0 && (
          <View style={s.totalCard}>
            <Text style={s.totalLabel}>Total Anggaran</Text>
            <Text style={s.totalVal}>{formatRupiah(totalBudget)}</Text>
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%`, backgroundColor: getProgressColor((totalSpent / totalBudget) * 100) }]} />
            </View>
            <Text style={s.totalSub}>Terpakai: {formatRupiah(totalSpent)} ({totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%)</Text>
          </View>
        )}

        {/* Budget per Kategori */}
        {budgets.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="wallet-outline" size={56} color="#C2A878" />
            <Text style={s.emptyTitle}>Belum ada anggaran</Text>
            <Text style={s.emptySub}>Atur anggaran per kategori untuk kontrol pengeluaran</Text>
          </View>
        ) : (
          budgets.map(budget => {
            const cat = categories.find(c => c.id === budget.category_id);
            const spent = getSpentForCat(budget.category_id);
            const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            return (
              <View key={budget.id} style={s.budgetCard} testID={`budget-${budget.id}`}>
                <View style={s.budgetHeader}>
                  <View style={[s.catIcon, { backgroundColor: (cat?.color || '#7D7D7D') + '18' }]}>
                    <Ionicons name={(cat?.icon || 'ellipsis-horizontal') as any} size={18} color={cat?.color || '#7D7D7D'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.catName}>{cat?.name || 'Lainnya'}</Text>
                    <Text style={s.budgetRange}>{formatRupiah(spent)} / {formatRupiah(budget.amount)}</Text>
                  </View>
                  <TouchableOpacity testID={`delete-budget-${budget.id}`} onPress={() => handleDeleteBudget(budget)}>
                    <Ionicons name="close-circle-outline" size={20} color="#D34A3E" />
                  </TouchableOpacity>
                </View>
                <View style={s.progressBg}>
                  <View style={[s.progressFill, { width: `${Math.min(100, pct)}%`, backgroundColor: getProgressColor(pct) }]} />
                </View>
                <Text style={[s.pctText, { color: getProgressColor(pct) }]}>{Math.round(pct)}%{pct >= 100 ? ' ⚠️ Melebihi!' : pct >= 80 ? ' ⚠️ Hampir Habis' : ''}</Text>
              </View>
            );
          })
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Modal Tambah Budget */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Atur Anggaran</Text>
              <TouchableOpacity testID="close-budget-modal" onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#1A4D2E" />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Kategori</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
              {categories.map(cat => (
                <TouchableOpacity key={cat.id} testID={`budget-cat-${cat.id}`}
                  style={[s.catPill, selCat === cat.id && { backgroundColor: cat.color + '30', borderColor: cat.color }]}
                  onPress={() => setSelCat(cat.id)}>
                  <Ionicons name={cat.icon as any} size={16} color={cat.color} />
                  <Text style={[s.catPillText, selCat === cat.id && { color: cat.color }]} numberOfLines={1}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.inputLabel}>Jumlah Anggaran</Text>
            <View style={s.amtRow}>
              <Text style={s.rupiah}>Rp</Text>
              <TextInput testID="budget-amount-input" style={s.amtInput} keyboardType="numeric" placeholder="0"
                value={formatAmountInput(budgetAmt)} onChangeText={t => setBudgetAmt(t.replace(/\D/g, ''))} placeholderTextColor="#7D7D7D" />
            </View>

            <TouchableOpacity testID="save-budget-btn" style={s.saveBtn} onPress={handleSaveBudget} activeOpacity={0.8}>
              <Text style={s.saveBtnText}>Simpan Anggaran</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  screenTitle: { fontSize: 24, fontWeight: '700', color: '#1A4D2E' },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E86A33', justifyContent: 'center', alignItems: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 16 },
  monthText: { fontSize: 15, fontWeight: '600', color: '#1A4D2E' },
  totalCard: { backgroundColor: '#1A4D2E', borderRadius: 16, padding: 20, marginBottom: 16 },
  totalLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  totalVal: { fontSize: 24, fontWeight: '700', color: '#FFF', marginVertical: 4 },
  totalSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  progressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  budgetCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0EBE1' },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  catIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  catName: { fontSize: 14, fontWeight: '600', color: '#1A4D2E' },
  budgetRange: { fontSize: 12, color: '#7D7D7D', marginTop: 2 },
  pctText: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A4D2E', marginTop: 16 },
  emptySub: { fontSize: 13, color: '#7D7D7D', marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#1A4D2E' },
  inputLabel: { fontSize: 13, fontWeight: '500', color: '#7D7D7D', marginBottom: 8, marginTop: 4 },
  catScroll: { marginBottom: 16 },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F9F9F6', borderWidth: 1, borderColor: '#F0EBE1', marginRight: 8 },
  catPillText: { fontSize: 12, color: '#4A4A4A' },
  amtRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F6', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#F0EBE1', marginBottom: 20 },
  rupiah: { fontSize: 16, fontWeight: '600', color: '#1A4D2E', marginRight: 8 },
  amtInput: { flex: 1, fontSize: 20, fontWeight: '600', color: '#1A4D2E', paddingVertical: 14 },
  saveBtn: { backgroundColor: '#1A4D2E', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});
