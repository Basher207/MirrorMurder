import { Orientation, MovementDirection } from './character.js';
import { SideType } from '../grid_system.js';

/**
 * Represents a node in the grid graph
 * Each node is a unique combination of triangle position and orientation
 */
class GraphNode {
    constructor(row, col, orientation) {
        this.row = row;
        this.col = col;
        this.orientation = orientation;
        this.edges = []; // Array of GraphEdge objects
    }

    /**
     * Get a unique identifier for this node
     */
    getId() {
        return `${this.row},${this.col},${this.orientation}`;
    }

    /**
     * Add an edge to another node
     * @param {GraphNode} targetNode - The destination node
     * @param {string} edgeType - 'rotation' or 'movement'
     * @param {string} action - The action that creates this edge (rotation direction or movement direction)
     */
    addEdge(targetNode, edgeType, action) {
        this.edges.push(new GraphEdge(targetNode, edgeType, action));
    }
}

/**
 * Represents an edge in the grid graph
 */
class GraphEdge {
    constructor(targetNode, edgeType, action) {
        this.targetNode = targetNode;
        this.edgeType = edgeType; // 'rotation' or 'movement'
        this.action = action; // 'clockwise', 'counterclockwise', 'forward_left', 'forward_right'
    }
}

/**
 * Represents the entire grid as a graph
 * Nodes are (triangle, orientation) pairs
 * Edges represent possible movements/rotations
 */
class GridGraph {
    constructor() {
        this.nodes = new Map(); // Map of "row,col,orientation" -> GraphNode
        this.grid = null; // Reference to the TriangularGrid
    }

    /**
     * Build the graph from a TriangularGrid
     * @param {TriangularGrid} grid - The triangular grid to build from
     */
    buildFromGrid(grid) {
        this.grid = grid;
        this.nodes.clear();

        console.log('🔨 Building GridGraph from TriangularGrid...');

        // Step 1: Create all nodes (one for each triangle-orientation combination)
        for (let row = 0; row < grid.getRowCount(); row++) {
            for (let col = 0; col < grid.getRowLength(row); col++) {
                // const triangle = grid.getTriangle(row, col);
                
                // Create a node for each possible orientation
                for (const orientation of Object.values(Orientation)) {
                    const node = new GraphNode(row, col, orientation);
                    this.nodes.set(node.getId(), node);
                }
            }
        }

        console.log(`   └─ Created ${this.nodes.size} nodes`);

        // Step 2: Create edges
        let rotationEdges = 0;
        let movementEdges = 0;

        for (const node of this.nodes.values()) {
            const triangle = grid.getTriangle(node.row, node.col);

            // Add rotation edges (within same triangle)
            const clockwiseNode = this.getClockwiseNode(node, triangle.pointsUp);
            if (clockwiseNode) {
                node.addEdge(clockwiseNode, 'rotation', 'clockwise');
                rotationEdges++;
            }

            const counterClockwiseNode = this.getCounterClockwiseNode(node, triangle.pointsUp);
            if (counterClockwiseNode) {
                node.addEdge(counterClockwiseNode, 'rotation', 'counterclockwise');
                rotationEdges++;
            }

            // Add movement edges (to adjacent triangles)
            // Movement always goes through the side we're facing
            const sideToCheck = node.orientation;
            const sideState = triangle.getSideState(sideToCheck);
            
            // Only add movement edges if the side is empty (not blocked)
            if (sideState === SideType.EMPTY) {
                const neighbor = triangle.neighbors[sideToCheck];
                
                if (neighbor) {
                    // Calculate the side we entered from in the neighbor
                    const enteredFromSide = triangle.getNeighborCorrespondingSide(sideToCheck);

                    // Add FORWARD_LEFT edge (turn right/clockwise from entered side)
                    const forwardLeftOrientation = this.getRotatedOrientation(
                        enteredFromSide, 
                        neighbor.pointsUp, 
                        true // clockwise
                    );
                    const forwardLeftNode = this.getNode(neighbor.row, neighbor.col, forwardLeftOrientation);
                    if (forwardLeftNode) {
                        node.addEdge(forwardLeftNode, 'movement', MovementDirection.FORWARD_LEFT);
                        movementEdges++;
                    }

                    // Add FORWARD_RIGHT edge (turn left/counterclockwise from entered side)
                    const forwardRightOrientation = this.getRotatedOrientation(
                        enteredFromSide, 
                        neighbor.pointsUp, 
                        false // counterclockwise
                    );
                    const forwardRightNode = this.getNode(neighbor.row, neighbor.col, forwardRightOrientation);
                    if (forwardRightNode) {
                        node.addEdge(forwardRightNode, 'movement', MovementDirection.FORWARD_RIGHT);
                        movementEdges++;
                    }
                }
            }
        }

        console.log(`   └─ Created ${rotationEdges} rotation edges`);
        console.log(`   └─ Created ${movementEdges} movement edges`);
        console.log('✅ GridGraph built successfully');
    }

