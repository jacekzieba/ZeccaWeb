# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Debugging: Feedback Loop First

**Before hypothesizing, build a tight pass/fail signal for the exact bug.**

- A failing test, a repro script, or a log line that goes red on *this* bug beats staring at code.
- Spend disproportionate effort here — bisection and instrumentation are only as good as the signal driving them.
- No signal yet? Don't guess-fix. Construct one first.

## 6. Design: Deep Modules

**A lot of behavior behind a small interface, testable at a clean seam.**

- Prefer few, well-named boundaries over many thin ones. A shallow module (interface nearly as complex as its implementation) is a smell.
- Test through the public interface (a "seam"), never against internals — implementation can change; the test shouldn't have to.

## Installed Skills

Several skills from [mattpocock/skills](https://github.com/mattpocock/skills) are installed under `.claude/skills/`: `tdd`, `code-review`, `diagnosing-bugs`, `codebase-design`, `domain-modeling`, `research`, `prototype`, `resolving-merge-conflicts`, `git-guardrails-claude-code`. They elaborate on sections 5-6 above — consult them when the task matches (e.g. `tdd` for red-green-refactor, `diagnosing-bugs` for hard bugs, `codebase-design` for module/seam design).

Note: `code-review` here may overlap with a built-in `/code-review` skill already available in this environment — check which one actually fires before assuming.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
