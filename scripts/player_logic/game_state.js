import { TriangularGrid } from '../grid_system.js';
import { Character } from './character.js';
import { GridGraph } from './grid_graph.js';

class GameState {
    constructor() {
        this.grid = null;
        this.gridGraph = null;
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
        
        // Build the graph from the grid
        this.gridGraph = new GridGraph();
        this.gridGraph.buildFromGrid(grid);
        
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
        
        // Build the graph from the grid
        this.gridGraph = new GridGraph();
        this.gridGraph.buildFromGrid(this.grid);
        
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
        
        // Move enemy towards player
        this.moveEnemyTowardsPlayer();
    }

    /**
     * Move the enemy one step towards the player using A* pathfinding
     */
    moveEnemyTowardsPlayer() {
        if (!this.gridGraph) {
            console.error('GridGraph not initialized');
            return;
        }

        const path = this.findEnemyPathToPlayer();
        
        if (path.length === 0) {
            console.warn('No path found for enemy to reach player');
            return;
        }

        // Get the first node in the path (next move)
        const nextNode = path[0];
        
        // Update enemy position and orientation
        this.enemy.setPosition(nextNode.row, nextNode.col, nextNode.orientation);
        
        console.log(`Enemy moved to (${nextNode.row}, ${nextNode.col}) facing ${nextNode.orientation}`);
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

    getGridGraph() {
        return this.gridGraph;
    }

    /**
     * Calculate Manhattan distance heuristic between two nodes
     * @param {GraphNode} nodeA 
     * @param {GraphNode} nodeB 
     * @returns {number} Manhattan distance
     */
    manhattanDistance(nodeA, nodeB) {
        return Math.abs(nodeA.row - nodeB.row) + Math.abs(nodeA.col - nodeB.col);
    }

    /**
     * A* pathfinding algorithm to find shortest path between two nodes
     * @param {GraphNode} startNode - Starting node
     * @param {GraphNode} endNode - Goal node
     * @returns {Array<GraphNode>} Array of next 5 nodes in the shortest path (or fewer if path is shorter)
     */
    findPathAStar(startNode, endNode) {
        if (!this.gridGraph) {
            console.error('GridGraph not initialized');
            return [];
        }

        if (!startNode || !endNode) {
            console.error('Invalid start or end node');
            return [];
        }

        // Priority queue for open set (nodes to be evaluated)
        const openSet = new Map(); // nodeId -> {node, fScore}
        const closedSet = new Set(); // nodeIds of evaluated nodes
        
        // Track g scores (cost from start to node)
        const gScore = new Map();
        
        // Track f scores (g + heuristic)
        const fScore = new Map();
        
        // Track parent nodes for path reconstruction
        const cameFrom = new Map();

        // Initialize start node
        const startId = startNode.getId();
        gScore.set(startId, 0);
        fScore.set(startId, this.manhattanDistance(startNode, endNode));
        openSet.set(startId, { node: startNode, fScore: fScore.get(startId) });

        while (openSet.size > 0) {
            // Get node with lowest fScore from openSet
            let currentId = null;
            let lowestFScore = Infinity;
            
            for (const [nodeId, data] of openSet.entries()) {
                if (data.fScore < lowestFScore) {
                    lowestFScore = data.fScore;
                    currentId = nodeId;
                }
            }

            const current = openSet.get(currentId).node;

            // Check if we reached the goal
            if (currentId === endNode.getId()) {
                // Reconstruct path
                const path = this.reconstructPath(cameFrom, current);
                // Return next 5 nodes (excluding start node)
                return path.slice(1, 6);
            }

            // Move current from open to closed
            openSet.delete(currentId);
            closedSet.add(currentId);

            // Check all neighbors
            for (const edge of current.edges) {
                const neighbor = edge.targetNode;
                const neighborId = neighbor.getId();

                // Skip if already evaluated
                if (closedSet.has(neighborId)) {
                    continue;
                }

                // Calculate tentative g score (cost is 1 for all edges)
                const tentativeGScore = gScore.get(currentId) + 1;

                // Discover new node or find better path
                if (!gScore.has(neighborId) || tentativeGScore < gScore.get(neighborId)) {
                    // Record this path
                    cameFrom.set(neighborId, current);
                    gScore.set(neighborId, tentativeGScore);
                    
                    const heuristic = this.manhattanDistance(neighbor, endNode);
                    const newFScore = tentativeGScore + heuristic;
                    fScore.set(neighborId, newFScore);

                    // Add to open set if not already there
                    if (!openSet.has(neighborId)) {
                        openSet.set(neighborId, { node: neighbor, fScore: newFScore });
                    } else {
                        // Update fScore in open set
                        openSet.get(neighborId).fScore = newFScore;
                    }
                }
            }
        }

        // No path found
        console.warn('No path found from', startNode.getId(), 'to', endNode.getId());
        return [];
    }

    /**
     * Reconstruct the path from start to end using the cameFrom map
     * @param {Map} cameFrom - Map of nodeId -> parent node
     * @param {GraphNode} current - The end node
     * @returns {Array<GraphNode>} Complete path from start to end
     */
    reconstructPath(cameFrom, current) {
        const path = [current];
        let currentId = current.getId();

        while (cameFrom.has(currentId)) {
            current = cameFrom.get(currentId);
            currentId = current.getId();
            path.unshift(current);
        }

        return path;
    }

    /**
     * Find the next moves for the enemy to approach the player
     * @returns {Array<GraphNode>} Next 5 nodes in the path from enemy to player
     */
    findEnemyPathToPlayer() {
        if (!this.gridGraph) {
            console.error('GridGraph not initialized');
            return [];
        }

        const enemyPos = this.enemy.getPosition();
        const playerPos = this.player.getPosition();

        const startNode = this.gridGraph.getNode(enemyPos.row, enemyPos.col, enemyPos.orientation);
        const endNode = this.gridGraph.getNode(playerPos.row, playerPos.col, playerPos.orientation);

        if (!startNode || !endNode) {
            console.error('Could not find start or end node in graph');
            return [];
        }

        return this.findPathAStar(startNode, endNode);
    }
}

const gameState = new GameState();
export default gameState;