    /**
     * Get a node by position and orientation
     */
    getNode(row, col, orientation) {
        return this.nodes.get(`${row},${col},${orientation}`);
    }

    /**
     * Get the node resulting from clockwise rotation
     */
    getClockwiseNode(node, pointsUp) {
        const newOrientation = this.getRotatedOrientation(node.orientation, pointsUp, true);
        return this.getNode(node.row, node.col, newOrientation);
    }

    /**
     * Get the node resulting from counter-clockwise rotation
     */
    getCounterClockwiseNode(node, pointsUp) {
        const newOrientation = this.getRotatedOrientation(node.orientation, pointsUp, false);
        return this.getNode(node.row, node.col, newOrientation);
    }

    /**
     * Get the orientation after rotation
     * @param {string} currentOrientation - Current orientation
     * @param {boolean} pointsUp - Whether triangle points up
     * @param {boolean} clockwise - True for clockwise, false for counter-clockwise
     */
    getRotatedOrientation(currentOrientation, pointsUp, clockwise) {
        if (clockwise) {
            if (pointsUp) {
                // Up-pointing: left -> right -> third -> left
                const rotationMap = {
                    [Orientation.LEFT]: Orientation.RIGHT,
                    [Orientation.RIGHT]: Orientation.THIRD,
                    [Orientation.THIRD]: Orientation.LEFT
                };
                return rotationMap[currentOrientation];
            } else {
                // Down-pointing: left -> third -> right -> left
                const rotationMap = {
                    [Orientation.LEFT]: Orientation.THIRD,
                    [Orientation.THIRD]: Orientation.RIGHT,
                    [Orientation.RIGHT]: Orientation.LEFT
                };
                return rotationMap[currentOrientation];
            }
        } else {
            if (pointsUp) {
                // Up-pointing counter-clockwise: left -> third -> right -> left
                const rotationMap = {
                    [Orientation.LEFT]: Orientation.THIRD,
                    [Orientation.THIRD]: Orientation.RIGHT,
                    [Orientation.RIGHT]: Orientation.LEFT
                };
                return rotationMap[currentOrientation];
            } else {
                // Down-pointing counter-clockwise: left -> right -> third -> left
                const rotationMap = {
                    [Orientation.LEFT]: Orientation.RIGHT,
                    [Orientation.RIGHT]: Orientation.THIRD,
                    [Orientation.THIRD]: Orientation.LEFT
                };
                return rotationMap[currentOrientation];
            }
        }
    }

    /**
     * Get all neighbors of a node (both rotation and movement)
     * @param {number} row
     * @param {number} col
     * @param {string} orientation
     * @returns {Array} Array of {node, edgeType, action}
     */
    getNeighbors(row, col, orientation) {
        const node = this.getNode(row, col, orientation);
        if (!node) return [];

        return node.edges.map(edge => ({
            node: edge.targetNode,
            edgeType: edge.edgeType,
            action: edge.action
        }));
    }

    /**
     * Get all nodes in the graph
     */
    getAllNodes() {
        return Array.from(this.nodes.values());
    }

    /**
     * Get the number of nodes in the graph
     */
    getNodeCount() {
        return this.nodes.size;
    }

    /**
     * Check if a node exists
     */
    hasNode(row, col, orientation) {
        return this.nodes.has(`${row},${col},${orientation}`);
    }
}

export { GridGraph, GraphNode, GraphEdge };