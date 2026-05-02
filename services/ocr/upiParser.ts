import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type {
  FieldConfidence,
  ParsedPayment,
  UpiSource,
} from '../../types';

dayjs.extend(customParseFormat);

const DATE_FORMATS = [
  'D MMM YYYY, h:mm a',
  'D MMM YYYY, hh:mm a',
  'DD MMM YYYY, h:mm a',
  'DD MMM YYYY, hh:mm a',
  'hh:mm A, DD MMM YYYY',
  'hh:mm a, DD MMM YYYY',
  'hh:mm a on DD MMM YYYY',
  'hh:mm A on DD MMM YYYY',
  'h:mm a on DD MMM YYYY',
  'DD MMM YYYY hh:mm A',
  'DD MMM YYYY hh:mm a',
  'DD/MM/YYYY hh:mm A',
  'DD/MM/YYYY hh:mm a',
];

const detectSource = (text: string): UpiSource => {
  const upper = text.toUpperCase();
  // Order matters: GPay screenshots often contain "PhonePe" in the recipient
  // UPI ID block ("PhonePe • foo@axl"), so we check for GPay-only markers
  // FIRST to avoid mis-tagging GPay shares as phonepe.
  if (upper.includes('MONEY SENT SUCCESSFULLY')) return 'paytm';
  if (
    upper.includes('GOOGLE PAY') ||
    upper.includes('GOOGLE TRANSACTION') ||
    upper.includes('GPAY') ||
    upper.includes('G PAY')
  ) {
    return 'gpay';
  }
  if (
    upper.includes('TRANSACTION SUCCESSFUL') ||
    upper.includes('CONTACT PHONEPE SUPPORT')
  ) {
    return 'phonepe';
  }
  // Weaker signals (mentions of the app name without a header)
  if (upper.includes('PHONEPE')) return 'phonepe';
  if (/\bPAYTM\b/.test(upper) && !upper.includes('@PAYTM')) return 'paytm';
  if (upper.includes('PAYTM')) return 'paytm';
  return 'unknown';
};

const NUM = '([\\d,]+(?:\\.\\d{1,2})?)';

const pickValues = (matches: RegExpMatchArray[] | null): number[] => {
  if (!matches) return [];
  return matches
    .map((m) => Number((m[1] ?? '').replace(/,/g, '')))
    .filter((n) => !isNaN(n) && n > 0 && n < 10_000_000);
};

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

// ML Kit on dark-mode PhonePe screens often misreads ₹ as 7 (the glyphs share
// a horizontal-bar-then-stroke shape). When the entire OCR text contains zero
// ₹ characters, ML Kit clearly can't see the rupee glyph on this image — so
// any candidate starting with 7 is suspect. Strip the leading 7. The trade-off:
// genuine ₹7XXX amounts where ML Kit also dropped ₹ would be wrongly stripped,
// but those cases are rare (and the modal makes them easy to fix). We do skip
// stripping when the remainder is 0 (e.g. ₹7000 OCR'd as `7000` strips to 000)
// since that's a clear sign the leading digit was real.
const stripLeadingRupeeMisread = (n: number, ocrText: string): number | null => {
  if (ocrText.includes('₹')) return null;
  const str = String(n);
  if (str.length < 2) return null;
  if (str[0] !== '7') return null;
  const rest = Number(str.slice(1));
  if (isNaN(rest) || rest <= 0) return null;
  return rest;
};

const wordToNumber = (phrase: string): number | null => {
  const tokens = phrase.toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  let total = 0;
  let current = 0;
  for (const word of tokens) {
    if (word === 'and') continue;
    if (word === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
      continue;
    }
    if (word === 'lakh' || word === 'lac') {
      total += (current || 1) * 100_000;
      current = 0;
      continue;
    }
    if (word === 'crore') {
      total += (current || 1) * 10_000_000;
      current = 0;
      continue;
    }
    if (word === 'hundred') {
      current = (current || 1) * 100;
      continue;
    }
    const o = ONES.indexOf(word);
    if (o >= 0) {
      current += o;
      continue;
    }
    const t = TEENS.indexOf(word);
    if (t >= 0) {
      current += 10 + t;
      continue;
    }
    const ten = TENS.indexOf(word);
    if (ten >= 2) {
      current += ten * 10;
      continue;
    }
    return null;
  }
  total += current;
  return total > 0 ? total : null;
};

