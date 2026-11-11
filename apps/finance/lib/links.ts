import { backofficeUrl, hrisUrl } from '@/lib/access';
import type { LineKind } from '@/modules/money';

/** Layar asal tiap jenis baris (spec F2-6 §3.2 "Lihat rincian"). null bila alamat web belum diatur. */
export function originLink(kind: LineKind): { href: string; label: string } | null {
  const bo = (path: string, label: string) => {
    const href = backofficeUrl(path);
    return href ? { href, label } : null;
  };
  const hris = (path: string, label: string) => {
    const href = hrisUrl(path);
    return href ? { href, label } : null;
  };
  switch (kind) {
    case 'CASH_DEPOSIT':
    case 'NONCASH':
      return bo('/deposits', 'Setoran (Back Office)');
    case 'TRANSFER_IN':
    case 'TRANSFER_OUT':
      return bo('/cash-flow/transfers', 'Pindah Dana (Back Office)');
    case 'CASHFLOW_IN':
    case 'CASHFLOW_OUT':
      return bo('/cash-flow', 'Arus Kas (Back Office)');
    case 'SUPPLIER':
      return bo('/purchase-orders/supplier-payables', 'Hutang Supplier (Back Office)');
    case 'PAYROLL':
      return hris('/gaji/bayar', 'Bayar Gaji (HRIS)');
    case 'ADVANCE':
    case 'ADVANCE_REPAY':
      return hris('/kasbon', 'Kasbon (HRIS)');
    case 'UNLOADING':
    case 'UNLOADING_REFUND':
      return hris('/gaji/bongkaran', 'Bongkaran (HRIS)');
    case 'VEHICLE_RENTAL':
      return hris('/logistik/sewa-mobil', 'Sewa Mobil (Logistik)');
  }
}
