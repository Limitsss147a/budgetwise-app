import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { PieChart, LineChart } from 'react-native-gifted-charts';
import { api } from '../../src/utils/api';
import { formatRupiah, getCurrentMonth, formatMonthYear, getMonthOffset } from '../../src/utils/format';
import { useTheme } from '../../src/contexts/ThemeContext';
import { fonts } from '../../src/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import type { CategoryBreakdown, MonthlyTrend } from '../../src/types';

export default function Reports() {
  const { colors, theme } = useTheme();
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
  const getShortMonth = (yyyymm: string) => {
    if (!yyyymm) return '';
    const m = parseInt(yyyymm.split('-')[1], 10);
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
    return names[m - 1] || '';
  };
  const incomeData = trend.map(t => ({ 
    value: t.income, 
    label: getShortMonth(t.month), 
    labelTextStyle: { color: colors.textTertiary, fontSize: 10, fontFamily: fonts.regular } 
  }));
  const expenseData = trend.map(t => ({ value: t.expense }));

  const handleExportCsv = () => {
    const url = api.getExportCsvUrl(month);
    Linking.openURL(url);
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

      <SafeAreaView style={{ flex: 1 }} testID="reports-screen">
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.brand} />} contentContainerStyle={st.scroll}>
          <Text style={[st.screenTitle, { color: colors.text, fontFamily: fonts.bold }]}>Laporan</Text>

          <View style={st.monthNav}>
            <TouchableOpacity testID="report-prev-month" onPress={() => setMonth(m => getMonthOffset(m, -1))}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[st.monthText, { color: colors.text, fontFamily: fonts.semiBold }]}>{formatMonthYear(month)}</Text>
            <TouchableOpacity testID="report-next-month" onPress={() => setMonth(m => getMonthOffset(m, 1))}>
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={st.summaryRow}>
            <View style={st.glassWrapperSmall}>
              <BlurView intensity={theme === 'dark' ? 20 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={st.glassCardSmall}>
                <View style={[st.summaryCardInner, { borderLeftColor: '#4ADE80', borderLeftWidth: 3, borderColor: colors.border }]}>
                  <Text style={[st.sumLabel, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Pemasukan</Text>
                  <Text style={[st.sumVal, { color: '#4ADE80', fontFamily: fonts.bold }]}>{formatRupiah(summary?.month_income || 0)}</Text>
                </View>
              </BlurView>
            </View>
            <View style={st.glassWrapperSmall}>
              <BlurView intensity={theme === 'dark' ? 20 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={st.glassCardSmall}>
                <View style={[st.summaryCardInner, { borderLeftColor: '#FB7185', borderLeftWidth: 3, borderColor: colors.border }]}>
                  <Text style={[st.sumLabel, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Pengeluaran</Text>
                  <Text style={[st.sumVal, { color: '#FB7185', fontFamily: fonts.bold }]}>{formatRupiah(summary?.month_expense || 0)}</Text>
                </View>
              </BlurView>
            </View>
          </View>

          <View style={st.glassWrapper}>
            <BlurView intensity={theme === 'dark' ? 20 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={st.glassCard}>
              <View style={[st.netCardInner, { borderColor: colors.border }]}>
                <Text style={[st.netLabel, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Selisih Bulan Ini</Text>
                <Text style={[st.netVal, { color: (summary?.month_net || 0) >= 0 ? '#4ADE80' : '#FB7185', fontFamily: fonts.bold }]}>
                  {(summary?.month_net || 0) >= 0 ? '+' : ''}{formatRupiah(summary?.month_net || 0)}
                </Text>
              </View>
            </BlurView>
          </View>

          <View style={st.glassWrapperLarge}>
            <BlurView intensity={theme === 'dark' ? 20 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={st.glassCardLarge}>
              <View style={[st.cardInner, { borderColor: colors.border }]}>
                <Text style={[st.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Tren Keuangan</Text>
                <View style={st.periodRow}>
                  {periods.map(p => (
                    <TouchableOpacity key={p.v} testID={`period-${p.v}`}
                      style={[st.periodPill, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, period === p.v && { backgroundColor: colors.brand }]}
                      onPress={() => setPeriod(p.v)}>
                      <Text style={[st.periodText, { color: colors.textTertiary, fontFamily: fonts.medium }, period === p.v && { color: colors.textInverse }]}>{p.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {incomeData.length > 0 && (
                  <View style={st.chartCenter}>
                    <LineChart
                      data={incomeData} data2={expenseData}
                      color1="#4ADE80" color2="#FB7185"
                      curved thickness={2}
                      hideDataPoints={false} dataPointsColor1="#4ADE80" dataPointsColor2="#FB7185"
                      dataPointsRadius={3}
                      yAxisThickness={1} yAxisColor={colors.border} xAxisThickness={1} xAxisColor={colors.border}
                      hideRules spacing={65} noOfSections={4} 
                      yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10, fontFamily: fonts.regular }}
                      formatYLabel={(val: string) => {
                        const v = Number(val);
                        return v >= 1000000 ? (v / 1000000).toFixed(0) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : String(v);
                      }}
                      width={280}
                      backgroundColor="transparent"
                    />
                    <View style={st.lineLegend}>
                      <View style={st.lineLegendItem}><View style={[st.lineLegendDot, { backgroundColor: '#4ADE80' }]} /><Text style={[st.lineLegendText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>Pemasukan</Text></View>
                      <View style={st.lineLegendItem}><View style={[st.lineLegendDot, { backgroundColor: '#FB7185' }]} /><Text style={[st.lineLegendText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>Pengeluaran</Text></View>
                    </View>
                  </View>
                )}
              </View>
            </BlurView>
          </View>

          {pieData.length > 0 && (
            <View style={st.glassWrapperLarge}>
              <BlurView intensity={theme === 'dark' ? 20 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={st.glassCardLarge}>
                <View style={[st.cardInner, { borderColor: colors.border }]}>
                  <Text style={[st.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Distribusi Pengeluaran</Text>
                  <View style={st.chartCenter}>
                    <PieChart data={pieData} donut innerRadius={45} radius={75} innerCircleColor="transparent" />
                  </View>
                  <View style={st.breakdownList}>
                    {breakdown.map(item => (
                      <View key={item.category_id} style={st.breakdownRow}>
                        <View style={[st.bDot, { backgroundColor: item.category_color }]} />
                        <Text style={[st.bName, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>{item.category_name}</Text>
                        <Text style={[st.bAmt, { color: colors.text, fontFamily: fonts.semiBold }]}>{formatRupiah(item.total)}</Text>
                        <Text style={[st.bPct, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{item.percentage}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </BlurView>
            </View>
          )}

          {stats && (
            <View style={st.glassWrapperLarge}>
              <BlurView intensity={theme === 'dark' ? 20 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={st.glassCardLarge}>
                <View style={[st.cardInner, { borderColor: colors.border }]}>
                  <Text style={[st.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Statistik</Text>
                  <View style={st.statGrid}>
                    <View style={[st.statItem, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                      <Ionicons name="calendar-outline" size={20} color={colors.accent} />
                      <Text style={[st.statLabel, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Rata-rata Harian</Text>
                      <Text style={[st.statVal, { color: colors.text, fontFamily: fonts.bold }]}>{formatRupiah(stats.avg_daily_expense)}</Text>
                    </View>
                    <View style={[st.statItem, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                      <Ionicons name="flame-outline" size={20} color="#FB7185" />
                      <Text style={[st.statLabel, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Tertinggi</Text>
                      <Text style={[st.statVal, { color: colors.text, fontFamily: fonts.bold }]}>{formatRupiah(stats.highest_day_amount)}</Text>
                    </View>
                    <View style={[st.statItem, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                      <Ionicons name="receipt-outline" size={20} color={colors.brand} />
                      <Text style={[st.statLabel, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Transaksi</Text>
                      <Text style={[st.statVal, { color: colors.text, fontFamily: fonts.bold }]}>{summary?.transaction_count || 0}</Text>
                    </View>
                    <View style={[st.statItem, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                      <Ionicons name="today-outline" size={20} color="#4ADE80" />
                      <Text style={[st.statLabel, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Hari Aktif</Text>
                      <Text style={[st.statVal, { color: colors.text, fontFamily: fonts.bold }]}>{stats.days_with_expense}</Text>
                    </View>
                  </View>
                </View>
              </BlurView>
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  screenTitle: { fontSize: 24, marginBottom: 8 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 16 },
  monthText: { fontSize: 15 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  glassWrapper: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10 },
  glassWrapperSmall: { flex: 1, borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 },
  glassWrapperLarge: { borderRadius: 20, overflow: 'hidden', marginBottom: 16, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 12 },
  glassCard: { borderRadius: 16 },
  glassCardSmall: { borderRadius: 16 },
  glassCardLarge: { borderRadius: 20 },
  summaryCardInner: { padding: 16, borderRadius: 16, borderWidth: 1 },
  netCardInner: { padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  cardInner: { padding: 20, borderRadius: 20, borderWidth: 1 },
  blob: { position: 'absolute', width: 300, height: 300, borderRadius: 150, filter: Platform.OS === 'ios' ? 'blur(60px)' : 'none' },
  sumLabel: { fontSize: 12, marginBottom: 4 },
  sumVal: { fontSize: 16 },
  netCard: { borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, alignItems: 'center' },
  netLabel: { fontSize: 12 },
  netVal: { fontSize: 22, marginTop: 4 },
  card: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 16, marginBottom: 12 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  periodText: { fontSize: 12 },
  chartCenter: { alignItems: 'center', marginBottom: 8 },
  lineLegend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  lineLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineLegendDot: { width: 8, height: 8, borderRadius: 4 },
  lineLegendText: { fontSize: 12 },
  breakdownList: { gap: 10, marginTop: 4 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bDot: { width: 10, height: 10, borderRadius: 5 },
  bName: { flex: 1, fontSize: 13 },
  bAmt: { fontSize: 13 },
  bPct: { fontSize: 12, width: 40, textAlign: 'right' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: { width: '46%' as any, borderRadius: 12, padding: 14, gap: 4 },
  statLabel: { fontSize: 12 },
  statVal: { fontSize: 16 },

});
