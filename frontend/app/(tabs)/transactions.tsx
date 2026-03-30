import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../src/utils/api';
import { formatRupiah, formatDate, getCurrentMonth, formatMonthYear, getMonthOffset } from '../../src/utils/format';
import { useTheme } from '../../src/contexts/ThemeContext';
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
    return (
      <TouchableOpacity testID={`tx-item-${tx.id}`} style={[s.txRow, { borderBottomColor: colors.border }]} activeOpacity={0.7}
        onPress={() => router.push(`/add-transaction?id=${tx.id}` as any)}>
        <View style={[s.txIcon, { backgroundColor: (cat?.color || '#7D7D7D') + '18' }]}>
          <Ionicons name={(cat?.icon || 'ellipsis-horizontal') as any} size={18} color={cat?.color || '#7D7D7D'} />
        </View>
        <View style={s.txInfo}>
          <Text style={[s.txName, { color: colors.text }]} numberOfLines={1}>{cat?.name || 'Lainnya'}</Text>
          <Text style={[s.txDesc, { color: colors.textTertiary }]} numberOfLines={1}>{tx.description || formatDate(tx.date)}</Text>
        </View>
        <View style={s.txRight}>
          <Text style={[s.txAmt, { color: tx.type === 'income' ? colors.income : colors.expense }]}>
            {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
          </Text>
          <TouchableOpacity testID={`delete-tx-${tx.id}`} onPress={() => handleDelete(tx)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={16} color={colors.expense} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} testID="transactions-screen">
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>Transaksi</Text>
        <TouchableOpacity testID="add-tx-btn" style={[s.addBtn, { backgroundColor: colors.accent }]} onPress={() => router.push('/add-transaction')}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Bulan Navigator */}
      <View style={s.monthNav}>
        <TouchableOpacity testID="prev-month" onPress={() => setMonth(m => getMonthOffset(m, -1))}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.monthText, { color: colors.text }]}>{formatMonthYear(month)}</Text>
        <TouchableOpacity testID="next-month" onPress={() => setMonth(m => getMonthOffset(m, 1))}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Filter */}
      <View style={s.filterRow}>
        {filters.map(f => (
          <TouchableOpacity key={f.key} testID={`filter-${f.key}`}
            style={[s.filterPill, { backgroundColor: colors.bgCard, borderColor: colors.border }, filter === f.key && { backgroundColor: colors.brand, borderColor: colors.brand }]}
            onPress={() => setFilter(f.key)}>
            <Text style={[s.filterText, { color: colors.textTertiary }, filter === f.key && { color: colors.textInverse }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(1); }} tintColor={colors.brand} />}
          onEndReached={() => { if (page < totalPages && !loadingMore) loadData(page + 1, true); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={colors.brand} /> : null}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={56} color={colors.textTertiary} />
              <Text style={[s.emptyTitle, { color: colors.text }]}>Belum ada transaksi</Text>
              <Text style={[s.emptySub, { color: colors.textTertiary }]}>Tap + untuk menambah transaksi baru</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '700' },
  addBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 16 },
  monthText: { fontSize: 15, fontWeight: '600' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '500' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  txIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txName: { fontSize: 14, fontWeight: '600' },
  txDesc: { fontSize: 12, marginTop: 2 },
  txRight: { alignItems: 'flex-end', gap: 6 },
  txAmt: { fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptySub: { fontSize: 13, marginTop: 4 },
});
