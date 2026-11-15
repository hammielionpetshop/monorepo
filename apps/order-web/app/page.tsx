import { getShopName } from '@/lib/shop-name';
import { PortalShell } from './_components/portal-shell';
import { CatalogClient } from './_components/catalog-client';

// Halaman ini membaca DB, jadi tanpa force-dynamic Next mencoba mem-prerender-nya
// saat build dan build jadi menuntut koneksi Postgres. Itu tidak bisa dipenuhi
// runner GitHub Actions yang membangun image Docker.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const shopName = await getShopName();

  return (
    <PortalShell shopName={shopName}>
      <CatalogClient />
    </PortalShell>
  );
}