const extractAmount = (text: string): { value: number; confidence: FieldConfidence } => {
  // Pass 0: word-form ("Rupees Two Only", "Rupees Eight Thousand Eight Hundred
  // Thirty Two Only"). Paytm always shows this and ML Kit recognizes it
  // reliably even when the ₹ glyph is dropped or misread.
  const wordMatch = text.match(/Rupees\s+([A-Za-z][A-Za-z\s-]{0,120}?)\s+Only/i);
  if (wordMatch) {
    const num = wordToNumber(wordMatch[1] ?? '');
    if (num !== null && num > 0) {
      return { value: num, confidence: 'ok' };
    }
  }

  // Pass 1: explicit currency markers — high confidence
  const strict: RegExpMatchArray[] = [
    ...text.matchAll(new RegExp(`₹\\s*${NUM}`, 'g')),
    ...text.matchAll(new RegExp(`\\bINR\\s*${NUM}`, 'gi')),
    ...text.matchAll(new RegExp(`\\bRs\\.?\\s*${NUM}`, 'gi')),
  ];
  const strictVals = pickValues(strict);
  if (strictVals.length > 0) {
    return { value: Math.max(...strictVals), confidence: 'ok' };
  }

  // Pass 2: lenient currency-glyph misread. ML Kit sometimes garbles ₹ as a
  // similar-looking char or a `?` placeholder for an unrecognizable glyph.
  // Whitelist the prefix to avoid matching timestamp colons or bank dashes.
  const lenient = [
    ...text.matchAll(new RegExp(`(?:^|\\s)([₹$€£¥?])\\s*${NUM}`, 'g')),
  ];
  const lenientNums = lenient
    .map((m) => Number((m[2] ?? '').replace(/,/g, '')))
    .filter((n) => !isNaN(n) && n > 0 && n < 1_000_000);
  if (lenientNums.length > 0) {
    return { value: Math.max(...lenientNums), confidence: 'guess' };
  }

  // Pass 3: standalone short number on its own line — anywhere in the OCR.
  // Allow an optional 1-char prefix from a whitelist of common ₹-misread
  // glyphs (F/R/T/Z and `?`). ML Kit's confusion of `₹` with these letters
  // happens especially on dark-mode screenshots with thin small text.
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const standaloneCandidates: number[] = [];
  for (const line of lines) {
    const m = line.match(
      new RegExp(`^([₹$€£¥?FfRrTtZz])?\\s*${NUM}$`),
    );
    if (!m) continue;
    const numStr = m[2] ?? '';
    const stripped = numStr.replace(/[.,]/g, '');
    if (stripped.length === 0 || stripped.length > 7) continue;
    const num = Number(numStr.replace(/,/g, ''));
    if (!isNaN(num) && num > 0 && num < 1_000_000) {
      standaloneCandidates.push(num);
    }
  }
  if (standaloneCandidates.length > 0) {
    const counts = new Map<number, number>();
    for (const n of standaloneCandidates) {
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) =>
      b[1] - a[1] !== 0 ? b[1] - a[1] : a[0] - b[0],
    );
    const raw = sorted[0][0];
    const stripped = stripLeadingRupeeMisread(raw, text);
    return { value: stripped ?? raw, confidence: 'guess' };
  }

  // Pass 4: number right after a payment context word
  const ctx = text.match(
    new RegExp(`(?:Paid|Sent|Amount|Total|Money\\s*Sent)[^\\d]{0,20}${NUM}`, 'i'),
  );
  if (ctx) {
    const num = Number((ctx[1] ?? '').replace(/,/g, ''));
    if (!isNaN(num) && num > 0 && num < 1_000_000) {
      return { value: num, confidence: 'guess' };
    }
  }

  return { value: 0, confidence: 'missing' };
};

