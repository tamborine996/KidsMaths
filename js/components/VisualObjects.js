/**
 * VisualObjects - Canvas-based visual representations of numbers
 * Used for L1 levels to help children understand what numbers mean
 */
export class VisualObjects {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;

        // Set canvas size accounting for device pixel ratio
        this._setupCanvas();

        // Colors
        this.colors = {
            apple: '#e74c3c',
            appleStem: '#8b4513',
            appleLeaf: '#27ae60',
            star: '#f1c40f',
            starOutline: '#f39c12',
            block: '#3498db',
            blockShadow: '#2980b9',
            label: '#2c3e50',
            plus: '#4ECDC4',
            equals: '#9b59b6'
        };
    }

    /**
     * Setup canvas with proper DPI scaling
     */
    _setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);

        this.width = rect.width;
        this.height = rect.height;
    }

    /**
     * Clear the canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Draw a visual representation of an addition problem
     */
    drawAddition(num1, num2, visualType = 'apples') {
        this.clear();

        const spacing = 10;
        const itemSize = this._calculateItemSize(num1 + num2);

        // Calculate layout
        const group1Width = this._getGroupWidth(num1, itemSize, spacing);
        const group2Width = this._getGroupWidth(num2, itemSize, spacing);
        const operatorWidth = 40;
        const totalWidth = group1Width + operatorWidth + group2Width;

        const startX = (this.width - totalWidth) / 2;
        const centerY = this.height / 2;

        // Draw first group
        this._drawGroup(num1, startX, centerY, itemSize, spacing, visualType);

        // Draw plus sign
        const plusX = startX + group1Width + operatorWidth / 2;
        this._drawOperator('+', plusX, centerY);

        // Draw second group
        const group2StartX = startX + group1Width + operatorWidth;
        this._drawGroup(num2, group2StartX, centerY, itemSize, spacing, visualType);
    }

    /**
     * Draw a visual representation of a subtraction problem
     */
    drawSubtraction(num1, num2, visualType = 'apples') {
        this.clear();

        const spacing = 10;
        const itemSize = this._calculateItemSize(num1);

        // Calculate layout - show all items, some crossed out
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // Draw all items
        this._drawGroup(num1, centerX - this._getGroupWidth(num1, itemSize, spacing) / 2, centerY, itemSize, spacing, visualType);

        // Cross out the subtracted items (from the right)
        this._drawCrossedOut(num2, num1, centerX - this._getGroupWidth(num1, itemSize, spacing) / 2, centerY, itemSize, spacing);
    }

    /**
     * Draw a group of visual objects
     */
    _drawGroup(count, startX, centerY, itemSize, spacing, visualType) {
        const cols = Math.min(count, 5);
        const rows = Math.ceil(count / 5);
        const groupHeight = rows * (itemSize + spacing) - spacing;

        let index = 0;
        for (let row = 0; row < rows; row++) {
            const itemsInRow = Math.min(cols, count - row * cols);
            for (let col = 0; col < itemsInRow; col++) {
                const x = startX + col * (itemSize + spacing) + itemSize / 2;
                const y = centerY - groupHeight / 2 + row * (itemSize + spacing) + itemSize / 2;

                switch (visualType) {
                    case 'apples':
                        this._drawApple(x, y, itemSize / 2);
                        break;
                    case 'stars':
                        this._drawStar(x, y, itemSize / 2);
                        break;
                    case 'blocks':
                        this._drawBlock(x, y, itemSize);
                        break;
                    default:
                        this._drawApple(x, y, itemSize / 2);
                }
                index++;
            }
        }
    }

    /**
     * Draw crossed out items for subtraction
     */
    _drawCrossedOut(crossCount, totalCount, startX, centerY, itemSize, spacing) {
        const cols = Math.min(totalCount, 5);
        const rows = Math.ceil(totalCount / 5);
        const groupHeight = rows * (itemSize + spacing) - spacing;

        // Cross out from the end
        let crossed = 0;
        for (let i = totalCount - 1; i >= 0 && crossed < crossCount; i--) {
            const row = Math.floor(i / cols);
            const col = i % cols;

            const x = startX + col * (itemSize + spacing) + itemSize / 2;
            const y = centerY - groupHeight / 2 + row * (itemSize + spacing) + itemSize / 2;

            // Draw X
            this.ctx.strokeStyle = '#e74c3c';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(x - itemSize / 2, y - itemSize / 2);
            this.ctx.lineTo(x + itemSize / 2, y + itemSize / 2);
            this.ctx.moveTo(x + itemSize / 2, y - itemSize / 2);
            this.ctx.lineTo(x - itemSize / 2, y + itemSize / 2);
            this.ctx.stroke();

            crossed++;
        }
    }

    /**
     * Draw an apple
     */
    _drawApple(x, y, radius) {
        // Main apple body
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.colors.apple;
        this.ctx.fill();

        // Highlight
        this.ctx.beginPath();
        this.ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fill();

        // Stem
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - radius);
        this.ctx.lineTo(x + 2, y - radius - 8);
        this.ctx.strokeStyle = this.colors.appleStem;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Leaf
        this.ctx.beginPath();
        this.ctx.ellipse(x + 6, y - radius - 4, 6, 3, Math.PI / 4, 0, Math.PI * 2);
        this.ctx.fillStyle = this.colors.appleLeaf;
        this.ctx.fill();
    }

    /**
     * Draw a star
     */
    _drawStar(x, y, radius) {
        const spikes = 5;
        const innerRadius = radius * 0.5;

        this.ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? radius : innerRadius;
            const angle = (i * Math.PI) / spikes - Math.PI / 2;
            const sx = x + Math.cos(angle) * r;
            const sy = y + Math.sin(angle) * r;

            if (i === 0) {
                this.ctx.moveTo(sx, sy);
            } else {
                this.ctx.lineTo(sx, sy);
            }
        }
        this.ctx.closePath();

        this.ctx.fillStyle = this.colors.star;
        this.ctx.fill();
        this.ctx.strokeStyle = this.colors.starOutline;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    /**
     * Draw a block
     */
    _drawBlock(x, y, size) {
        const halfSize = size / 2;

        // Shadow
        this.ctx.fillStyle = this.colors.blockShadow;
        this.ctx.fillRect(x - halfSize + 2, y - halfSize + 2, size - 4, size - 4);

        // Main block
        this.ctx.fillStyle = this.colors.block;
        this.ctx.fillRect(x - halfSize, y - halfSize, size - 4, size - 4);

        // Highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.fillRect(x - halfSize, y - halfSize, size - 4, 4);
    }

    /**
     * Draw an operator (+, -, etc.)
     */
    _drawOperator(operator, x, y) {
        this.ctx.font = 'bold 32px Nunito';
        this.ctx.fillStyle = this.colors.plus;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(operator, x, y);
    }

    /**
     * Calculate item size based on count
     */
    _calculateItemSize(count) {
        if (count <= 5) return 36;
        if (count <= 10) return 30;
        if (count <= 15) return 26;
        return 22;
    }

    /**
     * Get width of a group of items
     */
    _getGroupWidth(count, itemSize, spacing) {
        const cols = Math.min(count, 5);
        return cols * (itemSize + spacing) - spacing;
    }

    /**
     * Draw groups for multiplication/division visualization
     */
    drawGroups(groupCount, itemsPerGroup, visualType = 'apples') {
        this.clear();

        const itemSize = this._calculateItemSize(groupCount * itemsPerGroup);
        const groupSpacing = 20;
        const itemSpacing = 8;

        const groupWidth = this._getGroupWidth(itemsPerGroup, itemSize, itemSpacing);
        const totalWidth = groupCount * groupWidth + (groupCount - 1) * groupSpacing;

        const startX = (this.width - totalWidth) / 2;
        const centerY = this.height / 2;

        for (let g = 0; g < groupCount; g++) {
            const groupX = startX + g * (groupWidth + groupSpacing);

            // Draw group circle/box
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#bdc3c7';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.ellipse(
                groupX + groupWidth / 2,
                centerY,
                groupWidth / 2 + 10,
                this._calculateGroupHeight(itemsPerGroup, itemSize, itemSpacing) / 2 + 10,
                0, 0, Math.PI * 2
            );
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // Draw items in group
            this._drawGroup(itemsPerGroup, groupX, centerY, itemSize, itemSpacing, visualType);
        }
    }

    /**
     * Calculate group height
     */
    _calculateGroupHeight(count, itemSize, spacing) {
        const rows = Math.ceil(count / 5);
        return rows * (itemSize + spacing) - spacing;
    }

    /**
     * Resize handler
     */
    resize() {
        this._setupCanvas();
    }
}
