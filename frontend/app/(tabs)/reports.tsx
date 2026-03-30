import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { PieChart, LineChart } from 'react-native-gifted-charts';
import { api } from '../../src/utils/api';
import { formatRupiah, getCurrentMonth, formatMonthYear, getMonthOffset } from '../../src/utils/format';
import type { CategoryBreakdown, MonthlyTrend } from '../../src/types';

export default function Reports() {
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
    return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color="#1A4D2E" /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.container} testID="reports-screen">
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#1A4D2E" />} contentContainerStyle={s.scroll}>
        <Text style={s.screenTitle}>Laporan</Text>

        {/* Bulan Navigator */}
        <View style={s.monthNav}>
          <TouchableOpacity testID="report-prev-month" onPress={() => setMonth(m => getMonthOffset(m, -1))}>
            <Ionicons name="chevron-back" size={22} color="#1A4D2E" />
          </TouchableOpacity>
          <Text style={s.monthText}>{formatMonthYear(month)}</Text>
          <TouchableOpacity testID="report-next-month" onPress={() => setMonth(m => getMonthOffset(m, 1))}>
            <Ionicons name="chevron-forward" size={22} color="#1A4D2E" />
          </TouchableOpacity>
        </View>

        {/* Ringkasan */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { borderLeftColor: '#3A6E4B' }]}>
            <Text style={s.sumLabel}>Pemasukan</Text>
            <Text style={[s.sumVal, { color: '#3A6E4B' }]}>{formatRupiah(summary?.month_income || 0)}</Text>
          </View>
          <View style={[s.summaryCard, { borderLeftColor: '#D34A3E' }]}>
            <Text style={s.sumLabel}>Pengeluaran</Text>
            <Text style={[s.sumVal, { color: '#D34A3E' }]}>{formatRupiah(summary?.month_expense || 0)}</Text>
          </View>
        </View>

        {/* Selisih */}
        <View style={s.netCard}>
          <Text style={s.netLabel}>Selisih Bulan Ini</Text>
          <Text style={[s.netVal, { color: (summary?.month_net || 0) >= 0 ? '#3A6E4B' : '#D34A3E' }]}>
            {(summary?.month_net || 0) >= 0 ? '+' : ''}{formatRupiah(summary?.month_net || 0)}
          </Text>
        </View>

        {/* Tren Bulanan */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Tren Keuangan</Text>
          <View style={s.periodRow}>
            {periods.map(p => (
              <TouchableOpacity key={p.v} testID={`period-${p.v}`} style={[s.periodPill, period === p.v && s.periodActive]}
                onPress={() => setPeriod(p.v)}>
                <Text style={[s.periodText, period === p.v && s.periodTextActive]}>{p.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {incomeData.length > 0 && (
            <View style={s.chartCenter}>
              <LineChart
                data={incomeData} data2={expenseData}
                color1="#3A6E4B" color2="#D34A3E"
                curved thickness={2}
                hideDataPoints={false} dataPointsColor1="#3A6E4B" dataPointsColor2="#D34A3E"
                dataPointsRadius={3}
                yAxisThickness={0} xAxisThickness={1} xAxisColor="#F0EBE1"
                hideRules spacing={50} noOfSections={4} hideYAxisText
                width={260}
              />
              <View style={s.lineLegend}>
                <View style={s.lineLegendItem}><View style={[s.lineLegendDot, { backgroundColor: '#3A6E4B' }]} /><Text style={s.lineLegendText}>Pemasukan</Text></View>
                <View style={s.lineLegendItem}><View style={[s.lineLegendDot, { backgroundColor: '#D34A3E' }]} /><Text style={s.lineLegendText}>Pengeluaran</Text></View>
              </View>
            </View>
          )}
        </View>

        {/* Breakdown Pie */}
        {pieData.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Distribusi Pengeluaran</Text>
            <View style={s.chartCenter}>
              <PieChart data={pieData} donut innerRadius={45} radius={75} innerCircleColor="#FFF" />
            </View>
            <View style={s.breakdownList}>
              {breakdown.map(item => (
                <View key={item.category_id} style={s.breakdownRow}>
                  <View style={[s.bDot, { backgroundColor: item.category_color }]} />
                  <Text style={s.bName} numberOfLines={1}>{item.category_name}</Text>
                  <Text style={s.bAmt}>{formatRupiah(item.total)}</Text>
                  <Text style={s.bPct}>{item.percentage}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Statistik */}
        {stats && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Statistik</Text>
            <View style={s.statGrid}>
              <View style={s.statItem}>
                <Ionicons name="calendar-outline" size={20} color="#E86A33" />
                <Text style={s.statLabel}>Rata-rata Harian</Text>
                <Text style={s.statVal}>{formatRupiah(stats.avg_daily_expense)}</Text>
              </View>
              <View style={s.statItem}>
                <Ionicons name="flame-outline" size={20} color="#D34A3E" />
                <Text style={s.statLabel}>Tertinggi</Text>
                <Text style={s.statVal}>{formatRupiah(stats.highest_day_amount)}</Text>
              </View>
              <View style={s.statItem}>
                <Ionicons name="receipt-outline" size={20} color="#1A4D2E" />
                <Text style={s.statLabel}>Transaksi</Text>
                <Text style={s.statVal}>{summary?.transaction_count || 0}</Text>
              </View>
              <View style={s.statItem}>
                <Ionicons name="today-outline" size={20} color="#7D8F69" />
                <Text style={s.statLabel}>Hari Aktif</Text>
                <Text style={s.statVal}>{stats.days_with_expense}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Export */}
        <TouchableOpacity testID="export-csv-btn" style={s.exportBtn} onPress={handleExportCsv} activeOpacity={0.8}>
          <Ionicons name="download-outline" size={20} color="#FFF" />
          <Text style={s.exportBtnText}>Export CSV</Text>
        </TouchableOpacity>
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  screenTitle: { fontSize: 24, fontWeight: '700', color: '#1A4D2E', marginBottom: 8 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 16 },
  monthText: { fontSize: 15, fontWeight: '600', color: '#1A4D2E' },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 16, borderLeftWidth: 3, borderWidth: 1, borderColor: '#F0EBE1' },
  sumLabel: { fontSize: 12, color: '#7D7D7D', marginBottom: 4 },
  sumVal: { fontSize: 16, fontWeight: '700' },
  netCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F0EBE1', alignItems: 'center' },
  netLabel: { fontSize: 12, color: '#7D7D7D' },
  netVal: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F0EBE1' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1A4D2E', marginBottom: 12 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F4EFEB' },
  periodActive: { backgroundColor: '#1A4D2E' },
  periodText: { fontSize: 12, fontWeight: '500', color: '#7D7D7D' },
  periodTextActive: { color: '#FFF' },
  chartCenter: { alignItems: 'center', marginBottom: 8 },
  lineLegend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  lineLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineLegendDot: { width: 8, height: 8, borderRadius: 4 },
  lineLegendText: { fontSize: 12, color: '#4A4A4A' },
  breakdownList: { gap: 10, marginTop: 4 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bDot: { width: 10, height: 10, borderRadius: 5 },
  bName: { flex: 1, fontSize: 13, color: '#4A4A4A' },
  bAmt: { fontSize: 13, fontWeight: '600', color: '#1A4D2E' },
  bPct: { fontSize: 12, color: '#7D7D7D', width: 40, textAlign: 'right' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: { width: '46%' as any, backgroundColor: '#F9F9F6', borderRadius: 12, padding: 14, gap: 4 },
  statLabel: { fontSize: 12, color: '#7D7D7D' },
  statVal: { fontSize: 16, fontWeight: '700', color: '#1A4D2E' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A4D2E', borderRadius: 14, paddingVertical: 14, gap: 8 },
  exportBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
