import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/contexts/ThemeContext';
import { fonts } from '../src/constants/fonts';
import { formatRupiah, parseAmountInput, formatAmountInput } from '../src/utils/format';
import { api } from '../src/utils/api';
import Slider from '@react-native-community/slider';
import { LineChart } from 'react-native-gifted-charts';

const { width } = Dimensions.get('window');

export default function Tools() {
  const { colors, theme } = useTheme();
  const router = useRouter();

  // Kalkulator Bunga Majemuk State
  const [initial, setInitial] = useState('10000000');
  const [monthly, setMonthly] = useState('1000000');
  const [returnRate, setReturnRate] = useState('10'); // in %
  const [years, setYears] = useState(10);

  // Dana Darurat State
  const [loading, setLoading] = useState(true);
  const [avgExpense, setAvgExpense] = useState(0);
  const [liquidAsset, setLiquidAsset] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [nw, trends] = await Promise.all([
          api.getNetWorth(),
          api.getMonthlyTrend(3)
        ]);
        setLiquidAsset(nw.liquid_asset || 0);
        
        const totalExp = trends.reduce((acc, curr) => acc + curr.expense, 0);
        const monthsWithExp = trends.filter(t => t.expense > 0).length || 1;
        setAvgExpense(totalExp / monthsWithExp); 
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const chartData = useMemo(() => {
    let current = parseAmountInput(initial);
    const m = parseAmountInput(monthly);
    const rRate = parseFloat(returnRate) || 0;
    const r = rRate / 100 / 12; // monthly rate
    
    const data = [];
    data.push({ value: current, label: 'Th 0' });

    let val = current;
    for (let i = 1; i <= years; i++) {
      for (let j = 1; j <= 12; j++) {
        val += m;
        val = val * (1 + r);
      }
      data.push({ value: val, label: `Th ${i}` });
    }
    return data;
  }, [initial, monthly, returnRate, years]);

  const targetEmergency = avgExpense * 6;
  const emergencyProgress = targetEmergency > 0 ? Math.min((liquidAsset / targetEmergency) * 100, 100) : 0;
  const isEmergencyMet = liquidAsset >= targetEmergency;

  return (
    <SafeAreaView style={[st.container, { backgroundColor: colors.bg }]} testID="tools-screen">
      <View style={[st.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={{ marginRight: 12 }} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>Edukasi & Alat</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
        
        {/* ================================================== */}
        {/* Kalkulator Dana Darurat */}
        {/* ================================================== */}
        <Text style={[st.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>Dana Darurat</Text>
        <Text style={[st.sectionSubtitle, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Rekomendasi dana darurat adalah 6x pengeluaran bulanan Anda.</Text>

        <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.brand} style={{ marginVertical: 20 }} />
          ) : (
            <View>
              <View style={st.rowBetween}>
                <Text style={[st.label, { color: colors.textSecondary, fontFamily: fonts.medium }]}>Target (6x {formatRupiah(avgExpense)})</Text>
                <Text style={[st.valueText, { color: colors.text, fontFamily: fonts.bold }]}>{formatRupiah(targetEmergency)}</Text>
              </View>
              
              <View style={[st.rowBetween, { marginTop: 12 }]}>
                <Text style={[st.label, { color: colors.textSecondary, fontFamily: fonts.medium }]}>Saldo Liquid Anda</Text>
                <Text style={[st.valueText, { color: colors.brand, fontFamily: fonts.bold }]}>{formatRupiah(liquidAsset)}</Text>
              </View>

              <View style={st.progressContainer}>
                <View style={[st.progressTrack, { backgroundColor: colors.border }]}>
                  <View style={[st.progressFill, { backgroundColor: isEmergencyMet ? '#10B981' : colors.brand, width: `${emergencyProgress}%` }]} />
                </View>
                <Text style={[st.progressText, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>
                  {emergencyProgress.toFixed(1)}% Terpenuhi
                </Text>
              </View>
              
              {isEmergencyMet ? (
                <View style={[st.alertBox, { backgroundColor: '#10B98115', borderColor: '#10B981' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={[st.alertText, { color: '#10B981', fontFamily: fonts.medium }]}>Hebat! Dana darurat Anda sudah aman.</Text>
                </View>
              ) : (
                <View style={[st.alertBox, { backgroundColor: colors.expense + '15', borderColor: colors.expense }]}>
                  <Ionicons name="warning" size={20} color={colors.expense} />
                  <Text style={[st.alertText, { color: colors.expense, fontFamily: fonts.medium }]}>Anda masih butuh {formatRupiah(targetEmergency - liquidAsset)} lagi.</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ================================================== */}
        {/* Kalkulator Bunga Majemuk */}
        {/* ================================================== */}
        <Text style={[st.sectionTitle, { color: colors.text, fontFamily: fonts.bold, marginTop: 30 }]}>Kalkulator Bunga Majemuk</Text>
        <Text style={[st.sectionSubtitle, { color: colors.textTertiary, fontFamily: fonts.regular }]}>Hitung proyeksi kekayaan masa depan Anda dari efek compounding.</Text>

        <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={st.inputGroup}>
            <Text style={[st.inputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>Modal Awal (Rp)</Text>
            <TextInput
              style={[st.input, { backgroundColor: colors.bgSecondary, color: colors.text, borderColor: colors.border, fontFamily: fonts.medium }, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              keyboardType="numeric"
              value={formatAmountInput(initial)}
              onChangeText={(t) => setInitial(t.replace(/\D/g, ''))}
            />
          </View>

          <View style={st.inputGroup}>
            <Text style={[st.inputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>Investasi Bulanan (Rp)</Text>
            <TextInput
              style={[st.input, { backgroundColor: colors.bgSecondary, color: colors.text, borderColor: colors.border, fontFamily: fonts.medium }, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              keyboardType="numeric"
              value={formatAmountInput(monthly)}
              onChangeText={(t) => setMonthly(t.replace(/\D/g, ''))}
            />
          </View>

          <View style={st.inputGroup}>
            <Text style={[st.inputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>Ekspektasi Return (% per tahun)</Text>
            <TextInput
              style={[st.input, { backgroundColor: colors.bgSecondary, color: colors.text, borderColor: colors.border, fontFamily: fonts.medium }, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              keyboardType="numeric"
              value={returnRate}
              onChangeText={(t) => setReturnRate(t.replace(/[^0-9.]/g, ''))}
            />
          </View>

          <View style={st.inputGroup}>
            <View style={st.rowBetween}>
              <Text style={[st.inputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>Jangka Waktu</Text>
              <Text style={[st.sliderValue, { color: colors.brand, fontFamily: fonts.bold }]}>{years} Tahun</Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={1}
              maximumValue={40}
              step={1}
              value={years}
              onValueChange={setYears}
              minimumTrackTintColor={colors.brand}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.brand}
            />
          </View>

          <View style={[st.resultBox, { backgroundColor: colors.brand + '10', borderColor: colors.brand }]} >
            <Text style={[st.resultLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]}>Proyeksi Kekayaan di Tahun ke-{years}</Text>
            <Text style={[st.resultValue, { color: colors.brand, fontFamily: fonts.bold }]}>{formatRupiah(chartData[chartData.length - 1].value)}</Text>
          </View>

          {/* Chart Proyeksi */}
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <LineChart
              data={chartData}
              width={width - 130}
              height={180}
              spacing={(width - 130) / Math.max(chartData.length - 1, 1)}
              initialSpacing={0}
              hideDataPoints
              thickness={3}
              color={colors.brand}
              startFillColor={colors.brand}
              endFillColor={colors.brand}
              startOpacity={0.3}
              endOpacity={0.05}
              areaChart
              yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10, fontFamily: fonts.regular }}
              xAxisLabelTextStyle={{ color: colors.textTertiary, fontSize: 10, fontFamily: fonts.regular }}
              rulesColor={colors.border}
              yAxisColor={colors.border}
              xAxisColor={colors.border}
              pointerConfig={{
                pointerStripHeight: 160,
                pointerStripColor: 'lightgray',
                pointerStripWidth: 2,
                pointerColor: 'lightgray',
                radius: 6,
                pointerLabelWidth: 100,
                pointerLabelHeight: 90,
                activatePointersOnLongPress: true,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (items: any) => {
                  return (
                    <View style={[st.tooltip, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                      <Text style={[st.tooltipVal, { color: colors.text, fontFamily: fonts.bold }]}>{formatRupiah(items[0].value)}</Text>
                    </View>
                  );
                },
              }}
              formatYLabel={(label) => {
                const val = Number(label);
                if (val >= 1000000000) return `${(val / 1000000000).toFixed(1)}M`;
                if (val >= 1000000) return `${(val / 1000000).toFixed(0)}Jt`;
                return `${val / 1000}k`;
              }}
            />
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24 },
  scroll: { padding: 20 },
  sectionTitle: { fontSize: 18, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, marginBottom: 16 },
  card: { padding: 20, borderRadius: 16, borderWidth: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14 },
  valueText: { fontSize: 16 },
  progressContainer: { marginTop: 16 },
  progressTrack: { height: 8, borderRadius: 4, width: '100%', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 12, marginTop: 8, textAlign: 'right' },
  alertBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 16, gap: 10 },
  alertText: { fontSize: 13, flex: 1 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  sliderValue: { fontSize: 15 },
  resultBox: { padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 8, alignItems: 'center' },
  resultLabel: { fontSize: 13, marginBottom: 4 },
  resultValue: { fontSize: 22 },
  tooltip: { padding: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tooltipVal: { fontSize: 12 },
});
