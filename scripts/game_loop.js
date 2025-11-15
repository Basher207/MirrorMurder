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
        this.minimap = null;
        
        // Bind the loop
        this.loop = this.loop.bind(this);
    }
    
    // Register subsystems
    setMinimap(minimap) {
        this.minimap = minimap;
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
        // Player movement, AI, physics, etc.
    }
    
    // Render all visual elements
    render() {
        // Clear main canvas
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Main game rendering will go here
        // First-person view, UI elements, etc.
        
        // Render minimap (if available)
        if (this.minimap) {
            this.minimap.render();
        }
    }
    
    // Handle window resize
    handleResize(width, height) {
        if (this.minimap) {
            this.minimap.handleResize(width, height);
        }
    }
}

export { GameLoop };

