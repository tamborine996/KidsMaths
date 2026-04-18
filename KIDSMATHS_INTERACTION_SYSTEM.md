# KidsMaths Interaction System

This document applies the cross-project UX defaults to KidsMaths specifically.

## Purpose

Use this file when a KidsMaths UI problem involves reader interactions, gestures, popups, overlays, viewport behavior, or other mobile interaction-heavy behavior.

The goal is to stop solving these issues bottom-up from raw event handlers when they belong to a solved interaction class.

For broader phone-wide prevention beyond reader interactions, pair this file with `KIDSMATHS_ANDROID_WEB_GATES.md`.

## Primary operating model

When a new interaction problem appears, classify it before patching code.

Ask in this order:
1. Is this a solved interaction class?
2. Is this a product decision?
3. Is this an architecture/layering problem?
4. Or is this only a local bug inside an already-correct layer?

## KidsMaths interaction layers

Treat these as separate layers:

1. Selection layer
- word tap selection
- phrase drag selection
- selected-range visibility
- selection clearing / retapping

2. Popup positioning layer
- anchored placement near selected text
- never covering selected text
- above/below flip behavior
- viewport clamping / safe-area handling
- multi-line selection anchoring

3. Gesture layer
- left/right page swipes
- drag-down dismiss
- gesture intent thresholds
- conflict resolution between swipe, tap, and drag-select

4. Reader-level controls layer
- voice selection
- text size
- settings
- global reading controls

5. Product layer
- which actions belong at word level
- what should feel Kindle-like
- what is calm/safe for a child-facing reader
- visual hierarchy and elegance

Do not blur these layers.

## What should not be hand-rolled casually anymore

Unless there is a strong reason not to, do not keep reinventing these from scratch:
- anchored popup collision avoidance
- above/below popup flipping around selected text
- viewport-aware popup clamping on phone
- multi-line selection positioning logic
- gesture arbitration between swipe / drag / tap when the interaction surface gets complex

## Library-first rule for KidsMaths

Before implementing a new interaction-heavy behavior, check:
1. Is there a mature platform pattern already?
2. Is there a trusted library that solves the commodity part?
3. Can we keep only the product-specific part custom?

Default direction:
- popup positioning problems -> use an anchored/floating positioning library
- complex gesture/conflict problems -> consider a dedicated gesture layer/library
- product-specific action model / pedagogy / visual tone -> keep custom

## Word popup rules

Current product rules for the KidsMaths reader:
- The temporary word popup must never cover the selected text.
- The popup should stay word-specific, not become a mini control center.
- The popup should be as compact, calm, and elegant as possible on phone.
- Default word-popup actions are Speak, Bookmark, and Clear.
- Reader-level controls like voice choice or saved-word management should live elsewhere when possible.
- When the selected text is near the bottom, the popup must reposition intelligently instead of hiding the selection.

## QA rules for interaction work

For interaction-heavy reader changes:
1. verify locally in the real running reader
2. verify on the canonical review surface (currently Alice in Wonderland on phone)
3. check that the selected text remains visible
4. check that primary gestures do not conflict
5. check that the popup remains within the visible phone viewport
6. check edge cases explicitly: top-left, top-right, bottom-left, bottom-right, and center selections must all keep the popup visible
7. check that different selected words actually produce different popup positions in the live DOM instead of appearing stuck to one corner
8. only then deploy

## Android / Chrome mobile-web release gates

Treat these as project-wide prevention rules, not popup-only advice.

Before shipping a phone-facing KidsMaths change, check:
1. Touch/input model
- no hover-dependent primary actions
- touch targets remain comfortable on phone
- touch gestures do not fight vertical scrolling
- use app-owned tap state instead of fragile browser-native selection when the product needs stable child-friendly interactions

2. Viewport/overlay model
- overlays and popups must respect `VisualViewport`, not only `window.innerHeight`
- safe padding / browser chrome changes must not push important UI off-screen
- overlays must be geometry-checked, not only screenshot-reviewed

3. Edge-case geometry model
- top-left, top-right, bottom-left, bottom-right, and center cases must be tested for contextual popups/sheets
- selected text must stay visible
- popup must remain fully visible within the phone viewport
- if a library owns placement, legacy CSS must not keep owning centering/translation at the same time

4. Android/PWA update model
- bump service-worker cache version on every real phone-facing deploy
- verify live `version.json` before claiming a fix is available
- treat stale-cache diagnosis as part of phone QA, not as a separate surprise later

5. Release gating
- no signoff until at least one phone-width live DOM verification pass is done
- Mohammed's Android review should validate feel and real browser chrome behavior, but the codebase should already have machine-checkable geometry and update checks before that review

## Process rule for Hermes

When a KidsMaths interaction issue has already survived multiple patches, use the ace card:
- stop local tweaking
- step back to layer ownership
- choose the right library/abstraction if the problem is commodity
- then rewrite the affected interaction layer decisively

## Near-term likely stack direction

These are not locked yet, but are the leading candidates:
- Popup positioning: a floating/anchored positioning library
- Gesture handling: a dedicated gesture abstraction or library if current custom logic keeps conflicting

Do not treat these as final until explicitly adopted, but do treat them as the default direction of travel.
