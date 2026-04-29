import { SafeStorage } from './storage';
import type {
  Category, Transaction, Budget, Settings, Summary,
  CategoryBreakdown, DailyTrend, MonthlyTrend, TransactionListResponse
} from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

let authToken: string | null = null;
let refreshTokenValue: string | null = null;

export function setAuthToken(token: string | null) { authToken = token; }
export function setRefreshToken(token: string | null) { refreshTokenValue = token; }

// Hindari race: ketika ada beberapa request paralel yang 401 di waktu bersamaan,
// hanya satu yang benar-benar memanggil /auth/refresh, yang lain menunggu hasilnya.
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  if (!refreshTokenValue) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.access_token) return null;
      setAuthToken(data.access_token);
      await SafeStorage.setItem('access_token', data.access_token);
      return data.access_token as string;
    } catch {
      return null;
    } finally {
      // reset setelah pekerjaan selesai agar retry berikutnya tetap bisa refresh
      setTimeout(() => { refreshPromise = null; }, 0);
    }
  })();
  return refreshPromise;
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) h['Authorization'] = `Bearer ${authToken}`;
    if (options.headers) Object.assign(h, options.headers as Record<string, string>);
    return h;
  };

  let response = await fetch(url, { ...options, headers: buildHeaders() });

  if (response.status === 401 && !path.includes('/auth/') && refreshTokenValue) {
    const newToken = await doRefresh();
    if (newToken) {
      response = await fetch(url, { ...options, headers: buildHeaders() });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Terjadi kesalahan' }));
    throw new Error(typeof error.detail === 'string' ? error.detail : `HTTP ${response.status}`);
  }
  const ct = response.headers.get('content-type');
  if (ct && ct.includes('application/json')) return response.json();
  return response.text();
}

export const api = {
  getCategories: (type?: string): Promise<Category[]> => request(`/api/categories${type ? `?type=${type}` : ''}`),
  createCategory: (data: any): Promise<Category> => request('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any): Promise<Category> => request(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string): Promise<{message: string}> => request(`/api/categories/${id}`, { method: 'DELETE' }),

  getTransactions: (params?: Record<string, any>): Promise<TransactionListResponse> => {
    const q = params ? '?' + new URLSearchParams(Object.entries(params).reduce((a, [k, v]) => { if (v != null && v !== '') a[k] = String(v); return a; }, {} as Record<string, string>)).toString() : '';
    return request(`/api/transactions${q}`);
  },
  getTransaction: (id: string): Promise<Transaction> => request(`/api/transactions/${id}`),
  createTransaction: (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction> => request('/api/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id: string, data: Partial<Transaction>): Promise<Transaction> => request(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id: string): Promise<{message: string}> => request(`/api/transactions/${id}`, { method: 'DELETE' }),

  getBudgets: (month?: string): Promise<Budget[]> => request(`/api/budgets${month ? `?month=${month}` : ''}`),
  createBudget: (data: Omit<Budget, 'id' | 'created_at' | 'updated_at'>): Promise<Budget> => request('/api/budgets', { method: 'POST', body: JSON.stringify(data) }),
  deleteBudget: (id: string): Promise<{message: string}> => request(`/api/budgets/${id}`, { method: 'DELETE' }),

  getSummary: (month?: string): Promise<Summary> => request(`/api/analytics/summary${month ? `?month=${month}` : ''}`),
  getCategoryBreakdown: (month?: string, type?: string): Promise<{breakdown: CategoryBreakdown[], total: number}> => {
    const p = new URLSearchParams(); if (month) p.set('month', month); if (type) p.set('type', type);
    return request(`/api/analytics/category-breakdown${p.toString() ? `?${p}` : ''}`);
  },
  getDailyTrend: (days?: number): Promise<DailyTrend[]> => request(`/api/analytics/daily-trend${days ? `?days=${days}` : ''}`),
  getMonthlyTrend: (months?: number): Promise<MonthlyTrend[]> => request(`/api/analytics/monthly-trend${months ? `?months=${months}` : ''}`),
  getStats: (month?: string): Promise<{avg_daily_expense: number, highest_day: string, highest_day_amount: number, days_with_expense: number}> => request(`/api/analytics/stats${month ? `?month=${month}` : ''}`),
  getWeeklyReport: (): Promise<any> => request('/api/reports/weekly'),

  getSettings: (): Promise<Settings> => request('/api/settings'),
  updateSettings: (data: Partial<Settings>): Promise<Settings> => request('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  setPin: (pin: string): Promise<{message: string, has_pin: boolean}> => request('/api/settings/pin/set', { method: 'POST', body: JSON.stringify({ pin }) }),
  verifyPin: (pin: string): Promise<{valid: boolean}> => request('/api/settings/pin/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  removePin: (): Promise<{message: string, has_pin: boolean}> => request('/api/settings/pin', { method: 'DELETE' }),
  registerPushToken: (token: string): Promise<{message: string}> => request('/api/notifications/register', { method: 'POST', body: JSON.stringify({ token }) }),

  getExportCsvUrl: (month?: string): string => `${BASE_URL}/api/export/csv${month ? `?month=${month}` : ''}`,
  getBackup: (): Promise<any> => request('/api/export/backup'),
  importBackup: (data: any): Promise<{message: string}> => request('/api/import/backup', { method: 'POST', body: JSON.stringify(data) }),
  resetData: (): Promise<{message: string}> => request('/api/data/reset', { method: 'DELETE' }),

  updateMarketPrices: (): Promise<{message: string, updated: any[]}> => request('/api/portfolio/update-prices', { method: 'POST' }),
  getNetWorth: (): Promise<{liquid_asset: number, total_investment_value: number, total_asset_value: number, total_unrealized_pl: number, total_unrealized_pl_percentage: number, holdings: any[]}> => request('/api/portfolio/net-worth'),
  addInvestment: (data: { ticker: string, lot_count: number, average_buy_price: number }): Promise<{message: string, investments: any[]}> => request('/api/portfolio/investments', { method: 'POST', body: JSON.stringify(data) }),
  updateInvestment: (ticker: string, data: { lot_count?: number, average_buy_price?: number }): Promise<{message: string, investments: any[]}> => request(`/api/portfolio/investments/${encodeURIComponent(ticker)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteInvestment: (ticker: string): Promise<{message: string}> => request(`/api/portfolio/investments/${encodeURIComponent(ticker)}`, { method: 'DELETE' }),
};
