/**
 * Enum for triangle side types
 */
const SideType = Object.freeze({
    EMPTY: 'empty',
    MIRROR: 'mirror'
});

/**
 * Represents a single triangle in the grid
 */
class Triangle {
    constructor(row, col, pointsUp) {
        this.row = row;           // Row index
        this.col = col;           // Column index within the row
        this.pointsUp = pointsUp; // true if triangle points up, false if points down
        this.state = null;        // Can store game state (empty, player, enemy, etc.)
        this.neighbors = {        // Adjacent triangles with their relationship
            left: null,
            right: null,
            third: null
        };
        
        // Each side can have its own state (e.g., wall, mirror, door, etc.)
        // For up-pointing triangles: left, right, bottom
        // For down-pointing triangles: left, right, top
        this.sides = {
            left: SideType.EMPTY,
            right: SideType.EMPTY,
            third: SideType.EMPTY  // bottom for up-pointing, top for down-pointing
        };
    }

    /**
     * Set the state of this triangle
     */
    setState(state) {
        this.state = state;
    }

    /**
     * Set the state of a specific side and update the neighbor's corresponding side
     * @param {string} side - 'left', 'right', or 'third'
     * @param {string} state - The state to set (use SideType enum)
     * @param {boolean} updateNeighbor - Whether to update the neighbor's side (default: true)
     */
    setSideState(side, state, updateNeighbor = true) {
        if (this.sides.hasOwnProperty(side)) {
            this.sides[side] = state;

            // Update the neighbor's corresponding side
            if (updateNeighbor && this.neighbors[side]) {
                const neighborSide = this.getNeighborCorrespondingSide(side);
                // Pass false to prevent infinite recursion
                this.neighbors[side].setSideState(neighborSide, state, false);
            }
        }
    }

    /**
     * Get the corresponding side on the neighbor
     * @param {string} side - 'left', 'right', or 'third'
     * @returns {string} The corresponding side on the neighbor
     */
    getNeighborCorrespondingSide(side) {
        // Left neighbor's right side corresponds to our left side
        if (side === 'left') return 'right';
        // Right neighbor's left side corresponds to our right side
        if (side === 'right') return 'left';
        // Third side neighbor's third side corresponds to our third side
        if (side === 'third') return 'third';
        return null;
    }

    /**
     * Get the state of a specific side
     * @param {string} side - 'left', 'right', or 'third'
     */
    getSideState(side) {
        return this.sides[side];
    }

    /**
     * Set states for all sides at once
     * @param {Object} sideStates - Object with left, right, third properties
     * @param {boolean} updateNeighbors - Whether to update neighbors (default: true)
     */
    setAllSides(sideStates, updateNeighbors = true) {
        if (sideStates.left !== undefined) {
            this.setSideState('left', sideStates.left, updateNeighbors);
        }
        if (sideStates.right !== undefined) {
            this.setSideState('right', sideStates.right, updateNeighbors);
        }
        if (sideStates.third !== undefined) {
            this.setSideState('third', sideStates.third, updateNeighbors);
        }
    }

    /**
     * Get all side states
     */
    getAllSides() {
        return { ...this.sides };
    }

    /**
     * Get the name of the third side based on orientation
     */
    getThirdSideName() {
        return this.pointsUp ? 'bottom' : 'top';
    }

    /**
     * Add a neighboring triangle
     * @param {Triangle} triangle - The neighboring triangle
     * @param {string} side - Which side this neighbor is on ('left', 'right', 'third')
     */
    addNeighbor(triangle, side) {
        this.neighbors[side] = triangle;
    }

    /**
     * Check if a specific side has a certain state
     * @param {string} side - The side to check
     * @param {string} state - The state to compare (use SideType enum)
     */
    hasSideState(side, state) {
        return this.sides[side] === state;
    }

    /**
     * Clear all side states (set to EMPTY)
     * @param {boolean} updateNeighbors - Whether to update neighbors (default: true)
     */
    clearSides(updateNeighbors = true) {
        this.setSideState('left', SideType.EMPTY, updateNeighbors);
        this.setSideState('right', SideType.EMPTY, updateNeighbors);
        this.setSideState('third', SideType.EMPTY, updateNeighbors);
    }
}

