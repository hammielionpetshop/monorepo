'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatRupiah } from '@petshop/shared';
import { useCart } from './cart-context';

interface MeProfile {
  name: string;
  phone: string;
  address: string | null;
}

export function CheckoutClient() {
  const { cart, loading, refresh } = useCart();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderNumber: string } | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setProfile(data))
      .catch(() => setProfile(null));
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Gagal membuat pesanan');
        return;
      }
      await refresh();
      setSuccess({ orderNumber: data.orderNumber });
    } catch {
      setError('Terjadi kesalahan, coba lagi');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
        <h2 className="text-lg font-semibold text-foreground">Pesanan terkirim!</h2>
        <p className="text-sm text-muted-foreground">
          Nomor pesanan <span className="font-medium text-foreground">{success.orderNumber}</span>. Tunggu
          konfirmasi admin, cek status di halaman Pesanan Saya.
        </p>
        <Link href="/pesanan" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Lihat Pesanan Saya
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Memuat...</div>;
  }

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
        <p className="font-medium text-foreground">Keranjang kosong</p>
        <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Mulai belanja
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-40 pt-4">
      <h1 className="text-lg font-semibold text-foreground">Checkout</h1>

      <div className="rounded-md border border-border bg-card p-3">
        <p className="mb-2 text-sm font-medium text-foreground">Ringkasan Pesanan</p>
        <div className="flex flex-col gap-2">
          {cart.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.productName} x{item.qty} {item.uomCode}
              </span>
              <span className="font-medium text-foreground">{formatRupiah(item.subtotal)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-3">
        <p className="mb-1 text-sm font-medium text-foreground">Alamat Pengiriman</p>
        <p className="text-sm text-muted-foreground">
          {profile?.address || 'Belum ada alamat tercatat, hubungi admin'}
        </p>
      </div>

      <div className="rounded-md border border-border bg-card p-3">
        <label htmlFor="note" className="mb-1 block text-sm font-medium text-foreground">
          Catatan (opsional)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Alamat pengiriman berbeda? Detail lokasi? Tulis di sini"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <p className="rounded-md bg-yellow-100 px-3 py-2 text-sm font-medium text-yellow-800">
        Harga bersifat estimasi, total final dikonfirmasi admin via WhatsApp.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total estimasi</span>
          <span className="text-lg font-semibold text-foreground">{formatRupiah(cart.subtotal)}</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? 'Mengirim...' : 'Kirim Pesanan'}
        </button>
      </div>
    </div>
  );
}
