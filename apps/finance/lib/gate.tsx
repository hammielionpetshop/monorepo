import { backofficeUrl, currentViewer, type FinanceViewer } from '@/lib/access';

/**
 * Penjaga tiap halaman (bukan di layout, supaya halaman tidak pernah menyusun angka untuk yang tidak berhak).
 * Mengembalikan pemirsa, atau tampilan penolakan yang siap dirender.
 */
export async function gate(): Promise<{ viewer: FinanceViewer; denied?: undefined } | { viewer?: undefined; denied: React.ReactElement }> {
  const access = await currentViewer();
  if (access.ok) return { viewer: access.viewer };
  const login = backofficeUrl('/login');
  const message =
    access.reason === 'NOT_ALLOWED'
      ? `Web Finance hanya untuk Owner dan GM. Akun ${access.name ?? 'ini'} tidak termasuk.`
      : access.reason === 'NOT_CONFIGURED'
        ? 'Web Finance belum dikonfigurasi (AUTH_COOKIE_ENV).'
        : 'Silakan masuk dulu di Back Office staging dengan akun Owner atau GM, lalu buka halaman ini lagi.';
  return {
    denied: (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-border bg-card p-6 text-sm">
        <h1 className="text-base font-semibold">Tidak bisa membuka Finance</h1>
        <p className="mt-2 text-muted-foreground">{message}</p>
        {access.reason === 'NO_SESSION' && login && (
          <a href={login} className="mt-4 inline-block font-medium text-primary hover:underline">Masuk di Back Office →</a>
        )}
      </div>
    ),
  };
}