/**
 * Represents the entire triangular grid system
 */
class TriangularGrid {
    constructor() {
        this.rows = [];           // Array of rows, each containing triangles
        this.triangles = new Map(); // Map of "row,col" -> Triangle for quick lookup
        this.numRows = 0;        // Number of rows in the grid
    }

    /**
     * Initialize the grid with specified number of rows
     * @param {number} numRows - Number of rows in the grid
     * @param {number} trianglesPerRow - Base number of triangles per row
     */
    initialize(numRows, trianglesPerRow) {
        this.rows = [];
        this.triangles.clear();
        this.numRows = numRows;

        for (let row = 0; row < numRows; row++) {
            const rowTriangles = [];
            
            // Rows alternate starting orientation
            // Even rows (0, 2, 4...) start with up-pointing triangles
            // Odd rows (1, 3, 5...) start with down-pointing triangles
            const rowStartsUp = row % 2 === 0;
            
            for (let col = 0; col < trianglesPerRow; col++) {
                // If row starts up: even columns point up, odd columns point down
                // If row starts down: even columns point down, odd columns point up
                const pointsUp = rowStartsUp ? (col % 2 === 0) : (col % 2 !== 0);
                const triangle = new Triangle(row, col, pointsUp);
                
                rowTriangles.push(triangle);
                this.triangles.set(`${row},${col}`, triangle);
            }
            
            this.rows.push(rowTriangles);
        }

        // Set up neighbors after all triangles are created
        this.setupNeighbors();
    }

    /**
     * Initialize the grid from a map string
     * 
     * Map format:
     * - Each row is separated by newline
     * - Each triangle is separated by space
     * - Each triangle is represented as: L|R|T (Left|Right|Third side)
     * - Side values: 'e' = empty, 'm' = mirror
     * 
     * Example:
     * "e|e|e e|m|e e|e|m
     *  m|e|e e|e|e e|m|e
     *  e|e|m e|e|e e|e|e"
     * 
     * @param {string} mapString - The map definition string
     */
    initializeFromMap(mapString) {
        this.rows = [];
        this.triangles.clear();

        const lines = mapString.trim().split('\n');
        this.numRows = lines.length;

        const sideCharMap = {
            'e': SideType.EMPTY,
            'm': SideType.MIRROR
        };

        // First pass: Create all triangles and set their side states
        for (let row = 0; row < lines.length; row++) {
            const line = lines[row].trim();
            const triangleDefinitions = line.split(/\s+/);
            const rowTriangles = [];

            // Rows alternate starting orientation
            const rowStartsUp = row % 2 === 0;

            for (let col = 0; col < triangleDefinitions.length; col++) {
                const def = triangleDefinitions[col];
                const sides = def.split('|');

                if (sides.length !== 3) {
                    throw new Error(`Invalid triangle definition at row ${row}, col ${col}: "${def}". Expected format: "L|R|T"`);
                }

                // Determine orientation based on row and column
                const pointsUp = rowStartsUp ? (col % 2 === 0) : (col % 2 !== 0);
                const triangle = new Triangle(row, col, pointsUp);

                // Set side states without updating neighbors (they don't exist yet)
                triangle.setSideState('left', sideCharMap[sides[0]] || SideType.EMPTY, false);
                triangle.setSideState('right', sideCharMap[sides[1]] || SideType.EMPTY, false);
                triangle.setSideState('third', sideCharMap[sides[2]] || SideType.EMPTY, false);

                rowTriangles.push(triangle);
                this.triangles.set(`${row},${col}`, triangle);
            }

            this.rows.push(rowTriangles);
        }

        // Set up neighbors after all triangles are created
        this.setupNeighbors();

        // Second pass: Synchronize all neighbor side states
        // Priority: non-empty states override empty states
        for (let row = 0; row < this.rows.length; row++) {
            for (let col = 0; col < this.rows[row].length; col++) {
                const triangle = this.getTriangle(row, col);

                // Update neighbors' corresponding sides
                ['left', 'right', 'third'].forEach(side => {
                    if (triangle.neighbors[side]) {
                        const neighborSide = triangle.getNeighborCorrespondingSide(side);
                        const currentState = triangle.getSideState(side);
                        const neighborState = triangle.neighbors[side].getSideState(neighborSide);

                        // Determine which state should be used (prefer non-empty)
                        let finalState;
                        if (currentState !== SideType.EMPTY && neighborState === SideType.EMPTY) {
                            // Current side has a non-empty state, neighbor is empty
                            finalState = currentState;
                        } else if (currentState === SideType.EMPTY && neighborState !== SideType.EMPTY) {
                            // Neighbor has a non-empty state, current is empty
                            finalState = neighborState;
                        } else {
                            // Both empty or both non-empty, use current state
                            finalState = currentState;
                        }

                        // Update both sides to the final state
                        triangle.setSideState(side, finalState, false);
                        triangle.neighbors[side].setSideState(neighborSide, finalState, false);
                    }
                });
            }
        }
    }

