export const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const parseRupiah = (value: string): number => {
  return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
};
