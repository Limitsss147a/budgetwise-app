import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../src/utils/api';
import { formatAmountInput, parseAmountInput } from '../src/utils/format';
import type { Category } from '../src/types';

export default function AddTransaction() {
  const router = useRouter();
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

  // Auto-select first category when type changes
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
    return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color="#1A4D2E" /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.container} testID="add-transaction-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity testID="close-add-tx" onPress={() => router.back()}>
            <Ionicons name="close" size={26} color="#1A4D2E" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{isEdit ? 'Edit Transaksi' : 'Tambah Transaksi'}</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Tipe Toggle */}
          <View style={s.typeRow}>
            <TouchableOpacity testID="type-expense" style={[s.typeBtn, type === 'expense' && s.typeBtnActiveExp]}
              onPress={() => setType('expense')}>
              <Ionicons name="arrow-down-circle" size={18} color={type === 'expense' ? '#FFF' : '#D34A3E'} />
              <Text style={[s.typeText, type === 'expense' && s.typeTextActive]}>Pengeluaran</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="type-income" style={[s.typeBtn, type === 'income' && s.typeBtnActiveInc]}
              onPress={() => setType('income')}>
              <Ionicons name="arrow-up-circle" size={18} color={type === 'income' ? '#FFF' : '#3A6E4B'} />
              <Text style={[s.typeText, type === 'income' && s.typeTextActive]}>Pemasukan</Text>
            </TouchableOpacity>
          </View>

          {/* Jumlah */}
          <View style={s.amountCard}>
            <Text style={s.label}>Jumlah</Text>
            <View style={s.amountRow}>
              <Text style={s.rupiah}>Rp</Text>
              <TextInput testID="amount-input" style={s.amountInput} keyboardType="numeric" placeholder="0"
                value={formatAmountInput(amount)} onChangeText={t => setAmount(t.replace(/\D/g, ''))}
                placeholderTextColor="#C2A878" />
            </View>
          </View>

          {/* Kategori */}
          <Text style={s.label}>Kategori</Text>
          <View style={s.catGrid}>
            {filteredCats.map(cat => (
              <TouchableOpacity key={cat.id} testID={`cat-${cat.id}`}
                style={[s.catItem, categoryId === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color }]}
                onPress={() => setCategoryId(cat.id)}>
                <View style={[s.catIconBg, { backgroundColor: cat.color + '18' }]}>
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                </View>
                <Text style={[s.catName, categoryId === cat.id && { color: cat.color, fontWeight: '600' }]} numberOfLines={1}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Deskripsi */}
          <Text style={s.label}>Catatan (Opsional)</Text>
          <TextInput testID="description-input" style={s.descInput} placeholder="Contoh: Makan siang di kantin"
            value={description} onChangeText={setDescription} multiline placeholderTextColor="#7D7D7D" />

          {/* Tombol Simpan */}
          <TouchableOpacity testID="save-transaction-btn" style={[s.saveBtn, loading && s.saveBtnDisabled]}
            onPress={handleSave} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={s.saveBtnText}>{isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0EBE1' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1A4D2E' },
  scroll: { padding: 20, paddingBottom: 40 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F0EBE1' },
  typeBtnActiveExp: { backgroundColor: '#D34A3E', borderColor: '#D34A3E' },
  typeBtnActiveInc: { backgroundColor: '#3A6E4B', borderColor: '#3A6E4B' },
  typeText: { fontSize: 14, fontWeight: '500', color: '#4A4A4A' },
  typeTextActive: { color: '#FFF' },
  amountCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#F0EBE1' },
  label: { fontSize: 13, fontWeight: '600', color: '#7D7D7D', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  rupiah: { fontSize: 22, fontWeight: '600', color: '#1A4D2E', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '700', color: '#1A4D2E', padding: 0 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  catItem: { width: '30%' as any, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F0EBE1' },
  catIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  catName: { fontSize: 11, color: '#4A4A4A', textAlign: 'center', paddingHorizontal: 4 },
  descInput: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, fontSize: 14, color: '#1A4D2E', minHeight: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: '#F0EBE1', marginBottom: 24 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A4D2E', borderRadius: 14, paddingVertical: 16, gap: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});