    /**
     * Export the current grid to a map string format
     * @returns {string} The map string representation
     */
    exportToMap() {
        const sideTypeMap = {
            [SideType.EMPTY]: 'e',
            [SideType.MIRROR]: 'm'
        };

        const lines = [];

        for (let row = 0; row < this.rows.length; row++) {
            const triangleStrings = [];

            for (let col = 0; col < this.rows[row].length; col++) {
                const triangle = this.getTriangle(row, col);
                const left = sideTypeMap[triangle.getSideState('left')] || 'e';
                const right = sideTypeMap[triangle.getSideState('right')] || 'e';
                const third = sideTypeMap[triangle.getSideState('third')] || 'e';

                triangleStrings.push(`${left}|${right}|${third}`);
            }

            lines.push(triangleStrings.join(' '));
        }

        return lines.join('\n');
    }

    /**
     * Set up neighbor relationships between triangles
     */
    setupNeighbors() {
        for (let row = 0; row < this.rows.length; row++) {
            for (let col = 0; col < this.rows[row].length; col++) {
                const triangle = this.getTriangle(row, col);
                
                // Horizontal neighbors (left and right)
                if (col > 0) {
                    const leftNeighbor = this.getTriangle(row, col - 1);
                    triangle.addNeighbor(leftNeighbor, 'left');
                }
                if (col < this.rows[row].length - 1) {
                    const rightNeighbor = this.getTriangle(row, col + 1);
                    triangle.addNeighbor(rightNeighbor, 'right');
                }

                // Vertical neighbors depend on triangle orientation
                if (triangle.pointsUp) {
                    // Up-pointing triangle connects to row below
                    if (row < this.rows.length - 1 && col < this.rows[row + 1].length) {
                        const thirdNeighbor = this.getTriangle(row + 1, col);
                        triangle.addNeighbor(thirdNeighbor, 'third');
                    }
                } else {
                    // Down-pointing triangle connects to row above
                    if (row > 0 && col < this.rows[row - 1].length) {
                        const thirdNeighbor = this.getTriangle(row - 1, col);
                        triangle.addNeighbor(thirdNeighbor, 'third');
                    }
                }
            }
        }
    }

    /**
     * Get a triangle at specific row and column
     */
    getTriangle(row, col) {
        return this.triangles.get(`${row},${col}`);
    }

    /**
     * Get all triangles in a specific row
     */
    getRow(rowIndex) {
        return this.rows[rowIndex] || [];
    }

    /**
     * Get the total number of rows
     */
    getRowCount() {
        return this.rows.length;
    }

    /**
     * Get the maximum number of columns across all rows
     */
    getColCount() {
        if (this.rows.length === 0) return 0;
        return Math.max(...this.rows.map(row => row.length));
    }

    /**
     * Get the number of triangles in a specific row
     */
    getRowLength(rowIndex) {
        return this.rows[rowIndex]?.length || 0;
    }
    
