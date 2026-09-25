# Stack

## Purpose

The fixture is a private ESM Node service using TypeScript and a small JavaScript adapter surface, with TSX/JSX UI files. package.json runs Node's experimental strip-types test command; tsconfig targets ES2022/NodeNext with strict checking, allowJs, JSX preserve, and noEmit.

## Languages and runtime

The source combines TypeScript domain, application, HTTP, persistence and contract modules with JavaScript request/response and adapter helpers plus TSX/JSX UI components. Runtime code uses Node built-ins; the UUID adapter imports node:crypto.

## Configuration

loadConfig supplies PORT=8080 and RESERVATION_HORIZON_DAYS=7 defaults, then rejects non-integer or out-of-range values (ports 1-65535; horizon 1-30 days).

## Evidence

- `package.json`
- `tsconfig.json`
- `README.md`
- `src/config.ts`
- `src/adapters/ids.js`