const stripDiacritics = (s: string): string =>
  s.replace(/[^\x20-\x7E₹]/g, '').trim();

const isRejectedNameLine = (s: string): boolean =>
  /^(₹|Rs\.?|UPI|PhonePe|Paytm|Google|GPay|From|To:|Banking|Union|HDFC|ICICI|SBI|Axis|Kotak|@|\+\d|Ref)/i.test(
    s,
  );

const isLikelyName = (s: string): boolean => {
  const t = s.trim();
  if (!t || t.length < 2 || t.length > 60) return false;
  if (/^[+\d]/.test(t)) return false;
  if (t.includes('@')) return false;
  if (/[:|]/.test(t)) return false;
  // Title Case OR ALL CAPS, optional dots/hyphens/apostrophes inside words.
  const words = t.split(/\s+/);
  if (words.length === 0) return false;
  return words.every(
    (w) =>
      /^[A-Z][A-Za-z'.\-]*$/.test(w) ||
      /^[A-Z][A-Z'.\-]+$/.test(w),
  );
};

const isLikelyMessage = (s: string): boolean => {
  const t = s.trim();
  if (!t || t.length < 1 || t.length > 80) return false;
  if (/^\+?\d{6,}/.test(t)) return false; // phone-like
  if (/^[+]/.test(t)) return false; // any leading + (e.g. +91...)
  if (/^:/.test(t)) return false; // banking-name continuation like ": Raj Kishor"
  if (/^[A-Z0-9]{15,}$/.test(t)) return false; // txn-id-like
  if (t.includes('@')) return false;
  if (
    /^(Paid to|To:|From:|UPI|PhonePe|Paytm|Google|Banking|Transfer|Transaction|Debited|UTR|Powered|Send Again|Split|Share|History|Contact|Bank|Ref|Message)/i.test(
      t,
    )
  ) {
    return false;
  }
  return true;
};

const extractRecipient = (
  text: string,
  source: UpiSource,
): { value: string; confidence: FieldConfidence } => {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Helper: take the part after a label on the SAME line, falling back to the
  // immediate next line if the label is alone on its line.
  const extractFromLabel = (
    labelRegex: RegExp,
  ): string | null => {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(labelRegex);
      if (!m) continue;
      const inline = (m[1] ?? '').trim();
      if (inline) return stripDiacritics(inline);
      // Label was alone — pick next non-empty, non-rejected line.
      for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        const next = stripDiacritics(lines[j]);
        if (next && !isRejectedNameLine(next) && /^[A-Za-z]/.test(next)) {
          return next;
        }
      }
    }
    return null;
  };

  if (source === 'paytm') {
    const v =
      extractFromLabel(/^To:\s*(.*)$/i) ??
      extractFromLabel(/^To\s+Your:\s*(.*)$/i) ??
      extractFromLabel(/^To\s+\w+:\s*(.*)$/i);
    if (v) return { value: v, confidence: 'ok' };
  }
  if (source === 'gpay') {
    const v =
      extractFromLabel(/^Paid to\s*(.*)$/i) ??
      extractFromLabel(/^To\s+(.+)$/i);
    if (v) return { value: v, confidence: 'ok' };
  }
  if (source === 'phonepe') {
    // PhonePe's OCR often jumbles the recipient name with the message. Look
    // in the window between "Paid to" and "Banking Name"/"Transfer Details"
    // and pick the first line that LOOKS like a name (Title-Case / ALL CAPS).
    const startIdx = lines.findIndex((l) => /^Paid to/i.test(l));
    const endIdx = lines.findIndex((l) =>
      /^(Banking Name|Transfer Details|Message)/i.test(l),
    );
    if (startIdx >= 0) {
      const stop = endIdx > startIdx ? endIdx : Math.min(lines.length, startIdx + 6);
      const window = lines.slice(startIdx + 1, stop);
      const named = window.find((l) => isLikelyName(l));
      if (named) return { value: named, confidence: 'ok' };
    }
    const v = extractFromLabel(/^Paid to\s*(.*)$/i);
    if (v) return { value: v, confidence: 'guess' };
  }

  const generic =
    extractFromLabel(/^Paid to\s*(.*)$/i) ??
    extractFromLabel(/^To:\s*(.*)$/i) ??
    extractFromLabel(/^Sent to\s*(.*)$/i);
  if (generic) return { value: generic, confidence: 'guess' };

  return { value: '', confidence: 'missing' };
};

