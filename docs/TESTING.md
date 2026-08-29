# Device Testing

The project is intentionally testable before store release. The first supported stakeholder checkpoint is an **EAS preview build** installed on a physical Android or iOS device.

## Expo project

- Owner: `dragon2026s-team`
- Slug: `english-vocab`
- Project ID: `63fa98c3-c2ea-4146-95ea-a104d116f773`
- Dashboard: `https://expo.dev/accounts/dragon2026s-team/projects/english-vocab`

`app.json` is linked to this exact existing EAS project through `expo.extra.eas.projectId`, so preview builds must not create a second Expo project.

## Fastest preview: browser link

Pull requests automatically trigger an EAS Hosting preview deployment. Expo posts the unique preview URL back to the pull request when the deployment succeeds. Use this browser preview for fast UI/navigation feedback; native-only behavior such as notifications, haptics, persistent audio/file handling, and device-specific offline behavior must still be verified with a device build.

## First preview build

The preferred no-local-setup path is Expo Dashboard → **Builds** → **Build from GitHub**:

- Git ref: `build/tasks-31-40`
- Platform: Android for the fastest first install
- Build profile: `preview`

`eas.json` defines `preview` as internal distribution. Android uses APK format so it can be installed directly from the EAS build artifact. iOS preview builds use internal distribution and may require device registration / Apple signing setup on the first run.

A manual EAS Workflow also exists at `.eas/workflows/preview-build.yml` and builds Android and iOS with the preview environment.

## Server-backed smart imports

Expo Router API routes require a deployed server bundle. `app.json` uses `web.output: server`, and CI validates the web/server export in addition to Android and iOS exports.

Before testing prose/PDF/YouTube smart imports, deploy the API routes to EAS Hosting and configure the preview server environment. The native preview build can still be used for all local/offline features before this step.

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
