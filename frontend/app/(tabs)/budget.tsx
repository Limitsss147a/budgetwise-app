import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/utils/api';
import { formatRupiah, getCurrentMonth, formatMonthYear, getMonthOffset, formatAmountInput, parseAmountInput } from '../../src/utils/format';
import { useTheme } from '../../src/contexts/ThemeContext';
import { fonts } from '../../src/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import type { Budget, Category, CategoryBreakdown } from '../../src/types';

export default function BudgetScreen() {
  const { colors, theme } = useTheme();
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

  const handleEditBudget = (b: Budget) => {
    setSelCat(b.category_id);
    setBudgetAmt(b.amount.toString());
    setShowModal(true);
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return colors.expense;
    if (pct >= 80) return colors.accent;
    return colors.income;
  };

  if (loading) {
    return <SafeAreaView style={[st.container, { backgroundColor: colors.bg }]}><View style={st.center}><ActivityIndicator size="large" color={colors.brand} /></View></SafeAreaView>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Premium Background Elements */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={theme === 'dark' ? ['#0A1210', '#111827', '#0A1210'] : ['#F8FAFC', '#F1F5F9', '#EFF6FF']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[st.blob, { top: -50, left: -50, backgroundColor: colors.brand, opacity: theme === 'dark' ? 0.08 : 0.12 }]} />
        <View style={[st.blob, { bottom: 100, right: -50, backgroundColor: '#10B981', opacity: theme === 'dark' ? 0.05 : 0.08 }]} />
      </View>

      <SafeAreaView style={{ flex: 1 }} testID="budget-screen">
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.brand} />} contentContainerStyle={st.scroll}>
          <View style={st.headerRow}>
            <Text style={[st.screenTitle, { color: colors.text, fontFamily: fonts.bold }]}>Anggaran</Text>
            <TouchableOpacity testID="add-budget-btn" style={[st.addBtn, { backgroundColor: colors.accent }]} onPress={() => setShowModal(true)}>
              <Ionicons name="add" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={st.monthNav}>
            <TouchableOpacity testID="budget-prev-month" onPress={() => setMonth(m => getMonthOffset(m, -1))}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[st.monthText, { color: colors.text, fontFamily: fonts.semiBold }]}>{formatMonthYear(month)}</Text>
            <TouchableOpacity testID="budget-next-month" onPress={() => setMonth(m => getMonthOffset(m, 1))}>
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {budgets.length > 0 && (
            <View style={st.glassWrapper}>
              <BlurView intensity={theme === 'dark' ? 40 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={st.glassCard}>
                <LinearGradient
                  colors={['#064E3BCC', '#064E3B99']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={st.cardGradient}
                >
                  <Text style={[st.totalLabel, { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.7)' }]}>Total Anggaran</Text>
                  <Text style={[st.totalVal, { fontFamily: fonts.bold, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }]}>
                    {formatRupiah(totalBudget)}
                  </Text>
                  <View style={st.progressBg}>
                    <View style={[st.progressFill, { width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%`, backgroundColor: getProgressColor((totalSpent / totalBudget) * 100) }]} />
                  </View>
                  <Text style={[st.totalSub, { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.7)' }]}>Terpakai: {formatRupiah(totalSpent)} ({totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%)</Text>
                </LinearGradient>
              </BlurView>
            </View>
          )}

          {budgets.length === 0 ? (
            <View style={st.empty}>
              <Ionicons name="wallet-outline" size={56} color={colors.textTertiary} />
              <Text style={[st.emptyTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Belum ada anggaran</Text>
              <Text style={[st.emptySub, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Atur anggaran per kategori untuk kontrol pengeluaran</Text>
            </View>
          ) : (
            budgets.map(budget => {
              const cat = categories.find(c => c.id === budget.category_id);
              const spent = getSpentForCat(budget.category_id);
              const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
              return (
                <View key={budget.id} style={st.glassWrapperSmall}>
                  <BlurView intensity={theme === 'dark' ? 20 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={st.glassCardSmall}>
                    <View style={[st.budgetCardInner, { borderColor: colors.border }]}>
                      <View style={st.budgetHeader}>
                        <View style={[st.catIcon, { backgroundColor: (cat?.color || '#7D7D7D') + '18' }]}>
                          <Ionicons name={(cat?.icon || 'ellipsis-horizontal') as any} size={18} color={cat?.color || '#7D7D7D'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[st.catName, { color: colors.text, fontFamily: fonts.medium }]}>{cat?.name || 'Lainnya'}</Text>
                          <Text style={[st.budgetRange, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{formatRupiah(spent)} / {formatRupiah(budget.amount)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 14 }}>
                          <TouchableOpacity testID={`edit-budget-${budget.id}`} onPress={() => handleEditBudget(budget)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="create-outline" size={20} color={colors.brand} />
                          </TouchableOpacity>
                          <TouchableOpacity testID={`delete-budget-${budget.id}`} onPress={() => handleDeleteBudget(budget)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close-circle-outline" size={20} color={colors.expense} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={[st.progressBgCard, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                        <View style={[st.progressFill, { width: `${Math.min(100, pct)}%`, backgroundColor: getProgressColor(pct) }]} />
                      </View>
                      <Text style={[st.pctText, { color: getProgressColor(pct), fontFamily: fonts.semiBold }]}>{Math.round(pct)}%{pct >= 100 ? ' Melebihi!' : pct >= 80 ? ' Hampir Habis' : ''}</Text>
                    </View>
                  </BlurView>
                </View>
              );
            })
          )}
          <View style={{ height: 30 }} />
        </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Atur Anggaran</Text>
              <TouchableOpacity testID="close-budget-modal" onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[st.inputLabel, { color: colors.textTertiary, fontFamily: fonts.medium }]}>Kategori</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.catScroll}>
              {categories.map(cat => (
                <TouchableOpacity key={cat.id} testID={`budget-cat-${cat.id}`}
                  style={[st.catPill, { backgroundColor: colors.bgSecondary, borderColor: colors.border }, selCat === cat.id && { backgroundColor: cat.color + '30', borderColor: cat.color }]}
                  onPress={() => setSelCat(cat.id)}>
                  <Ionicons name={cat.icon as any} size={16} color={cat.color} />
                  <Text style={[st.catPillText, { color: colors.textSecondary, fontFamily: fonts.regular }, selCat === cat.id && { color: cat.color }]} numberOfLines={1}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[st.inputLabel, { color: colors.textTertiary, fontFamily: fonts.medium }]}>Jumlah Anggaran</Text>
            <View style={[st.amtRow, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Text style={[st.rupiah, { color: colors.text, fontFamily: fonts.semiBold }]}>Rp</Text>
              <TextInput testID="budget-amount-input" style={[st.amtInput, { color: colors.text, fontFamily: fonts.semiBold }]} keyboardType="numeric" placeholder="0"
                value={formatAmountInput(budgetAmt)} onChangeText={t => setBudgetAmt(t.replace(/\D/g, ''))} placeholderTextColor={colors.textTertiary} />
            </View>

            <TouchableOpacity testID="save-budget-btn" style={[st.saveBtn, { backgroundColor: colors.brand }]} onPress={handleSaveBudget} activeOpacity={0.8}>
              <Text style={[st.saveBtnText, { fontFamily: fonts.semiBold }]}>Simpan Anggaran</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  screenTitle: { fontSize: 24 },
  addBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 16 },
  monthText: { fontSize: 15 },
  totalCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  glassWrapper: { borderRadius: 24, overflow: 'hidden', marginBottom: 24, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 16 },
  glassWrapperSmall: { borderRadius: 20, overflow: 'hidden', marginBottom: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
  glassCard: { borderRadius: 24 },
  glassCardSmall: { borderRadius: 20 },
  cardGradient: { padding: 24, borderRadius: 24 },
  budgetCardInner: { padding: 16, borderRadius: 20, borderWidth: 1 },
  blob: { position: 'absolute', width: 300, height: 300, borderRadius: 150, filter: Platform.OS === 'ios' ? 'blur(60px)' : 'none' },
  totalLabel: { fontSize: 12 },
  totalVal: { fontSize: 24, color: '#FFF', marginVertical: 4 },
  totalSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  progressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressBgCard: { height: 8, borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  budgetCard: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  catIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  catName: { fontSize: 14 },
  budgetRange: { fontSize: 12, marginTop: 2 },
  pctText: { fontSize: 12, marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, marginTop: 16 },
  emptySub: { fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18 },
  inputLabel: { fontSize: 13, marginBottom: 8, marginTop: 4 },
  catScroll: { marginBottom: 16 },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  catPillText: { fontSize: 12 },
  amtRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, marginBottom: 20 },
  rupiah: { fontSize: 16, marginRight: 8 },
  amtInput: { flex: 1, fontSize: 20, paddingVertical: 14 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 16, color: '#FFF' },
});
