'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useHoldSeconds } from '@/components/ui/hold-button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { Alert, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { ACTION_NAMES, SCOPE_LABELS, type Scope } from '../rules/actions';
import { postJson } from './api';
import { GrantsTable, definitionOf, type GrantGroup } from './grants-table';
import { PositionList, type PositionOption } from './position-list';


function scopeLabel(scope: Scope | null) {
  return scope ? SCOPE_LABELS[scope] : 'Tidak ada';
}

/** Kelompok tindakan sesuai urutan katalog; tindakan khusus Pemilik/GM dipisah (tidak bisa diberikan). */
const GROUPS: GrantGroup[] = ACTION_NAMES.reduce<GrantGroup[]>((groups, action) => {
  const definition = definitionOf(action);
  let group = groups.find((g) => g.name === definition.group);
  if (!group) {
    group = { name: definition.group, actions: [], ownerOnly: [] };
    groups.push(group);
  }
  (definition.ownerOnly ? group.ownerOnly : group.actions).push(action);
  return groups;
}, []);

const GRANTABLE_COUNT = GROUPS.reduce((sum, g) => sum + g.actions.length, 0);

/** KAR-L33 Hak Akses Jabatan: jabatan di kiri, matriks lingkup di kanan; simpan lewat periksa + tahan. */
export function GrantsScreen({
  positions, selectedId, grants, actorPositionId,
}: {
  positions: PositionOption[];
  selectedId: number | null;
  grants: Record<string, Scope>;
  actorPositionId: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const selected = positions.find((p) => p.id === selectedId) ?? null;
  const [draft, setDraft] = useState<Record<string, Scope | null>>({});
  const [query, setQuery] = useState('');
  const [grantedOnly, setGrantedOnly] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const holdSeconds = useHoldSeconds();
  const [countdown, setCountdown] = useState(holdSeconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDraft({}); setError(null); }, [selectedId, grants]);

  useEffect(() => {
    if (!reviewing) return;
    setCountdown(holdSeconds);
    const timer = setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [reviewing, holdSeconds]);

  const valueOf = (action: string) => (action in draft ? draft[action] : grants[action] ?? null);
  const isChanged = (action: string) => valueOf(action) !== (grants[action] ?? null);

  const changes = useMemo(
    () => Object.entries(draft)
      .filter(([action, scope]) => (grants[action] ?? null) !== scope)
      .map(([action, scope]) => ({ action, scope })),
    [draft, grants],
  );

  const grantedCount = GROUPS.reduce(
    (sum, g) => sum + g.actions.filter((action) => (action in draft ? draft[action] : grants[action] ?? null) !== null).length,
    0,
  );

  const needle = query.trim().toLowerCase();
  const filtering = needle !== '' || grantedOnly;
  const visibleGroups = GROUPS
    .map((group) => ({
      ...group,
      actions: group.actions.filter((action) => {
        if (needle && !definitionOf(action).label.toLowerCase().includes(needle)) return false;
        return !grantedOnly || valueOf(action) !== null;
      }),
    }))
    .filter((group) => group.actions.length > 0 || (!filtering && group.ownerOnly.length > 0));

  const locked = !selected || selected.fullAccess || selected.id === actorPositionId;

  async function submit() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const result = await postJson('/api/access/grants', { positionId: selected.id, changes });
    setBusy(false);
    setReviewing(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Hak akses jabatan tersimpan.', 'ok');
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
      <PositionList positions={positions} selectedId={selectedId} />

      <div className="min-w-0 space-y-3">
        {!selected && <EmptyState title="Pilih jabatan">Pilih jabatan untuk melihat dan mengatur hak aksesnya.</EmptyState>}

        {selected?.fullAccess && (
          <Alert tone="info" title="Mengikuti Pemilik">
            Jabatan {selected.name} memegang semua tindakan dengan lingkup semua. Haknya tidak bisa diubah atau dikurangi.
          </Alert>
        )}

        {selected && !selected.fullAccess && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h2 className="font-semibold">{selected.name}</h2>
                <p className="text-xs text-ink-muted">
                  {selected.holders} pemegang · {grantedCount} dari {GRANTABLE_COUNT} tindakan diberi
                </p>
              </div>
              <div className="ml-auto flex w-full flex-wrap items-center gap-3 sm:w-auto">
                <Input
                  type="search"
                  aria-label="Cari tindakan"
                  placeholder="Cari tindakan…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 sm:w-56 sm:flex-none"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={grantedOnly}
                    onChange={(e) => setGrantedOnly(e.target.checked)}
                    className="size-4 accent-brand-600"
                  />
                  Hanya yang diberi
                </label>
              </div>
            </div>

            {selected.id === actorPositionId && (
              <Alert tone="warn">Ini jabatan yang sedang Anda pegang; haknya tidak bisa Anda ubah sendiri.</Alert>
            )}
            {error && <Alert tone="danger" title="Tidak tersimpan">{error}</Alert>}

            {visibleGroups.length ? (
              <GrantsTable
                groups={visibleGroups}
                valueOf={valueOf}
                isChanged={isChanged}
                locked={locked}
                showOwnerOnly={!filtering}
                onChange={(action, scope) => setDraft({ ...draft, [action]: scope })}
              />
            ) : (
              <EmptyState title="Tidak ada tindakan yang cocok">Ubah kata pencarian atau matikan saringan.</EmptyState>
            )}

            <div className="sticky bottom-20 flex justify-end gap-2 md:bottom-4">
              <Button variant="secondary" disabled={!changes.length} onClick={() => setDraft({})}>Batalkan perubahan</Button>
              <Button disabled={locked || !changes.length} onClick={() => setReviewing(true)}>
                Periksa {changes.length ? `(${changes.length})` : ''}
              </Button>
            </div>
          </>
        )}
      </div>

      <Dialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        title={`Periksa perubahan ${selected?.name ?? ''}`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setReviewing(false)}>Kembali</Button>
            <Button onClick={submit} loading={busy} disabled={countdown > 0}>
              {countdown > 0 ? `Simpan (${countdown})` : 'Simpan'}
            </Button>
          </>
        )}
      >
        <p className="mb-2">Berlaku untuk {selected?.holders ?? 0} orang di jabatan ini, langsung setelah disimpan.</p>
        <ul className="space-y-1">
          {changes.map((change) => (
            <li key={change.action}>
              <span className="font-medium">{definitionOf(change.action).label}</span>
              : {scopeLabel(grants[change.action] ?? null)} → {scopeLabel(change.scope)}
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