const extractMessage = (
  text: string,
  source: UpiSource,
): { value: string; confidence: FieldConfidence } => {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (source === 'phonepe') {
    // 1. Try the line right after "Message" — but skip phone numbers / UPI IDs
    //    that ML Kit sometimes inserts there.
    for (let i = 0; i < lines.length; i++) {
      if (/^Message\b/i.test(lines[i])) {
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (isLikelyMessage(lines[j])) {
            return { value: lines[j], confidence: 'ok' };
          }
        }
      }
    }
    // 2. PhonePe's OCR often places the message between "Paid to" and the
    //    next section label, even when "Message" appears later. Scan that
    //    window for a casual-text line that's not a name.
    const startIdx = lines.findIndex((l) => /^Paid to/i.test(l));
    const endIdx = lines.findIndex((l) =>
      /^(Banking Name|Transfer Details|Transaction ID|Debited from)/i.test(l),
    );
    if (startIdx >= 0 && endIdx > startIdx) {
      const window = lines.slice(startIdx + 1, endIdx);
      const candidate = window.find(
        (l) => isLikelyMessage(l) && !isLikelyName(l),
      );
      if (candidate) return { value: candidate, confidence: 'guess' };
    }
  }

  // GPay shows the message in a chip between the amount and the "Pay again" /
  // "Completed" buttons. The chip's preceding line is the amount, but ML Kit
  // often drops the ₹ glyph — so we anchor only on the trailing buttons and
  // reject lines that look like the amount/account/UPI labels themselves.
  if (source === 'gpay') {
    for (let i = 0; i < lines.length; i++) {
      const followsCompleted = lines
        .slice(i + 1, i + 4)
        .some((l) => /(Pay again|Completed)/i.test(l));
      if (!followsCompleted) continue;
      const candidate = lines[i];
      if (
        !/(Pay again|Completed|UPI|PhonePe|Paytm|Google|₹|Bank)/i.test(candidate) &&
        !/^\d+$/.test(candidate) &&
        candidate.length > 1 &&
        candidate.length < 80
      ) {
        return { value: candidate, confidence: 'ok' };
      }
    }
  }

  // Paytm: message lives between the "Rupees X Only" amount block and the
  // "To:" / "To Your:" recipient block. Strip stray icon prefix chars (e.g.
  // "y Credit card" from the smiley glyph) before returning.
  if (source === 'paytm') {
    const cleanMessage = (s: string): string =>
      s.replace(/^[a-z]\s+/, '').trim();

    const isMessageCandidate = (s: string): boolean =>
      Boolean(s) &&
      /[A-Za-z]/.test(s) &&
      !/(₹|Rupees|Money Sent|UPI|To:|From:|@|Bank|Ref|Paytm|PhonePe|Google|Powered|Only)/i.test(
        s,
      ) &&
      !/^\d+$/.test(s) &&
      s.length < 80;

    const onlyIdx = lines.findIndex((l) => /\bOnly\b/i.test(l));
    const toIdx = lines.findIndex((l) =>
      /^To:|^To\s+\w+:/i.test(l),
    );

    if (onlyIdx >= 0 && toIdx > onlyIdx) {
      const window = lines.slice(onlyIdx + 1, toIdx);
      const withComma = window.find(
        (l) => l.includes(',') && isMessageCandidate(l) && !/\d{4}/.test(l),
      );
      if (withComma) return { value: cleanMessage(withComma), confidence: 'ok' };
      const noName = window.find(
        (l) => isMessageCandidate(l) && !isLikelyName(l),
      );
      if (noName) return { value: cleanMessage(noName), confidence: 'guess' };
    }

    // Fallback: any comma-bearing message-shaped line anywhere.
    const anyComma = lines.find(
      (l) => l.includes(',') && isMessageCandidate(l) && !/\d{4}/.test(l),
    );
    if (anyComma) return { value: cleanMessage(anyComma), confidence: 'guess' };
  }

  return { value: '', confidence: 'missing' };
};

