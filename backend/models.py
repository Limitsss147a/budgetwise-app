from typing import Optional
from pydantic import BaseModel


class AuthRegister(BaseModel):
    name: str
    email: str
    password: str


class AuthLogin(BaseModel):
    email: str
    password: str


class ForgotPassword(BaseModel):
    email: str
    recovery_key: str
    new_password: str


class CategoryCreate(BaseModel):
    name: str
    type: str
    icon: str
    color: str


class WalletCreate(BaseModel):
    name: str
    type: str # bank, ewallet, cash
    initial_balance: float = 0.0
    color: str
    icon: str

class WalletUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    initial_balance: Optional[float] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_default: Optional[bool] = None

class WalletTransfer(BaseModel):
    from_wallet_id: str
    to_wallet_id: str
    amount: float
    description: str = "Transfer antar wallet"
    date: str

class TransactionCreate(BaseModel):
    type: str
    amount: float
    category_id: str
    wallet_id: str
    description: str = ""
    date: str
    photo_uri: str = ""
    recurring_frequency: Optional[str] = None # daily, weekly, monthly, yearly


class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    amount: Optional[float] = None
    category_id: Optional[str] = None
    wallet_id: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    photo_uri: Optional[str] = None

class RecurringUpdate(BaseModel):
    is_active: Optional[bool] = None
    amount: Optional[float] = None
    description: Optional[str] = None


class BudgetCreate(BaseModel):
    category_id: str
    amount: float
    month: str


class GoalCreate(BaseModel):
    name: str
    target_amount: float
    color: Optional[str] = "#10B981"
    icon: Optional[str] = "flag"
    deadline: Optional[str] = None

class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    deadline: Optional[str] = None

class GoalContribute(BaseModel):
    wallet_id: str
    amount: float


class SettingsUpdate(BaseModel):
    currency: Optional[str] = None
    date_format: Optional[str] = None
    theme: Optional[str] = None
    profile_name: Optional[str] = None
    weekly_report_enabled: Optional[bool] = None
    weekly_report_day: Optional[int] = None  # 1=Mon, 2=Tue, ..., 7=Sun
    weekly_report_hour: Optional[int] = None  # 0-23


class PushTokenRequest(BaseModel):
    token: str


class PinRequest(BaseModel):
    pin: str


class BackupData(BaseModel):
    transactions: list = []
    categories: list = []
    budgets: list = []


class InvestmentCreate(BaseModel):
    ticker: str
    lot_count: int
    average_buy_price: float


class InvestmentUpdate(BaseModel):
    ticker: Optional[str] = None
    lot_count: Optional[int] = None
    average_buy_price: Optional[float] = None
