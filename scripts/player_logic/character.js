/**
 * Enum for character orientations (matches Triangle neighbor sides)
 */
const Orientation = Object.freeze({
    LEFT: 'left',
    RIGHT: 'right',
    THIRD: 'third'
});

/**
 * Enum for movement directions
 */
const MovementDirection = Object.freeze({
    FORWARD_LEFT: 'forward_left',
    FORWARD_RIGHT: 'forward_right'
});

/**
 * Represents a character in the game (player or enemy)
 */
class Character {
    constructor(type = 'player') {
        this.row = 0;                    // Current row coordinate
        this.col = 0;                    // Current column coordinate
        this.orientation = Orientation.LEFT; // Current facing direction
        this.state = null;               // Character state (e.g., 'alive', 'dead', 'stunned')
        this.type = type;                // Character type identifier
    }

    /**
     * Set the character's position and orientation
     * @param {number} row - Row coordinate
     * @param {number} col - Column coordinate
     * @param {string} orientation - 'left', 'right', or 'third'
     */
    setPosition(row, col, orientation = null) {
        this.row = row;
        this.col = col;
        if (orientation !== null) {
            this.setOrientation(orientation);
        }
    }

    /**
     * Set the character's orientation
     * @param {string} orientation - 'left', 'right', or 'third'
     */
    setOrientation(orientation) {
        if (Object.values(Orientation).includes(orientation)) {
            this.orientation = orientation;
        } else {
            console.warn(`Invalid orientation: ${orientation}`);
        }
    }

    /**
     * Get the character's current position
     * @returns {Object} Object with row, col, and orientation properties
     */
    getPosition() {
        return {
            row: this.row,
            col: this.col,
            orientation: this.orientation
        };
    }

    /**
     * Get the character's current orientation
     * @returns {string} The current orientation
     */
    getOrientation() {
        return this.orientation;
    }

    /**
     * Set the character's state
     * @param {string} state - The state to set
     */
    setState(state) {
        this.state = state;
    }

    /**
     * Get the character's current state
     * @returns {string} The current state
     */
    getState() {
        return this.state;
    }

    /**
     * Get the character's type
     * @returns {string} The character type
     */
    getType() {
        return this.type;
    }

    /**
     * Rotate the character clockwise (relative to triangle sides)
     * For up-pointing triangles: left -> right -> third -> left
     * For down-pointing triangles: left -> third -> right -> left
     * @param {boolean} pointsUp - Whether the current triangle points up
     */
    rotateClockwise(pointsUp) {
        if (pointsUp) {
            // Up-pointing triangle: left -> right -> third -> left
            const rotationMap = {
                [Orientation.LEFT]: Orientation.RIGHT,
                [Orientation.RIGHT]: Orientation.THIRD,
                [Orientation.THIRD]: Orientation.LEFT
            };
            this.orientation = rotationMap[this.orientation];
        } else {
            // Down-pointing triangle: left -> third -> right -> left
            const rotationMap = {
                [Orientation.LEFT]: Orientation.THIRD,
                [Orientation.THIRD]: Orientation.RIGHT,
                [Orientation.RIGHT]: Orientation.LEFT
            };
            this.orientation = rotationMap[this.orientation];
        }
    }

    /**
     * Rotate the character counter-clockwise
     * For up-pointing triangles: left -> third -> right -> left
     * For down-pointing triangles: left -> right -> third -> left
     * @param {boolean} pointsUp - Whether the current triangle points up
     */
    rotateCounterClockwise(pointsUp) {
        if (pointsUp) {
            // Up-pointing triangle: left -> third -> right -> left
            const rotationMap = {
                [Orientation.LEFT]: Orientation.THIRD,
                [Orientation.THIRD]: Orientation.RIGHT,
                [Orientation.RIGHT]: Orientation.LEFT
            };
            this.orientation = rotationMap[this.orientation];
        } else {
            // Down-pointing triangle: left -> right -> third -> left
            const rotationMap = {
                [Orientation.LEFT]: Orientation.RIGHT,
                [Orientation.RIGHT]: Orientation.THIRD,
                [Orientation.THIRD]: Orientation.LEFT
            };
            this.orientation = rotationMap[this.orientation];
        }
    }

