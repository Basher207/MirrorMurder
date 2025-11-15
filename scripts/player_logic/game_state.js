import { TriangularGrid } from '../grid_system.js';
import { Character } from './character.js';

class GameState {
    constructor() {
        this.grid = null;
        this.turnCounter = 0;
        this.player = new Character('player');
        this.enemy = new Character('enemy');
    }

    /**
     * Initialize the grid
     * @param {TriangularGrid} grid - The triangular grid instance
     */
    setGrid(grid) {
        this.grid = grid;
        
        // Set initial positions
        // Player at (0, 0)
        this.player.setPosition(0, 0, 'left');
        
        // Enemy at max row and max col
        const maxRow = this.grid.getRowCount() - 1;
        const maxCol = this.grid.getRowLength(maxRow) - 1;
        this.enemy.setPosition(maxRow, maxCol, 'right');
    }

    initializeGrid(numRows, trianglesPerRow) {
        this.grid = new TriangularGrid();
        this.grid.initialize(numRows, trianglesPerRow);
        
        // Set initial positions after grid creation
        this.player.setPosition(0, 0, 'left');
        
        const maxRow = this.grid.getRowCount() - 1;
        const maxCol = this.grid.getRowLength(maxRow) - 1;
        this.enemy.setPosition(maxRow, maxCol, 'right');
    }

    /**
     * Set the player's position and orientation
     * @param {number} row - Row coordinate
     * @param {number} col - Column coordinate
     * @param {string} orientation - 'left', 'right', or 'third'
     */
    setPlayerPosition(row, col, orientation) {
        this.player.setPosition(row, col, orientation);
    }

    /**
     * Set the enemy's position and orientation
     * @param {number} row - Row coordinate
     * @param {number} col - Column coordinate
     * @param {string} orientation - 'left', 'right', or 'third'
     */
    setEnemyPosition(row, col, orientation) {
        this.enemy.setPosition(row, col, orientation);
    }

    incrementTurn() {
        this.turnCounter++;
    }

    getCurrentTurn() {
        return this.turnCounter;
    }

    getPlayer() {
        return this.player;
    }

    getEnemy() {
        return this.enemy;
    }

    getGrid() {
        return this.grid;
    }
}

const gameState = new GameState();
export default gameState;