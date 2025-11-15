// Main Game Loop Manager
// Coordinates all game systems and rendering

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
        this.gameState = {
            // Future game state will go here
            // player: null,
            // enemies: [],
            // items: [],
            // etc.
        };
        
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
        // Update movement (player input)
        if (this.movement) {
            this.movement.update(deltaTime);
        }
        
        // Future game logic updates will go here
        // - AI, physics, etc.
        // - Collision detection
        // - Game state updates
        
        // Update scene renderer
        if (this.sceneRenderer) {
            this.sceneRenderer.update(deltaTime);
        }
        
        // Update UI with current game state
        if (this.uiOverlay) {
            this.uiOverlay.update(deltaTime, this.gameState);
        }
    }
    
    // Render all visual elements
    render() {
        // ====== GAME RENDERING ======
        // Render the main 3D scene using raycast shader
        if (this.sceneRenderer) {
            this.sceneRenderer.render();
        }
        
        // ====== UI OVERLAY RENDERING (Always on top) ======
        // Render UI elements last so they appear on top of everything
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
}

export { GameLoop };

