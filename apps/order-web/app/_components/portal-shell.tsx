'use client';

import { CartProvider } from './cart-context';
import { AppHeader } from './app-header';

export function PortalShell({ shopName, children }: { shopName: string; children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <AppHeader shopName={shopName} />
        <main className="flex-1">{children}</main>
      </div>
    </CartProvider>
  );
}
