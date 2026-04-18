import { computePosition, flip, inline, offset, shift } from './vendor/floating-ui.dom.bundle.mjs';

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function toDomRectLike(rect) {
    return {
        x: rect.left,
        y: rect.top,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
    };
}

function createVirtualSelectionReference(selectedButtons = []) {
    const rects = Array.from(selectedButtons)
        .map(button => button?.getBoundingClientRect?.())
        .filter(rect => rect && rect.width > 0 && rect.height > 0)
        .map(toDomRectLike);

    if (!rects.length) return null;

    const unionRect = rects.reduce((acc, rect) => ({
        left: Math.min(acc.left, rect.left),
        top: Math.min(acc.top, rect.top),
        right: Math.max(acc.right, rect.right),
        bottom: Math.max(acc.bottom, rect.bottom),
        width: 0,
        height: 0,
        x: 0,
        y: 0,
    }));

    unionRect.width = Math.max(0, unionRect.right - unionRect.left);
    unionRect.height = Math.max(0, unionRect.bottom - unionRect.top);
    unionRect.x = unionRect.left;
    unionRect.y = unionRect.top;

    return {
        getBoundingClientRect() {
            return unionRect;
        },
        getClientRects() {
            return rects;
        },
    };
}

export class StorySelectionPositioner {
    clear(controls, storyScreen) {
        if (controls) {
            controls.classList.remove('is-anchored');
            controls.style.left = '';
            controls.style.top = '';
            controls.style.bottom = '';
            controls.style.right = '';
            controls.dataset.storySelectionPlacement = '';
            controls.dataset.storySelectionAnchor = '';
        }
        storyScreen?.classList.remove('story-selection-popup-anchored');
    }

    async update({ controls, storyScreen, selectedButtons = [] } = {}) {
        if (!controls || !storyScreen) return false;

        const reference = createVirtualSelectionReference(selectedButtons);
        if (!reference) {
            this.clear(controls, storyScreen);
            return false;
        }

        controls.classList.add('is-anchored');
        controls.style.left = '0px';
        controls.style.top = '0px';
        controls.style.bottom = 'auto';
        controls.style.right = 'auto';

        const viewport = window.visualViewport;
        const viewportLeft = viewport?.offsetLeft ?? 0;
        const viewportTop = viewport?.offsetTop ?? 0;
        const viewportWidth = viewport?.width ?? window.innerWidth;
        const viewportHeight = viewport?.height ?? window.innerHeight;
        const viewportPadding = 8;

        const { x, y, placement } = await computePosition(reference, controls, {
            strategy: 'fixed',
            placement: 'top',
            middleware: [
                inline(),
                offset(12),
                flip({ padding: viewportPadding }),
                shift({ padding: viewportPadding }),
            ],
        });

        const popupRect = controls.getBoundingClientRect();
        const maxLeft = viewportLeft + viewportWidth - popupRect.width - viewportPadding;
        const maxTop = viewportTop + viewportHeight - popupRect.height - viewportPadding;
        const clampedLeft = clamp(x, viewportLeft + viewportPadding, Math.max(viewportLeft + viewportPadding, maxLeft));
        const clampedTop = clamp(y, viewportTop + viewportPadding, Math.max(viewportTop + viewportPadding, maxTop));
        const anchorRect = reference.getBoundingClientRect();

        controls.style.left = `${Math.round(clampedLeft)}px`;
        controls.style.top = `${Math.round(clampedTop)}px`;
        controls.dataset.storySelectionPlacement = placement;
        controls.dataset.storySelectionAnchor = JSON.stringify({
            left: Math.round(anchorRect.left),
            top: Math.round(anchorRect.top),
            right: Math.round(anchorRect.right),
            bottom: Math.round(anchorRect.bottom),
            width: Math.round(anchorRect.width),
            height: Math.round(anchorRect.height),
        });
        storyScreen.classList.add('story-selection-popup-anchored');
        return true;
    }
}
