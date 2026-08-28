# Deployment Targets

This file records external deployment targets so release work does not accidentally create duplicate projects.

## Expo / EAS

- Expo account/team: `dragon2026s-team`
- Existing Expo project slug: `english-vocab`
- Dashboard: `https://expo.dev/accounts/dragon2026s-team/projects/english-vocab`
- GitHub repository: `addvaluewithai-hub/english-vocab-game`

The Expo project is already linked to this repository by the project owner. When T043–T045 begin, use this existing project rather than creating a new Expo project.

### Configuration reconciliation before first EAS build

The current app config still uses the local Expo slug `english-vocab-game`. Before the first EAS development/beta build, confirm the existing Expo project's EAS project ID and then update `app.json`/app config with the correct `owner`, project slug/project ID, runtime/update settings, and build profiles. Do not guess the EAS project ID.

Native identifiers currently planned by the app are:

- iOS bundle identifier: `com.addvaluewithai.vocabflow`
- Android application ID: `com.addvaluewithai.vocabflow`

Confirm those identifiers against the existing Expo project before signing or store submission.
