// UI Overlay Manager
// Handles all UI rendering on top of the game scene

import { MazeMinimap } from './maze_minimap.js';
import gameState from '../player_logic/game_state.js';

class UIOverlay {
    constructor(containerElement) {
        this.container = containerElement;
        
        // UI Components
        this.minimap = null;
        this.phaseDisplay = null;
        
        // Grid reference
        this.grid = null;
        
        // Movement system reference
        this.movementSystem = null;
        
        // Scene renderer reference (for player position)
        this.sceneRenderer = null;
        
        // Initialize UI components
        this.initializeComponents();
        
        console.log('UIOverlay: Initialized');
    }
    
    initializeComponents() {
        // Create minimap
        this.minimap = new MazeMinimap(this.container);
        console.log('UIOverlay: Minimap created');

        // Pass game state to minimap
        this.minimap.setGameState(gameState);
        
        // Create phase display
        this.phaseDisplay = document.createElement('div');
        this.phaseDisplay.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            padding: 15px 25px;
            background: rgba(0, 0, 0, 0.8);
            border: 3px solid #00ff00;
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 20px;
            font-weight: bold;
            text-transform: uppercase;
            z-index: 1000;
            pointer-events: none;
            letter-spacing: 2px;
        `;
        this.phaseDisplay.textContent = '🔄 ROTATION MODE';
        this.container.appendChild(this.phaseDisplay);
        
        console.log('UIOverlay: Phase display created');
        
        // Future UI components will be initialized here
    }
    
    /**
     * Set the movement system reference to track phase changes
     * @param {MovementSystem} movementSystem - The movement system instance
     */
    setMovementSystem(movementSystem) {
        this.movementSystem = movementSystem;
        console.log('UIOverlay: Movement system reference set');
    }
    
    /**
     * Set the grid to be visualized
     * @param {TriangularGrid} grid - The grid system to visualize
     */
    setGrid(grid) {
        this.grid = grid;
        console.log('UIOverlay: Setting grid with', grid.getRowCount(), 'rows');
        if (this.minimap) {
            this.minimap.setGrid(grid);
        }
    }
    
    /**
     * Set the scene renderer reference for accessing player position
     * @param {SceneRenderer} sceneRenderer - The scene renderer
     */
    setSceneRenderer(sceneRenderer) {
        this.sceneRenderer = sceneRenderer;
    }
    
    // Update UI state (called every frame)
    update(deltaTime, gameState) {
        // Update phase display
        if (this.movementSystem && this.phaseDisplay) {
            const phase = this.movementSystem.getCurrentPhase();
            if (phase === 'movement') {
                this.phaseDisplay.textContent = '📍 MOVEMENT MODE';
                this.phaseDisplay.style.borderColor = '#00aaff';
                this.phaseDisplay.style.color = '#00aaff';
            } else {
                this.phaseDisplay.textContent = '🔄 ROTATION MODE';
                this.phaseDisplay.style.borderColor = '#00ff00';
                this.phaseDisplay.style.color = '#00ff00';
            }
        }
    }
    
    // Render all UI elements (called every frame after game rendering)
    render() {
        // Render minimap with player position
        if (this.minimap && this.sceneRenderer) {
            const playerPos = this.sceneRenderer.getPlayerPosition();
            const playerYaw = this.sceneRenderer.playerYaw;
            this.minimap.render(playerPos, playerYaw);
        } else if (this.minimap) {
            this.minimap.render();
        }
        
        // Future UI rendering will go here
        // Canvas-based UI elements can be drawn here
        // Three.js UI elements are rendered by their own renderers
    }
    
    // Handle window resize
    handleResize(width, height) {
        if (this.minimap) {
            this.minimap.handleResize(width, height);
        }
        
        // Handle resize for other UI components
    }
    
    // Cleanup
    destroy() {
        if (this.minimap) {
            this.minimap.destroy();
        }
        
        if (this.phaseDisplay && this.phaseDisplay.parentNode) {
            this.phaseDisplay.parentNode.removeChild(this.phaseDisplay);
        }
        
        // Cleanup other UI components
    }
    
    // Getters for UI components (for external access)
    getMinimap() {
        return this.minimap;
    }
}

export { UIOverlay };

