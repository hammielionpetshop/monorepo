'use client';

import { useState } from 'react';
import { Button } from './ui/button';

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

  return <Button variant="secondary" size="sm" onClick={logout} loading={busy}>Keluar</Button>;
}
