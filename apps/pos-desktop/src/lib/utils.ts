import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(value: number): string {
  return 'Rp ' + Math.round(value).toLocaleString('id-ID');
}

/**
 * Format berat: tampilkan dalam gram (gr) atau kilogram (kg) otomatis.
 * Jika >= 1000 gram, konversi ke kg dengan 1-2 desimal.
 */
export function formatWeight(gram: number): string {
  if (gram <= 0) return '0 gr';
  if (gram >= 1000) {
    const kg = gram / 1000;
    // Jika angka bulat, tampilkan tanpa desimal; jika tidak, 1 desimal
    const formatted = kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1);
    return `${formatted} kg`;
  }
  return `${Math.round(gram)} gr`;
}
