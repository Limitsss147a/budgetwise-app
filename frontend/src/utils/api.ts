const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

let authToken: string | null = null;
export function setAuthToken(token: string | null) { authToken = token; }

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (options.headers) Object.assign(headers, options.headers);
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Terjadi kesalahan' }));
    throw new Error(typeof error.detail === 'string' ? error.detail : `HTTP ${response.status}`);
  }
  const ct = response.headers.get('content-type');
  if (ct && ct.includes('application/json')) return response.json();
  return response.text();
}

export const api = {
  getCategories: (type?: string) => request(`/api/categories${type ? `?type=${type}` : ''}`),
  createCategory: (data: any) => request('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any) => request(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) => request(`/api/categories/${id}`, { method: 'DELETE' }),

  getTransactions: (params?: Record<string, any>) => {
    const q = params ? '?' + new URLSearchParams(Object.entries(params).reduce((a, [k, v]) => { if (v != null && v !== '') a[k] = String(v); return a; }, {} as Record<string, string>)).toString() : '';
    return request(`/api/transactions${q}`);
  },
  getTransaction: (id: string) => request(`/api/transactions/${id}`),
  createTransaction: (data: any) => request('/api/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id: string, data: any) => request(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id: string) => request(`/api/transactions/${id}`, { method: 'DELETE' }),

  getBudgets: (month?: string) => request(`/api/budgets${month ? `?month=${month}` : ''}`),
  createBudget: (data: any) => request('/api/budgets', { method: 'POST', body: JSON.stringify(data) }),
  deleteBudget: (id: string) => request(`/api/budgets/${id}`, { method: 'DELETE' }),

  getSummary: (month?: string) => request(`/api/analytics/summary${month ? `?month=${month}` : ''}`),
  getCategoryBreakdown: (month?: string, type?: string) => {
    const p = new URLSearchParams(); if (month) p.set('month', month); if (type) p.set('type', type);
    return request(`/api/analytics/category-breakdown${p.toString() ? `?${p}` : ''}`);
  },
  getDailyTrend: (days?: number) => request(`/api/analytics/daily-trend${days ? `?days=${days}` : ''}`),
  getMonthlyTrend: (months?: number) => request(`/api/analytics/monthly-trend${months ? `?months=${months}` : ''}`),
  getStats: (month?: string) => request(`/api/analytics/stats${month ? `?month=${month}` : ''}`),
  getWeeklyReport: () => request('/api/reports/weekly'),

  getSettings: () => request('/api/settings'),
  updateSettings: (data: any) => request('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  setPin: (pin: string) => request('/api/settings/pin/set', { method: 'POST', body: JSON.stringify({ pin }) }),
  verifyPin: (pin: string) => request('/api/settings/pin/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  removePin: () => request('/api/settings/pin', { method: 'DELETE' }),
  registerPushToken: (token: string) => request('/api/notifications/register', { method: 'POST', body: JSON.stringify({ token }) }),

  getExportCsvUrl: (month?: string) => `${BASE_URL}/api/export/csv${month ? `?month=${month}` : ''}`,
  getBackup: () => request('/api/export/backup'),
  importBackup: (data: any) => request('/api/import/backup', { method: 'POST', body: JSON.stringify(data) }),
  resetData: () => request('/api/data/reset', { method: 'DELETE' }),

  updateMarketPrices: () => request('/api/portfolio/update-prices', { method: 'POST' }),
  getNetWorth: () => request('/api/portfolio/net-worth'),
  addInvestment: (data: { ticker: string, lot_count: number, average_buy_price: number }) => request('/api/portfolio/investments', { method: 'POST', body: JSON.stringify(data) }),
  updateInvestment: (ticker: string, data: { lot_count?: number, average_buy_price?: number }) => request(`/api/portfolio/investments/${encodeURIComponent(ticker)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteInvestment: (ticker: string) => request(`/api/portfolio/investments/${encodeURIComponent(ticker)}`, { method: 'DELETE' }),
};
