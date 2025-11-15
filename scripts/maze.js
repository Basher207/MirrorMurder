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
// Bit 0 (1): Edge 0 has wall (third edge)
// Bit 1 (2): Edge 1 has wall (left edge)
// Bit 2 (4): Edge 2 has wall (right edge)
// Generated from TriangularGrid map format: left|right|third
const mazeData = [
    [1, 0, 1, 0, 0, 0],  // Row 0
    [4, 2, 4, 0, 4, 3],  // Row 1
    [0, 1, 0, 0, 2, 0],  // Row 2
    [2, 0, 4, 0, 1, 0],  // Row 3
    [1, 0, 0, 2, 0, 4],  // Row 4
    [0, 3, 0, 0, 4, 0],  // Row 5
    [4, 0, 1, 0, 0, 2],  // Row 6
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
    const x = col * TRIANGLE_SIZE * 0.5 + TRIANGLE_SIZE / 2;  // Center horizontally
    const z = row * TRIANGLE_HEIGHT;
    
    // Offset for pointing-down triangles
    const offsetZ = isPointingUp(row, col) ? TRIANGLE_HEIGHT / 3 : TRIANGLE_HEIGHT * 2 / 3;
    
    return { x, z: z + offsetZ };
}

// Get the three vertices of a triangle in world space
function getTriangleVertices(row, col) {
    const x = col * TRIANGLE_SIZE * 0.5;
    const z = row * TRIANGLE_HEIGHT;
    const up = isPointingUp(row, col);
    
    if (up) {
        // Pointing UP triangle
        return [
            { x: x + TRIANGLE_SIZE/2, z: z },                    // Top apex (edge 0 opposite)
            { x: x, z: z + TRIANGLE_HEIGHT },                    // Bottom-left (edge 1 opposite)
            { x: x + TRIANGLE_SIZE, z: z + TRIANGLE_HEIGHT }     // Bottom-right (edge 2 opposite)
        ];
    } else {
        // Pointing DOWN triangle
        return [
            { x: x + TRIANGLE_SIZE/2, z: z + TRIANGLE_HEIGHT },  // Bottom apex (edge 0 opposite)
            { x: x, z: z },                                      // Top-left (edge 1 opposite)
            { x: x + TRIANGLE_SIZE, z: z }                       // Top-right (edge 2 opposite)
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
// Maze Validation
// ============================================================================

// Get the corresponding edge index on the neighbor triangle
// When you cross edge E from triangle A to triangle B, this returns which edge on B connects back to A
function getCorrespondingEdge(edgeIndex) {
    // Edge 0 always connects to edge 0 (vertical neighbor)
    // Edge 1 connects to edge 2 (diagonal neighbors)
    // Edge 2 connects to edge 1 (diagonal neighbors)
    if (edgeIndex === 0) return 0;
    if (edgeIndex === 1) return 2;
    if (edgeIndex === 2) return 1;
    return -1;
}

// Validate that walls are consistent on both sides
function validateMazeConsistency() {
    const errors = [];
    
    for (let row = 0; row < MAZE_ROWS; row++) {
        for (let col = 0; col < MAZE_COLS; col++) {
            const cellValue = getCell(row, col);
            
            // Check each edge
            for (let edge = 0; edge < 3; edge++) {
                const hasWallHere = hasWall(cellValue, edge);
                const neighbor = getNeighbor(row, col, edge);
                
                // Skip if neighbor is out of bounds
                if (!neighbor) continue;
                
                const { row: nRow, col: nCol } = neighbor;
                
                // Skip if neighbor is out of bounds in the data
                if (nRow < 0 || nRow >= MAZE_ROWS || nCol < 0 || nCol >= MAZE_COLS) {
                    continue;
                }
                
                const neighborValue = getCell(nRow, nCol);
                const correspondingEdge = getCorrespondingEdge(edge);
                const hasWallThere = hasWall(neighborValue, correspondingEdge);
                
                // Walls must match on both sides
                if (hasWallHere !== hasWallThere) {
                    errors.push({
                        cell: { row, col },
                        edge: edge,
                        hasWall: hasWallHere,
                        neighbor: { row: nRow, col: nCol },
                        neighborEdge: correspondingEdge,
                        neighborHasWall: hasWallThere
                    });
                }
            }
        }
    }
    
    return errors;
}

// Run validation and log results
function checkMazeData() {
    console.log("Validating maze data consistency...");
    const errors = validateMazeConsistency();
    
    if (errors.length === 0) {
        console.log("✓ Maze data is consistent - all walls match on both sides");
        return true;
    } else {
        console.error(`✗ Found ${errors.length} wall consistency error(s):`);
        errors.forEach((err, idx) => {
            console.error(`  ${idx + 1}. Cell (${err.cell.row},${err.cell.col}) edge ${err.edge} has wall: ${err.hasWall}`);
            console.error(`     But neighbor (${err.neighbor.row},${err.neighbor.col}) edge ${err.neighborEdge} has wall: ${err.neighborHasWall}`);
        });
        return false;
    }
}

// Fix maze data by ensuring walls are consistent on both sides
// Strategy: If either side has a wall, both sides get a wall (walls take precedence)
function fixMazeData() {
    const correctedData = mazeData.map(row => [...row]); // Deep copy
    
    for (let row = 0; row < MAZE_ROWS; row++) {
        for (let col = 0; col < MAZE_COLS; col++) {
            const cellValue = correctedData[row][col];
            
            // Check each edge
            for (let edge = 0; edge < 3; edge++) {
                const hasWallHere = hasWall(cellValue, edge);
                const neighbor = getNeighbor(row, col, edge);
                
                // Skip if neighbor is out of bounds
                if (!neighbor) continue;
                
                const { row: nRow, col: nCol } = neighbor;
                
                // Skip if neighbor is out of bounds in the data
                if (nRow < 0 || nRow >= MAZE_ROWS || nCol < 0 || nCol >= MAZE_COLS) {
                    continue;
                }
                
                const neighborValue = correctedData[nRow][nCol];
                const correspondingEdge = getCorrespondingEdge(edge);
                const hasWallThere = hasWall(neighborValue, correspondingEdge);
                
                // If either side has a wall, both should have it
                if (hasWallHere || hasWallThere) {
                    // Add wall to current cell
                    correctedData[row][col] |= (1 << edge);
                    // Add wall to neighbor
                    correctedData[nRow][nCol] |= (1 << correspondingEdge);
                }
            }
        }
    }
    
    return correctedData;
}

// Print corrected maze data as a copyable JavaScript string
function printCorrectedMazeData() {
    const corrected = fixMazeData();
    
    console.log("\n=== CORRECTED MAZE DATA ===");
    console.log("Copy and paste this into maze.js:\n");
    
    let output = "const mazeData = [\n";
    for (let row = 0; row < corrected.length; row++) {
        const rowData = corrected[row].map(val => val.toString()).join(", ");
        output += `    [${rowData}]`;
        if (row < corrected.length - 1) {
            output += ",";
        }
        output += `  // Row ${row}\n`;
    }
    output += "];";
    
    console.log(output);
    console.log("\n===========================\n");
    
    return corrected;
}

// Validate on module load
const isValid = checkMazeData();
if (!isValid) {
    console.log("\n⚠️  Maze has inconsistencies. Generating corrected version...\n");
    printCorrectedMazeData();
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
    cellToUV,
    
    // Validation
    validateMazeConsistency,
    checkMazeData,
    fixMazeData,
    printCorrectedMazeData
};

