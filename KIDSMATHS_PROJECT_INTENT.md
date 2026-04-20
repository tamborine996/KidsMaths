# KidsMaths Project Intent

This is the canonical project-level intent file for KidsMaths.

Use it for Mohammed's durable ideas about what KidsMaths should become, how Hermes should behave inside this project, and what quality bar the product should meet.

Do not use this file for generic cross-project preferences that belong in Hermes memory or global skills.
Do not use this file as a scratchpad for temporary session residue or implementation trivia.

## What belongs here

- Mohammed's stable product direction for KidsMaths
- project-specific expectations for Hermes inside this repo
- quality standards for the child-facing experience
- durable decisions about what the reader, maths surfaces, and supporting workflows should feel like
- project-level priorities that should survive chat history compression

## What does not belong here

- generic preferences that are true across all projects
- ephemeral debugging residue
- command snippets that are only useful for one short session
- detailed subsystem rules that belong in the dedicated interaction or Android-gates docs
- backlog items that belong in `CLAUDE.md`

## Relationship to other project docs

- `KIDSMATHS_PROJECT_INTENT.md`
  - canonical source for project-level product intent
- `KIDSMATHS_VISUAL_AESTHETIC.md`
  - canonical source for KidsMaths visual direction and anti-drift aesthetic rules
- `KIDSMATHS_INTERACTION_SYSTEM.md`
  - reader interaction, popup, gesture, and selection rules
- `KIDSMATHS_ANDROID_WEB_GATES.md`
  - Android/PWA/phone release gates and QA discipline
- `CLAUDE.md`
  - project context, backlog, and migration staging area
- Hermes memory / skills
  - only compact cross-project truths and reusable workflows

## Primary operating rule

Hermes should behave like an operator, not a commentator: understand the real goal, keep driving the work forward, and do not stop at partial progress when an obvious next step remains. Only stop when the job is genuinely complete, a real blocker exists, the user asks to stop, or explicit signoff is needed before the next side effect.

## Execution discipline

- Do not randomly stop after a partial improvement if there is an obvious next step that advances the user’s stated goal.
- Keep working until one of these is true:
  1. the requested job is actually complete,
  2. a real blocker is reached,
  3. user asks to stop,
  4. user wants review/signoff before the next side-effecting change.
- If the user says "keep going", "continue", or similar, continue with the next highest-leverage obvious step instead of pausing for ceremony.
- Do not stop just because one subproblem was fixed if the broader user complaint is still materially unresolved.

## Reporting discipline

- Do not present partial completion as if the full issue is solved.
- Say what was fixed, what remains, and what you are doing next.
- If more work is still clearly needed and safe to do, do it before replying.
- Only treat work as complete when the user-visible problem is actually resolved or a real blocker is explicit.

## KidsMaths-specific expectations

- Prioritize live child-facing reading/math experience over internal neatness.
- Prefer decisive structural fixes over repeating small cosmetic tweaks that have already failed.
- Verify changes in the real running surface whenever practical, not only by static inspection.
- For reader improvements, preserve calm child-friendly UX: low-risk taps, clear feedback, and minimal confusion.
- Keep project-specific intent current: when Mohammed gives durable direction about KidsMaths in Telegram, promote it into the appropriate project doc instead of leaving it only in chat.

## Current durable direction to preserve

- KidsMaths should feel like a calm, high-quality child-facing product, not a cluttered dashboard.
- Visual direction should follow `KIDSMATHS_VISUAL_AESTHETIC.md`: premium, warm-editorial, restrained, and human-authored — not chunky storybook chrome or rough sketchiness.
- Reader interactions should converge toward established Android/Kindle-like behavior when that improves clarity and trust.
- Bookmarking, saved-word/word-bank behavior, and page-place behavior must stay semantically distinct and understandable.
- Deep links into the relevant article/page are valuable for fast troubleshooting and should be treated as a real operational capability, not a nice-to-have.
- Project docs should stay Hermes-native and current rather than depending on stale Claude-era catch-all notes.

## When blocked

- If blocked, state the exact blocker briefly.
- If there is a reasonable fallback path, take it instead of stopping.
- If a fallback has tradeoffs, make the tradeoff explicit but keep moving where possible.
