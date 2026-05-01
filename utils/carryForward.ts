export const computeCarryForward = (
  walletBudget: number,
  walletSpent: number,
): number => walletBudget - walletSpent;

export const effectiveWalletBudget = (
  newMonthAllocation: number,
  carryForward: number,
): number => newMonthAllocation + carryForward;

export const remainingWallet = (
  walletBudget: number,
  carryForward: number,
  walletSpent: number,
): number => effectiveWalletBudget(walletBudget, carryForward) - walletSpent;
