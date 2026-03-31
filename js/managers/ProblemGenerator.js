/**
 * ProblemGenerator - Generates math problems for each module/level
 */
export class ProblemGenerator {
    constructor() {
        // Visual object types
        this.visualTypes = ['apples', 'stars', 'blocks'];
    }

    /**
     * Generate a problem based on module and level config
     */
    generate(module, levelConfig) {
        switch (module) {
            case 'addition':
                return this._generateAddition(levelConfig);
            case 'subtraction':
                return this._generateSubtraction(levelConfig);
            case 'times-tables':
                return this._generateTimesTables(levelConfig);
            case 'multiplication':
                return this._generateMultiplication(levelConfig);
            case 'division':
                return this._generateDivision(levelConfig);
            case 'percentages':
                return this._generatePercentage(levelConfig);
            default:
                console.warn(`Unknown module: ${module}`);
                return this._generateAddition(levelConfig);
        }
    }

    /**
     * Generate addition problem
     */
    _generateAddition(config) {
        let op1, op2;

        do {
            op1 = this._randomInRange(config.operand1.min, config.operand1.max);
            op2 = this._randomInRange(config.operand2.min, config.operand2.max);
        } while (config.noCarry && this._hasCarry(op1, op2, 'add'));

        return {
            operand1: op1,
            operand2: op2,
            operator: '+',
            answer: op1 + op2,
            visual: config.visual || false,
            visualType: config.visualType || 'apples'
        };
    }

    /**
     * Generate subtraction problem
     */
    _generateSubtraction(config) {
        let op1, op2;

        do {
            op1 = this._randomInRange(config.operand1.min, config.operand1.max);
            op2 = this._randomInRange(config.operand2.min, config.operand2.max);

            // Ensure op1 >= op2 (no negative answers for kids)
            if (op1 < op2) {
                [op1, op2] = [op2, op1];
            }
        } while (config.noBorrow && this._hasBorrow(op1, op2));

        return {
            operand1: op1,
            operand2: op2,
            operator: '-',
            answer: op1 - op2,
            visual: config.visual || false,
            visualType: config.visualType || 'apples'
        };
    }

    /**
     * Generate times tables problem
     */
    _generateTimesTables(config) {
        const table = config.table; // Which times table (2-12)
        const multiplier = this._randomInRange(1, 12);

        // Randomly swap order for variety
        const swap = Math.random() > 0.5;
        const op1 = swap ? multiplier : table;
        const op2 = swap ? table : multiplier;

        return {
            operand1: op1,
            operand2: op2,
            operator: '×',
            answer: op1 * op2,
            visual: config.visual || false,
            visualType: 'groups'
        };
    }

    /**
     * Generate multiplication problem (beyond tables)
     */
    _generateMultiplication(config) {
        const op1 = this._randomInRange(config.operand1.min, config.operand1.max);
        const op2 = this._randomInRange(config.operand2.min, config.operand2.max);

        return {
            operand1: op1,
            operand2: op2,
            operator: '×',
            answer: op1 * op2,
            visual: false,
            visualType: null
        };
    }

    /**
     * Generate division problem
     */
    _generateDivision(config) {
        // Generate answer first, then multiply to get dividend
        const answer = this._randomInRange(config.answer?.min || 1, config.answer?.max || 12);
        const divisor = this._randomInRange(config.divisor?.min || 2, config.divisor?.max || 12);
        const dividend = answer * divisor;

        return {
            operand1: dividend,
            operand2: divisor,
            operator: '÷',
            answer: answer,
            visual: config.visual || false,
            visualType: 'groups'
        };
    }

    /**
     * Generate percentage problem
     */
    _generatePercentage(config) {
        const percentages = config.percentages || [50, 25, 10];
        const percent = percentages[Math.floor(Math.random() * percentages.length)];

        // Generate a number that works nicely with the percentage
        let baseMultiplier;
        switch (percent) {
            case 50: baseMultiplier = 2; break;
            case 25: baseMultiplier = 4; break;
            case 10: baseMultiplier = 10; break;
            case 20: baseMultiplier = 5; break;
            case 5: baseMultiplier = 20; break;
            default: baseMultiplier = 100 / percent;
        }

        const resultMin = config.result?.min || 1;
        const resultMax = config.result?.max || 20;
        const result = this._randomInRange(resultMin, resultMax);
        const number = result * baseMultiplier;

        return {
            operand1: percent,
            operand2: number,
            operator: '% of',
            answer: result,
            visual: false,
            displayFormat: `${percent}% of ${number} = ?`
        };
    }

    /**
     * Generate a hint for a problem
     */
    generateHint(problem) {
        switch (problem.operator) {
            case '+':
                if (problem.visual) {
                    return `Count all the ${problem.visualType}! There are ${problem.operand1} and ${problem.operand2} more.`;
                }
                return `Try counting up from ${problem.operand1}. Add ${problem.operand2} more.`;

            case '-':
                if (problem.visual) {
                    return `Start with ${problem.operand1} ${problem.visualType}, then take away ${problem.operand2}.`;
                }
                return `Start at ${problem.operand1} and count back ${problem.operand2}.`;

            case '×':
                return `Think of it as ${problem.operand1} groups of ${problem.operand2}.`;

            case '÷':
                return `How many groups of ${problem.operand2} can you make from ${problem.operand1}?`;

            case '% of':
                if (problem.operand1 === 50) {
                    return `50% means half. What is half of ${problem.operand2}?`;
                } else if (problem.operand1 === 25) {
                    return `25% means a quarter. Split ${problem.operand2} into 4 equal parts.`;
                } else if (problem.operand1 === 10) {
                    return `10% is easy! Just move the decimal point one place left.`;
                }
                return `${problem.operand1}% means ${problem.operand1} out of 100.`;

            default:
                return 'Take your time and think carefully!';
        }
    }

    /**
     * Check if addition produces a carry
     */
    _hasCarry(a, b, operation) {
        const aStr = a.toString();
        const bStr = b.toString().padStart(aStr.length, '0');

        for (let i = aStr.length - 1; i >= 0; i--) {
            const aDigit = parseInt(aStr[i]) || 0;
            const bDigit = parseInt(bStr[i]) || 0;
            if (aDigit + bDigit >= 10) return true;
        }
        return false;
    }

    /**
     * Check if subtraction requires borrowing
     */
    _hasBorrow(a, b) {
        const aStr = a.toString();
        const bStr = b.toString().padStart(aStr.length, '0');

        for (let i = aStr.length - 1; i >= 0; i--) {
            const aDigit = parseInt(aStr[i]) || 0;
            const bDigit = parseInt(bStr[i]) || 0;
            if (aDigit < bDigit) return true;
        }
        return false;
    }

    /**
     * Random integer in range (inclusive)
     */
    _randomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}
