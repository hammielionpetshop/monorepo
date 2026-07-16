# Expand DataTable Usage in Backoffice

## Overview

This spec defines phase 1 of expanding the reusable `DataTable` in
`apps/backoffice`. The goal is to standardize list and index screens that still
render manual tables, while keeping business-specific filters, tabs, summaries,
and actions in the page-level client components.

This phase does not aim to force every table-shaped UI into the same
abstraction. It focuses only on screens where a reusable list table reduces
duplicated markup without distorting the existing behavior.

## Goals

- Expand reusable `DataTable` adoption across backoffice list and index screens.
- Improve the core `DataTable` so list screens can share loading, empty,
  sorting, pagination, and toolbar structure.
- Preserve existing business flows on each page during migration.
- Keep the component generic enough to remain understandable and testable.

## Non-Goals

- Migrating embedded line-item tables inside forms or detail dialogs.
- Migrating report or print-oriented tables.
- Adding server-side pagination in this phase.
- Moving business filters, status tabs, fetch orchestration, or summary cards
  into `DataTable`.
- Supporting expandable inline detail rows as a first-class `DataTable` feature.

## Current State

The reusable `DataTable` currently covers:

- generic row and column rendering with TanStack Table
- client-side pagination
- a shared empty state row
- a shared pagination summary

The current component is already used by several master data and settings
screens, but many other list and index pages still render manual table markup
because they need one or more of the following:

- filter toolbar sections above the table
- loading states rendered inside the table body
- sortable columns
- row click behavior or row navigation
- page-specific summary text
- page-specific row styling

Examples of representative manual list screens reviewed during design:

- `orders/_components/orders-list-client.tsx`
- `purchase-orders/_components/po-list-client.tsx`
- `audit-log/_components/audit-log-table.tsx`
- `inventory/stock-logs/_components/stock-logs-client.tsx`
- `inventory/adjustment-logs/_components/adjustment-logs-client.tsx`
- `master-data/suppliers/_components/supplier-client.tsx`
- `master-data/customers/_components/customer-client.tsx`

## Scope Definition

Phase 1 covers only list and index screens.

Included:

- list pages with static or fetched row sets
- pages that use page-level filters or status tabs above the table
- pages that need row actions but still fit a normal row model

Excluded:

- line-item tables inside forms, wizards, and transaction editors
- tables inside detail modals or detail pages where layout is tightly coupled to
  the detail view
- print and report layouts
- screens that depend on inline expandable rows for critical workflows unless
  they are first refactored to a simpler pattern

## Design Principles

- `DataTable` owns generic table presentation and generic row interactions.
- Page components own business logic, fetch logic, tab state, filter state,
  summaries, dialogs, and mutations.
- Migration should remove duplicated markup first, not redesign business
  workflows.
- If a screen requires special behavior that would make `DataTable`
  substantially more complex, the screen should be deferred instead of
  stretching the abstraction.

## Proposed DataTable Responsibility

`DataTable` will be the shared foundation for list and index screens, but not a
full page framework.

`DataTable` should own:

- column and row rendering
- client-side pagination
- optional column sorting
- shared loading and empty table states
- optional toolbar placement
- optional page-specific summary placement
- optional row click behavior
- optional row-level class customization

`DataTable` should not own:

- status tabs
- filter forms and filter semantics
- API calls and request state orchestration
- domain-specific summary cards
- expandable inline forms per row
- report and print presentation

## Proposed Phase 1 API

The existing API remains the base:

- `data`
- `columns`
- `emptyMessage`
- `pageSize?`

The component is extended with these optional props:

- `toolbar?: React.ReactNode` Renders a page-supplied toolbar area above the
  table. This is where search, filter controls, reset or apply actions, and
  create buttons live.
- `isLoading?: boolean` Renders a shared loading state inside the table body.
- `loadingMessage?: string` Overrides the default loading text.
- `summary?: React.ReactNode` Allows a page to supply custom summary or warning
  text below the table.
- `enableSorting?: boolean` Enables sortable headers when the supplied columns
  define sorting behavior.
- `onRowClick?: (row: TData) => void` Enables row click interactions without
  forcing the page to manually wrap rows.
- `rowClassName?: (row: TData) => string` Allows page-specific row styling while
  keeping row rendering centralized.

Phase 1 intentionally does not add:

- built-in tabs
- built-in filter state
- built-in server pagination
- built-in expandable row content
- built-in selection or bulk action systems

## Page Composition Pattern

After the change, list pages should follow this structure:

