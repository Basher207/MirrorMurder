// Main Game Loop Manager
// Coordinates all game systems and rendering

class GameLoop {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.isRunning = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        
        // Subsystems (to be populated)
        this.uiOverlay = null;
        
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
    setUIOverlay(uiOverlay) {
        this.uiOverlay = uiOverlay;
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
        // Future game logic updates will go here
        // - Player movement, AI, physics, etc.
        // - Collision detection
        // - Game state updates
        
        // Update UI with current game state
        if (this.uiOverlay) {
            this.uiOverlay.update(deltaTime, this.gameState);
        }
    }
    
    // Render all visual elements
    render() {
        // Clear main canvas
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // ====== GAME RENDERING ======
        // This is where the main game scene will be rendered
        // - First-person 3D view
        // - World geometry
        // - Characters and objects
        // - Lighting and effects
        this.renderGame();
        
        // ====== UI OVERLAY RENDERING (Always on top) ======
        // Render UI elements last so they appear on top of everything
        if (this.uiOverlay) {
            this.uiOverlay.render();
        }
    }
    
    // Render the main game scene
    renderGame() {
        // Placeholder for game rendering
        // Future implementation will include:
        // - Three.js first-person renderer
        // - Maze 3D view
        // - Player view
        // - Entities (enemies, items, etc.)
        
        // For now, just show a simple placeholder
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(50, 50, 200, 100);
        this.ctx.fillStyle = '#00aaff';
        this.ctx.font = '16px Courier New';
        this.ctx.fillText('Game View', 90, 105);
    }
    
    // Handle window resize
    handleResize(width, height) {
        if (this.uiOverlay) {
            this.uiOverlay.handleResize(width, height);
        }
        
        // Handle resize for other game systems (3D renderer, etc.)
    }
}

export { GameLoop };

