# Task Template

Use this template only when implementation or product learning creates genuinely new work. Add the new task to `Tasks/README.md` as well; the status in `Tasks/README.md` remains authoritative.

## TXXX — Clear outcome-oriented task name

**Priority:** P0 / P1 / P2  
**Dependencies:** TXXX, TYYY (or `none`)

### Scope
- Describe one cohesive outcome that fits a focused implementation session.
- Include the important product/domain constraints.
- Include tests, migration, failure-state, accessibility, security, or observability work when they are naturally part of the same outcome.
- Avoid mixing unrelated surfaces just because they touch the same feature area.

### Acceptance criteria
- State observable conditions that prove the task is complete.
- Include correctness/error paths, not only the happy path.
- Include relevant automated tests/checks.
- Avoid subjective completion language such as “looks good” unless paired with concrete review criteria.

## Splitting rule

Split a task before starting when it contains multiple independently shippable outcomes or clearly cannot be completed as one focused session. Preserve dependencies so the next implementer can choose a `READY` task without reconstructing the plan from chat history.

## Completing rule

When the task is complete:

1. Verify all acceptance criteria.
2. Integrate the implementation and checks.
3. Update its status in `Tasks/README.md` to `DONE`.
4. Change directly unblocked dependent tasks from `BACKLOG` to `READY`.
5. If implementation changed an architectural/product assumption, update the relevant in-repo documentation in the same work.
