### Quality guidelines

**ALWAYS** follow these quality guidelines:

- **IMPORTANT**: When you complete a task that has new functions write unit tests for the new function
- **IMPORTANT**: When you complete a task that updates code make sure all existing unit tests pass and write new tests if needed
- **IMPORTANT**: Each time you write or update a unit test run them and ensure they pass
- **IMPORTANT**: When you complete a task run `docker compose exec api uv run pytest` and `docker compose exec frontend npx vitest run` to ensure all tests pass
- **IMPORTANT**: When you complete a task run `docker compose exec frontend npx tsc --noEmit` and `docker compose exec api uv run mypy app/` to check for type errors and fix them
- **IMPORTANT**: After refactoring ALWAYS run `make complexity` and `make quality`. Degradation in code coverage and /o r quality is unacceptable
