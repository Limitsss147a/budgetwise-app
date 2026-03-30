import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { api } from '../../src/utils/api';
import { formatRupiah, getCurrentMonth, formatDate, formatDayName, formatMonthYear } from '../../src/utils/format';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { fonts } from '../../src/constants/fonts';
import type { Summary, CategoryBreakdown, DailyTrend, Transaction, Category } from '../../src/types';

export default function Dashboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
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
    return <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}><View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View></SafeAreaView>;
  }

  const pieData = breakdown.map(item => ({ value: item.total, color: item.category_color }));
  const barData = dailyTrend.map(day => ({
    value: day.expense, label: formatDayName(day.date), frontColor: colors.brand,
  }));

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} testID="dashboard-screen">
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.brand} />} contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={[s.greeting, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Selamat Datang, {user?.name || 'User'} 👋</Text>
            <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>Keuanganmu</Text>
          </View>
        </View>

        {/* Kartu Saldo */}
        <View style={[s.balanceCard, { backgroundColor: colors.brand }]} testID="balance-card">
          <Text style={[s.balLabel, { fontFamily: fonts.regular }]}>Saldo Total</Text>
          <Text style={[s.balAmount, { fontFamily: fonts.bold }]}>{formatRupiah(summary?.balance || 0)}</Text>
          <View style={s.balRow}>
            <View style={s.balItem}>
              <Ionicons name="arrow-up-circle" size={20} color="#A8F0C6" />
              <View style={{ marginLeft: 6 }}>
                <Text style={[s.balItemLabel, { fontFamily: fonts.regular }]}>Pemasukan</Text>
                <Text style={[s.balItemVal, { color: '#A8F0C6', fontFamily: fonts.semiBold }]}>+{formatRupiah(summary?.month_income || 0)}</Text>
              </View>
            </View>
            <View style={s.balItem}>
              <Ionicons name="arrow-down-circle" size={20} color="#FFB4B4" />
              <View style={{ marginLeft: 6 }}>
                <Text style={[s.balItemLabel, { fontFamily: fonts.regular }]}>Pengeluaran</Text>
                <Text style={[s.balItemVal, { color: '#FFB4B4', fontFamily: fonts.semiBold }]}>-{formatRupiah(summary?.month_expense || 0)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tombol Tambah */}
        <TouchableOpacity testID="add-transaction-button" style={[s.addBtn, { backgroundColor: colors.accent }]} onPress={() => router.push('/add-transaction')} activeOpacity={0.8}>
          <Ionicons name="add-circle" size={22} color="#FFF" />
          <Text style={[s.addBtnText, { fontFamily: fonts.semiBold }]}>Tambah Transaksi</Text>
        </TouchableOpacity>

        {/* Grafik Pengeluaran */}
        {pieData.length > 0 && (
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="expense-breakdown-card">
            <Text style={[s.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Pengeluaran {formatMonthYear(month)}</Text>
            <View style={s.chartCenter}>
              <PieChart data={pieData} donut innerRadius={50} radius={80} innerCircleColor={colors.bgCard}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: fonts.regular }}>Total</Text>
                    <Text style={{ fontSize: 13, color: colors.text, fontFamily: fonts.bold }}>{formatRupiah(summary?.month_expense || 0)}</Text>
                  </View>
                )}
              />
            </View>
            <View style={s.legendWrap}>
              {breakdown.slice(0, 5).map(item => (
                <View key={item.category_id} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: item.category_color }]} />
                  <Text style={[s.legendText, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>{item.category_name}</Text>
                  <Text style={[s.legendPct, { color: colors.text, fontFamily: fonts.semiBold }]}>{item.percentage}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Grafik Tren 7 Hari */}
        {barData.some(d => d.value > 0) && (
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="daily-trend-card">
            <Text style={[s.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Tren 7 Hari Terakhir</Text>
            <View style={s.chartCenter}>
              <BarChart data={barData} barWidth={26} spacing={14} barBorderRadius={6} frontColor={colors.brand}
                yAxisThickness={0} xAxisThickness={1} xAxisColor={colors.border} noOfSections={4}
                hideRules hideYAxisText xAxisLabelTextStyle={{ color: colors.textTertiary, fontSize: 10, fontFamily: fonts.regular }}
              />
            </View>
          </View>
        )}

        {/* Transaksi Terakhir */}
        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="recent-transactions-card">
          <View style={s.cardHead}>
            <Text style={[s.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Transaksi Terakhir</Text>
            <TouchableOpacity testID="see-all-transactions" onPress={() => router.push('/(tabs)/transactions' as any)}>
              <Text style={[s.seeAll, { color: colors.accent, fontFamily: fonts.semiBold }]}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>
          {recentTx.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={48} color={colors.textTertiary} />
              <Text style={[s.emptyTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Belum ada transaksi</Text>
              <Text style={[s.emptySub, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Mulai catat keuanganmu!</Text>
            </View>
          ) : (
            recentTx.map(tx => {
              const cat = catMap(tx.category_id);
              return (
                <View key={tx.id} style={[s.txRow, { borderBottomColor: colors.border }]} testID={`recent-tx-${tx.id}`}>
                  <View style={[s.txIcon, { backgroundColor: (cat?.color || '#7D7D7D') + '18' }]}>
                    <Ionicons name={(cat?.icon || 'ellipsis-horizontal') as any} size={18} color={cat?.color || '#7D7D7D'} />
                  </View>
                  <View style={s.txInfo}>
                    <Text style={[s.txName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{cat?.name || 'Lainnya'}</Text>
                    <Text style={[s.txDate, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{formatDate(tx.date)}</Text>
                  </View>
                  <Text style={[s.txAmt, { color: tx.type === 'income' ? colors.income : colors.expense, fontFamily: fonts.bold }]}>
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
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  greeting: { fontSize: 14 },
  headerTitle: { fontSize: 28 },
  balanceCard: { borderRadius: 20, padding: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8 },
  balLabel: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  balAmount: { fontSize: 30, color: '#FFF', marginVertical: 8 },
  balRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  balItem: { flexDirection: 'row', alignItems: 'center' },
  balItemLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  balItemVal: { fontSize: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14, marginBottom: 20, gap: 8 },
  addBtnText: { fontSize: 15, color: '#FFF' },
  card: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 2 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 17, marginBottom: 12 },
  seeAll: { fontSize: 13 },
  chartCenter: { alignItems: 'center', marginBottom: 12 },
  legendWrap: { gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, fontSize: 13 },
  legendPct: { fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 15, marginTop: 12 },
  emptySub: { fontSize: 13, marginTop: 4 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txName: { fontSize: 14 },
  txDate: { fontSize: 11, marginTop: 2 },
  txAmt: { fontSize: 14 },
});
