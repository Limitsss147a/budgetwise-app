import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { api } from '../../src/utils/api';
import { formatRupiah, getCurrentMonth, formatDate, formatDayName, formatMonthYear } from '../../src/utils/format';
import type { Summary, CategoryBreakdown, DailyTrend, Transaction, Category } from '../../src/types';

export default function Dashboard() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const month = getCurrentMonth();

  const loadData = useCallback(async () => {
    try {
      const [s, b, t, tx, c] = await Promise.all([
        api.getSummary(month), api.getCategoryBreakdown(month),
        api.getDailyTrend(7), api.getTransactions({ page: '1', limit: '5', sort_by: 'date', sort_order: 'desc' }),
        api.getCategories(),
      ]);
      setSummary(s); setBreakdown(b.breakdown); setDailyTrend(t);
      setRecentTx(tx.transactions); setCategories(c);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [month]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const catMap = useCallback((id: string) => categories.find(c => c.id === id), [categories]);

  if (loading) {
    return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color="#1A4D2E" /></View></SafeAreaView>;
  }

  const pieData = breakdown.map(item => ({ value: item.total, color: item.category_color }));
  const barData = dailyTrend.map(day => ({
    value: day.expense, label: formatDayName(day.date), frontColor: '#1A4D2E',
  }));

  return (
    <SafeAreaView style={s.container} testID="dashboard-screen">
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#1A4D2E" />} contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Selamat Datang 👋</Text>
            <Text style={s.headerTitle}>Keuanganmu</Text>
          </View>
        </View>

        {/* Kartu Saldo */}
        <View style={s.balanceCard} testID="balance-card">
          <Text style={s.balLabel}>Saldo Total</Text>
          <Text style={s.balAmount}>{formatRupiah(summary?.balance || 0)}</Text>
          <View style={s.balRow}>
            <View style={s.balItem}>
              <Ionicons name="arrow-up-circle" size={20} color="#4CAF50" />
              <View style={{ marginLeft: 6 }}>
                <Text style={s.balItemLabel}>Pemasukan</Text>
                <Text style={[s.balItemVal, { color: '#4CAF50' }]}>+{formatRupiah(summary?.month_income || 0)}</Text>
              </View>
            </View>
            <View style={s.balItem}>
              <Ionicons name="arrow-down-circle" size={20} color="#FF5252" />
              <View style={{ marginLeft: 6 }}>
                <Text style={s.balItemLabel}>Pengeluaran</Text>
                <Text style={[s.balItemVal, { color: '#FF5252' }]}>-{formatRupiah(summary?.month_expense || 0)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tombol Tambah */}
        <TouchableOpacity testID="add-transaction-button" style={s.addBtn} onPress={() => router.push('/add-transaction')} activeOpacity={0.8}>
          <Ionicons name="add-circle" size={22} color="#FFF" />
          <Text style={s.addBtnText}>Tambah Transaksi</Text>
        </TouchableOpacity>

        {/* Grafik Pengeluaran */}
        {pieData.length > 0 && (
          <View style={s.card} testID="expense-breakdown-card">
            <Text style={s.cardTitle}>Pengeluaran {formatMonthYear(month)}</Text>
            <View style={s.chartCenter}>
              <PieChart data={pieData} donut innerRadius={50} radius={80} innerCircleColor="#FFFFFF"
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#7D7D7D' }}>Total</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A4D2E' }}>{formatRupiah(summary?.month_expense || 0)}</Text>
                  </View>
                )}
              />
            </View>
            <View style={s.legendWrap}>
              {breakdown.slice(0, 5).map(item => (
                <View key={item.category_id} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: item.category_color }]} />
                  <Text style={s.legendText} numberOfLines={1}>{item.category_name}</Text>
                  <Text style={s.legendPct}>{item.percentage}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Grafik Tren 7 Hari */}
        {barData.some(d => d.value > 0) && (
          <View style={s.card} testID="daily-trend-card">
            <Text style={s.cardTitle}>Tren 7 Hari Terakhir</Text>
            <View style={s.chartCenter}>
              <BarChart data={barData} barWidth={26} spacing={14} barBorderRadius={6} frontColor="#1A4D2E"
                yAxisThickness={0} xAxisThickness={1} xAxisColor="#F0EBE1" noOfSections={4}
                hideRules hideYAxisText xAxisLabelTextStyle={{ color: '#7D7D7D', fontSize: 10 }}
              />
            </View>
          </View>
        )}

        {/* Transaksi Terakhir */}
        <View style={s.card} testID="recent-transactions-card">
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Transaksi Terakhir</Text>
            <TouchableOpacity testID="see-all-transactions" onPress={() => router.push('/(tabs)/transactions' as any)}>
              <Text style={s.seeAll}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>
          {recentTx.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={48} color="#C2A878" />
              <Text style={s.emptyTitle}>Belum ada transaksi</Text>
              <Text style={s.emptySub}>Mulai catat keuanganmu!</Text>
            </View>
          ) : (
            recentTx.map(tx => {
              const cat = catMap(tx.category_id);
              return (
                <View key={tx.id} style={s.txRow} testID={`recent-tx-${tx.id}`}>
                  <View style={[s.txIcon, { backgroundColor: (cat?.color || '#7D7D7D') + '18' }]}>
                    <Ionicons name={(cat?.icon || 'ellipsis-horizontal') as any} size={18} color={cat?.color || '#7D7D7D'} />
                  </View>
                  <View style={s.txInfo}>
                    <Text style={s.txName} numberOfLines={1}>{cat?.name || 'Lainnya'}</Text>
                    <Text style={s.txDate}>{formatDate(tx.date)}</Text>
                  </View>
                  <Text style={[s.txAmt, { color: tx.type === 'income' ? '#3A6E4B' : '#D34A3E' }]}>
                    {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  greeting: { fontSize: 14, color: '#7D7D7D' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#1A4D2E' },
  balanceCard: { backgroundColor: '#1A4D2E', borderRadius: 20, padding: 24, marginBottom: 16, shadowColor: '#1A4D2E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8 },
  balLabel: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  balAmount: { fontSize: 30, fontWeight: '700', color: '#FFF', marginVertical: 8 },
  balRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  balItem: { flexDirection: 'row', alignItems: 'center' },
  balItemLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  balItemVal: { fontSize: 14, fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E86A33', borderRadius: 14, paddingVertical: 14, marginBottom: 20, gap: 8 },
  addBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F0EBE1', shadowColor: '#1A4D2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 2 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#1A4D2E', marginBottom: 12 },
  seeAll: { fontSize: 13, fontWeight: '600', color: '#E86A33' },
  chartCenter: { alignItems: 'center', marginBottom: 12 },
  legendWrap: { gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, fontSize: 13, color: '#4A4A4A' },
  legendPct: { fontSize: 13, fontWeight: '600', color: '#1A4D2E' },
  empty: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1A4D2E', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#7D7D7D', marginTop: 4 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EBE1' },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txName: { fontSize: 14, fontWeight: '600', color: '#1A4D2E' },
  txDate: { fontSize: 11, color: '#7D7D7D', marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '700' },
});
