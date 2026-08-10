# Agent Instructions

## Project Scope

- Primary work area: `apps/backoffice`.
- `apps/pos-desktop` is frozen: excluded from `build`, `typecheck`, `lint`, and `test`. Do not work on it unless asked.

## Verification

- For this project, do not run broad or excessive test suites by default.
- Minimum verification for code changes is TypeScript correctness: `pnpm typecheck` (covers `backoffice` and `order-web`).
- Add or run targeted tests only when the change is risky, the behavior is non-trivial, or the user explicitly asks for tests.
- If broader tests are skipped, state that clearly in the final response.

## Parallel work

Several agents may be working in this repo at the same time, each in its own git worktree.

- Read `docs/agents/claims.md` before starting: it holds the migration lock, active claims, the domain map, and the list of shared "magnet" files.
- Claim your work by committing a row to `docs/agents/claims.md` on `main` **before** creating your branch. A claim written on your own branch is invisible to everyone else.
- Only one branch may add a DB migration at a time — take the migration lock in that file first.
- Stay inside your domain's paths (see the domain map). Split work vertically (UI + API + service of one domain), never horizontally.
- Never edit `apps/backoffice/CHANGELOG.md`. Write a fragment in `apps/backoffice/changelog.d/<branch>.md` instead.

Full rules and the worktree commands (`pnpm worktree:new` / `worktree:remove`) are in `CLAUDE.md`.
