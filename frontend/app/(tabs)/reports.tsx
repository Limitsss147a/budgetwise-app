import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { PieChart, LineChart } from 'react-native-gifted-charts';
import { api } from '../../src/utils/api';
import { formatRupiah, getCurrentMonth, formatMonthYear, getMonthOffset } from '../../src/utils/format';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { CategoryBreakdown, MonthlyTrend } from '../../src/types';

export default function Reports() {
  const { colors } = useTheme();
  const [month, setMonth] = useState(getCurrentMonth());
  const [period, setPeriod] = useState(6);
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const [trend, setTrend] = useState<MonthlyTrend[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [b, t, st, sm] = await Promise.all([
        api.getCategoryBreakdown(month), api.getMonthlyTrend(period),
        api.getStats(month), api.getSummary(month),
      ]);
      setBreakdown(b.breakdown); setTrend(t); setStats(st); setSummary(sm);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [month, period]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const periods = [{ v: 3, l: '3 Bln' }, { v: 6, l: '6 Bln' }, { v: 12, l: '1 Thn' }];
  const pieData = breakdown.map(i => ({ value: i.total, color: i.category_color }));

  const incomeData = trend.map(t => ({ value: t.income }));
  const expenseData = trend.map(t => ({ value: t.expense }));

  const handleExportCsv = () => {
    const url = api.getExportCsvUrl(month);
    Linking.openURL(url);
  };

  if (loading) {
    return <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}><View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} testID="reports-screen">
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.brand} />} contentContainerStyle={s.scroll}>
        <Text style={[s.screenTitle, { color: colors.text }]}>Laporan</Text>

        {/* Bulan Navigator */}
        <View style={s.monthNav}>
          <TouchableOpacity testID="report-prev-month" onPress={() => setMonth(m => getMonthOffset(m, -1))}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.monthText, { color: colors.text }]}>{formatMonthYear(month)}</Text>
          <TouchableOpacity testID="report-next-month" onPress={() => setMonth(m => getMonthOffset(m, 1))}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Ringkasan */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderLeftColor: colors.income }]}>
            <Text style={[s.sumLabel, { color: colors.textTertiary }]}>Pemasukan</Text>
            <Text style={[s.sumVal, { color: colors.income }]}>{formatRupiah(summary?.month_income || 0)}</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderLeftColor: colors.expense }]}>
            <Text style={[s.sumLabel, { color: colors.textTertiary }]}>Pengeluaran</Text>
            <Text style={[s.sumVal, { color: colors.expense }]}>{formatRupiah(summary?.month_expense || 0)}</Text>
          </View>
        </View>

        {/* Selisih */}
        <View style={[s.netCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[s.netLabel, { color: colors.textTertiary }]}>Selisih Bulan Ini</Text>
          <Text style={[s.netVal, { color: (summary?.month_net || 0) >= 0 ? colors.income : colors.expense }]}>
            {(summary?.month_net || 0) >= 0 ? '+' : ''}{formatRupiah(summary?.month_net || 0)}
          </Text>
        </View>

        {/* Tren Bulanan */}
        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.text }]}>Tren Keuangan</Text>
          <View style={s.periodRow}>
            {periods.map(p => (
              <TouchableOpacity key={p.v} testID={`period-${p.v}`}
                style={[s.periodPill, { backgroundColor: colors.bgSecondary }, period === p.v && { backgroundColor: colors.brand }]}
                onPress={() => setPeriod(p.v)}>
                <Text style={[s.periodText, { color: colors.textTertiary }, period === p.v && { color: colors.textInverse }]}>{p.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {incomeData.length > 0 && (
            <View style={s.chartCenter}>
              <LineChart
                data={incomeData} data2={expenseData}
                color1={colors.income} color2={colors.expense}
                curved thickness={2}
                hideDataPoints={false} dataPointsColor1={colors.income} dataPointsColor2={colors.expense}
                dataPointsRadius={3}
                yAxisThickness={0} xAxisThickness={1} xAxisColor={colors.border}
                hideRules spacing={50} noOfSections={4} hideYAxisText
                width={260}
              />
              <View style={s.lineLegend}>
                <View style={s.lineLegendItem}><View style={[s.lineLegendDot, { backgroundColor: colors.income }]} /><Text style={[s.lineLegendText, { color: colors.textSecondary }]}>Pemasukan</Text></View>
                <View style={s.lineLegendItem}><View style={[s.lineLegendDot, { backgroundColor: colors.expense }]} /><Text style={[s.lineLegendText, { color: colors.textSecondary }]}>Pengeluaran</Text></View>
              </View>
            </View>
          )}
        </View>

        {/* Breakdown Pie */}
        {pieData.length > 0 && (
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>Distribusi Pengeluaran</Text>
            <View style={s.chartCenter}>
              <PieChart data={pieData} donut innerRadius={45} radius={75} innerCircleColor={colors.bgCard} />
            </View>
            <View style={s.breakdownList}>
              {breakdown.map(item => (
                <View key={item.category_id} style={s.breakdownRow}>
                  <View style={[s.bDot, { backgroundColor: item.category_color }]} />
                  <Text style={[s.bName, { color: colors.textSecondary }]} numberOfLines={1}>{item.category_name}</Text>
                  <Text style={[s.bAmt, { color: colors.text }]}>{formatRupiah(item.total)}</Text>
                  <Text style={[s.bPct, { color: colors.textTertiary }]}>{item.percentage}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Statistik */}
        {stats && (
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>Statistik</Text>
            <View style={s.statGrid}>
              <View style={[s.statItem, { backgroundColor: colors.bgSecondary }]}>
                <Ionicons name="calendar-outline" size={20} color={colors.accent} />
                <Text style={[s.statLabel, { color: colors.textTertiary }]}>Rata-rata Harian</Text>
                <Text style={[s.statVal, { color: colors.text }]}>{formatRupiah(stats.avg_daily_expense)}</Text>
              </View>
              <View style={[s.statItem, { backgroundColor: colors.bgSecondary }]}>
                <Ionicons name="flame-outline" size={20} color={colors.expense} />
                <Text style={[s.statLabel, { color: colors.textTertiary }]}>Tertinggi</Text>
                <Text style={[s.statVal, { color: colors.text }]}>{formatRupiah(stats.highest_day_amount)}</Text>
              </View>
              <View style={[s.statItem, { backgroundColor: colors.bgSecondary }]}>
                <Ionicons name="receipt-outline" size={20} color={colors.brand} />
                <Text style={[s.statLabel, { color: colors.textTertiary }]}>Transaksi</Text>
                <Text style={[s.statVal, { color: colors.text }]}>{summary?.transaction_count || 0}</Text>
              </View>
              <View style={[s.statItem, { backgroundColor: colors.bgSecondary }]}>
                <Ionicons name="today-outline" size={20} color={colors.income} />
                <Text style={[s.statLabel, { color: colors.textTertiary }]}>Hari Aktif</Text>
                <Text style={[s.statVal, { color: colors.text }]}>{stats.days_with_expense}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Export */}
        <TouchableOpacity testID="export-csv-btn" style={[s.exportBtn, { backgroundColor: colors.brand }]} onPress={handleExportCsv} activeOpacity={0.8}>
          <Ionicons name="download-outline" size={20} color="#FFF" />
          <Text style={s.exportBtnText}>Export CSV</Text>
        </TouchableOpacity>
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  screenTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 16 },
  monthText: { fontSize: 15, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 16, borderLeftWidth: 3, borderWidth: 1 },
  sumLabel: { fontSize: 12, marginBottom: 4 },
  sumVal: { fontSize: 16, fontWeight: '700' },
  netCard: { borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, alignItems: 'center' },
  netLabel: { fontSize: 12 },
  netVal: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  card: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  periodText: { fontSize: 12, fontWeight: '500' },
  chartCenter: { alignItems: 'center', marginBottom: 8 },
  lineLegend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  lineLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineLegendDot: { width: 8, height: 8, borderRadius: 4 },
  lineLegendText: { fontSize: 12 },
  breakdownList: { gap: 10, marginTop: 4 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bDot: { width: 10, height: 10, borderRadius: 5 },
  bName: { flex: 1, fontSize: 13 },
  bAmt: { fontSize: 13, fontWeight: '600' },
  bPct: { fontSize: 12, width: 40, textAlign: 'right' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: { width: '46%' as any, borderRadius: 12, padding: 14, gap: 4 },
  statLabel: { fontSize: 12 },
  statVal: { fontSize: 16, fontWeight: '700' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14, gap: 8 },
  exportBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
