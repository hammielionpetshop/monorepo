import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { GrantsScreen, NoAccess, getPositionGrants, listPositionsWithHolders } from '@/modules/access';

export const dynamic = 'force-dynamic';

// KAR-L33 Hak Akses Jabatan.
export default async function GrantsPage({ searchParams }: { searchParams: Promise<{ jabatan?: string }> }) {
  const actor = await requirePageAction('position.grants.update');
  if (!actor) return <NoAccess />;
  const { jabatan } = await searchParams;
  const positions = await listPositionsWithHolders();
  const selected = positions.find((p) => String(p.id) === jabatan) ?? null;
  const grants = selected && !selected.fullAccess ? await getPositionGrants(selected.id) : {};
  return (
    <>
      <PageHeader
        title="Hak Akses Jabatan"
        description="Tindakan yang boleh dilakukan tiap jabatan beserta lingkupnya. Perubahan langsung berlaku dan tercatat."
      />
      <GrantsScreen
        positions={positions.map((p) => ({ id: p.id, name: p.name, fullAccess: p.fullAccess, active: p.active, holders: p.holders }))}
        selectedId={selected?.id ?? null}
        grants={grants}
        actorPositionId={actor.positionId}
      />
    </>
  );
}
