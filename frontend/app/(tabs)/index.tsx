import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { api } from '../../src/utils/api';
import { formatRupiah, getCurrentMonth, formatDate, formatDayName, formatMonthYear } from '../../src/utils/format';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { fonts } from '../../src/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { Summary, CategoryBreakdown, DailyTrend, Transaction, Category } from '../../src/types';
import { Card, CardTitle } from '../../src/components/ui/Card';
import { DonutChart } from '../../src/components/ui/DonutChart';

export default function Dashboard() {
  const router = useRouter();
  const { colors, theme } = useTheme();
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Premium Background Elements */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={theme === 'dark' ? ['#0A1210', '#111827', '#0A1210'] : ['#F8FAFC', '#F1F5F9', '#EFF6FF']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[s.blob, { top: -50, left: -50, backgroundColor: colors.brand, opacity: theme === 'dark' ? 0.08 : 0.12 }]} />
        <View style={[s.blob, { bottom: 100, right: -50, backgroundColor: '#10B981', opacity: theme === 'dark' ? 0.05 : 0.08 }]} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.brand} />} contentContainerStyle={s.scroll}>
          {/* Enhanced Premium Header */}
          <View style={s.headerWrapper}>
            <View style={s.greetRow}>
              <View>
                <Text style={[s.greet, { color: colors.textTertiary, fontFamily: fonts.medium }]}>Halo,</Text>
                <Text style={[s.user, { color: colors.text, fontFamily: fonts.bold }]}>{user?.name || 'Pengguna'}</Text>
              </View>
              <TouchableOpacity testID="settings-btn" onPress={() => router.push('/settings')} style={[s.iconBtn, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: colors.border }]}>
                <Ionicons name="person-circle-outline" size={28} color={colors.brand} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance Glass Card */}
          <View style={s.glassWrapper}>
            <BlurView intensity={theme === 'dark' ? 40 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={s.glassCard}>
              <LinearGradient
                colors={['#10B981CC', '#064E3BCC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.cardGradient}
              >
                <Text style={[s.balLabel, { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.8)' }]}>Total Saldo</Text>
                <Text style={[s.balVal, { fontFamily: fonts.bold, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }]}>
                  {formatRupiah(summary?.balance || 0)}
                </Text>
                <View style={s.balLine} />
                <View style={s.balGrid}>
                  <View style={s.balItem}>
                    <View style={[s.balIcon, { backgroundColor: 'rgba(74, 222, 128, 0.2)' }]}>
                      <Ionicons name="arrow-up" size={14} color="#4ADE80" />
                    </View>
                    <View>
                      <Text style={[s.balItemLabel, { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.regular }]}>Masuk</Text>
                      <Text style={[s.balItemVal, { color: '#FFF', fontFamily: fonts.semiBold }]}>{formatRupiah(summary?.month_income || 0)}</Text>
                    </View>
                  </View>
                  <View style={s.balItem}>
                    <View style={[s.balIcon, { backgroundColor: 'rgba(251, 113, 133, 0.2)' }]}>
                      <Ionicons name="arrow-down" size={14} color="#FB7185" />
                    </View>
                    <View>
                      <Text style={[s.balItemLabel, { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.regular }]}>Keluar</Text>
                      <Text style={[s.balItemVal, { color: '#FFF', fontFamily: fonts.semiBold }]}>{formatRupiah(summary?.month_expense || 0)}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.balLine} />
                <View style={s.balBottom}>
                  <View>
                    <Text style={[s.balSub, { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.regular }]}>Selisih Bulan Ini</Text>
                    <Text style={[s.balChange, { color: '#FFF', fontFamily: fonts.semiBold }]}>
                      {(summary?.month_income || 0) - (summary?.month_expense || 0) >= 0 ? '+' : ''}{formatRupiah((summary?.month_income || 0) - (summary?.month_expense || 0))}
                    </Text>
                  </View>
                  <Ionicons name={((summary?.month_income || 0) - (summary?.month_expense || 0)) >= 0 ? 'stats-chart' : 'trending-down'} size={24} color="rgba(255,255,255,0.6)" />
                </View>
              </LinearGradient>
            </BlurView>
          </View>

          {/* Regular Cards with Glass Effect */}
          {breakdown.length > 0 && (
            <Card style={{ marginBottom: 24 }}>
              <CardTitle>Alokasi Pengeluaran</CardTitle>
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <DonutChart
                  data={breakdown.map(item => ({
                    value: item.total,
                    color: item.category_color || colors.brand,
                    label: item.category_name,
                  }))}
                  size={240}
                  strokeWidth={32}
                  centerContent={
                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: fonts.regular, marginBottom: 2 }}>Total Pengeluaran</Text>
                      <Text style={{ fontSize: 18, color: colors.text, fontFamily: fonts.bold }}>{formatRupiah(summary?.month_expense || 0)}</Text>
                    </View>
                  }
                />
              </View>
              
              <View style={[s.balLine, { marginVertical: 0, marginBottom: 20, backgroundColor: colors.border }]} />
              
              <View style={s.legendWrap}>
                {breakdown.map((item, idx) => (
                  <View key={idx} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: item.category_color }]} />
                    <Text style={[s.legendText, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>{item.category_name}</Text>
                    <Text style={[s.legendPct, { color: colors.text, fontFamily: fonts.semiBold }]}>{formatRupiah(item.total)}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {barData.some(d => d.value > 0) && (
            <View style={s.glassWrapperSmall}>
              <BlurView intensity={theme === 'dark' ? 20 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={s.glassCardSmall}>
                <View style={[s.cardInner, { borderColor: colors.border }]}>
                  <Text style={[s.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Tren 7 Hari Terakhir</Text>
                  <View style={s.chartCenter}>
                    <BarChart data={barData} barWidth={26} spacing={14} barBorderRadius={6} frontColor={colors.brand}
                      yAxisThickness={0} xAxisThickness={1} xAxisColor={colors.border} noOfSections={4}
                      hideRules hideYAxisText xAxisLabelTextStyle={{ color: colors.textTertiary, fontSize: 10, fontFamily: fonts.regular }}
                    />
                  </View>
                </View>
              </BlurView>
            </View>
          )}

          <View style={s.glassWrapperSmall}>
             <BlurView intensity={theme === 'dark' ? 20 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={s.glassCardSmall}>
                <View style={[s.cardInner, { borderColor: colors.border }]}>
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
             </BlurView>
          </View>
          <View style={{ height: 20 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  headerWrapper: { marginBottom: 20 },
  greetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greet: { fontSize: 14 },
  user: { fontSize: 20, marginTop: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  glassWrapper: { borderRadius: 24, overflow: 'hidden', marginBottom: 24, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 16 },
  glassWrapperSmall: { borderRadius: 20, overflow: 'hidden', marginBottom: 16, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10 },
  glassWrapperLarge: { borderRadius: 24, overflow: 'hidden', marginBottom: 16, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 12 },
  glassCard: { borderRadius: 24 },
  glassCardSmall: { borderRadius: 20 },
  glassCardLarge: { borderRadius: 24 },
  cardGradient: { padding: 24, borderRadius: 24 },
  cardInner: { padding: 20, borderRadius: 20, borderWidth: 1 },
  blob: { position: 'absolute', width: 300, height: 300, borderRadius: 150, filter: Platform.OS === 'ios' ? 'blur(60px)' : 'none' },
  balLabel: { fontSize: 13 },
  balVal: { fontSize: 32, marginVertical: 8 },
  balLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 },
  balGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  balIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  balItemLabel: { fontSize: 11, marginBottom: 2 },
  balItemVal: { fontSize: 14 },
  balBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balSub: { fontSize: 11, marginBottom: 4 },
  balChange: { fontSize: 16 },

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
