export const formatCurrency = (
  amount: number,
  currency: string = '₹',
  withSymbol: boolean = true,
): string => {
  const isNegative = amount < 0;
  const absAmount = Math.abs(Math.round(amount));
  const formatted = new Intl.NumberFormat('en-IN').format(absAmount);
  const body = withSymbol ? `${currency}${formatted}` : formatted;
  return isNegative ? `-${body}` : body;
};

export const parseCurrency = (input: string): number => {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d.-]/g, '');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
};

export const formatSigned = (
  amount: number,
  currency: string = '₹',
): string => {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatCurrency(Math.abs(amount), currency)}`;
};
