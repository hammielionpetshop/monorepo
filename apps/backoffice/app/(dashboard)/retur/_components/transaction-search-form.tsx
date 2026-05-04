'use client';

import { useState } from 'react';
import type { TransactionWithReturInfo } from '@/lib/services/retur-service';
import ReturnProcessingForm from './return-processing-form';

export default function TransactionSearchForm() {
  const [trxNumber, setTrxNumber] = useState('');
  const [transaction, setTransaction] = useState<TransactionWithReturInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!trxNumber.trim()) return;

    setIsLoading(true);
    setSearchError(null);
    setTransaction(null);

    try {
      const res = await fetch(`/api/bo/transactions/${trxNumber.trim()}`);
      const data = await res.json();

      if (!res.ok) {
        setSearchError(data.error || 'Gagal mencari transaksi');
        return;
      }

      setTransaction(data);
    } catch (error) {
      setSearchError('Terjadi kesalahan koneksi');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
        <h3 className="text-sm font-semibold mb-4 text-foreground uppercase tracking-wider">Cari Transaksi</h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={trxNumber}
            onChange={(e) => setTrxNumber(e.target.value)}
            placeholder="TRX-YYYYMMDD-XXXX"
            className="flex-1 bg-background border border-input rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Mencari...' : 'Cari'}
          </button>
        </form>

        {searchError && (
          <div className="mt-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
            {searchError}
          </div>
        )}
      </div>

      {transaction && (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border bg-muted/30 flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Detail Transaksi</p>
              <h4 className="text-lg font-bold text-foreground">{transaction.trxNumber}</h4>
              <p className="text-sm text-muted-foreground">{new Date(transaction.createdAt).toLocaleString('id-ID')}</p>
            </div>
            {transaction.isFullyReturned ? (
              <span className="bg-destructive/10 text-destructive text-xs font-bold px-3 py-1 rounded-full border border-destructive/20">
                Sudah Diretur Penuh
              </span>
            ) : (
              <span className="bg-green-50 text-green-700 text-xs font-bold px-3 py-1 rounded-full border border-green-200">
                Siap Diretur
              </span>
            )}
          </div>
          
          <div className="p-6">
             <ReturnProcessingForm 
               transaction={transaction} 
               onSuccess={() => {
                 // Refresh transaction data after success
                 handleSearch({ preventDefault: () => {} } as any);
               }}
             />
          </div>
        </div>
      )}
    </div>
  );
}
