// Normalisasi nomor HP Indonesia ke format E.164 (+62...). Menerima input umum:
// 08xxxxxxxxxx, 8xxxxxxxxxx, 628xxxxxxxxxx, +628xxxxxxxxxx. Return null bila tak valid.
export function normalizePhoneE164(input: string): string | null {
  const trimmed = input.trim().replace(/[\s\-()]/g, '');

  let normalized: string;
  if (trimmed.startsWith('+62')) {
    normalized = trimmed;
  } else if (trimmed.startsWith('62')) {
    normalized = `+${trimmed}`;
  } else if (trimmed.startsWith('0')) {
    normalized = `+62${trimmed.slice(1)}`;
  } else if (trimmed.startsWith('8')) {
    normalized = `+62${trimmed}`;
  } else {
    return null;
  }

  return /^\+62\d{9,13}$/.test(normalized) ? normalized : null;
}
