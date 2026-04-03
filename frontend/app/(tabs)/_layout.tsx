import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { fonts } from '../../src/constants/fonts';

export default function TabsLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const isPortfolio = pathname.includes('portfolio');

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.tabBg,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 88 : 64,
            paddingBottom: Platform.OS === 'ios' ? 28 : 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.semiBold },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Beranda', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
        <Tabs.Screen name="transactions" options={{ title: 'Transaksi', tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} /> }} />
        <Tabs.Screen name="portfolio" options={{ title: 'Investasi', tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart" size={size} color={color} /> }} />
        <Tabs.Screen name="reports" options={{ title: 'Laporan', tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} /> }} />
        <Tabs.Screen name="budget" options={{ title: 'Anggaran', tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
        <Tabs.Screen name="settings" options={{ title: 'Pengaturan', tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }} />
      </Tabs>
      {!isPortfolio && (
        <TouchableOpacity
          testID="global-fab"
          style={[st.fab, { backgroundColor: colors.accent }]}
          activeOpacity={0.8}
          onPress={() => router.push('/add-transaction' as any)}
        >
          <Ionicons name="add" size={32} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
