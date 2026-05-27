export interface User {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  sheetId: string;
  salaryDay: number;
  currency: string;
  biometricEnabled: boolean;
  createdAt: string;
}

export interface Bucket {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  type: 'fixed' | 'give' | 'wallet';
  isWallet: boolean;
}

export interface MonthData {
  month: string;
  year: number;
  salaryAmount: number;
  source: string;
  dateCredited: string;
  carryForward: number;
}

export interface Allocation {
  month: string;
  year: number;
  bucketName: string;
  bucketType: string;
  allocatedAmount: number;
  lastMonthAmount: number;
}

export interface WalletSpend {
  id: string;
  date: string;
  month: string;
  year: number;
  amount: number;
  paidTo: string;
  notes: string;
  receiptLink: string;
  balanceAfter: number;
  deductsWallet: boolean;
}

export interface FixedPayment {
  id: string;
  month: string;
  year: number;
  bucketName: string;
  paymentType: 'paid' | 'given';
  amount: number;
  paidTo: string;
  datePaid: string;
  receiptLink: string;
  notes: string;
}

export type IncomeDirection = 'in' | 'out';

export interface IncomeEntry {
  id: string;
  month: string;
  year: number;
  date: string;
  paidBy: string;
  amount: number;
  notes: string;
  direction: IncomeDirection;
}

export interface CarryForward {
  amount: number;
  fromMonth: string;
  fromYear: number;
}

export interface StoredAccount {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  sheetId: string;
  lastUsedAt: string;
}

export type UpiSource = 'phonepe' | 'gpay' | 'paytm' | 'unknown';
export type FieldConfidence = 'ok' | 'guess' | 'missing';

export interface ParsedPayment {
  source: UpiSource;
  amount: number;
  paidTo: string;
  message: string;
  txnId: string;
  date: Date;
  raw: string;
  confidence: {
    amount: FieldConfidence;
    paidTo: FieldConfidence;
    message: FieldConfidence;
    txnId: FieldConfidence;
    date: FieldConfidence;
  };
}

export interface PaymentDraft {
  id: string;
  capturedAt: string;
  screenshotUri: string;
  parsed: ParsedPayment;
  target: 'wallet' | 'fixed';
  bucketName?: string;
}
