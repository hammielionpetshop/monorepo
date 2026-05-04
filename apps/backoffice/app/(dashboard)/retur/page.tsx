import TransactionSearchForm from './_components/transaction-search-form';

export const dynamic = 'force-dynamic';

export default function ReturPage() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Manajemen Retur</h1>
        <p className="text-muted-foreground mt-1">
          Cari transaksi dan proses pengembalian barang secara aman.
        </p>
      </div>

      <div className="max-w-4xl">
        <TransactionSearchForm />
      </div>
    </div>
  );
}
