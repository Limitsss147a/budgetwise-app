import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/utils/api';
import { formatRupiah } from '../../src/utils/format';
import { useTheme } from '../../src/contexts/ThemeContext';
import { fonts } from '../../src/constants/fonts';

interface Holding {
  ticker: string;
  lot_count: number;
  shares: number;
  average_buy_price: number;
  current_price: number;
  total_value: number;
  unrealized_pl: number;
  unrealized_pl_percentage: number;
  pbv?: number | null;
  roe?: number | null;
  der?: number | null;
}

interface NetWorthData {
  liquid_asset: number;
  total_investment_value: number;
  total_asset_value: number;
  total_unrealized_pl: number;
  total_unrealized_pl_percentage: number;
  holdings: Holding[];
}

export default function PortfolioScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [selectedStock, setSelectedStock] = useState<Holding | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Add Investment state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [tickerInput, setTickerInput] = useState('');
  const [lotInput, setLotInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getNetWorth();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleUpdatePrices = async () => {
    try {
      setRefreshing(true);
      await api.updateMarketPrices();
      await loadData();
    } catch(e) {
      console.error(e);
      setRefreshing(false);
    }
  };

  const openSheet = (stock: Holding) => {
    setSelectedStock(stock);
    setModalVisible(true);
  };

  const handleAddInvestment = async () => {
    if (!tickerInput || !lotInput || !priceInput) {
      Alert.alert('Error', 'Harap isi semua field');
      return;
    }
    try {
      setSubmitting(true);
      await api.addInvestment({
        ticker: tickerInput,
        lot_count: parseInt(lotInput),
        average_buy_price: parseFloat(priceInput)
      });
      setAddModalVisible(false);
      setTickerInput('');
      setLotInput('');
      setPriceInput('');
      loadData(); // refresh
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: Holding }) => {
    const isProfit = item.unrealized_pl >= 0;
    const plColor = isProfit ? '#10B981' : '#EF4444'; // Emerald green vs Red
    
    return (
      <TouchableOpacity 
        style={[styles.stockCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() => openSheet(item)}
      >
        <View style={styles.stockRow}>
          <View>
            <Text style={[styles.tickerText, { color: colors.text }]}>{item.ticker}</Text>
            <Text style={[styles.lotText, { color: colors.textSecondary }]}>{item.lot_count} lot • Avg: {formatRupiah(item.average_buy_price)}</Text>
          </View>
          <View style={styles.alignRight}>
            <Text style={[styles.valueText, { color: colors.text }]}>{formatRupiah(item.total_value)}</Text>
            <Text style={[styles.plText, { color: plColor }]}>
              {isProfit ? '+' : ''}{formatRupiah(item.unrealized_pl)} ({isProfit ? '+' : ''}{item.unrealized_pl_percentage.toFixed(2)}%)
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Portofolio Investasi</Text>
        <TouchableOpacity onPress={handleUpdatePrices}>
          <Ionicons name="refresh-circle" size={28} color={colors.brand} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={data?.holdings || []}
        keyExtractor={item => item.ticker}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.brand} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={[styles.netWorthCard, { backgroundColor: colors.brand }]}>
              <Text style={styles.nwLabel}>Kekayaan Bersih (Net Worth)</Text>
              <Text style={styles.nwAmount}>{formatRupiah(data?.total_asset_value || 0)}</Text>
              
              <View style={styles.nwDivider} />
              
              <View style={styles.nwRow}>
                <View style={styles.nwItem}>
                  <Text style={styles.nwItemLabel}>Aset Likuid</Text>
                  <Text style={styles.nwItemVal}>{formatRupiah(data?.liquid_asset || 0)}</Text>
                </View>
                <View style={[styles.nwItem, { alignItems: 'flex-end' }]}>
                  <Text style={styles.nwItemLabel}>Aset Investasi</Text>
                  <Text style={styles.nwItemVal}>{formatRupiah(data?.total_investment_value || 0)}</Text>
                </View>
              </View>
              
              <View style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={styles.nwItemLabel}>Total Unrealized P/L</Text>
                <Text style={[styles.nwItemVal, { color: (data?.total_unrealized_pl || 0) >= 0 ? '#A8F0C6' : '#FFB4B4' }]}>
                  {(data?.total_unrealized_pl || 0) >= 0 ? '+' : ''}{formatRupiah(data?.total_unrealized_pl || 0)} ({(data?.total_unrealized_pl_percentage || 0).toFixed(2)}%)
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Daftar Aset</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="trending-up-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Belum ada investasi</Text>
            <Text style={[styles.emptySub, { color: colors.textTertiary }]}>Mulai masukkan emiten sahammu!</Text>
          </View>
        }
        renderItem={renderItem}
      />

      {/* Detail Bottom Sheet */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View style={[styles.sheetContainer, { backgroundColor: colors.bgCard }]}>
            {selectedStock && (
              <>
                <View style={styles.sheetHandle} />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{selectedStock.ticker}</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>Detail Fundamental & Posisi</Text>
                
                <View style={styles.metricsGrid}>
                  <View style={[styles.metricBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Harga Saat Ini</Text>
                    <Text style={[styles.metricVal, { color: colors.text }]}>{formatRupiah(selectedStock.current_price)}</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Harga Rata-Rata</Text>
                    <Text style={[styles.metricVal, { color: colors.text }]}>{formatRupiah(selectedStock.average_buy_price)}</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>PBV</Text>
                    <Text style={[styles.metricVal, { color: colors.text }]}>{selectedStock.pbv ? selectedStock.pbv.toFixed(2) : '-'}</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>ROE</Text>
                    <Text style={[styles.metricVal, { color: colors.text }]}>{selectedStock.roe ? (selectedStock.roe * 100).toFixed(2) + '%' : '-'}</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>DER</Text>
                    <Text style={[styles.metricVal, { color: colors.text }]}>{selectedStock.der ? selectedStock.der.toFixed(2) : '-'}</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Total Lot</Text>
                    <Text style={[styles.metricVal, { color: colors.text }]}>{selectedStock.lot_count}</Text>
                  </View>
                </View>

                <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.brand }]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.closeBtnText}>Tutup</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Investment Modal */}
      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayCenter}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAddModalVisible(false)} />
          <View style={[styles.dialogContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>Tambah Investasi</Text>
            
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              placeholder="Kode Saham (e.g. BBCA)"
              placeholderTextColor={colors.textTertiary}
              value={tickerInput}
              onChangeText={setTickerInput}
              autoCapitalize="characters"
            />
            
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              placeholder="Jumlah Lot"
              placeholderTextColor={colors.textTertiary}
              value={lotInput}
              onChangeText={setLotInput}
              keyboardType="number-pad"
            />
            
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              placeholder="Harga Rata-rata Beli"
              placeholderTextColor={colors.textTertiary}
              value={priceInput}
              onChangeText={setPriceInput}
              keyboardType="decimal-pad"
            />
            
            <View style={styles.dialogActions}>
              <TouchableOpacity style={[styles.dialogBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => setAddModalVisible(false)}>
                <Text style={[styles.dialogBtnText, { color: colors.textSecondary }]}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dialogBtn, { backgroundColor: colors.brand }]} onPress={handleAddInvestment} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={[styles.dialogBtnText, { color: '#FFF' }]}>Simpan</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity
        style={[styles.fabExtended, { backgroundColor: colors.accent }]}
        onPress={() => setAddModalVisible(true)}
      >
        <Ionicons name="trending-up" size={24} color="#FFF" />
        <Text style={styles.fabText}>Tambah Saham</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  headerTitle: { fontSize: 24, fontFamily: fonts.bold },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  
  netWorthCard: { borderRadius: 20, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 6 },
  nwLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: fonts.medium, textAlign: 'center' },
  nwAmount: { fontSize: 32, color: '#FFF', fontFamily: fonts.bold, textAlign: 'center', marginVertical: 8 },
  nwDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 16 },
  nwRow: { flexDirection: 'row', justifyContent: 'space-between' },
  nwItem: { flex: 1 },
  nwItemLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: fonts.regular, marginBottom: 4 },
  nwItemVal: { fontSize: 16, color: '#FFF', fontFamily: fonts.semiBold },
  
  sectionTitle: { fontSize: 18, fontFamily: fonts.semiBold, marginBottom: 12 },
  
  stockCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  stockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tickerText: { fontSize: 17, fontFamily: fonts.bold, marginBottom: 4 },
  lotText: { fontSize: 12, fontFamily: fonts.regular },
  alignRight: { alignItems: 'flex-end' },
  valueText: { fontSize: 15, fontFamily: fonts.semiBold, marginBottom: 4 },
  plText: { fontSize: 13, fontFamily: fonts.medium },
  
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.semiBold, marginTop: 12 },
  emptySub: { fontSize: 13, fontFamily: fonts.regular, marginTop: 6 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetContainer: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontFamily: fonts.bold, textAlign: 'center', marginBottom: 4 },
  sheetSubtitle: { fontSize: 13, fontFamily: fonts.regular, textAlign: 'center', marginBottom: 24 },
  
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metricBox: { width: '48%', borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  metricLabel: { fontSize: 11, fontFamily: fonts.regular, marginBottom: 8 },
  metricVal: { fontSize: 15, fontFamily: fonts.semiBold },
  
  closeBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  closeBtnText: { color: '#FFF', fontSize: 15, fontFamily: fonts.semiBold },

  fabExtended: { position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80, right: 20, height: 56, borderRadius: 28, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  fabText: { color: '#FFF', fontSize: 15, fontFamily: fonts.bold, marginLeft: 8 },
  
  modalOverlayCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialogContainer: { width: '100%', borderRadius: 20, padding: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  dialogTitle: { fontSize: 20, fontFamily: fonts.bold, marginBottom: 20, textAlign: 'center' },
  input: { width: '100%', height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, fontSize: 15, fontFamily: fonts.medium },
  dialogActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 12 },
  dialogBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dialogBtnText: { fontSize: 15, fontFamily: fonts.bold }
});
