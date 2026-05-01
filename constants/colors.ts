export const colors = {
  blue: '#185FA5',
  blueDark: '#0C447C',
  blueLight: '#E6F1FB',
  green: '#0F6E56',
  greenDark: '#085041',
  greenLight: '#E1F5EE',
  purple: '#534AB7',
  purpleDark: '#3C3489',
  purpleLight: '#EEEDFE',
  amber: '#854F0B',
  amberLight: '#FAEEDA',
  coral: '#D85A30',
  red: '#993C1D',
  redLight: '#FAECE7',
  gray: '#444441',
  grayLight: '#F1EFE8',
  white: '#FFFFFF',
  credit: '#0F6E56',
  debit: '#993C1D',
  savings: '#534AB7',
} as const;

export type ColorKey = keyof typeof colors;
