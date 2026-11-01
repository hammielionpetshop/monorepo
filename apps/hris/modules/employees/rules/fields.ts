import { isIsoDate, type IsoDate } from './dates';

// Normalisasi isian data orang (KAR-01, 80, 81). Murni; server memanggilnya sebelum menyimpan.

export const GENDERS = ['MALE', 'FEMALE'] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = { MALE: 'Laki-laki', FEMALE: 'Perempuan' };

export function cleanText(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  return text ? text.slice(0, max) : null;
}

/** Nama wajib, 2–100 karakter. */
export function cleanPersonName(value: unknown): string | null {
  const name = cleanText(value, 200);
  return name && name.length >= 2 && name.length <= 100 ? name : null;
}

/**
 * Nomor HP disimpan dalam satu bentuk supaya kembar terdeteksi: angka saja, awalan 62/+62 → 0.
 * Hasil null = kosong; 'INVALID' = isi tidak masuk akal.
 */
export function normalizePhone(value: unknown): string | null | 'INVALID' {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'string') return 'INVALID';
  let digits = value.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return 'INVALID';
  if (digits.startsWith('62')) digits = `0${digits.slice(2)}`;
  return /^0\d{8,13}$/.test(digits) ? digits : 'INVALID';
}

export function normalizeEmail(value: unknown): string | null | 'INVALID' {
  const email = cleanText(value, 255)?.toLowerCase() ?? null;
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : 'INVALID';
}

export function optionalDate(value: unknown): IsoDate | null | 'INVALID' {
  if (value == null || value === '') return null;
  return isIsoDate(value) ? value : 'INVALID';
}

/** Rekening disamarkan kecuali 4 angka terakhir (KAR-L10). */
export function maskAccountNumber(value: string | null): string | null {
  if (!value) return null;
  const tail = value.slice(-4);
  return `${'•'.repeat(Math.max(0, Math.min(8, value.length - 4)))}${tail}`;
}

/** Kolom kontak & data diri lain yang boleh diubah orangnya sendiri, langsung berlaku (KAR-12, 81). */
export const OWN_CONTACT_FIELDS = [
  'phone', 'address', 'emergencyContactName', 'emergencyContactPhone',
  'birthPlace', 'religion', 'maritalStatus', 'dependents', 'education',
] as const;

/** Kolom data diri dan identitas yang diubah HR langsung (KAR-L21, tercatat sebelum/sesudah). */
export const PERSON_FIELDS = [
  'name', 'phone', 'email', 'birthDate', 'gender', 'address', 'emergencyContactName', 'emergencyContactPhone',
  'birthPlace', 'religion', 'maritalStatus', 'dependents', 'education', 'bankName', 'bankAccountNumber',
  'bankAccountHolder',
] as const;
export type PersonField = (typeof PERSON_FIELDS)[number];

export type PersonValues = {
  name: string;
  phone: string | null;
  email: string | null;
  birthDate: IsoDate | null;
  gender: Gender | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  birthPlace: string | null;
  religion: string | null;
  maritalStatus: string | null;
  dependents: number | null;
  education: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
};

export type FieldsCheck = { ok: true; values: Partial<PersonValues> } | { ok: false; error: string };

/** Memeriksa dan merapikan kolom yang dikirim; kolom yang tidak dikirim tidak disentuh. */
export function cleanPersonFields(input: Record<string, unknown>, allowed: readonly PersonField[]): FieldsCheck {
  const values: Partial<PersonValues> = {};
  for (const field of allowed) {
    if (!Object.hasOwn(input, field)) continue;
    const raw = input[field];
    switch (field) {
      case 'name': {
        const name = cleanPersonName(raw);
        if (!name) return { ok: false, error: 'Nama wajib diisi (2–100 karakter).' };
        values.name = name;
        break;
      }
      case 'phone':
      case 'emergencyContactPhone': {
        const phone = normalizePhone(raw);
        if (phone === 'INVALID') return { ok: false, error: 'Nomor HP tidak valid. Contoh: 081234567890.' };
        values[field] = phone;
        break;
      }
      case 'email': {
        const email = normalizeEmail(raw);
        if (email === 'INVALID') return { ok: false, error: 'Alamat email tidak valid.' };
        values.email = email;
        break;
      }
      case 'birthDate': {
        const date = optionalDate(raw);
        if (date === 'INVALID') return { ok: false, error: 'Tanggal lahir tidak valid.' };
        values.birthDate = date;
        break;
      }
      case 'gender':
        if (raw != null && raw !== '' && !GENDERS.includes(raw as Gender)) return { ok: false, error: 'Jenis kelamin tidak valid.' };
        values.gender = raw ? (raw as Gender) : null;
        break;
      case 'dependents':
        if (raw == null || raw === '') values.dependents = null;
        else if (!Number.isInteger(raw) || (raw as number) < 0 || (raw as number) > 50) {
          return { ok: false, error: 'Jumlah tanggungan harus angka 0–50.' };
        } else values.dependents = raw as number;
        break;
      case 'bankAccountNumber': {
        const number = cleanText(raw, 40)?.replace(/[\s-]/g, '') ?? null;
        if (number && !/^\d{5,30}$/.test(number)) return { ok: false, error: 'Nomor rekening hanya berisi angka.' };
        values.bankAccountNumber = number;
        break;
      }
      case 'address':
        values.address = cleanText(raw, 500);
        break;
      default:
        values[field] = cleanText(raw, 100);
    }
  }
  return { ok: true, values };
}

/** Kolom data identitas yang diubah lewat pengajuan "Ubah data diri" (KAR-66); data lama tetap sampai disetujui. */
export const IDENTITY_FIELDS = ['name', 'birthDate', 'gender', 'bankName', 'bankAccountNumber', 'bankAccountHolder'] as const;
export type IdentityField = (typeof IDENTITY_FIELDS)[number];

export const IDENTITY_LABELS: Record<IdentityField, string> = {
  name: 'Nama',
  birthDate: 'Tanggal lahir',
  gender: 'Jenis kelamin',
  bankName: 'Nama bank',
  bankAccountNumber: 'Nomor rekening',
  bankAccountHolder: 'Nama pemilik rekening',
};

const BANK_FIELDS: readonly IdentityField[] = ['bankName', 'bankAccountNumber', 'bankAccountHolder'];

/** Mengganti rekening wajib melampirkan foto buku tabungan atau kartu ATM (KAR-80). */
export function touchesBankAccount(fields: readonly IdentityField[]): boolean {
  return fields.some((field) => BANK_FIELDS.includes(field));
}

/** Ringkasan satu baris untuk kartu pengajuan: "Ganti nama dan rekening". */
export function identityChangeSummary(fields: readonly IdentityField[]): string {
  const parts: string[] = [];
  if (fields.includes('name')) parts.push('nama');
  if (fields.includes('birthDate')) parts.push('tanggal lahir');
  if (fields.includes('gender')) parts.push('jenis kelamin');
  if (touchesBankAccount(fields)) parts.push('rekening');
  if (!parts.length) return 'Ganti data identitas';
  const text = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} dan ${parts[parts.length - 1]}`;
  return `Ganti ${text}`;
}
