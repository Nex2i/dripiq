---
name: package-maintainer
description: Maintain DripIQ npm dependencies across client, landing, and server. Use when upgrading packages, reviewing npm audit results, scoping latest-major migrations, or touching package.json/package-lock.json files.
---

# Package Maintainer

## Scope

DripIQ has three independent npm packages and lockfiles:

- `client`
- `landing`
- `server`

There is no root npm workspace. Run package commands from the package directory you are maintaining.

## Current-Major Upgrade Workflow

1. Start from a clean branch and confirm there are no unrelated local changes.
2. For each package, run:

```bash
npx npm-check-updates --target minor -u
npm install
```

`--target minor` keeps package ranges within the current major. For `0.x` packages, minor updates can still be breaking; verify affected APIs carefully.

3. Build and verify:

```bash
cd client && npm run build
cd landing && npm run build
cd server && npm run prod
```

Do not use server scripts that start the server for build verification.

4. If upgraded lint or formatter packages surface warnings, prefer the package's fix script before hand-editing:

```bash
cd server && npm run lint:fix
```

5. Keep generated churn out of dependency commits. `landing npm run build` regenerates `landing/public/sitemap.xml` with the current date; revert that timestamp-only change unless sitemap changes are part of the task.

## Known Compatibility Notes

- `@tanstack/store@0.11.x` no longer exports `Derived`. Use `createAtom(() => computedValue)` for computed store values.
- The server package should expose `npm run prod` as an alias to its production verification script.
- Upgraded server lint tooling may reorder alias imports ahead of relative imports and apply Prettier wrapping changes in scheduling-related files.

## Security Review Workflow

After committing current-major upgrades, run this in the repo root to summarize audit and latest-major scope:

```bash
node - <<'NODE'
const { execSync } = require('child_process');
const dirs = ['client', 'landing', 'server'];
function runJson(dir, cmd) {
  try {
    return JSON.parse(execSync(cmd, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) || '{}');
  } catch (error) {
    return JSON.parse(error.stdout?.toString() || '{}');
  }
}
function major(version) {
  const match = String(version || '').match(/^(?:\D*)(\d+)/);
  return match ? Number(match[1]) : null;
}
for (const dir of dirs) {
  const audit = runJson(dir, 'npm audit --json');
  console.log(`\n## ${dir} audit`);
  console.log(audit.metadata?.vulnerabilities || {});
  const outdated = runJson(dir, 'npm outdated --json');
  console.log(`\n## ${dir} latest-major candidates`);
  for (const [name, info] of Object.entries(outdated || {})) {
    if (major(info.latest) > major(info.current)) {
      console.log(`${name}: ${info.current} -> ${info.latest}`);
    }
  }
}
NODE
```

## Latest Stable Migration Scope

Use this grouping when planning next-major work:

- Frontend build/test stack: `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `typescript`, and related ESLint packages. Upgrade together and expect config, type, and test environment changes.
- TanStack packages: keep router, router devtools, router plugins, store, and React adapters aligned by package family.
- Server Fastify auth: prioritize `@fastify/jwt@10` because the current `@fastify/jwt@9` path leaves a critical `fast-jwt` advisory. Review JWT plugin registration, signing, verification, and tests.
- Server observability and AI SDKs: upgrade LangChain packages together, then Langfuse packages together. These are likely API migrations and should have focused integration checks.
- Server data/tooling: treat `drizzle-kit`, `drizzle-orm`, TypeScript, and Node types as a coordinated migration because they affect migrations, seed scripts, and compile output.

## Baseline Findings From 2026-04-26

- `client`: 10 audit findings after current-major upgrades, all reported by npm as fixable; latest-major candidates include Vite 8, Vitest 4, TypeScript 6, jsdom 29, lucide-react 1, and faker 10.
- `landing`: 7 audit findings after current-major upgrades, all reported by npm as fixable; latest-major candidates overlap with the frontend build/test stack and ESLint 10.
- `server`: 26 audit findings after current-major upgrades, including a critical `fast-jwt` issue through `@fastify/jwt@9`; latest-major candidates include `@fastify/jwt@10`, Bull Board 7, LangChain 1, Langfuse 5, TypeScript 6, pino 10, uuid 14, and Node types 25.
