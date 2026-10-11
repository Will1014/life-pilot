# Contributing

## Development

No build step and no dependencies. Serve the folder and open it:

```bash
npm run serve
npm test
```

Game rules live in `src/game.js` and `src/life.js`, which must not touch the
DOM, so every mechanic can be tested under Node. Browser code stays in
`src/main.js`.

## Versioning

Semantic versioning. MAJOR for a change to how the game plays that breaks
comparability of scores, MINOR for new features, PATCH for fixes.

## Releasing

1. CI is green on `main`.
2. Move `[Unreleased]` in `CHANGELOG.md` into a dated version section.
3. Bump `version` in `package.json`.
4. Commit, tag `vX.Y.Z`, push the tag, create the GitHub release.
