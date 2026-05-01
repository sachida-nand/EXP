import type { Bucket } from '../types';

export const defaultBuckets: Bucket[] = [
  { id: '1', name: 'House rent',         icon: '🏠', color: '#993C1D', bgColor: '#FAECE7', type: 'fixed',  isWallet: false },
  { id: '2', name: 'Brother expense',    icon: '👨', color: '#185FA5', bgColor: '#E6F1FB', type: 'give',   isWallet: false },
  { id: '3', name: 'Family expense',     icon: '👨‍👩‍👧', color: '#0F6E56', bgColor: '#E1F5EE', type: 'give',   isWallet: false },
  { id: '4', name: 'Credit card',        icon: '💳', color: '#BA7517', bgColor: '#FAEEDA', type: 'fixed',  isWallet: false },
  { id: '5', name: 'College fee',        icon: '🎓', color: '#D85A30', bgColor: '#FAECE7', type: 'fixed',  isWallet: false },
  { id: '6', name: 'My Monthly Expense', icon: '📋', color: '#185FA5', bgColor: '#E6F1FB', type: 'wallet', isWallet: true  },
];

export const optionalBuckets: Bucket[] = [
  { id: 'opt-medical',     name: 'Medical',       icon: '🏥', color: '#993C1D', bgColor: '#FAECE7', type: 'fixed', isWallet: false },
  { id: 'opt-vehicle-emi', name: 'Vehicle EMI',   icon: '🏍️', color: '#185FA5', bgColor: '#E6F1FB', type: 'fixed', isWallet: false },
  { id: 'opt-phone',       name: 'Phone bill',    icon: '📱', color: '#534AB7', bgColor: '#EEEDFE', type: 'fixed', isWallet: false },
  { id: 'opt-electricity', name: 'Electricity',   icon: '💡', color: '#854F0B', bgColor: '#FAEEDA', type: 'fixed', isWallet: false },
  { id: 'opt-loan-emi',    name: 'Loan EMI',      icon: '🏦', color: '#0F6E56', bgColor: '#E1F5EE', type: 'fixed', isWallet: false },
];

export const defaultPurposes = [
  'Grocery',
  'Transport',
  'Plumber',
  'Medicine',
  'Repair',
  'Wifi',
];
