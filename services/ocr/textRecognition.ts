import TextRecognition from '@react-native-ml-kit/text-recognition';

export const recognizeText = async (uri: string): Promise<string> => {
  try {
    const result = await TextRecognition.recognize(uri);
    return result?.text ?? '';
  } catch (err) {
    console.warn('[ocr] recognize failed', err);
    return '';
  }
};
