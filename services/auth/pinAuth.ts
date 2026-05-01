import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorage } from '../storage/secureStorage';

const PIN_LENGTH = 4;
const PIN_PEPPER = 'em_pin_v1';

const hashPin = async (uid: string, pin: string): Promise<string> =>
  Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${PIN_PEPPER}:${uid}:${pin}`,
  );

export const isValidPinShape = (pin: string): boolean =>
  /^\d{4}$/.test(pin) && pin.length === PIN_LENGTH;

export const setPin = async (uid: string, pin: string): Promise<void> => {
  if (!isValidPinShape(pin)) throw new Error('PIN must be 4 digits');
  const hash = await hashPin(uid, pin);
  await secureStorage.setPinHash(uid, hash);
};

export const verifyPin = async (uid: string, pin: string): Promise<boolean> => {
  if (!isValidPinShape(pin)) return false;
  const stored = await secureStorage.getPinHash(uid);
  if (!stored) return false;
  const hash = await hashPin(uid, pin);
  return hash === stored;
};

export const hasPin = async (uid: string): Promise<boolean> =>
  (await secureStorage.getPinHash(uid)) !== null;

export interface BiometricCapability {
  hardwareAvailable: boolean;
  enrolled: boolean;
  types: LocalAuthentication.AuthenticationType[];
}

export const getBiometricCapability = async (): Promise<BiometricCapability> => {
  const [hardwareAvailable, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { hardwareAvailable, enrolled, types };
};

export const isBiometricUsable = async (): Promise<boolean> => {
  const cap = await getBiometricCapability();
  return cap.hardwareAvailable && cap.enrolled;
};

export const setBiometricEnabled = (uid: string, enabled: boolean) =>
  secureStorage.setBiometricEnabled(uid, enabled);

export const isBiometricEnabled = (uid: string) =>
  secureStorage.getBiometricEnabled(uid);

export const authenticateWithBiometric = async (
  promptMessage: string = 'Unlock Expense Manager',
): Promise<boolean> => {
  if (!(await isBiometricUsable())) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Use PIN',
    disableDeviceFallback: true,
  });
  return result.success;
};
