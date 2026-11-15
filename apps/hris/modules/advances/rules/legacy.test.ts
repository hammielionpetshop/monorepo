import { describe, expect, it } from 'vitest';
import { LEGACY_MAX_INSTALLMENTS, legacyInputProblem, usedOf } from './advance';

// L9a sisa kasbon bawaan sistem lama (spec L9 §3.1, SIS-28).
describe('legacyInputProblem', () => {
  it('menerima sisa berapa pun (tanpa kelipatan, tanpa batas atas) dengan 1–3 kali potong', () => {
    expect(legacyInputProblem({ amount: 437_500, installments: 3, note: '' })).toBeNull();
    expect(legacyInputProblem({ amount: 1_250_000, installments: 1, note: 'KB lama 12' })).toBeNull();
  });

  it('menolak sisa 0, minus, pecahan, dan kali potong di luar 1–3', () => {
    expect(legacyInputProblem({ amount: 0, installments: 1, note: '' })).toMatch(/lebih dari 0/);
    expect(legacyInputProblem({ amount: -5, installments: 1, note: '' })).toMatch(/lebih dari 0/);
    expect(legacyInputProblem({ amount: 1000.5, installments: 1, note: '' })).toMatch(/lebih dari 0/);
    expect(legacyInputProblem({ amount: 100_000, installments: LEGACY_MAX_INSTALLMENTS + 1, note: '' })).not.toBeNull();
    expect(legacyInputProblem({ amount: 100_000, installments: 0, note: '' })).not.toBeNull();
  });

  it('sisa yang sudah disahkan dihitung terpakai (mengurangi batas orang dan Dana Kasbon)', () => {
    expect(usedOf({ kind: 'LEGACY', state: 'APPROVED', requestedAmount: 400_000, finalAmount: 400_000, handedOver: true, remaining: 300_000 })).toBe(300_000);
  });
});