    /**
     * Convert the grid to maze.js bitmask format
     * Returns a 2D array where each cell is a bitmask of walls:
     * Bit 0 (1): third edge has mirror
     * Bit 1 (2): right edge has mirror
     * Bit 2 (4): left edge has mirror
     * @returns {Array<Array<number>>} 2D array of wall bitmasks
     */
    toMazeBitmask() {
        const bitmaskData = [];
        
        console.log('🔄 Converting TriangularGrid to maze bitmask format...');
        
        for (let row = 0; row < this.rows.length; row++) {
            const rowBitmasks = [];
            
            for (let col = 0; col < this.rows[row].length; col++) {
                const triangle = this.getTriangle(row, col);
                let bitmask = 0;
                
                // Map grid sides to maze.js edge bits
                // Grid format: left|right|third sides with 'empty' or 'mirror'
                // Maze format (as used by the raycast shader):
                //   edge 0 = "third" side
                //   edge 1 = right side
                //   edge 2 = left side
                // So we map:
                //   third -> bit 0 (1)
                //   right -> bit 1 (2)
                //   left  -> bit 2 (4)
                
                if (triangle.getSideState('third') === SideType.MIRROR) {
                    bitmask |= 1;  // Bit 0
                }
                if (triangle.getSideState('left') === SideType.MIRROR) {
                    bitmask |= 4;  // Bit 2
                }
                if (triangle.getSideState('right') === SideType.MIRROR) {
                    bitmask |= 2;  // Bit 1
                }
                
                rowBitmasks.push(bitmask);
            }
            
            bitmaskData.push(rowBitmasks);
        }
        
        console.log('   └─ Converted to', bitmaskData.length, 'rows x', bitmaskData[0]?.length, 'cols');
        console.log('   └─ Full bitmask data:');
        bitmaskData.forEach((row, index) => {
            console.log(`      Row ${index}:`, row);
        });
        
        return bitmaskData;
    }

    /**
     * Generate a random connected grid with exactly one boundary exit
     * and an approximate mirror density.
     *
     * Guarantees:
     * - All triangles are mutually reachable (no unreachable areas)
     * - Exactly one boundary edge is open (the exit)
     * - Mirror density is clamped to the feasible range given the above constraints
     *
     * @param {number} numRows
     * @param {number} trianglesPerRow
     * @param {number} mirrorDensity - desired fraction of edges that are mirrors (0..1)
     * @param {number|string|null} rngSeed - optional seed for deterministic generation
     */
    generateRandomGrid(numRows, trianglesPerRow, mirrorDensity = 0.65, rngSeed = null) {
        // Build grid topology first
        this.initialize(numRows, trianglesPerRow);

        const trianglesCount = numRows * trianglesPerRow;
        const sideNames = ['left', 'right', 'third'];

        // Seeded RNG (Mulberry32). Falls back to Math.random when no seed provided.
        const rng = (() => {
            if (rngSeed === null || rngSeed === undefined) return Math.random;

            let seedNum;
            if (typeof rngSeed === 'number') {
                seedNum = (rngSeed >>> 0);
            } else {
                const s = String(rngSeed);
                let h = 2166136261 >>> 0; // FNV-1a like hash
                for (let i = 0; i < s.length; i++) {
                    h ^= s.charCodeAt(i);
                    h = Math.imul(h, 16777619);
                }
                seedNum = h >>> 0;
            }
            function mulberry32(a) {
                return function() {
                    let t = a += 0x6D2B79F5;
                    t = Math.imul(t ^ (t >>> 15), t | 1);
                    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
                    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
                };
            }
            return mulberry32(seedNum);
        })();

        const pickRandom = (arr) => arr[Math.floor(rng() * arr.length)];
        const shuffle = (arr) => {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                const tmp = arr[i];
                arr[i] = arr[j];
                arr[j] = tmp;
            }
            return arr;
        };

