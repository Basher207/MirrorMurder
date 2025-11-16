// Main Game Loop Manager
// Coordinates all game systems and rendering

import gameState from './player_logic/game_state.js';

class GameLoop {
    constructor() {
        this.isRunning = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        
        // Subsystems (to be populated)
        this.sceneRenderer = null;
        this.uiOverlay = null;
        this.movement = null;
        
        // Game state
        this.gameState = gameState;
        
        // Bind the loop
        this.loop = this.loop.bind(this);
    }
    
    // Register subsystems
    setSceneRenderer(sceneRenderer) {
        this.sceneRenderer = sceneRenderer;
    }
    
    setUIOverlay(uiOverlay) {
        this.uiOverlay = uiOverlay;
    }
    
    setMovement(movement) {
        this.movement = movement;
    }
    
    // Start the game loop
    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop();
    }
    
    // Stop the game loop
    stop() {
        this.isRunning = false;
    }
    
    // Main game loop
    loop(currentTime = 0) {
        if (!this.isRunning) return;
        
        // Calculate delta time
        this.deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;
        
        // Update phase
        this.update(this.deltaTime);
        
        // Render phase
        this.render();
        
        // Continue loop
        requestAnimationFrame(this.loop);
    }
    
    // Update all game systems
    update(deltaTime) {
        // Update player animation
        if (this.playerAnimation) {
            this.playerAnimation.update(deltaTime);
        }
        
        // DO NOT sync world position to grid here - it creates a feedback loop
        // The movement system updates grid position, which then updates world position
        // Syncing world back to grid overwrites the movement system's changes
        
        // Only sync if we're doing free movement (not turn-based)
        // For now, comment this out since we're using turn-based movement
        /*
        if (this.sceneRenderer && this.gameState) {
            const worldPos = this.sceneRenderer.playerPos;
            const yaw = this.sceneRenderer.playerYaw;
            this.gameState.updatePlayerFromWorldPosition(worldPos, yaw);
        }
        */

        // Update game logic
        if (this.movement) {
            this.movement.update(deltaTime);
        }
        
        // Update UI
        if (this.uiOverlay) {
            this.uiOverlay.update(deltaTime, {});
        }
    }
    
    // Render all visual elements
    render() {
        // Update and render 3D scene
        if (this.sceneRenderer) {
            this.sceneRenderer.update(this.deltaTime);
            this.sceneRenderer.render();
        }
        
        // Render UI overlay on top
        if (this.uiOverlay) {
            this.uiOverlay.render();
        }
    }
    
    // Handle window resize
    handleResize(width, height) {
        if (this.sceneRenderer) {
            this.sceneRenderer.handleResize(width, height);
        }
        
        if (this.uiOverlay) {
            this.uiOverlay.handleResize(width, height);
        }
    }
    
    setGrid(grid) {
        this.grid = grid;
        console.log('GameLoop: Grid set');
    }
}

export { GameLoop };

