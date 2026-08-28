# Phase 07 — Quality, Security, Beta, and Release

Goal: convert the feature-complete product into a trustworthy, observable, tested, performant mobile app ready for real users and store distribution.

---

## T039 — Privacy-safe analytics and production error reporting

**Priority:** P1  
**Dependencies:** T010, T021

### Scope
- Define the minimum event taxonomy needed to understand activation, study-loop completion, retention behavior, import usage, and major failures.
- Add crash/error reporting with release/build context.
- Avoid sending vocabulary content, source text, translations, document contents, or other sensitive learning data by default.
- Add consent/configuration behavior required by chosen providers and jurisdictions targeted at launch.
- Document which events/properties are collected and why.

### Acceptance criteria
- Product can measure core funnel health without reconstructing a user's private vocabulary content.
- Crashes and major unhandled errors can be tied to app version/build.
- Analytics/error reporting failures never block study or sync.
- Telemetry policy is documented and consistent with user-facing privacy copy.

---

## T040 — Security/privacy controls, data export, account deletion, and retention policy

**Priority:** P0  
**Dependencies:** T018, T019

### Scope
- Threat-model authentication, RLS, storage URLs, imported files, AI processing, local data, and account transitions.
- Add user-visible data export covering supported vocabulary/review/content data in a documented format.
- Implement account deletion and associated server-data deletion/retention behavior.
- Define retention/cleanup for temporary import artifacts and generated media.
- Verify secrets/service-role credentials never ship in the client bundle.
- Add privacy/security documentation needed for store/release work.

### Acceptance criteria
- Account deletion is end-to-end tested and has a clear user confirmation/recovery boundary.
- Export produces usable data and does not expose another user's content.
- RLS/storage/security checks from T018 are re-verified in production-like configuration.
- Temporary imported source artifacts follow documented cleanup/retention rules.
- Client contains no privileged backend secrets.

---

## T041 — Performance, offline, storage, memory, and battery hardening

**Priority:** P0  
**Dependencies:** T022, T036

### Scope
- Profile cold start, local DB initialization, bank list performance, study card transitions, image/audio caching, and sync/import background behavior.
- Test large realistic vocabulary banks and long review histories.
- Verify offline launch/study after prior setup and clean handling of intermittent connectivity.
- Put bounds/cleanup around caches, media, temporary files, and local database growth.
- Avoid unnecessary polling/background work that consumes battery/data.

### Acceptance criteria
- Core study interaction remains perceptibly instant with a large local bank.
- App does not require network availability to review already-local cards.
- Local storage and media caches have bounded cleanup behavior.
- No known memory leak/crash appears during extended study/import/navigation stress testing.
- Background sync/import status checking is appropriately throttled.

---

## T042 — End-to-end test suite and CI quality gates

**Priority:** P0  
**Dependencies:** T023, T036

### Scope
- Establish CI checks for typecheck, lint, unit/integration tests, migrations, and build-critical validation.
- Add end-to-end coverage for onboarding/manual add/study/review persistence/bank search/auth/sync/import staging.
- Add regression coverage for multi-sense terms, duplicate review-event protection, offline edits, and import dedupe.
- Keep flaky external-provider tests isolated behind mocks/contract fixtures where appropriate.
- Define required checks before merging/releasing.

### Acceptance criteria
- Main branch cannot silently regress core domain/sync invariants without a failing automated check.
- Critical user journey has repeatable E2E coverage on at least the primary supported mobile path.
- Database migration tests start from both fresh and representative older schema states.
- External AI/transcript/provider outages do not make ordinary CI randomly fail.

---

## T043 — Internal beta builds, feedback capture, and release feedback loop

**Priority:** P0  
**Dependencies:** T039, T040, T041, T042

### Scope
- Configure EAS development/preview/production profiles and versioning conventions.
- Produce iOS TestFlight and Android internal/closed testing builds as applicable.
- Create a lightweight in-app or linked feedback path including app version/build and optional diagnostics.
- Define beta scenarios testers should exercise: daily study, manual entry, offline use, account restore, imports, notifications.
- Establish bug severity and feedback-triage rules tied back to this Tasks roadmap.

### Acceptance criteria
- A non-developer tester can install the app through supported beta distribution.
- Feedback can be tied to a build/version without requiring users to know technical details.
- P0 beta defects block release and are represented/tracked in the repo planning system.
- Beta checklist covers both iOS and Android release-critical behavior.

---

## T044 — Store readiness: onboarding polish, permissions, privacy copy, metadata, and assets

**Priority:** P0  
**Dependencies:** T043

### Scope
- Finalize first-run onboarding so value is clear before asking for unnecessary permissions/account creation.
- Audit notification, photo/file, camera, and other permission prompts so they are contextual and explained.
- Prepare App Store/Play Store descriptions, screenshots/assets, support/privacy links, age/content declarations, and required data-safety/privacy answers.
- Finalize app icon, splash/launch presentation, version/build naming, and store-facing product identity.
- Verify deep links and production app configuration.

### Acceptance criteria
- Store metadata and privacy/data declarations match actual app behavior.
- Permissions are requested only when the associated feature is used or genuinely required.
- Onboarding can reach useful local value without forcing AI imports or unnecessary account setup.
- Production configuration contains no test endpoints, demo secrets, or placeholder branding.

---

## T045 — Release-candidate hardening and production launch

**Priority:** P0  
**Dependencies:** T044

### Scope
- Cut a release candidate and freeze non-critical scope.
- Run the full automated suite and release checklist on production configuration.
- Perform targeted manual checks: fresh install, upgrade path, offline study, auth restore, sync convergence, import failures, notifications, data deletion/export.
- Resolve all P0 and release-blocking P1 defects or explicitly remove affected scope from launch.
- Build/submit production binaries and record release version/commit.
- Prepare rollback/disable strategy for server-side import/AI features where possible.

### Acceptance criteria
- Release checklist is completed against the exact submitted build/commit.
- No known P0 defect remains in launch scope.
- Production backend migrations/configuration are reproducible and verified.
- Store submissions are created successfully and release artifacts/versions are documented.
- Operational owner knows how to disable a broken import/AI path without disabling local study.

---

## T046 — Post-launch monitoring, feedback triage, and release cadence

**Priority:** P1  
**Dependencies:** T045

### Scope
- Monitor crash/error trends, sync/import failure rates, activation/study completion, and major retention signals defined in T039.
- Establish a repeatable flow for turning real user feedback into roadmap changes/tasks without bypassing the source-of-truth process.
- Define hotfix vs normal-release criteria and versioning/release-note practice.
- Review AI/import cost and quality signals regularly and tune limits/ranking based on evidence.
- Run a post-launch review of the original product hypotheses, especially whether users return to complete due reviews.

### Acceptance criteria
- Production incidents and severe regressions have a documented triage/release path.
- New work is added to `Tasks/README.md` with priority/dependencies before implementation.
- Product can identify whether the core study loop is being used repeatedly, not merely installed/opened once.
- The initial launch plan transitions into an evidence-based ongoing roadmap rather than an untracked feature queue.
