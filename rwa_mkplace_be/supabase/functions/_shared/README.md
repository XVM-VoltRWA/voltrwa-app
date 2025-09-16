# \_shared/nft — folder structure and conventions

This document describes the purpose and conventions for the `supabase/functions/_shared` folder so other developers can quickly understand how to use and extend the shared code.

Recommended structure

- `index.ts` — public exports and small, safe facades used by functions
- `repository/` — code that talks to external systems or the ledger (network/RPC/DB). Keep side-effects isolated here.
- `service/` — orchestration and higher-level flows that combine repository calls and pure helpers to implement business logic.
- `type/` — shared TypeScript types and interfaces (input/output contracts)

Example tree (actual files in this repo)

```
supabase/functions/_shared/nft/
├─ index.ts
├─ repository/
│  └─ index.ts
├─ service/
│  └─ index.ts
└─ type/
   └─ index.ts
```

What belongs where

- `repository/index.ts`

  - Implement low-level calls (HTTP, RPC, DB).
  - Export functions like `fetchOffers`, `submitTransaction`, `getTransactionStatus` that return raw responses or normalized data.
  - Keep network-specific logic here so it can be mocked in tests.

- `service/index.ts`

  - Implement higher-level workflows that orchestrate repository methods and transformation helpers.
  - Example responsibilities: validate inputs, build payloads, call repository to submit, retry/parse and return a sanitized result.
  - Keep side-effects minimal and prefer returning results instead of directly sending HTTP responses.

- `type/index.ts`

  - Export domain interfaces used across repository and service layers. Example: `MintRequest`, `MintResult`, `Offer`.
  - Keep these minimal, stable, and exported from `index.ts` so consumers import a single source.

- `index.ts` (top-level)
  - Re-export the public API: small, stable functions that edge functions import.
  - Example: `export { mintNft } from './service'; export * as types from './type';`

Usage examples

- Import in a Supabase function:

```
import { mintNft } from '../_shared/nft';
import { MintRequest } from '../_shared/nft/type';

const payload: MintRequest = { /* ... */ };
const result = await mintNft(payload);
```

Conventions & best practices

- Pure helpers vs side-effects: place pure data transforms in `service` or separate utils; place network calls in `repository`.
- Environment variables: access secrets inside functions or repository code using the runtime (for Deno: `Deno.env.get()`), and document them in this README.
- Tests: unit-test pure helpers and mock repository calls for service tests. Put tests under `__tests__` near the domain or use the repo test folder.
- Exports: keep `supabase/functions/_shared/nft/index.ts` as the single import surface for callers.

Quick checklist when adding features

1. Add/update TypeScript types in `type/index.ts`.
2. Add low-level calls to `repository/index.ts` (keep them small and mockable).
3. Add orchestration functions to `service/index.ts` that use `repository` and `type`.
4. Re-export public functions from the top-level `index.ts`.
5. Add unit tests for pure logic and mocked tests for orchestration.
6. Update this README if you add new environment variables or external dependencies.

If you want, I can also:

- Generate a scaffold for another domain using the same pattern.
- Add a `types.ts` content example and a small unit test skeleton for `service`.

That's it — short, clear, and consistent so edge functions can import shared code safely.
