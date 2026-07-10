'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, LogOut } from 'lucide-react';
import { useCart } from './cart-context';

export function AppHeader({ shopName }: { shopName: string }) {
  const router = useRouter();
  const { itemCount } = useCart();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <Link href="/" className="text-lg font-semibold text-foreground">
        {shopName}
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/keranjang" className="relative rounded-md p-2 hover:bg-secondary" aria-label="Keranjang">
          <ShoppingCart className="h-6 w-6" />
          {itemCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
              {itemCount}
            </span>
          )}
        </Link>
        <button onClick={handleLogout} className="rounded-md p-2 text-muted-foreground hover:bg-secondary" aria-label="Keluar">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
