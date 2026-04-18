# KidsMaths Android / Chrome Mobile-Web Gates

Purpose
- Prevent phone issues from being discovered only after Mohammed reviews on Android.
- Turn Android/Chrome mobile-web constraints into repeatable engineering and QA gates.

Use this file for any phone-facing KidsMaths change, not only reader popup work.

## 1. Input and gesture gates

Before shipping:
- primary actions must work with touch, not hover
- touch targets should remain comfortable on phone
- gestures must not fight vertical page scrolling
- if both swipe and tap exist on the same surface, intent thresholds must be explicit
- child-facing primary actions should prefer app-owned tap interactions over fragile browser-native selection when reliability matters

## 2. Viewport and overlay gates

Before shipping:
- overlays/popups/sheets must respect `VisualViewport`
- safe padding and browser chrome changes must not push important UI off-screen
- no critical control should rely on the browser viewport staying static while Android UI bars appear/disappear
- geometry should be checked in the live DOM, not only by visual guesswork

## 3. Edge-case geometry gates

For contextual overlays/popups:
- verify top-left, top-right, bottom-left, bottom-right, and center cases
- selected/tapped content must remain visible
- overlay must remain fully within the visible phone viewport
- different trigger positions must produce different overlay positions when appropriate
- if a library owns placement, legacy CSS must not continue owning centering/translation at the same time

## 4. Text and readability gates

Before shipping:
- text should feel comfortably readable on Android phone without pinch zoom
- helper chips/badges must scale with reading text
- avoid narrow reading columns caused by excessive padding or chrome
- primary reading text should appear high enough in the viewport, not below stacked controls

## 5. PWA and caching gates

Before every real phone-facing deploy:
- bump service-worker cache version
- update build time/version metadata
- verify live `version.json`
- assume Android may show stale PWA state until proven otherwise
- do not claim a phone fix is live until live version metadata confirms it

## 6. Media and async state gates

Before shipping media-related changes:
- audio controls must visibly reconcile state immediately
- short audio actions should not reshape the UI unnecessarily
- errors should fail honestly and quietly rather than leaving the UI in a misleading state
- asynchronous state should not depend on hidden browser behaviors

## 7. Form and keyboard gates

For any screen with inputs:
- Android keyboard must not hide the active field or primary action
- fixed bars/sheets must be checked with the keyboard open where relevant
- viewport changes caused by the keyboard must not trap controls off-screen

## 8. Release-gating workflow

Minimum required before signoff on Android-relevant work:
1. automated/static checks pass
2. local browser verification pass is completed
3. phone-width DOM/geometry verification pass is completed for overlays or fixed UI
4. live version is confirmed after deploy
5. only then ask Mohammed to review on Android for real-device feel

## 9. What to encode into code/tests instead of relying on review

Prefer machine-checkable protections for:
- overlay placement
- viewport containment
- service-worker/version discipline
- touch target sizes where feasible
- state reconciliation after async actions

Mohammed's Android review should validate real-device feel and edge behavior, not discover basic geometry or stale-cache mistakes that code/tests could have caught.
