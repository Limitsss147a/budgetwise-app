import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from '../utils/api';

let Notifications: any = null;
export let notificationsAvailable = false;

// Safely load expo-notifications
try {
  Notifications = require('expo-notifications');
  notificationsAvailable = true;
} catch {
  console.warn('[Notifications] expo-notifications native module not available');
}

// Configure notification handler (only if available)
if (notificationsAvailable && Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.warn('[Notifications] Failed to set notification handler:', e);
    notificationsAvailable = false;
  }
}

const DAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export function getDayName(day: number): string {
  return DAY_NAMES[day] || 'Senin';
}

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web' || !notificationsAvailable || !Notifications) {
    return false;
  }

  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    // Register push token with backend
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      await api.registerPushToken(tokenData.data);
    } catch (e) {
      console.log('Failed to get push token:', e);
    }

    return true;
  } catch (e) {
    console.warn('[Notifications] requestPermissions failed:', e);
    return false;
  }
}

// Schedule weekly report notification
export async function scheduleWeeklyReport(day: number, hour: number): Promise<string | null> {
  if (Platform.OS === 'web' || !notificationsAvailable || !Notifications) return null;

  // Cancel existing weekly report notifications
  await cancelWeeklyReport();

  try {
    // Fetch weekly report data for notification content
    let reportBody = 'Tap untuk melihat ringkasan keuangan mingguanmu';
    try {
      const report = await api.getWeeklyReport();
      const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');
      reportBody = `Pengeluaran: ${formatRp(report.total_expense)} | Pemasukan: ${formatRp(report.total_income)} | Saldo: ${report.net >= 0 ? '+' : ''}${formatRp(report.net)}`;
    } catch {
      // Use default message if report fetch fails
    }

    // Schedule weekly recurring notification
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Laporan Mingguan BudgetWise',
        body: reportBody,
        data: { screen: 'reports', type: 'weekly_report' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: day === 7 ? 1 : day + 1, // Convert: 1=Mon→2, 7=Sun→1 (Expo uses 1=Sun, 2=Mon, etc.)
        hour: hour,
        minute: 0,
      },
    });

    return id;
  } catch (e) {
    console.error('Failed to schedule weekly notification:', e);
    return null;
  }
}

// Cancel all weekly report notifications
export async function cancelWeeklyReport(): Promise<void> {
  if (Platform.OS === 'web' || !notificationsAvailable || !Notifications) return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === 'weekly_report') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.error('Failed to cancel notifications:', e);
  }
}

// Send a test notification immediately
export async function sendTestNotification(): Promise<void> {
  if (Platform.OS === 'web' || !notificationsAvailable || !Notifications) return;

  try {
    let reportBody = 'Ini adalah contoh notifikasi laporan mingguan';
    try {
      const report = await api.getWeeklyReport();
      const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');
      reportBody = `Pengeluaran: ${formatRp(report.total_expense)} | Pemasukan: ${formatRp(report.total_income)} | Saldo: ${report.net >= 0 ? '+' : ''}${formatRp(report.net)}`;
    } catch {
      // Use default message
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Laporan Mingguan BudgetWise',
        body: reportBody,
        data: { screen: 'reports', type: 'weekly_report' },
        sound: true,
      },
      trigger: null, // Immediately
    });
  } catch (e) {
    console.error('Failed to send test notification:', e);
  }
}

// Get count of scheduled notifications
export async function getScheduledCount(): Promise<number> {
  if (Platform.OS === 'web' || !notificationsAvailable || !Notifications) return 0;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.filter((n: any) => n.content.data?.type === 'weekly_report').length;
  } catch {
    return 0;
  }
}
