// Triangle Maze Data Model
// Each triangle can have walls represented by bit flags:
// 0 = no walls
// 1 = north wall (top edge)
// 2 = south west wall (bottom-left edge)
// 4 = south east wall (bottom-right edge)
// Combinations: 3 (N+SW), 5 (N+SE), 6 (SW+SE), 7 (all walls)

// Wall constants for readability
const WALLS = {
    NONE: 0,
    NORTH: 1,
    SOUTH_WEST: 2,
    SOUTH_EAST: 4,
    ALL: 7
};

// Helper functions
function hasWall(cell, wallType) {
    return (cell & wallType) !== 0;
}

function addWall(cell, wallType) {
    return cell | wallType;
}

function removeWall(cell, wallType) {
    return cell & ~wallType;
}

function toggleWall(cell, wallType) {
    return cell ^ wallType;
}

// Example maze - 2D array representing an offset triangular grid
// Each row is offset from the previous one to create the triangular pattern
// Rows represent horizontal levels, columns represent triangle positions
const maze = [
    [7, 5, 6, 3, 4],  // Row 0
    [1, 0, 2, 4, 7],  // Row 1
    [6, 3, 0, 1, 2],  // Row 2
    [4, 7, 5, 0, 6],  // Row 3
    [2, 1, 4, 3, 0]   // Row 4
];

// Maze dimensions
const MAZE_ROWS = maze.length;
const MAZE_COLS = maze[0].length;

// Get cell value at position (returns 0 if out of bounds)
function getCell(row, col) {
    if (row < 0 || row >= MAZE_ROWS || col < 0 || col >= MAZE_COLS) {
        return 0;
    }
    return maze[row][col];
}

// Set cell value at position
function setCell(row, col, value) {
    if (row >= 0 && row < MAZE_ROWS && col >= 0 && col < MAZE_COLS) {
        maze[row][col] = value;
    }
}

// Export for use in other modules
export {
    maze,
    WALLS,
    MAZE_ROWS,
    MAZE_COLS,
    hasWall,
    addWall,
    removeWall,
    toggleWall,
    getCell,
    setCell
};

