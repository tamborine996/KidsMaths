# KidsMaths

A children's maths learning web app designed to help a 6-year-old achieve Year 6 level maths within a year.

## Deployment

- **Repository**: Not yet created
- **Live URL**: Not yet deployed
- **Git Root**: `C:\Users\mqc20\Downloads\Projects\KidsMaths`
- **Local Dev**: `npx serve -l 3005`

## Core Philosophy

1. **Parent always present** - App is a tool to amplify parent-led teaching, not replace it
2. **Effort-based rewards** - 1 coin per 15-minute session, NEVER for correct answers
3. **No pressure** - Gentle correction, no penalties for mistakes
4. **Mastery tracking for parent only** - Child sees encouragement, parent sees data in dashboard

## Project Structure

```
KidsMaths/
├── index.html              # Single-page app
├── css/styles.css          # All styling with CSS variables
├── js/
│   ├── app.js              # Main application
│   ├── managers/           # State, Timer, Coins, Progress, ProblemGenerator
│   ├── screens/            # (integrated into app.js for Phase 1)
│   └── components/         # VisualObjects, Celebration, Timer
├── data/
│   ├── modules.json        # All 6 modules with level configs
│   └── rewards.json        # Store items
└── assets/icons/           # Custom SVG icons (not yet used)
```

## Modules

| Module | Levels | Status |
|--------|--------|--------|
| Addition | L1-L5 | Complete |
| Subtraction | L1-L5 | Complete |
| Times Tables | L1-L12 | Complete |
| Multiplication | L1-L5 | Complete |
| Division | L1-L5 | Complete |
| Percentages | L1-L4 | Complete |

## Current State

**Phase 1 Complete**: Core infrastructure working
- Home screen with 6 modules
- Module screen with level selector
- Learn/Practice/Test modes
- Visual objects (apples) for L1 levels
- 15-minute timer with coin award
- Celebration animations
- Store with rewards
- Parent dashboard with PIN protection (default: 1234)

**Design Theme**: Warm Storybook
- Comic Neue font (friendly, hand-drawn feel)
- Cream background (`#F7F3E9`)
- Warm golden accents (`#F4A460`)
- Chunky 3px offset shadows
- Color-coded module borders

## To-Dos

### Pressing
- Deploy to Netlify
- Test on tablet device
- Refine visual canvas for larger numbers

### Future Enhancements
- Speed challenge mode (L6 per module)
- Sound effects toggle
- Multiple child profiles
- Offline mode (service worker)
- More visual object types (stars, blocks)

## Key Implementation Notes

### Effort-Based Rewards (CRITICAL)
```javascript
// CORRECT: Coin awarded for time spent, not performance
timerManager.onComplete = () => {
    coinManager.award(1, '15-minute session completed');
};

// WRONG: Never do this
// if (percentCorrect > 80) { coinManager.award(1); }
```

### Parent PIN
Default PIN is `1234`. Can be changed in Parent Mode > Settings.

### Data Persistence
All data stored in localStorage under key `kidsmaths_state`:
- Coin balance and history
- Session history
- Module progress per level
- Redeemed rewards
- Parent PIN

## Development Notes

### Session: December 30, 2025
- Applied "Warm Storybook" visual theme across entire app
- Redesigned Parent Dashboard with visual progress rings
- Added overall stats banner (minutes practiced, streak, coins earned)
- Progress cards now show levels attempted/total with color-coded rings
- Added friendly date formatting ("Today", "Yesterday", "3 days ago")
- Updated fonts from Nunito/Quicksand to Comic Neue
- Created theme-picker.html for theme selection (6 options offered)

### Session: December 27, 2025
- Built complete Phase 1 infrastructure
- All 6 modules with level configurations
- Visual apples working for addition L1
- Timer, coins, celebration all functional
- Store and Parent Dashboard working
- Fixed "undefined" bug in progress display
