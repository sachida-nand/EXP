export const SHEET_FILE_PREFIX = 'Expense Manager — ';

export const TABS = {
  salary: 'Salary',
  allocations: 'Allocations',
  dailyWallet: 'Daily Wallet',
  fixedPayments: 'Fixed Payments',
  extraIncome: 'Extra Income',
} as const;

export type TabName = (typeof TABS)[keyof typeof TABS];

export const HEADERS = {
  [TABS.salary]: [
    'month',
    'year',
    'salary_amount',
    'source',
    'date_credited',
    'carry_forward',
    'created_at',
  ],
  [TABS.allocations]: [
    'month',
    'year',
    'bucket_name',
    'bucket_type',
    'allocated_amount',
    'last_month_amount',
    'created_at',
  ],
  [TABS.dailyWallet]: [
    'date',
    'month',
    'year',
    'amount',
    'paid_to',
    'purpose',
    'notes',
    'receipt_link',
    'balance_after',
    'created_at',
    'deducts_wallet',
  ],
  [TABS.fixedPayments]: [
    'month',
    'year',
    'bucket_name',
    'payment_type',
    'amount',
    'paid_to',
    'date_paid',
    'receipt_link',
    'created_at',
    'notes',
  ],
  [TABS.extraIncome]: [
    'month',
    'year',
    'date',
    'paid_by',
    'amount',
    'notes',
    'created_at',
    'direction',
  ],
} as const;

export const LAST_COLUMN: Record<TabName, string> = {
  [TABS.salary]: 'G',
  [TABS.allocations]: 'G',
  [TABS.dailyWallet]: 'K',
  [TABS.fixedPayments]: 'J',
  [TABS.extraIncome]: 'H',
};

export const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
export const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files';
