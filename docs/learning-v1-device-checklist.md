# Gate D — Learning V1 Device Verification Checklist

Use this checklist on EAS development/beta builds before Gate D is declared complete. The target Expo project is documented in `docs/deployment-targets.md`.

## iOS

- Install a development/beta build on a physical iPhone.
- Enable review reminders from Settings and grant notification permission only when prompted.
- Set a reminder time a few minutes ahead with at least one card due by that time.
- Background/close the app and verify one reminder arrives with the expected due count.
- Tap the reminder and verify the app opens the intended language-pair study context.
- Complete the due session, foreground the app, and verify the stale reminder is cancelled/reconciled.
- Disable reminders and verify no further local review notification is scheduled.
- Deny notification permission on a fresh install/account and verify local study remains fully usable.
- Play pronunciation audio, replay it, background the app, and verify audio does not continue unexpectedly.
- Reopen offline after previously fetching supported pronunciation audio and verify cached playback when the platform cache still contains the asset; cache misses must degrade without blocking grading.

## Android

- Install a development/beta build on a physical Android device.
- Enable review reminders and verify the `Due vocabulary reviews` notification channel is created with non-alarming/default importance.
- Set a reminder time a few minutes ahead with at least one card due by that time.
- Background/close the app and verify one reminder arrives with the expected due count.
- Tap the notification and verify the correct study context opens.
- Complete the due session and verify reminder reconciliation prevents repeat noise for already-completed due work.
- Disable reminders and confirm scheduled review notifications are removed.
- Deny notification permission and verify the app records reminders as disabled while study remains usable.
- Verify pronunciation playback/replay and background lifecycle behavior.
- Verify supported previously fetched audio can play offline when still cached and that a missing cache never blocks grading.

## Cross-platform regression checks

- No notification is scheduled when no cards will be due at the next reminder time.
- Changing the reminder time replaces the prior scheduled notification instead of stacking duplicates.
- Switching language pairs reconciles reminders per pair and notification taps preserve the intended pair context.
- Recall modes do not autoplay answer-revealing pronunciation audio.
- Listening mode is only offered when an audio source exists.
- Notification and audio errors use recoverable UI and never corrupt ReviewEvents or UserCardState.

## Evidence to retain for T043

Record the EAS build IDs used, device/OS versions, pass/fail for each item above, and any platform-specific caveats. Store beta findings in the release feedback log created by T043.
