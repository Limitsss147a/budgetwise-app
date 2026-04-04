import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/utils/api';
import { formatRupiah } from '../../src/utils/format';
import { useTheme } from '../../src/contexts/ThemeContext';
import { fonts } from '../../src/constants/fonts';
import { StockPortfolioTable } from '../../src/components/ui/StockPortfolioTable';
import { formatPercentage } from '../../src/utils/format';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';

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
  const { colors, theme } = useTheme();
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
  const [isEditing, setIsEditing] = useState(false);

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

  const handleSaveInvestment = async () => {
    if (!tickerInput || !lotInput || !priceInput) {
      Alert.alert('Error', 'Harap isi semua field');
      return;
    }
    try {
      setSubmitting(true);
      const cleanTicker = tickerInput.trim().toUpperCase();
      const cleanLot = parseInt(lotInput.replace(/\D/g, '') || '0');
      const cleanPrice = parseFloat(priceInput.replace(/[^\d.]/g, '') || '0'); // Allow dot but remove others
      
      if (isEditing) {
        await api.updateInvestment(cleanTicker, {
          lot_count: cleanLot,
          average_buy_price: cleanPrice
        });
      } else {
        await api.addInvestment({
          ticker: cleanTicker,
          lot_count: cleanLot,
          average_buy_price: cleanPrice
        });
      }
      setAddModalVisible(false);
      setTickerInput('');
      setLotInput('');
      setPriceInput('');
      setIsEditing(false);
      await loadData(); // refresh
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan saat menyimpan data');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPress = (stock: Holding) => {
    setModalVisible(false);
    setTickerInput(stock.ticker);
    setLotInput(stock.lot_count.toString());
    setPriceInput(stock.average_buy_price.toString());
    setIsEditing(true);
    setAddModalVisible(true);
  };

  const handleDeleteInvestment = (ticker: string) => {
    Alert.alert(
      'Hapus Investasi',
      `Apakah Anda yakin ingin menghapus ${ticker} dari portofolio?`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteInvestment(ticker);
              setModalVisible(false);
              await loadData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Gagal menghapus saham');
            }
          }
        }
      ]
    );
  };

  if (loading) return <LoadingScreen />;

  const renderHoldingsTable = () => {
    const stocks = data?.holdings.map(h => ({
      ...h,
      id: h.ticker, // Map ticker to id
    })) || [];

    return (
      <View style={{ marginTop: 24 }}>
        <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 20 }]}>Daftar Aset</Text>
        <StockPortfolioTable 
          stocks={stocks}
          colors={colors}
          onStockSelect={openSheet}
          theme={theme}
        />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Premium Background Elements */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={theme === 'dark' ? ['#0A1210', '#111827', '#0A1210'] : ['#F8FAFC', '#F1F5F9', '#EFF6FF']}
          style={StyleSheet.absoluteFill}
        />
        {/* Decorative Blurred Blobs - Emerald themed for dark mode */}
        <View style={[styles.blob, { top: -50, left: -50, backgroundColor: colors.brand, opacity: theme === 'dark' ? 0.08 : 0.15 }]} />
        <View style={[styles.blob, { bottom: 100, right: -50, backgroundColor: '#059669', opacity: theme === 'dark' ? 0.05 : 0.1 }]} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Portofolio Investasi</Text>
          <TouchableOpacity onPress={handleUpdatePrices}>
            <Ionicons name="refresh-circle" size={28} color={colors.brand} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.brand} />}
        >
          <View style={{ paddingHorizontal: 20 }}>
            {/* Net Worth Glass Card */}
            <View style={styles.glassWrapper}>
              <BlurView intensity={theme === 'dark' ? 40 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={styles.glassCard}>
                <LinearGradient
                  colors={[colors.brand + 'CC', colors.brand + '99']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGradient}
                >
                  <Text style={[styles.nwLabel, { color: 'rgba(255,255,255,0.8)' }]}>Kekayaan Bersih (Net Worth)</Text>
                  <Text style={[styles.nwAmount, { color: '#FFF', textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }]}>
                    {formatRupiah(data?.total_asset_value || 0)}
                  </Text>
                  
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
                    <Text style={[styles.nwItemVal, { color: (data?.total_unrealized_pl || 0) >= 0 ? '#4ADE80' : '#FB7185' }]}>
                      {(data?.total_unrealized_pl || 0) >= 0 ? '+' : ''}{formatRupiah(data?.total_unrealized_pl || 0)} ({(data?.total_unrealized_pl_percentage || 0).toFixed(2)}%)
                    </Text>
                  </View>
                </LinearGradient>
              </BlurView>
            </View>
          </View>

          {(!data?.holdings || data.holdings.length === 0) ? (
            <View style={styles.empty}>
              <Ionicons name="trending-up-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Belum ada investasi</Text>
              <Text style={[styles.emptySub, { color: colors.textTertiary }]}>Mulai masukkan emiten sahammu!</Text>
            </View>
          ) : (
            renderHoldingsTable()
          )}
        </ScrollView>
      </SafeAreaView>

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
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Total Lot</Text>
                    <Text style={[styles.metricVal, { color: colors.text }]}>{selectedStock.lot_count}</Text>
                  </View>
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => handleEditPress(selectedStock)}>
                    <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: '#EF4444', borderWidth: 1 }]} onPress={() => handleDeleteInvestment(selectedStock.ticker)}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Hapus</Text>
                  </TouchableOpacity>
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
          <Pressable style={styles.modalBackdrop} onPress={() => { setAddModalVisible(false); setIsEditing(false); }} />
          <View style={[styles.dialogContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>{isEditing ? 'Edit Investasi' : 'Tambah Investasi'}</Text>
            
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: isEditing ? colors.bgSecondary : colors.bg }]}
              placeholder="Kode Saham (e.g. BBCA)"
              placeholderTextColor={colors.textTertiary}
              value={tickerInput}
              onChangeText={setTickerInput}
              autoCapitalize="characters"
              editable={!isEditing}
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
              <TouchableOpacity style={[styles.dialogBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => { setAddModalVisible(false); setIsEditing(false); }}>
                <Text style={[styles.dialogBtnText, { color: colors.textSecondary }]}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dialogBtn, { backgroundColor: colors.brand }]} onPress={handleSaveInvestment} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={[styles.dialogBtnText, { color: '#FFF' }]}>Simpan</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity
        style={[styles.fabExtended, { backgroundColor: colors.accent }]}
        onPress={() => { setIsEditing(false); setTickerInput(''); setLotInput(''); setPriceInput(''); setAddModalVisible(true); }}
      >
        <Ionicons name="trending-up" size={24} color="#FFF" />
        <Text style={styles.fabText}>Tambah Saham</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  headerTitle: { fontSize: 24, fontFamily: fonts.bold },
  listContent: { paddingHorizontal: 20, paddingBottom: 150 },
  
  netWorthCard: { borderRadius: 24, padding: 24, marginBottom: 24 },
  glassWrapper: { borderRadius: 24, overflow: 'hidden', marginBottom: 24, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 16 },
  glassCard: { borderRadius: 24 },
  cardGradient: { padding: 24, borderRadius: 24 },
  blob: { position: 'absolute', width: 300, height: 300, borderRadius: 150, filter: Platform.OS === 'ios' ? 'blur(60px)' : 'none' }, // Note: filter blur might not work on all Android, but giving depth
  nwLabel: { fontSize: 13, fontFamily: fonts.medium, textAlign: 'center' },
  nwAmount: { fontSize: 32, fontFamily: fonts.bold, textAlign: 'center', marginVertical: 8 },
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

  sheetActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  actionBtn: { flex: 1, height: 48, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionBtnText: { fontSize: 14, fontFamily: fonts.bold },

  fabExtended: { position: 'absolute', bottom: Platform.OS === 'ios' ? 110 : 96, right: 20, height: 56, borderRadius: 28, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  fabText: { color: '#FFF', fontSize: 15, fontFamily: fonts.bold, marginLeft: 8 },
  
  modalOverlayCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialogContainer: { width: '100%', borderRadius: 20, padding: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  dialogTitle: { fontSize: 20, fontFamily: fonts.bold, marginBottom: 20, textAlign: 'center' },
  input: { width: '100%', height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, fontSize: 15, fontFamily: fonts.medium },
  dialogActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 12 },
  dialogBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dialogBtnText: { fontSize: 15, fontFamily: fonts.bold }
});
