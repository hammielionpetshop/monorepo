# Agent Instructions

## Project Scope

- Primary work area: `apps/backoffice`.

## Verification

- For this project, do not run broad or excessive test suites by default.
- Minimum verification for code changes is TypeScript correctness: run `tsc --noEmit` for `apps/backoffice`.
- Add or run targeted tests only when the change is risky, the behavior is non-trivial, or the user explicitly asks for tests.
- If broader tests are skipped, state that clearly in the final response.