    /**
     * Attempt to move the character forward through the side they're facing
     * Direction determines the new orientation in the target triangle
     * @param {TriangularGrid} grid - The grid to move on
     * @param {string} direction - MovementDirection.FORWARD_LEFT or MovementDirection.FORWARD_RIGHT
     * @returns {Object} Object with success (boolean), newRow, newCol, newOrientation
     */
    move(grid, direction) {
        const currentTriangle = grid.getTriangle(this.row, this.col);
        
        if (!currentTriangle) {
            return {
                success: false,
                row: this.row,
                col: this.col,
                orientation: this.orientation
            };
        }

        // Always move through the side we're currently facing
        const sideToCheck = this.orientation;

        // Check if the side is blocked
        const sideState = currentTriangle.getSideState(sideToCheck);
        if (sideState !== 'empty') {
            // Movement blocked
            return {
                success: false,
                row: this.row,
                col: this.col,
                orientation: this.orientation
            };
        }

        // Check if neighbor exists
        const neighbor = currentTriangle.neighbors[sideToCheck];
        if (!neighbor) {
            // Edge of map
            return {
                success: false,
                row: this.row,
                col: this.col,
                orientation: this.orientation
            };
        }

        // Calculate new orientation based on direction
        // We need to find which side we entered from, then rotate based on direction
        const enteredFromSide = currentTriangle.getNeighborCorrespondingSide(sideToCheck);
        
        let newOrientation;
        if (direction === MovementDirection.FORWARD_RIGHT) {
            // Turn left: rotate counter-clockwise from the entered side
            const rotationMap = neighbor.pointsUp ? {
                [Orientation.LEFT]: Orientation.THIRD,
                [Orientation.THIRD]: Orientation.RIGHT,
                [Orientation.RIGHT]: Orientation.LEFT
            } : {
                [Orientation.LEFT]: Orientation.RIGHT,
                [Orientation.RIGHT]: Orientation.THIRD,
                [Orientation.THIRD]: Orientation.LEFT
            };
            newOrientation = rotationMap[enteredFromSide];
        } else if (direction === MovementDirection.FORWARD_LEFT) {
            // Turn right: rotate clockwise from the entered side
            const rotationMap = neighbor.pointsUp ? {
                [Orientation.LEFT]: Orientation.RIGHT,
                [Orientation.RIGHT]: Orientation.THIRD,
                [Orientation.THIRD]: Orientation.LEFT
            } : {
                [Orientation.LEFT]: Orientation.THIRD,
                [Orientation.THIRD]: Orientation.RIGHT,
                [Orientation.RIGHT]: Orientation.LEFT
            };
            newOrientation = rotationMap[enteredFromSide];
        } else {
            console.warn(`Invalid movement direction: ${direction}`);
            return {
                success: false,
                row: this.row,
                col: this.col,
                orientation: this.orientation
            };
        }

        // Movement successful
        const newPosition = {
            success: true,
            row: neighbor.row,
            col: neighbor.col,
            orientation: newOrientation
        };

        // Update character position
        this.row = newPosition.row;
        this.col = newPosition.col;
        this.orientation = newPosition.orientation;

        return newPosition;
    }

    /**
     * Check if movement is possible without actually moving
     * @param {TriangularGrid} grid - The grid to check
     * @returns {boolean} True if movement is possible
     */
    canMove(grid) {
        const currentTriangle = grid.getTriangle(this.row, this.col);
        
        if (!currentTriangle) {
            return false;
        }

        // Check the side we're facing
        const sideToCheck = this.orientation;

        // Check if side is empty
        const sideState = currentTriangle.getSideState(sideToCheck);
        if (sideState !== 'empty') {
            return false;
        }

        // Check if neighbor exists
        const neighbor = currentTriangle.neighbors[sideToCheck];
        return neighbor !== null;
    }
}

export { Character, Orientation, MovementDirection };