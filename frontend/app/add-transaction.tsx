import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../src/utils/api';
import { formatAmountInput, parseAmountInput } from '../src/utils/format';
import { useTheme } from '../src/contexts/ThemeContext';
import { fonts } from '../src/constants/fonts';
import type { Category } from '../src/types';

export default function AddTransaction() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        if (id) {
          const tx = await api.getTransaction(id);
          setType(tx.type);
          setAmount(String(tx.amount));
          setCategoryId(tx.category_id);
          setDescription(tx.description || '');
        }
        const cats = await api.getCategories();
        setCategories(cats);
      } catch (e) { console.error(e); }
      finally { setInitLoading(false); }
    };
    init();
  }, [id]);

  const filteredCats = categories.filter(c => c.type === type);

  useEffect(() => {
    if (filteredCats.length > 0 && !filteredCats.find(c => c.id === categoryId)) {
      setCategoryId(filteredCats[0].id);
    }
  }, [type, filteredCats.length]);

  const handleSave = async () => {
    const amt = parseAmountInput(amount);
    if (amt <= 0) { Alert.alert('Error', 'Masukkan jumlah yang valid'); return; }
    if (!categoryId) { Alert.alert('Error', 'Pilih kategori'); return; }

    setLoading(true);
    try {
      const data = {
        type, amount: amt, category_id: categoryId,
        description, date: new Date().toISOString(),
      };
      if (isEdit) await api.updateTransaction(id!, data);
      else await api.createTransaction(data);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal menyimpan');
    } finally { setLoading(false); }
  };

  if (initLoading) {
    return <SafeAreaView style={[st.container, { backgroundColor: colors.bg }]}><View style={st.center}><ActivityIndicator size="large" color={colors.brand} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[st.container, { backgroundColor: colors.bg }]} testID="add-transaction-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[st.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity testID="close-add-tx" onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{isEdit ? 'Edit Transaksi' : 'Tambah Transaksi'}</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
          <View style={st.typeRow}>
            <TouchableOpacity testID="type-expense" style={[st.typeBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }, type === 'expense' && { backgroundColor: colors.expense, borderColor: colors.expense }]}
              onPress={() => setType('expense')}>
              <Ionicons name="arrow-down-circle" size={18} color={type === 'expense' ? '#FFF' : colors.expense} />
              <Text style={[st.typeText, { color: colors.textSecondary, fontFamily: fonts.medium }, type === 'expense' && st.typeTextActive]}>Pengeluaran</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="type-income" style={[st.typeBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }, type === 'income' && { backgroundColor: colors.income, borderColor: colors.income }]}
              onPress={() => setType('income')}>
              <Ionicons name="arrow-up-circle" size={18} color={type === 'income' ? '#FFF' : colors.income} />
              <Text style={[st.typeText, { color: colors.textSecondary, fontFamily: fonts.medium }, type === 'income' && st.typeTextActive]}>Pemasukan</Text>
            </TouchableOpacity>
          </View>

          <View style={[st.amountCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[st.label, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Jumlah</Text>
            <View style={st.amountRow}>
              <Text style={[st.rupiah, { color: colors.text, fontFamily: fonts.semiBold }]}>Rp</Text>
              <TextInput testID="amount-input" style={[st.amountInput, { color: colors.text, fontFamily: fonts.bold }]} keyboardType="numeric" placeholder="0"
                value={formatAmountInput(amount)} onChangeText={t => setAmount(t.replace(/\D/g, ''))}
                placeholderTextColor={colors.textTertiary} />
            </View>
          </View>

          <Text style={[st.label, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Kategori</Text>
          <View style={st.catGrid}>
            {filteredCats.map(cat => (
              <TouchableOpacity key={cat.id} testID={`cat-${cat.id}`}
                style={[st.catItem, { backgroundColor: colors.bgCard, borderColor: colors.border }, categoryId === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color }]}
                onPress={() => setCategoryId(cat.id)}>
                <View style={[st.catIconBg, { backgroundColor: cat.color + '18' }]}>
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                </View>
                <Text style={[st.catName, { color: colors.textSecondary, fontFamily: fonts.regular }, categoryId === cat.id && { color: cat.color, fontFamily: fonts.semiBold }]} numberOfLines={1}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[st.label, { color: colors.textTertiary, fontFamily: fonts.semiBold }]}>Catatan (Opsional)</Text>
          <TextInput testID="description-input" style={[st.descInput, { backgroundColor: colors.bgCard, color: colors.text, borderColor: colors.border, fontFamily: fonts.regular }]} placeholder="Contoh: Makan siang di kantin"
            value={description} onChangeText={setDescription} multiline placeholderTextColor={colors.textTertiary} />

          <TouchableOpacity testID="save-transaction-btn" style={[st.saveBtn, { backgroundColor: colors.brand }, loading && st.saveBtnDisabled]}
            onPress={handleSave} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={[st.saveBtnText, { fontFamily: fonts.semiBold }]}>{isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17 },
  scroll: { padding: 20, paddingBottom: 40 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  typeText: { fontSize: 14 },
  typeTextActive: { color: '#FFF' },
  amountCard: { borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1 },
  label: { fontSize: 13, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  rupiah: { fontSize: 22, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 32, padding: 0 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  catItem: { width: '30%' as any, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  catIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  catName: { fontSize: 11, textAlign: 'center', paddingHorizontal: 4 },
  descInput: { borderRadius: 12, padding: 14, fontSize: 14, minHeight: 60, textAlignVertical: 'top', borderWidth: 1, marginBottom: 24 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, gap: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, color: '#FFF' },
});
