export class StorySelectionEngine {
    constructor({ getStoryText, normalizeWord }) {
        this.getStoryText = getStoryText;
        this.normalizeWord = normalizeWord;
    }

    _storyText() {
        return this.getStoryText?.() || null;
    }

    _buttonsForParagraph(paragraphIndex) {
        const storyText = this._storyText();
        if (!storyText) return [];
        return Array.from(storyText.querySelectorAll(`.story-word-button[data-paragraph-index="${paragraphIndex}"]`));
    }

    buildSelectionFromButton(button) {
        if (!button) return null;
        const word = this.normalizeWord(button.dataset.storyWordNormalized || button.dataset.storyWord || button.textContent || '');
        const paragraphIndex = Number(button.dataset.paragraphIndex);
        const occurrenceIndex = Number(button.dataset.occurrenceIndex);
        const tokenIndex = Number(button.dataset.tokenIndex);
        if (!word || Number.isNaN(paragraphIndex) || Number.isNaN(occurrenceIndex) || Number.isNaN(tokenIndex)) {
            return null;
        }
        return { word, paragraphIndex, occurrenceIndex, tokenIndex };
    }

    buildTextFromRange(paragraphIndex, startTokenIndex, endTokenIndex) {
        const selectedButtons = this._buttonsForParagraph(paragraphIndex).filter((button) => {
            const tokenIndex = Number(button.dataset.tokenIndex);
            return tokenIndex >= Number(startTokenIndex) && tokenIndex <= Number(endTokenIndex);
        });
        return selectedButtons
            .map((button) => this.normalizeWord(button.dataset.storyWordNormalized || button.dataset.storyWord || button.textContent || ''))
            .filter(Boolean)
            .join(' ')
            .trim();
    }

    createRangeSelection(startSelection, endSelection = startSelection, { storyId, page } = {}) {
        if (!startSelection || !endSelection || !storyId) return null;
        if (Number(startSelection.paragraphIndex) !== Number(endSelection.paragraphIndex)) {
            endSelection = startSelection;
        }

        const startTokenIndex = Math.min(Number(startSelection.tokenIndex), Number(endSelection.tokenIndex));
        const endTokenIndex = Math.max(Number(startSelection.tokenIndex), Number(endSelection.tokenIndex));
        const startOccurrenceIndex = Number(startSelection.tokenIndex) <= Number(endSelection.tokenIndex)
            ? Number(startSelection.occurrenceIndex)
            : Number(endSelection.occurrenceIndex);
        const endOccurrenceIndex = Number(startSelection.tokenIndex) <= Number(endSelection.tokenIndex)
            ? Number(endSelection.occurrenceIndex)
            : Number(startSelection.occurrenceIndex);
        const text = this.buildTextFromRange(Number(startSelection.paragraphIndex), startTokenIndex, endTokenIndex)
            || this.normalizeWord(startSelection.word)
            || this.normalizeWord(endSelection.word);
        if (!text) return null;

        return {
            text,
            word: text,
            paragraphIndex: Number(startSelection.paragraphIndex),
            occurrenceIndex: startOccurrenceIndex,
            startOccurrenceIndex,
            endOccurrenceIndex,
            startTokenIndex,
            endTokenIndex,
            storyId,
            page
        };
    }

    createSingleWordSelection(selection, { storyId, page } = {}) {
        if (!selection) return null;
        return this.createRangeSelection(selection, selection, { storyId, page });
    }

    isSingleWord(selection) {
        if (!selection) return false;
        return Number(selection.startTokenIndex ?? selection.tokenIndex ?? -1) === Number(selection.endTokenIndex ?? selection.tokenIndex ?? -1);
    }

    getBoundarySelection(boundary = 'start', selection) {
        if (!selection) return null;
        const useStart = boundary === 'start';
        return {
            word: useStart ? selection.word : selection.text,
            paragraphIndex: Number(selection.paragraphIndex),
            occurrenceIndex: Number(useStart ? selection.startOccurrenceIndex ?? selection.occurrenceIndex : selection.endOccurrenceIndex ?? selection.occurrenceIndex),
            tokenIndex: Number(useStart ? selection.startTokenIndex ?? selection.tokenIndex : selection.endTokenIndex ?? selection.tokenIndex)
        };
    }

    getBoundaryButton(boundary = 'start', selection) {
        const boundarySelection = this.getBoundarySelection(boundary, selection);
        if (!boundarySelection) return null;
        const storyText = this._storyText();
        if (!storyText) return null;
        return storyText.querySelector(`.story-word-button[data-paragraph-index="${boundarySelection.paragraphIndex}"][data-token-index="${boundarySelection.tokenIndex}"]`);
    }

    getSelectionNearPoint(clientX, clientY, preferredParagraphIndex = null) {
        const directHit = document.elementsFromPoint(clientX, clientY)
            .find((el) => el?.classList?.contains?.('story-word-button'));
        const directSelection = this.buildSelectionFromButton(directHit);
        if (directSelection) return directSelection;

        const storyText = this._storyText();
        if (!storyText) return null;

        const storyBounds = storyText.getBoundingClientRect?.();
        if (storyBounds && Number.isFinite(storyBounds.top) && Number.isFinite(storyBounds.bottom)
            && Number.isFinite(storyBounds.left) && Number.isFinite(storyBounds.right)) {
            const horizontalSlack = 44;
            const topSlack = 12;
            const bottomSlack = 64;
            const withinStorySurface = clientX >= storyBounds.left - horizontalSlack
                && clientX <= storyBounds.right + horizontalSlack
                && clientY >= storyBounds.top - topSlack
                && clientY <= storyBounds.bottom + bottomSlack;
            if (!withinStorySurface) {
                return null;
            }
        }

        const buttons = Array.from(storyText.querySelectorAll('.story-word-button'));
        if (!buttons.length) return null;

        let bestSelection = null;
        let bestScore = Number.POSITIVE_INFINITY;
        buttons.forEach((button) => {
            const selection = this.buildSelectionFromButton(button);
            if (!selection) return;
            if (preferredParagraphIndex !== null && Number(selection.paragraphIndex) !== Number(preferredParagraphIndex)) return;
            const rect = button.getBoundingClientRect();
            const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
            const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
            const distance = Math.hypot(dx, dy);
            // Do not hard-cut nearby cross-line targets during handle drag.
            // On phone/tablet, the handle sits below the selection, so dragging to a word
            // on the line above can easily exceed a small Euclidean threshold before the
            // finger is visually over that word. The caller already paragraph-scopes the
            // search during handle drag, so picking the nearest word in that paragraph is
            // the stable reader-like behavior.
            const centerX = rect.left + (rect.width / 2);
            const centerY = rect.top + (rect.height / 2);
            const score = distance + (Math.abs(centerX - clientX) * 0.02) + (Math.abs(centerY - clientY) * 0.02);
            if (score >= bestScore) return;
            bestScore = score;
            bestSelection = selection;
        });

        return bestSelection;
    }
}
