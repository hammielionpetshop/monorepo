'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { ACTIONS, ACTION_NAMES, SCOPES, SCOPE_LABELS, type ActionDefinition, type Scope } from '../rules/actions';
import { postJson } from './api';

type PositionOption = { id: number; name: string; fullAccess: boolean; active: boolean; holders: number };

const HOLD_SECONDS = 3;

function scopeLabel(scope: Scope | null) {
  return scope ? SCOPE_LABELS[scope] : 'Tidak ada';
}

function allowedScopes(definition: ActionDefinition): readonly Scope[] {
  if (definition.ownerOnly) return [];
  return definition.selfOnly ? ['SELF'] : SCOPES;
}

const GROUPS = ACTION_NAMES.reduce<Map<string, string[]>>((map, action) => {
  const { group } = ACTIONS[action] as ActionDefinition;
  map.set(group, [...(map.get(group) ?? []), action]);
  return map;
}, new Map());

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
  const [reviewing, setReviewing] = useState(false);
  const [countdown, setCountdown] = useState(HOLD_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDraft({}); setError(null); }, [selectedId, grants]);

  useEffect(() => {
    if (!reviewing) return;
    setCountdown(HOLD_SECONDS);
    const timer = setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [reviewing]);

  const changes = useMemo(
    () => Object.entries(draft)
      .filter(([action, scope]) => (grants[action] ?? null) !== scope)
      .map(([action, scope]) => ({ action, scope })),
    [draft, grants],
  );

  const locked = !selected || selected.fullAccess || selected.id === actorPositionId;

  async function submit() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const result = await postJson('/api/access/grants', { positionId: selected.id, changes });
    setBusy(false);
    if (!result.ok) {
      setReviewing(false);
      return setError(result.error ?? 'Gagal menyimpan.');
    }
    setReviewing(false);
    toast('Hak akses jabatan tersimpan.', 'ok');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <Field id="position" label="Langkah 1 — Pilih jabatan">
          <Select
            id="position"
            value={selectedId ?? ''}
            onChange={(e) => router.push(e.target.value ? `?jabatan=${e.target.value}` : '?')}
          >
            <option value="">Pilih jabatan…</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.fullAccess ? ' (mengikuti Pemilik)' : ''}{p.active ? '' : ' (nonaktif)'}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {selected && selected.fullAccess && (
        <Alert tone="info" title="Mengikuti Pemilik">
          Jabatan {selected.name} memegang semua tindakan dengan lingkup semua. Haknya tidak bisa diubah atau dikurangi.
        </Alert>
      )}
      {selected && !selected.fullAccess && selected.id === actorPositionId && (
        <Alert tone="warn">Ini jabatan yang sedang Anda pegang; haknya tidak bisa Anda ubah sendiri.</Alert>
      )}
      {error && <Alert tone="danger" title="Tidak tersimpan">{error}</Alert>}

      {selected && !selected.fullAccess && (
        <>
          <p className="text-sm text-ink-muted">
            Langkah 2 — Atur lingkup tiap tindakan. Pemegang jabatan ini: {selected.holders} orang.
          </p>
          {[...GROUPS.entries()].map(([group, actions]) => (
            <Card key={group}>
              <h2 className="mb-3 font-semibold">{group}</h2>
              <ul className="divide-y divide-line">
                {actions.map((action) => {
                  const definition = ACTIONS[action as keyof typeof ACTIONS] as ActionDefinition;
                  const current = grants[action] ?? null;
                  const value = action in draft ? draft[action] : current;
                  const changed = value !== current;
                  const options = allowedScopes(definition);
                  return (
                    <li key={action} className={cn('flex flex-wrap items-center justify-between gap-2 py-2', changed && 'bg-warn-bg/60 -mx-2 rounded px-2')}>
                      <label htmlFor={`scope-${action}`} className="min-w-0 flex-1 text-sm">{definition.label}</label>
                      {definition.ownerOnly ? (
                        <span className="text-xs text-ink-muted">Hanya Pemilik dan GM</span>
                      ) : (
                        <Select
                          id={`scope-${action}`}
                          className="w-full sm:w-48"
                          value={value ?? ''}
                          disabled={locked}
                          onChange={(e) => setDraft({ ...draft, [action]: (e.target.value || null) as Scope | null })}
                        >
                          <option value="">Tidak ada</option>
                          {options.map((scope) => <option key={scope} value={scope}>{SCOPE_LABELS[scope]}</option>)}
                        </Select>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
          <div className="sticky bottom-20 flex justify-end gap-2 md:bottom-4">
            <Button variant="secondary" disabled={!changes.length} onClick={() => setDraft({})}>Batalkan perubahan</Button>
            <Button disabled={locked || !changes.length} onClick={() => setReviewing(true)}>
              Periksa {changes.length ? `(${changes.length})` : ''}
            </Button>
          </div>
        </>
      )}

      <Dialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        title={`Langkah 3 — Periksa perubahan ${selected?.name ?? ''}`}
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
              <span className="font-medium">{(ACTIONS[change.action as keyof typeof ACTIONS] as ActionDefinition).label}</span>
              : {scopeLabel(grants[change.action] ?? null)} → {scopeLabel(change.scope)}
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
