// Player Animation System
// Handles animated sprites for the player character

import * as THREE from 'three';

class PlayerAnimation {
    constructor() {
        this.frames = [];
        this.currentFrameIndex = 0;
        this.frameTime = 1.0; // 1 second per frame
        this.elapsedTime = 0.0;
        this.isLoaded = false;
        this.loadingCount = 0;
        this.totalFrames = 4;
        
        // Load all animation frames
        this.loadFrames();
    }
    
    loadFrames() {
        const loader = new THREE.TextureLoader();
        
        // Load all 4 player frames
        for (let i = 1; i <= this.totalFrames; i++) {
            const path = `./assets/player/player${i}.png`;
            
            loader.load(
                path,
                (texture) => {
                    // Configure texture
                    texture.minFilter = THREE.LinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    texture.wrapS = THREE.ClampToEdgeWrapping;
                    texture.wrapT = THREE.ClampToEdgeWrapping;
                    
                    // Store in array at correct index
                    this.frames[i - 1] = texture;
                    this.loadingCount++;
                    
                    console.log(`✅ Player frame ${i}/4 loaded`);
                    
                    // Check if all frames are loaded
                    if (this.loadingCount === this.totalFrames) {
                        this.isLoaded = true;
                        console.log('✅ All player animation frames loaded');
                    }
                },
                undefined,
                (error) => {
                    console.error(`❌ Failed to load player frame ${i}:`, error);
                }
            );
        }
    }
    
    /**
     * Update the animation state
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        if (!this.isLoaded) return;
        
        this.elapsedTime += deltaTime;
        
        // Check if we need to advance to the next frame
        if (this.elapsedTime >= this.frameTime) {
            this.elapsedTime -= this.frameTime;
            this.currentFrameIndex = (this.currentFrameIndex + 1) % this.totalFrames;
        }
    }
    
    /**
     * Get the current frame texture
     * @returns {THREE.Texture|null} Current animation frame
     */
    getCurrentFrame() {
        if (!this.isLoaded || this.frames.length === 0) {
            return null;
        }
        return this.frames[this.currentFrameIndex];
    }
    
    /**
     * Reset animation to first frame
     */
    reset() {
        this.currentFrameIndex = 0;
        this.elapsedTime = 0.0;
    }
    
    /**
     * Check if animation is ready
     * @returns {boolean}
     */
    isReady() {
        return this.isLoaded;
    }
}

export { PlayerAnimation };
