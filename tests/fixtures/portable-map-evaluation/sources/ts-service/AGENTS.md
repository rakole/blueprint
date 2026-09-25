# Fixture development notes

Keep the service source and its tests self-contained and runnable with Node.js
built-ins. Use the local TypeScript compiler when changing typed contracts.
Keep domain invariants in `src/domain`, application orchestration in
`src/application`, HTTP translation in `src/http`, and storage behind the
interfaces in `src/persistence`. This is a synthetic fixture; keep source and
tests focused on the service behavior.
