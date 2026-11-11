const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const rupiah = (n: number) => IDR.format(n);

export function tanggal(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
}

export function bulan(month: string): string {
  return new Date(`${month.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', month: 'long', year: 'numeric' });
}
