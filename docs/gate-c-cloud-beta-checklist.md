# Gate C — Cloud Beta Verification Checklist

Use this checklist before declaring the Cloud Beta gate complete. Run it against a non-production Neon branch first, then repeat the smoke subset against the release environment.

## Preconditions

- Two test accounts exist: Account A and Account B.
- Two physical devices or one physical device plus a simulator/emulator are available.
- Neon Auth and the authenticated Data API boundary are configured for the target environment.
- The app starts with SQLite as the immediate read/write source and can be used with networking disabled.

## Fresh-device restore

1. On Device A, sign into Account A and create at least two terms, including one phrase and one term with multiple senses.
2. Put one card into a collection and save source/context metadata.
3. Complete at least three reviews, including one `KNEW` and one `FORGOT` result.
4. Confirm Device A reaches a synced state.
5. Install/reset the app on Device B so it has no local Account A rows, then sign into Account A.
6. Run sync/restore and verify the vocabulary bank, senses, collection membership, source/context metadata, card state, due dates, and review history are reconstructed.
7. Verify missing optional media cache files do not prevent the restored cards from opening or being graded.

Expected result: the cloud copy is sufficient to reconstruct supported local learning state without privileged credentials in the client.

## Independent offline use and convergence

1. Start with both devices synced for Account A.
2. Disable networking on both devices.
3. On Device A, edit an existing sense/definition and complete a review.
4. On Device B, add a different term and complete a review on another card.
5. Restart both apps while still offline and verify all local changes are still present.
6. Re-enable networking on Device A and sync; then re-enable networking on Device B and sync.
7. Sync Device A once more.
8. Verify both devices converge on the same vocabulary, collection, source metadata, review-event count, and current scheduling state.
9. Confirm review events are not duplicated after repeated sync runs.

Expected result: independent offline work converges deterministically and append-only review history remains idempotent.

## Conflict and tombstone behavior

1. With both devices synced, disable networking.
2. Edit the same mutable entity on both devices with different values.
3. Reconnect/sync in opposite orders and confirm the documented deterministic conflict rule produces the same winner.
4. Repeat with Device A deleting/archiving an entity while Device B holds an older offline edit.
5. Confirm the stale edit does not resurrect the tombstoned entity.

Expected result: conflict resolution is deterministic and old clients cannot silently resurrect deleted content.

## Poisoned mutation and recovery

1. Introduce a test mutation that the server rejects permanently.
2. Verify it moves to the blocked/dead-letter path rather than retrying forever.
3. Verify later valid mutations continue to sync.
4. Confirm Settings shows an actionable sync error without blocking local study.
5. Fix/retry the blocked item and verify the sync state returns to normal.

Expected result: one bad mutation never wedges the whole account.

## Local reset and re-download

1. Ensure Account A is fully synced.
2. Trigger **Reset local data & re-download** from Settings and accept the explicit confirmation.
3. Verify only the selected account's local copy is rebuilt.
4. Confirm cloud rows are not deleted and unrelated guest/other-account data is not exposed.
5. Verify study remains usable after the restore completes.

Expected result: local recovery is destructive only to the device copy and never implicitly deletes cloud data.

## Account isolation

1. Sign out from Account A and sign into Account B on the same device.
2. Verify Account A bank, collections, reviews, and sources are not visible under Account B.
3. Create/sync Account B data, then switch back to Account A and verify each account sees only its own data.

Expected result: shared-device transitions do not leak private learning data between accounts.

## Known beta limitations to record when applicable

- Large media files are restored as metadata/references; device caches may need to be fetched again.
- Long-running smart imports use their own job lifecycle and are not treated as ordinary sync mutations.
- Notification delivery timing is platform-controlled and should be validated in the Learning V1 device checklist.
- Any source provider with expiring URLs must define refresh/fallback behavior before store release.
