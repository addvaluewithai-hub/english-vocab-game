# English Vocab Game

Offline-first vocabulary recall app built with Expo + React Native + TypeScript.

The learning model is **Term/Phrase → Sense → Context → Review**, not `word → one translation`.

## Stack
- Expo SDK 57 / React Native / TypeScript
- Expo Router
- Expo SQLite
- React Native Gesture Handler + Reanimated
- Expo Haptics
- Neon Postgres planned for cloud persistence after the local MVP

## Development
```bash
npm install
npm run start
npm run typecheck
npm run lint
npm test
```

Use Expo Go where supported for fast iteration. A development build is the production-grade native testing path.

## Structure
See [`docs/architecture.md`](./docs/architecture.md) and the authoritative roadmap in [`Tasks/README.md`](./Tasks/README.md).
