// API client untuk komunikasi dengan backend
const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Terjadi kesalahan' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

export const api = {
  // Kategori
  getCategories: (type?: string) => request(`/api/categories${type ? `?type=${type}` : ''}`),
  createCategory: (data: any) => request('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any) => request(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) => request(`/api/categories/${id}`, { method: 'DELETE' }),

  // Transaksi
  getTransactions: (params?: Record<string, any>) => {
    const query = params ? '?' + new URLSearchParams(Object.entries(params).reduce((a, [k, v]) => { if (v !== undefined && v !== null && v !== '') a[k] = String(v); return a; }, {} as Record<string, string>)).toString() : '';
    return request(`/api/transactions${query}`);
  },
  getTransaction: (id: string) => request(`/api/transactions/${id}`),
  createTransaction: (data: any) => request('/api/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id: string, data: any) => request(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id: string) => request(`/api/transactions/${id}`, { method: 'DELETE' }),

  // Anggaran
  getBudgets: (month?: string) => request(`/api/budgets${month ? `?month=${month}` : ''}`),
  createBudget: (data: any) => request('/api/budgets', { method: 'POST', body: JSON.stringify(data) }),
  deleteBudget: (id: string) => request(`/api/budgets/${id}`, { method: 'DELETE' }),

  // Analitik
  getSummary: (month?: string) => request(`/api/analytics/summary${month ? `?month=${month}` : ''}`),
  getCategoryBreakdown: (month?: string, type?: string) => {
    const p = new URLSearchParams();
    if (month) p.set('month', month);
    if (type) p.set('type', type);
    const q = p.toString();
    return request(`/api/analytics/category-breakdown${q ? `?${q}` : ''}`);
  },
  getDailyTrend: (days?: number) => request(`/api/analytics/daily-trend${days ? `?days=${days}` : ''}`),
  getMonthlyTrend: (months?: number) => request(`/api/analytics/monthly-trend${months ? `?months=${months}` : ''}`),
  getStats: (month?: string) => request(`/api/analytics/stats${month ? `?month=${month}` : ''}`),

  // Pengaturan
  getSettings: () => request('/api/settings'),
  updateSettings: (data: any) => request('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  setPin: (pin: string) => request('/api/settings/pin/set', { method: 'POST', body: JSON.stringify({ pin }) }),
  verifyPin: (pin: string) => request('/api/settings/pin/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  removePin: () => request('/api/settings/pin', { method: 'DELETE' }),

  // Export & Backup
  getExportCsvUrl: (month?: string) => `${BASE_URL}/api/export/csv${month ? `?month=${month}` : ''}`,
  getBackup: () => request('/api/export/backup'),
  importBackup: (data: any) => request('/api/import/backup', { method: 'POST', body: JSON.stringify(data) }),
  resetData: () => request('/api/data/reset', { method: 'DELETE' }),
};
