export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category_id: string;
  description: string;
  date: string;
  photo_uri: string;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  category_id: string;
  amount: number;
  month: string;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  currency: string;
  date_format: string;
  theme: string;
  has_pin: boolean;
  profile_name: string;
  profile_photo: string;
  weekly_report_enabled: boolean;
  weekly_report_day: number;
  weekly_report_hour: number;
}

export interface Summary {
  balance: number;
  month_income: number;
  month_expense: number;
  month_net: number;
  transaction_count: number;
}

export interface CategoryBreakdown {
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  total: number;
  percentage: number;
}

export interface DailyTrend {
  date: string;
  income: number;
  expense: number;
}

export interface MonthlyTrend {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