        // Start with all sides set to MIRROR
        for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < trianglesPerRow; c++) {
                const t = this.getTriangle(r, c);
                t.setAllSides({
                    left: SideType.MIRROR,
                    right: SideType.MIRROR,
                    third: SideType.MIRROR
                }, true);
            }
        }

        // Collect unique edges and a map for quick lookup by triangle pair
        const internalEdges = [];
        const boundaryEdges = [];
        const edgeByPair = new Map(); // key: "r1,c1|r2,c2" (both orders) -> edge

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < trianglesPerRow; col++) {
                const tri = this.getTriangle(row, col);
                const triKey = `${row},${col}`;

                sideNames.forEach(side => {
                    const neighbor = tri.neighbors[side];
                    if (neighbor) {
                        const neighborKey = `${neighbor.row},${neighbor.col}`;
                        const neighborSide = tri.getNeighborCorrespondingSide(side);
                        // Canonicalize so each internal edge appears once
                        if (triKey < neighborKey) {
                            const edge = {
                                a: tri,
                                aSide: side,
                                b: neighbor,
                                bSide: neighborSide,
                                isBoundary: false
                            };
                            internalEdges.push(edge);
                            edgeByPair.set(`${triKey}|${neighborKey}`, edge);
                            edgeByPair.set(`${neighborKey}|${triKey}`, edge);
                        }
                    } else {
                        boundaryEdges.push({
                            a: tri,
                            aSide: side,
                            isBoundary: true
                        });
                    }
                });
            }
        }

        const totalEdges = internalEdges.length + boundaryEdges.length;
        const minOpenEdges = trianglesCount;              // (N-1) internal for connectivity + 1 boundary exit
        const maxOpenEdges = internalEdges.length + 1;    // all internal open + exactly one boundary exit
        const maxDensity = (totalEdges - minOpenEdges) / totalEdges;
        const minDensity = (totalEdges - maxOpenEdges) / totalEdges;

        let desiredDensity = Number.isFinite(mirrorDensity) ? Math.max(0, Math.min(1, mirrorDensity)) : 0.65;
        if (desiredDensity > maxDensity) {
            console.warn(`[TriangularGrid] mirrorDensity ${desiredDensity.toFixed(3)} > max feasible ${maxDensity.toFixed(3)}; clamping.`);
            desiredDensity = maxDensity;
        }
        if (desiredDensity < minDensity) {
            console.warn(`[TriangularGrid] mirrorDensity ${desiredDensity.toFixed(3)} < min feasible ${minDensity.toFixed(3)} (one exit constraint); clamping.`);
            desiredDensity = minDensity;
        }

        // Helper to open an edge (updates both triangles for internal edges)
        const openEdge = (edge) => {
            edge.a.setSideState(edge.aSide, SideType.EMPTY, true);
        };

        // Randomized DFS to carve a spanning tree (ensures connectivity, no unreachable areas)
        const startRow = Math.floor(numRows / 2);
        const startCol = Math.floor(trianglesPerRow / 2);
        const start = this.getTriangle(startRow, startCol);
        const visited = new Set([`${start.row},${start.col}`]);
        const stack = [start];

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const curKey = `${current.row},${current.col}`;

            const candidates = [];
            sideNames.forEach(side => {
                const nb = current.neighbors[side];
                if (!nb) return;
                const nbKey = `${nb.row},${nb.col}`;
                if (!visited.has(nbKey)) {
                    const e = edgeByPair.get(`${curKey}|${nbKey}`);
                    if (e) candidates.push({ nb, edge: e });
                }
            });

            if (candidates.length === 0) {
                stack.pop();
                continue;
            }

            const choice = pickRandom(candidates);
            openEdge(choice.edge);
            visited.add(`${choice.nb.row},${choice.nb.col}`);
            stack.push(choice.nb);
        }

        // Exactly one boundary exit
        const exitEdge = pickRandom(boundaryEdges);
        exitEdge.a.setSideState(exitEdge.aSide, SideType.EMPTY, false);

        // Adjust to target density by opening additional INTERNAL edges only (preserve single exit)
        const targetOpenEdges = Math.round(totalEdges * (1 - desiredDensity));
        let currentOpenEdges = minOpenEdges; // after spanning tree + single exit

        if (targetOpenEdges > currentOpenEdges) {
            const closedInternal = internalEdges.filter(e => e.a.getSideState(e.aSide) === SideType.MIRROR);
            shuffle(closedInternal);
            const toOpen = Math.min(targetOpenEdges - currentOpenEdges, closedInternal.length);
            for (let i = 0; i < toOpen; i++) {
                openEdge(closedInternal[i]);
            }
            currentOpenEdges += toOpen;
        }

        console.log('🧩 Random grid generated', {
            rows: numRows,
            cols: trianglesPerRow,
            triangles: trianglesCount,
            totalEdges,
            internalEdges: internalEdges.length,
            boundaryEdges: boundaryEdges.length,
            mirrorDensity: desiredDensity
        });
    }
}

// Export for ES6 modules
export { Triangle, TriangularGrid, SideType };