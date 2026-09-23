import { describe, expect, it } from 'vitest';
import { formatPoNumber, isUniqueViolation, nextPoSequence } from './po-number';

describe('nextPoSequence', () => {
  it('mulai dari 1 kalau belum ada PO hari itu', () => {
    expect(nextPoSequence(null)).toBe(1);
    expect(nextPoSequence(undefined)).toBe(1);
  });

  it('melanjutkan nomor terbesar hari itu, apa pun cabangnya', () => {
    expect(nextPoSequence('PO-20260923-0005')).toBe(6);
  });

  it('kembali ke 1 kalau format nomor tak terbaca', () => {
    expect(nextPoSequence('PO-rusak')).toBe(1);
  });
});

describe('formatPoNumber', () => {
  it('mengisi nol di depan sampai 4 digit', () => {
    expect(formatPoNumber('20260923', 6)).toBe('PO-20260923-0006');
  });
});

describe('isUniqueViolation', () => {
  it('mengenali kode 23505 langsung maupun di cause (DrizzleQueryError)', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ message: 'Failed query', cause: { code: '23505' } })).toBe(true);
    expect(isUniqueViolation({ cause: { code: '23503' } })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
