// UI Overlay Manager
// Handles all UI rendering on top of the game scene

import { MazeMinimap } from './maze_minimap.js';

class UIOverlay {
    constructor(containerElement) {
        this.container = containerElement;
        
        // UI Components
        this.minimap = null;
        
        // Grid reference
        this.grid = null;
        
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
        
        // Future UI components will be initialized here
        // - Health bars
        // - Inventory
        // - Objectives
        // - Crosshair
        // etc.
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
        // Update UI elements based on game state
        // For example: health bar, ammo count, objectives, etc.
        
        // Minimap could show player position in the future
        // this.minimap.updatePlayerPosition(gameState.player.position);
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
        
        // Cleanup other UI components
    }
    
    // Getters for UI components (for external access)
    getMinimap() {
        return this.minimap;
    }
}

export { UIOverlay };

