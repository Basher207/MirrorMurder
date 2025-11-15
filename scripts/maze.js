// Triangle Maze Data Model - Optimized for Raycast Shader
// 
// Structure: Regular grid where each cell contains a triangle
// - Triangles alternate orientation: (row + col) % 2 === 0 means pointing UP
// - Each triangle has 3 edges (numbered 0, 1, 2)
// - Edge indices are consistent with triangle orientation for easy shader logic

// Triangle size constants (world space units)
const TRIANGLE_SIZE = 2.0;
const TRIANGLE_HEIGHT = Math.sqrt(3) * TRIANGLE_SIZE / 2;

// Edge indices for walls (relative to triangle orientation)
const EDGE = {
    EDGE_0: 0,  // For UP: top edge,    For DOWN: bottom edge
    EDGE_1: 1,  // For UP: bottom-left, For DOWN: top-left
    EDGE_2: 2   // For UP: bottom-right, For DOWN: top-right
};

// Maze data: 2D array where each value is a bitmask of walls
// Bit 0 (1): Edge 0 has wall
// Bit 1 (2): Edge 1 has wall
// Bit 2 (4): Edge 2 has wall
const mazeData = [
    [7, 5, 6, 3, 4],  // Row 0
    [1, 0, 2, 4, 7],  // Row 1
    [6, 3, 0, 1, 2],  // Row 2
    [4, 7, 5, 0, 6],  // Row 3
    [2, 1, 4, 3, 0]   // Row 4
];

const MAZE_ROWS = mazeData.length;
const MAZE_COLS = mazeData[0].length;

// ============================================================================
// Helper Functions
// ============================================================================

function isPointingUp(row, col) {
    return (row + col) % 2 === 0;
}

function hasWall(cellValue, edgeIndex) {
    return (cellValue & (1 << edgeIndex)) !== 0;
}

function getCell(row, col) {
    if (row < 0 || row >= MAZE_ROWS || col < 0 || col >= MAZE_COLS) {
        return 7; // Out of bounds = all walls
    }
    return mazeData[row][col];
}

// Get the world-space center position of a triangle
function getTriangleCenter(row, col) {
    const x = col * TRIANGLE_SIZE;
    const z = row * TRIANGLE_HEIGHT;
    
    // Offset for pointing-down triangles
    const offsetZ = isPointingUp(row, col) ? 0 : TRIANGLE_HEIGHT / 3;
    
    return { x, z: z + offsetZ };
}

// Get the three vertices of a triangle in world space
function getTriangleVertices(row, col) {
    const x = col * TRIANGLE_SIZE;
    const z = row * TRIANGLE_HEIGHT;
    const up = isPointingUp(row, col);
    
    if (up) {
        // Pointing UP triangle
        return [
            { x: x, z: z },                           // Top vertex (edge 0 opposite)
            { x: x - TRIANGLE_SIZE/2, z: z + TRIANGLE_HEIGHT }, // Bottom-left (edge 1 opposite)
            { x: x + TRIANGLE_SIZE/2, z: z + TRIANGLE_HEIGHT }  // Bottom-right (edge 2 opposite)
        ];
    } else {
        // Pointing DOWN triangle
        return [
            { x: x, z: z + TRIANGLE_HEIGHT },         // Bottom vertex (edge 0 opposite)
            { x: x - TRIANGLE_SIZE/2, z: z },         // Top-left (edge 1 opposite)
            { x: x + TRIANGLE_SIZE/2, z: z }          // Top-right (edge 2 opposite)
        ];
    }
}

// Get the two endpoints of a specific edge
function getEdgeVertices(row, col, edgeIndex) {
    const vertices = getTriangleVertices(row, col);
    // Edge N connects vertex (N+1) to vertex (N+2), wrapping around
    const v1 = vertices[(edgeIndex + 1) % 3];
    const v2 = vertices[(edgeIndex + 2) % 3];
    return [v1, v2];
}

// Get neighbor triangle across a specific edge (returns {row, col} or null if out of bounds)
function getNeighbor(row, col, edgeIndex) {
    const up = isPointingUp(row, col);
    
    if (up) {
        // Pointing UP triangle neighbors
        if (edgeIndex === 0) return { row: row - 1, col: col }; // North
        if (edgeIndex === 1) return { row: row, col: col - 1 }; // Southwest  
        if (edgeIndex === 2) return { row: row, col: col + 1 }; // Southeast
    } else {
        // Pointing DOWN triangle neighbors
        if (edgeIndex === 0) return { row: row + 1, col: col }; // South
        if (edgeIndex === 1) return { row: row, col: col - 1 }; // Northwest
        if (edgeIndex === 2) return { row: row, col: col + 1 }; // Northeast
    }
    
    return null;
}

// ============================================================================
// Shader-Friendly Data Encoding
// ============================================================================

// Encode maze data into a flat array suitable for a texture
// Each triangle gets 4 float values (RGBA):
// R: orientation (0 = down, 1 = up)
// G: wall bitmask (0-7)
// B: reserved for future use (material ID, lighting, etc.)
// A: reserved for future use
function encodeToTexture() {
    const data = new Float32Array(MAZE_ROWS * MAZE_COLS * 4);
    
    for (let row = 0; row < MAZE_ROWS; row++) {
        for (let col = 0; col < MAZE_COLS; col++) {
            const idx = (row * MAZE_COLS + col) * 4;
            const up = isPointingUp(row, col);
            const walls = getCell(row, col);
            
            data[idx + 0] = up ? 1.0 : 0.0;        // R: orientation
            data[idx + 1] = walls / 7.0;           // G: walls normalized to 0-1
            data[idx + 2] = 0.0;                   // B: reserved
            data[idx + 3] = 1.0;                   // A: reserved
        }
    }
    
    return {
        data: data,
        width: MAZE_COLS,
        height: MAZE_ROWS
    };
}

// Convert row,col to texture UV coordinates
function cellToUV(row, col) {
    return {
        u: (col + 0.5) / MAZE_COLS,
        v: (row + 0.5) / MAZE_ROWS
    };
}

// ============================================================================
// Exports
// ============================================================================

export {
    // Constants
    TRIANGLE_SIZE,
    TRIANGLE_HEIGHT,
    MAZE_ROWS,
    MAZE_COLS,
    EDGE,
    
    // Raw data
    mazeData,
    
    // Query functions
    getCell,
    hasWall,
    isPointingUp,
    getTriangleCenter,
    getTriangleVertices,
    getEdgeVertices,
    getNeighbor,
    
    // Shader encoding
    encodeToTexture,
    cellToUV
};

