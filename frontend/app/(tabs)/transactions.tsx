import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { api } from '../../src/utils/api';
import { formatRupiah, formatDate, getCurrentMonth, formatMonthYear, getMonthOffset } from '../../src/utils/format';
import { useTheme } from '../../src/contexts/ThemeContext';
import { fonts } from '../../src/constants/fonts';
import type { Transaction, Category } from '../../src/types';

export default function Transactions() {
  const router = useRouter();
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<string>('all');
  const [month, setMonth] = useState(getCurrentMonth());
  const [loadingMore, setLoadingMore] = useState(false);

  const loadData = useCallback(async (p = 1, append = false) => {
    try {
      if (p === 1 && !append) setLoading(true);
      else setLoadingMore(true);
      const params: Record<string, string> = { page: String(p), limit: '20', sort_by: 'date', sort_order: 'desc', month };
      if (filter !== 'all') params.type = filter;
      const [res, cats] = await Promise.all([api.getTransactions(params), p === 1 ? api.getCategories() : Promise.resolve(null)]);
      if (cats) setCategories(cats);
      if (append) setTransactions(prev => [...prev, ...res.transactions]);
      else setTransactions(res.transactions);
      setTotalPages(res.pages);
      setPage(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  }, [filter, month]);

  useFocusEffect(useCallback(() => { loadData(1); }, [loadData]));

  const handleDelete = (tx: Transaction) => {
    Alert.alert('Hapus Transaksi', `Yakin ingin menghapus transaksi ${formatRupiah(tx.amount)}?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try { await api.deleteTransaction(tx.id); loadData(1); } catch (e) { Alert.alert('Error', 'Gagal menghapus'); }
      }},
    ]);
  };

  const catMap = (id: string) => categories.find(c => c.id === id);
  const filters = [{ key: 'all', label: 'Semua' }, { key: 'income', label: 'Masuk' }, { key: 'expense', label: 'Keluar' }];

  const renderItem = ({ item: tx }: { item: Transaction }) => {
    const cat = catMap(tx.category_id);
    const renderRightActions = () => (
      <TouchableOpacity 
        style={st.deleteAction} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          handleDelete(tx);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="trash" size={24} color="#FFF" />
      </TouchableOpacity>
    );

    return (
      <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
        <TouchableOpacity testID={`tx-item-${tx.id}`} style={[st.txRow, { borderBottomColor: colors.border, backgroundColor: colors.bg }]} activeOpacity={1}
          onPress={() => router.push(`/add-transaction?id=${tx.id}` as any)}>
          <View style={[st.txIcon, { backgroundColor: (cat?.color || '#7D7D7D') + '18' }]}>
            <Ionicons name={(cat?.icon || 'ellipsis-horizontal') as any} size={18} color={cat?.color || '#7D7D7D'} />
          </View>
          <View style={st.txInfo}>
            <Text style={[st.txName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{cat?.name || 'Lainnya'}</Text>
            <Text style={[st.txDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]} numberOfLines={1}>{tx.description || formatDate(tx.date)}</Text>
          </View>
          <View style={st.txRight}>
            <Text style={[st.txAmt, { color: tx.type === 'income' ? colors.income : colors.expense, fontFamily: fonts.bold }]}>
              {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
            </Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={[st.container, { backgroundColor: colors.bg }]} testID="transactions-screen">
      <View style={st.header}>
        <Text style={[st.title, { color: colors.text, fontFamily: fonts.bold }]}>Transaksi</Text>
        <TouchableOpacity testID="add-tx-btn" style={[st.addBtn, { backgroundColor: colors.accent }]} onPress={() => router.push('/add-transaction')}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={st.monthNav}>
        <TouchableOpacity testID="prev-month" onPress={() => setMonth(m => getMonthOffset(m, -1))}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[st.monthText, { color: colors.text, fontFamily: fonts.semiBold }]}>{formatMonthYear(month)}</Text>
        <TouchableOpacity testID="next-month" onPress={() => setMonth(m => getMonthOffset(m, 1))}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={st.filterRow}>
        {filters.map(f => (
          <TouchableOpacity key={f.key} testID={`filter-${f.key}`}
            style={[st.filterPill, { backgroundColor: colors.bgCard, borderColor: colors.border }, filter === f.key && { backgroundColor: colors.brand, borderColor: colors.brand }]}
            onPress={() => setFilter(f.key)}>
            <Text style={[st.filterText, { color: colors.textTertiary, fontFamily: fonts.medium }, filter === f.key && { color: colors.textInverse }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(1); }} tintColor={colors.brand} />}
          onEndReached={() => { if (page < totalPages && !loadingMore) loadData(page + 1, true); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={colors.brand} /> : null}
          ListEmptyComponent={
            <View style={st.empty}>
              <Ionicons name="receipt-outline" size={56} color={colors.textTertiary} />
              <Text style={[st.emptyTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Belum ada transaksi</Text>
              <Text style={[st.emptySub, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Tap + untuk menambah transaksi baru</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24 },
  addBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 16 },
  monthText: { fontSize: 15 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  txIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txName: { fontSize: 14 },
  txDesc: { fontSize: 12, marginTop: 2 },
  txRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
  txAmt: { fontSize: 14 },
  deleteAction: { width: 75, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EF4444' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, marginTop: 16 },
  emptySub: { fontSize: 13, marginTop: 4 },
});
