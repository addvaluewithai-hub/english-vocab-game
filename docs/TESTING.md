# Device Testing

The project is intentionally testable before store release. The first supported stakeholder checkpoint is an **EAS preview build** installed on a physical Android or iOS device.

## Expo project

- Owner: `dragon2026s-team`
- Slug: `english-vocab`
- Dashboard: `https://expo.dev/accounts/dragon2026s-team/projects/english-vocab`

`app.json` intentionally contains the owner and slug but does not guess an EAS project UUID. Before the first build, read the existing project's **Project ID** from Expo Project Settings → General and link this repository to that exact project. Prefer linking by exact ID so a second project cannot be created accidentally.

## Preview profile

`eas.json` defines a `preview` profile using internal distribution. Android builds use APK format so they can be installed directly. iOS preview builds use internal distribution and may require device registration / Apple signing setup on the first run.

A manual EAS Workflow exists at `.eas/workflows/preview-build.yml` and builds both platforms using the preview environment.

## What to test in the first preview

1. Fresh launch and language-pair setup.
2. Vocabulary Bank browse/search/filter.
3. Manual word + second-sense creation and editing.
4. Study card flip, swipe grading, Forgot/Knew buttons, haptics, progress and completion.
5. App restart with local vocabulary and review state preserved.
6. Pronunciation playback and replay; replay a previously cached clip while offline.
7. Reverse/cloze/listening/typing recall modes where content supports them.
8. Stats screen and learner-level setting.
9. Sign in / account flow and cloud sync status when preview Neon endpoints are configured.
10. Text/list import. Explicit vocabulary lists should work locally; prose requires the server API.
11. YouTube and PDF import only after preview EAS server secrets/endpoints are configured.
12. Notification opt-in and scheduled due reminder on a physical device. This is the remaining verification for T028.

## Smart-import runtime requirements

The mobile build never contains privileged secrets. Server-side smart imports require the preview EAS environment to provide the configured Neon server variables, object-storage variables, and `GEMINI_API_KEY`. `GEMINI_API_KEY` in GitHub Actions is separate from EAS runtime secrets and is not automatically copied to EAS.

If the server environment is not configured yet, the local study loop, bank, manual CRUD, local list import, stats, and cached/offline behavior remain testable.

## Feedback format

For every issue, record:

- platform/device and OS version;
- app version/build if displayed;
- screen and action that triggered the issue;
- expected vs actual behavior;
- whether the device was online or offline;
- screenshot/video when useful;
- never include passwords, tokens, API keys, or private source-document contents in a public issue.
