# Workspace Rules

## Testing Before Commits
- Always run `npm test` after making code changes and before committing.
- `npm test` runs Vitest in single-run mode (`vitest run`) with strict per-test, hook, and teardown timeouts. Treat any hung or timed-out test as a failure and investigate before committing.

## Automatic Git Commit and Push
- After completing file changes for any user request and verifying that tests pass, automatically stage (`git add -A`) and commit (`git commit`) all changes with a clear, descriptive commit message without waiting for the user to ask.
- Immediately after committing, automatically push (`git push`) the commit to the remote repository (`origin`), since this is a solo-developer repository.
