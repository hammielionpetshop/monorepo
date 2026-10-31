import { Select } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { ACTIONS, SCOPES, SCOPE_LABELS, type ActionDefinition, type Scope } from '../rules/actions';

export type GrantGroup = { name: string; actions: string[]; ownerOnly: string[] };

export function definitionOf(action: string) {
  return ACTIONS[action as keyof typeof ACTIONS] as ActionDefinition;
}

export function allowedScopes(definition: ActionDefinition): readonly Scope[] {
  if (definition.ownerOnly) return [];
  return definition.selfOnly ? ['SELF'] : SCOPES;
}

const COLUMNS: (Scope | null)[] = [null, ...SCOPES];

function columnLabel(scope: Scope | null) {
  return scope ? SCOPE_LABELS[scope] : 'Tidak ada';
}

/** Catatan tindakan khusus Pemilik/GM: satu baris per kelompok, rinciannya bisa dibuka. */
function OwnerOnlyNote({ actions }: { actions: string[] }) {
  if (!actions.length) return null;
  return (
    <details className="text-xs text-ink-muted">
      <summary className="cursor-pointer select-none py-1">
        {actions.length} tindakan hanya untuk Pemilik dan GM
      </summary>
      <ul className="list-disc pb-1 pl-5">
        {actions.map((action) => <li key={action}>{definitionOf(action).label}</li>)}
      </ul>
    </details>
  );
}

/**
 * Tabel lingkup: di layar md ke atas berupa matriks pilihan (baris tindakan × kolom lingkup);
 * di HP tiap baris memakai dropdown supaya tidak menggulir ke samping.
 */
export function GrantsTable({
  groups, valueOf, isChanged, locked, showOwnerOnly, onChange,
}: {
  groups: GrantGroup[];
  valueOf: (action: string) => Scope | null;
  isChanged: (action: string) => boolean;
  locked: boolean;
  showOwnerOnly: boolean;
  onChange: (action: string, scope: Scope | null) => void;
}) {
  return (
    <>
      {/* Layar md ke atas */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs text-ink-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Tindakan</th>
              {COLUMNS.map((scope) => (
                <th key={scope ?? 'none'} scope="col" className="w-24 px-2 py-2 text-center font-medium">{columnLabel(scope)}</th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.name} className="border-b border-line last:border-b-0">
              <tr className="bg-canvas/60">
                <th scope="colgroup" colSpan={COLUMNS.length + 1} className="px-3 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {group.name}
                </th>
              </tr>
              {group.actions.map((action) => {
                const definition = definitionOf(action);
                const value = valueOf(action);
                const options = allowedScopes(definition);
                return (
                  <tr key={action} className={cn('border-t border-line/60', isChanged(action) && 'bg-warn-bg/60')}>
                    <th scope="row" className="px-3 py-1.5 font-normal">{definition.label}</th>
                    {COLUMNS.map((scope) => {
                      const allowed = scope === null || options.includes(scope);
                      return (
                        <td key={scope ?? 'none'} className="px-2 py-1.5 text-center">
                          {allowed ? (
                            <input
                              type="radio"
                              name={`scope-${action}`}
                              checked={value === scope}
                              disabled={locked}
                              onChange={() => onChange(action, scope)}
                              aria-label={`${definition.label}: ${columnLabel(scope)}`}
                              className="size-4 cursor-pointer accent-brand-600 disabled:cursor-not-allowed"
                            />
                          ) : (
                            <span aria-hidden className="text-line">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {showOwnerOnly && group.ownerOnly.length > 0 && (
                <tr className="border-t border-line/60">
                  <td colSpan={COLUMNS.length + 1} className="px-3 py-1"><OwnerOnlyNote actions={group.ownerOnly} /></td>
                </tr>
              )}
            </tbody>
          ))}
        </table>
      </div>

      {/* HP */}
      <div className="space-y-3 md:hidden">
        {groups.map((group) => (
          <section key={group.name} className="rounded-card border border-line bg-surface px-3 py-2">
            <h2 className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{group.name}</h2>
            <ul className="divide-y divide-line">
              {group.actions.map((action) => {
                const definition = definitionOf(action);
                const value = valueOf(action);
                return (
                  <li key={action} className={cn('space-y-1 py-2', isChanged(action) && '-mx-2 rounded bg-warn-bg/60 px-2')}>
                    <label htmlFor={`scope-m-${action}`} className="block text-sm">{definition.label}</label>
                    <Select
                      id={`scope-m-${action}`}
                      value={value ?? ''}
                      disabled={locked}
                      onChange={(e) => onChange(action, (e.target.value || null) as Scope | null)}
                    >
                      <option value="">Tidak ada</option>
                      {allowedScopes(definition).map((scope) => <option key={scope} value={scope}>{SCOPE_LABELS[scope]}</option>)}
                    </Select>
                  </li>
                );
              })}
            </ul>
            {showOwnerOnly && <OwnerOnlyNote actions={group.ownerOnly} />}
          </section>
        ))}
      </div>
    </>
  );
}
