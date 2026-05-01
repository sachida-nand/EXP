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
  purpose: string;
  notes: string;
  receiptLink: string;
  balanceAfter: number;
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

export interface CarryForward {
  amount: number;
  fromMonth: string;
  fromYear: number;
}

export interface Purpose {
  name: string;
  createdAt: string;
}

export interface StoredAccount {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  sheetId: string;
  lastUsedAt: string;
}
