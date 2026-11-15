# Workspace Rules

## Testing Before Commits
- Always run `npm test` after making code changes and before committing.
- `npm test` runs Vitest in single-run mode (`vitest run`) with strict per-test, hook, and teardown timeouts. Treat any hung or timed-out test as a failure and investigate before committing.
- **9-Second Sanity Check & Test Tiering**:
  - Watch the total runtime of `npm test`. If `npm test` takes longer than **9 seconds**, automatically trigger a review and update/optimization of the tests (and/or the code paths they exercise).
  - If needed to keep `npm test` consistently under 9 seconds without reducing coverage, separate tests into two tiers:
    1. **Default / Fast Suite (`npm test`)**: Fast, isolated unit and component tests run on every routine change before committing (`< 9s`).
    2. **Extended Regression / Smoke / System Suite (`npm run test:e2e`, and/or a dedicated slow-test script such as `npm run test:full`)**: Slower heavy regression, multi-seed fuzzing, and headless browser E2E/system tests — run only for major or risky changes, new milestones/versions, or when a bug is reported or suspected.

## Automatic Git Commit and Push
- After completing file changes for any user request and verifying that tests pass, automatically stage (`git add -A`) and commit (`git commit`) all changes with a clear, descriptive commit message without waiting for the user to ask.
- Immediately after committing, automatically push (`git push`) the commit to the remote repository (`origin`), since this is a solo-developer repository.
