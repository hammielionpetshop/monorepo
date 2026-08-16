import TransactionSearchForm from './_components/transaction-search-form';
import ReturTabs from './_components/retur-tabs';

export const dynamic = 'force-dynamic';

export default function ReturPage() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-foreground">Manajemen Retur</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Cari transaksi dan proses pengembalian barang secara aman.
        </p>
      </div>

      <div className="mb-6">
        <ReturTabs />
      </div>

      <div className="max-w-4xl">
        <TransactionSearchForm />
      </div>
    </div>
  );
}
