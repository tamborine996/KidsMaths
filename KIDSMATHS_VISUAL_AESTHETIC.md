# KidsMaths Visual Aesthetic Contract

This is the canonical visual-direction document for KidsMaths.

Use it to keep the product from drifting back into chunky prototype UI, over-explained dashboard chrome, or generic warm-child-app styling.

It is based on the review/export boards Mohammed approved as the right aesthetic examples:
- streamlined reading section proposal
- proposed English reading shelf
- Kindle-style scroll bookshelf proposal
- Kindle-style browsing state

These example boards are references for the aesthetic grammar, not literal screenshots to copy.

## Core stance

KidsMaths should feel like a premium, calm, human-authored reading product.

The right direction is not:
- rough whiteboard
- generic SaaS dashboard
- chunky playful storybook chrome
- over-pastel child-app toy styling

The right direction is:
- warm editorial
- restrained
- bookish
- calm
- structured
- premium
- human-authored

A useful shorthand is:
`curated reading notebook`
not
`storybook dashboard`
and not
`rough sketch board`.

## Non-negotiable visual identity rules

### 1. Premium Excalidraw translation, not literal sketchiness
Mohammed's example boards have an Excalidraw-like authored clarity, but they are not rough.

What to keep from that direction:
- human-made feeling
- clear object boundaries
- simple, readable grouping
- lightly softened shapes
- strong layout legibility

What not to copy:
- loose doodle energy
- messy arrows/redlines
- rough whiteboard sloppiness
- amateur sketch wobble in core product UI

The product should feel authored by a thoughtful human, not literally sketched.

### 2. Calm editorial reading product, not a dashboard
The app should not feel like a dashboard that happens to contain books.

Avoid:
- noisy filters
- equal-weight cards everywhere
- status-chip clutter
- badge-heavy surfaces
- lots of micro-panels competing for attention
- explanatory chrome before the main reading action

Prefer:
- one dominant action
- one dominant artifact/card when needed
- clear section rhythm
- obvious next step
- quiet supporting metadata

### 3. Warm neutral base, dark ink structure
Use a restrained palette.

Primary palette:
- warm cream / parchment background
- white or lightly warmed cards
- deep navy / ink for primary structure and buttons
- soft gray for supporting text
- pale butter/yellow only for review-note or rationale surfaces
- desaturated accent colors for covers/content differentiation only

Avoid:
- loud rainbow accenting
- many equally strong colors at once
- candy-like child-app saturation
- bright blue selected states unless intentionally justified

### 4. Typography should be modern, disciplined, and editorial
Default direction:
- clean modern sans-serif for UI structure, labels, body, metadata
- if serif is used, use it deliberately and sparingly for bookish emphasis, not as a blanket personality crutch

Avoid:
- Comic Neue / comic-ish UI as the governing reading-product aesthetic
- whimsical type that weakens premium trust
- too many font personalities mixed together

Typography rules:
- large bold titles for page/screen headings
- smaller muted body copy
- small uppercase micro-labels only where they genuinely help structure
- short, exact copy
- no decorative hype copy

### 5. Rounded, soft, and precise — not chunky
Rounded corners are correct.
Chunkiness is not.

Prefer:
- consistent soft radii
- thin borders
- subtle shadows
- quiet depth
- strong spacing and alignment doing most of the work

Avoid as the main system language:
- thick 3px+ borders everywhere
- offset toy-like shadows
- inflated puffy buttons
- heavy outlined boxes around everything

### 6. One consistent card grammar
Cards should feel like part of one system.

Shared rules:
- same radius family
- same shadow family
- same border logic
- same padding rhythm
- same primary/secondary action grammar

Within that system:
- hero cards can be larger and more detailed
- list rows can be denser
- nested secondary panels can exist for bookmark/place/support info

But they must still feel related.

### 7. Primary vs secondary action must always be obvious
Buttons should follow a stable grammar:
- primary = dark filled / strongest visual weight
- secondary = light/outlined / quieter

Do not create surfaces where:
- every button shouts equally
- the whole card means too many different actions
- action hierarchy depends on guesswork

### 8. Review/export boards are part of the product system
When Hermes prepares design-review exports or proposal boards for KidsMaths, they should follow the same aesthetic grammar.

Board rules:
- warm cream background
- one oversized phone/device artifact on the left
- numbered rationale cards on the right
- clean sans typography
- dark navy structure
- pale yellow commentary cards
- subtle shadows
- no messy arrows or sketch clutter

These exports should feel premium, calm, and decision-oriented.

## Surface-specific rules

### Home / shelf / browse surfaces
Should feel like:
- a reading home
- a shelf
- a collection
- a curated notebook of reading choices

Should not feel like:
- an admin dashboard
- a database
- a filter-heavy catalog
- a taxonomy screen

### Reader surfaces
Should feel like:
- calm reading first
- support second
- overlays/tools kept quiet until needed

Should not feel like:
- stacked widgets
- a document viewer with helper junk around it
- a web app with floating divs layered on top of text

### Parent/admin/support surfaces
Can be plainer and more operational, but should still remain visually related.
They should not drag the child-facing surfaces back toward dashboard clutter.

## Explicit anti-drift rules

If a change introduces any of the following, treat it as aesthetic drift and reject/rework it:
- thick chunky borders as default system language
- playful offset shadows as a core visual theme
- comic/novelty font as the main UI font
- too many pills/chips/badges in the main reading path
- rainbow accenting or overly bright colors
- over-explained empty-state/product-philosophy copy inside task surfaces
- dashboard-style chrome before the main reading action
- UI that feels more like a prototype PWA than a premium reading product
- hand-drawn messiness instead of controlled human-authored polish

## Concrete "do this, not that" substitutions

Instead of:
- chunky storybook borders
Use:
- thinner borders, calmer surfaces, stronger spacing rhythm

Instead of:
- offset toy shadows
Use:
- soft short shadows or subtle separation only

Instead of:
- comic-ish friendliness as the main personality
Use:
- mature calm editorial warmth

Instead of:
- many pills/chips for every state
Use:
- fewer, quieter labels and stronger section hierarchy

Instead of:
- a dashboard of equal cards
Use:
- one dominant primary surface and calm supporting structure

Instead of:
- rough Excalidraw-like sketchiness
Use:
- premium human-authored clarity with clean export quality

## Signoff checklist for future UI work

Before signing off on KidsMaths UI changes, check:
1. Does it still feel like a calm reading product rather than a dashboard?
2. Is the main action visually dominant?
3. Are the colors restrained and premium rather than bright/playful?
4. Did we avoid thick borders and offset toy shadows?
5. Does the typography feel modern and trustworthy?
6. Do cards/buttons still belong to one system?
7. Would this still look credible next to the approved review/export boards?
8. Did we reduce noise rather than add it?

If the answer to any of those is no, the work is not aesthetically signed off.

## Relationship to other project docs

- `KIDSMATHS_PROJECT_INTENT.md`
  - product intent and durable direction
- `KIDSMATHS_INTERACTION_SYSTEM.md`
  - interaction, selection, popup, gesture behavior
- `KIDSMATHS_ANDROID_WEB_GATES.md`
  - Android/PWA/phone gates
- `KIDSMATHS_VISUAL_AESTHETIC.md`
  - this document; visual and presentation-system source of truth
- `CLAUDE.md`
  - active context and backlog only; should not override this aesthetic contract

## Superseded direction

Older KidsMaths visual language like:
- `Warm Storybook`
- `Comic Neue` as the governing UI font
- `Chunky 3px offset shadows`
- thick playful borders as the core theme

should be treated as legacy and not the default direction for current reading-product work.