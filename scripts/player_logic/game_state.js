import { TriangularGrid } from '../grid_system.js';
import { Character } from './character.js';
import { GridGraph } from './grid_graph.js';
import { EYE_HEIGHT } from '../rendering/scene_render.js';
import { TRIANGLE_SIZE, TRIANGLE_HEIGHT } from '../maze.js';

class GameState {
    constructor() {
        this.grid = null;
        this.gridGraph = null;
        this.turnCounter = 0;
        this.player = new Character('player');
        this.enemy = new Character('enemy');
        this.sceneRenderer = null;
        this.gameOver = false; // Add game over flag
    }
    
    /**
     * Set the scene renderer reference for updating camera position
     * @param {SceneRenderer} sceneRenderer - The scene renderer instance
     */
    setSceneRenderer(sceneRenderer) {
        this.sceneRenderer = sceneRenderer;
        console.log('GameState: Scene renderer reference set');
    }

    /**
     * Initialize the grid
     * @param {TriangularGrid} grid - The triangular grid instance
     */
    setGrid(grid, ) {
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
     * Check if player and enemy are in the same location
     * @returns {boolean} True if they occupy the same triangle
     */
    checkCollision() {
        const playerPos = this.player.getPosition();
        const enemyPos = this.enemy.getPosition();
        
        return playerPos.row === enemyPos.row && playerPos.col === enemyPos.col;
    }

    /**
     * Handle game over - redirect to lose screen
     */
    triggerGameOver() {
        if (this.gameOver) return; // Prevent multiple triggers
        
        this.gameOver = true;
        console.log('💀 GAME OVER - Enemy caught the player!');
        
        // Short delay before redirect for dramatic effect
        setTimeout(() => {
            window.location.href = 'end_lose.html';
        }, 500);
    }

    /**
     * Set the player's position and orientation
     * @param {number} row - Row coordinate
     * @param {number} col - Column coordinate
     * @param {string} orientation - 'left', 'right', or 'third'
     */
    setPlayerPosition(row, col, orientation) {
        if (this.gameOver) return; // Don't allow moves if game is over
        
        this.player.row = row;
        this.player.col = col;
        this.player.orientation = orientation;
        
        // Check for collision after player moves
        if (this.checkCollision()) {
            this.triggerGameOver();
            return;
        }
        
        // Update camera position if scene renderer is available
        if (this.sceneRenderer && this.grid) {
            const worldPos = this.gridToWorldPosition(row, col, orientation);
            const yaw = this.orientationToYaw(orientation, this.grid.getTriangle(row, col).pointsUp);
            this.sceneRenderer.updateCameraPosition(worldPos, yaw);
        }
    }

    /**
     * Update player position from world coordinates
     * @param {THREE.Vector3} worldPos - World position
     * @param {number} yaw - Yaw angle in radians
     */
    updatePlayerFromWorldPosition(worldPos, yaw) {
        if (!this.grid) return;
        
        // Convert world position back to grid coordinates
        const row = Math.round(worldPos.z / TRIANGLE_HEIGHT);
        const col = Math.round(worldPos.x / (TRIANGLE_SIZE * 0.5));
        
        // Clamp to valid grid bounds
        const clampedRow = Math.max(0, Math.min(row, this.grid.getRowCount() - 1));
        const clampedCol = Math.max(0, Math.min(col, this.grid.getRowLength(clampedRow) - 1));
        
        // Determine orientation from yaw angle
        const triangle = this.grid.getTriangle(clampedRow, clampedCol);
        if (!triangle) return;
        
        // Normalize yaw to 0-2π range
        let normalizedYaw = yaw % (Math.PI * 2);
        if (normalizedYaw < 0) normalizedYaw += Math.PI * 2;
        
        let orientation = 'left';
        if (triangle.pointsUp) {
            // Up-pointing triangle: third=0°, left=120°, right=240°
            if (normalizedYaw < Math.PI / 3 || normalizedYaw >= Math.PI * 5/3) {
                orientation = 'third'; // 0° ± 60° (330° to 30°)
            } else if (normalizedYaw >= Math.PI / 3 && normalizedYaw < Math.PI) {
                orientation = 'left'; // 120° ± 60° (60° to 180°)
            } else {
                orientation = 'right'; // 240° ± 60° (180° to 300°)
            }
        } else {
            // Down-pointing triangle: left=60°, third=180°, right=300°
            if (normalizedYaw < Math.PI / 6 || normalizedYaw >= Math.PI * 11/6) {
                orientation = 'right'; // 300° ± 30° (285° to 15°) wraps around
            } else if (normalizedYaw >= Math.PI / 6 && normalizedYaw < Math.PI * 7/6) {
                orientation = 'left'; // 60° ± 60° (0° to 120°) or third 180° ± 60° (120° to 240°)
                // Need to distinguish between left (60°) and third (180°)
                if (normalizedYaw >= Math.PI * 2/3) {
                    orientation = 'third';
                }
            } else {
                orientation = 'right'; // 300° ± 60° (240° to 360°)
            }
        }
        
        // Update player position
        this.player.row = clampedRow;
        this.player.col = clampedCol;
        this.player.orientation = orientation;
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
        if (this.gameOver) return; // Don't process turns if game is over
        
        this.turnCounter++;
        
        // Move enemy towards player
        this.moveEnemyTowardsPlayer();
        
        // Check for collision after enemy moves
        if (this.checkCollision()) {
            this.triggerGameOver();
            return;
        }
        
        // Update scene renderer with new player position
        if (this.sceneRenderer) {
            const playerPos = this.player.getPosition();
            const worldPos = this.gridToWorldPosition(playerPos.row, playerPos.col, playerPos.orientation);
            
            // Get the triangle to determine if it points up
            const triangle = this.grid.getTriangle(playerPos.row, playerPos.col);
            const pointsUp = triangle ? triangle.pointsUp : true;
            
            const yaw = this.orientationToYaw(playerPos.orientation, pointsUp);
            this.sceneRenderer.updatePlayer(worldPos, yaw, 0);
        }
    }
    
    /**
     * Convert grid coordinates to world coordinates
     * @param {number} row - Grid row
     * @param {number} col - Grid column
     * @param {string} orientation - Triangle orientation
     * @returns {THREE.Vector3} World position
     */
    gridToWorldPosition(row, col, orientation) {
        const x = col * TRIANGLE_SIZE * 0.5 + TRIANGLE_SIZE / 2;
        const z = row * TRIANGLE_HEIGHT + TRIANGLE_HEIGHT / 2;
        const y = EYE_HEIGHT; // Eye height
        
        return { x, y, z };
    }
    
    /**
     * Convert orientation to yaw angle
     * @param {string} orientation - 'left', 'right', or 'third'
     * @param {boolean} pointsUp - Whether the triangle points up
     * @returns {number} Yaw angle in radians
     */
    orientationToYaw(orientation, pointsUp) {
        let angle = 0;
        
        if (pointsUp) {
            // Up-pointing triangle
            switch (orientation) {
                case 'left':
                    angle = (120) * Math.PI / 180; // 120 degrees
                    break;
                case 'right':
                    angle = (240) * Math.PI / 180; // 240 degrees
                    break;
                case 'third': // Bottom
                    angle = (0) * Math.PI / 180; // 0 degrees
                    break;
            } 
        } else {
            // Down-pointing triangle
            switch (orientation) {
                case 'left':
                    angle = (60) * Math.PI / 180; // 60 degrees
                    break;
                case 'right':
                    angle = (300) * Math.PI / 180; // 300 degrees
                    break;
                case 'third': // Top
                    angle = (180) * Math.PI / 180; // 180 degrees
                    break;
            }
        }
        
        return angle;
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