const extractTxnId = (
  text: string,
): { value: string; confidence: FieldConfidence } => {
  const patterns = [
    /UPI\s*transaction\s*ID\s*[:\-]?\s*([A-Za-z0-9]{8,})/i,
    /UPI\s*Ref(?:erence)?\s*(?:No\.?)?\s*[:\-]?\s*([A-Za-z0-9]{8,})/i,
    /Transaction\s*ID\s*[:\-]?\s*([A-Za-z0-9]{8,})/i,
    /Google\s*transaction\s*ID\s*[:\-]?\s*([A-Za-z0-9]{8,})/i,
    /UTR\s*[:\-]?\s*([A-Za-z0-9]{8,})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return { value: m[1], confidence: 'ok' };
  }
  return { value: '', confidence: 'missing' };
};

const extractDate = (
  text: string,
): { value: Date; confidence: FieldConfidence } => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  // try matching a date-time substring per line
  for (const line of lines) {
    for (const fmt of DATE_FORMATS) {
      const parsed = dayjs(line, fmt, true);
      if (parsed.isValid()) {
        return { value: parsed.toDate(), confidence: 'ok' };
      }
    }
  }
  // looser scan: combine adjacent words for "06:00 pm on 24 Apr 2026" style
  const blob = text.replace(/\n+/g, ' ');
  const dateRegex =
    /(\d{1,2}[:.]\d{2}\s*(?:am|pm|AM|PM))\s*(?:on)?\s*(\d{1,2}\s+\w{3,9}\s+\d{4})/;
  const m1 = blob.match(dateRegex);
  if (m1) {
    const candidate = `${m1[1]} on ${m1[2]}`;
    for (const fmt of DATE_FORMATS) {
      const parsed = dayjs(candidate, fmt, true);
      if (parsed.isValid()) {
        return { value: parsed.toDate(), confidence: 'guess' };
      }
    }
  }
  // even looser: just find a "1 May 2026" or similar
  const dateOnly = blob.match(/(\d{1,2}\s+\w{3,9}\s+\d{4})/);
  if (dateOnly) {
    const parsed = dayjs(dateOnly[1], ['D MMM YYYY', 'DD MMMM YYYY'], true);
    if (parsed.isValid()) {
      return { value: parsed.toDate(), confidence: 'guess' };
    }
  }
  return { value: new Date(), confidence: 'missing' };
};

export const parseUpiText = (raw: string): ParsedPayment => {
  const source = detectSource(raw);
  const amount = extractAmount(raw);
  const paidTo = extractRecipient(raw, source);
  const message = extractMessage(raw, source);
  const txnId = extractTxnId(raw);
  const date = extractDate(raw);

  return {
    source,
    amount: amount.value,
    paidTo: paidTo.value,
    message: message.value,
    txnId: txnId.value,
    date: date.value,
    raw,
    confidence: {
      amount: amount.confidence,
      paidTo: paidTo.confidence,
      message: message.confidence,
      txnId: txnId.confidence,
      date: date.confidence,
    },
  };
};

export const matchBucket = (
  message: string,
  buckets: { bucketName: string; bucketType: string }[],
): { bucketName: string; bucketType: string } | null => {
  if (!message) return null;
  const tokens = message
    .toLowerCase()
    .split(/[\s,/.\-]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const fixedBuckets = buckets.filter((b) => b.bucketType !== 'wallet');

  for (const token of tokens) {
    const exact = fixedBuckets.find(
      (b) => b.bucketName.toLowerCase() === token,
    );
    if (exact) return exact;
  }
  for (const token of tokens) {
    const starts = fixedBuckets.find((b) =>
      b.bucketName.toLowerCase().startsWith(token),
    );
    if (starts) return starts;
  }
  for (const token of tokens) {
    const sub = fixedBuckets.find((b) =>
      b.bucketName.toLowerCase().includes(token),
    );
    if (sub) return sub;
  }
  return null;
};
