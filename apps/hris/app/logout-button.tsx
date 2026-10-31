'use client';

import { useState } from 'react';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      const csrf = await (await fetch('/api/auth/csrf', { cache: 'no-store' })).json();
      await fetch('/api/auth/logout', { method: 'POST', headers: { 'x-csrf-token': csrf.token } });
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <button onClick={logout} disabled={busy} className="rounded border px-3 py-1 text-sm disabled:opacity-50">
      {busy ? 'Keluar…' : 'Keluar'}
    </button>
  );
}
