import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const escapeCell = (value: string | number): string => {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const buildCsv = (headers: string[], rows: (string | number)[][]): string => {
  const lines = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))];
  return lines.join('\r\n');
};

export const shareCsv = async (filename: string, csv: string): Promise<void> => {
  const safeName = filename.replace(/[^\w.-]+/g, '_');
  const path = `${FileSystem.cacheDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(path, {
    mimeType: 'text/csv',
    dialogTitle: 'Export spends',
    UTI: 'public.comma-separated-values-text',
  });
};