1. Page-level summary cards, if needed.
2. Page-level tabs, if needed.
3. `DataTable` with page-provided `toolbar`, `summary`, and `columns`.
4. Page-level modals and dialogs that remain outside the table.

This keeps business decisions close to each screen while still centralizing the
repetitive table structure.

## Sorting Model

Sorting remains client-side in phase 1.

- Sorting is opt-in per page.
- Pages that need stable display order but no user sorting can leave sorting
  disabled.
- TanStack column definitions continue to define how each column renders and
  sorts.
- The shared component should render sortable header affordances only when
  sorting is enabled and the column supports sorting.

This avoids introducing server query coupling before the list screens are
standardized.

## Loading and Empty States

The shared component should unify the visual structure for these states:

- loading rows rendered in the table body when `isLoading` is true
- empty state row rendered when not loading and `data.length === 0`
- normal body rows rendered otherwise

Pages remain responsible for:

- deciding when to fetch
- deciding whether to show page-level error banners
- supplying contextual empty messages
- supplying contextual loading text when generic wording is insufficient

## Row Interaction Model

Some list screens navigate to detail pages or open a detail dialog from a row.

Phase 1 supports row interaction with `onRowClick` only. Pages that prefer
explicit cell-level links can continue to render links inside columns. The
shared component should not assume that every row is navigable.

This keeps navigation concerns flexible and prevents the core component from
owning routing.

## Migration Candidates

These screens are strong phase 1 candidates because their current behavior fits
the proposed boundary:

- `master-data/customers`
- `master-data/suppliers`
- `orders`
- `purchase-orders`
- `audit-log`
- `inventory/stock-logs`
- `inventory/adjustment-logs`

These pages already match the dominant pattern of page-level filters or tabs
plus a normal result table.

## Deferred Candidates

These should be evaluated after phase 1 or after local simplification:

- `purchase-orders/internal/payables`

`payables` is still a list screen, but the current implementation expands extra
rows inside the table body for payment input and waive confirmation. That is a
workflow-specific pattern, not a generic table responsibility.

It should only migrate in one of these cases:

- the inline payment and waive flows are moved to modal or drawer interactions,
  or
- the page keeps its current custom table because preserving the workflow is
  more important than sharing markup

## Rollout Strategy

Rollout should happen in this order:

1. Extend `DataTable` and add focused tests for the new generic behaviors.
2. Migrate the simplest list screens first to validate the API shape.
3. Migrate screens with richer filters or loading states once the foundation is
   proven.
4. Defer or explicitly redesign outlier screens instead of forcing them into the
   abstraction.

Recommended early migration order:

1. `master-data/customers`
2. `master-data/suppliers`
3. `orders`
4. `purchase-orders`
5. `audit-log`
6. `inventory/adjustment-logs`
7. `inventory/stock-logs`

This sequence starts with local client-side filtering and basic actions before
moving into pages with more involved fetch and loading behavior.

## Testing and Verification

Minimum verification for implementation work:

- run `tsc --noEmit` inside `apps/backoffice`

Targeted tests should be added or updated for:

- toolbar rendering
- loading state rendering
- empty state rendering
- sorting behavior where new logic is introduced
- pagination behavior when loading and data transitions occur

Broader test suites are not required by default for this phase unless a specific
migrated page introduces non-trivial behavioral risk.

## Risks and Mitigations

### Risk: DataTable becomes too broad

Mitigation:

- keep tabs, filters, summaries, and fetch orchestration outside the core
  component
- defer screens that require inline expandable workflows

### Risk: Pages lose existing behavior during migration

Mitigation:

- preserve page-level state and handlers
- migrate one screen at a time
- avoid redesigning business flows during the same change

### Risk: Sorting and row interaction introduce inconsistent UX

Mitigation:

- keep both features opt-in
- only render sortable affordances when a page explicitly enables them
- allow pages to retain explicit link cells where that is clearer

## Acceptance Criteria

Phase 1 design is considered satisfied when implementation delivers all of the
following:

- `DataTable` supports optional toolbar, loading, summary, sorting, and row
  interaction props
- list and index screens can adopt the shared table without moving business
  logic into the core component
- status tabs remain page-level UI above `DataTable`
- at least the simple and medium-complexity candidate screens can migrate
  without custom table markup
- outlier screens such as `payables` are either deferred or locally redesigned
  before migration

## Implementation Notes

- Preserve the current client-side pagination model in phase 1.
- Avoid introducing server query contracts into the shared component.
- Favor API additions that compose with existing TanStack column definitions.
- Treat this phase as a consolidation step before considering more advanced
  table behavior later.
