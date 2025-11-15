// Movement System
// Handles turn-based movement and rotation for the player character

import gameState from './game_state.js';
import { MovementDirection } from './character.js';

/**
 * Enum for movement phases
 */
const MovementPhase = Object.freeze({
    MOVEMENT: 'movement',
    ROTATION: 'rotation'
});

class MovementSystem {
    constructor() {
        this.currentPhase = MovementPhase.ROTATION; // Start in rotation phase
        this.keysPressed = new Set();
        
        // Setup input listeners
        this.setupInputListeners();
        
        console.log('MovementSystem: Initialized in ROTATION phase');
    }
    
    setupInputListeners() {
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }
    
    onKeyDown(event) {
        const key = event.key.toLowerCase();
        
        // Prevent repeat key events
        if (this.keysPressed.has(key)) return;
        this.keysPressed.add(key);
        
        // Phase switching
        if (key === 'w' || key === 'arrowup') {
            this.enterMovementPhase();
            return;
        }
        
        if (key === 's' || key === 'arrowdown') {
            this.enterRotationPhase();
            return;
        }
        
        // Handle actions based on current phase
        if (this.currentPhase === MovementPhase.MOVEMENT) {
            this.handleMovementInput(key);
        } else if (this.currentPhase === MovementPhase.ROTATION) {
            this.handleRotationInput(key);
        }
    }
    
    onKeyUp(event) {
        const key = event.key.toLowerCase();
        this.keysPressed.delete(key);
    }
    
    enterMovementPhase() {
        this.currentPhase = MovementPhase.MOVEMENT;
        console.log('📍 Entered MOVEMENT phase - Press A/Left for forward-left, D/Right for forward-right');
    }
    
    enterRotationPhase() {
        this.currentPhase = MovementPhase.ROTATION;
        console.log('🔄 Entered ROTATION phase - Press A/Left to rotate counter-clockwise, D/Right to rotate clockwise');
    }
    
    handleMovementInput(key) {
        const player = gameState.getPlayer();
        const grid = gameState.getGrid();
        
        if (!player || !grid) {
            console.warn('MovementSystem: Player or grid not initialized');
            return;
        }
        
        let direction = null;
        
        if (key === 'a' || key === 'arrowleft') {
            direction = MovementDirection.FORWARD_LEFT;
        } else if (key === 'd' || key === 'arrowright') {
            direction = MovementDirection.FORWARD_RIGHT;
        }
        
        if (direction) {
            const result = player.move(grid, direction);
            
            if (result.success) {
                console.log(`✅ Player moved to (${result.row}, ${result.col}) facing ${result.orientation}`);
                gameState.incrementTurn();
                console.log(`Turn: ${gameState.getCurrentTurn()}`);
            } else {
                console.log('❌ Movement blocked!');
            }
        }
    }
    
    handleRotationInput(key) {
        const player = gameState.getPlayer();
        const grid = gameState.getGrid();
        
        if (!player || !grid) {
            console.warn('MovementSystem: Player or grid not initialized');
            return;
        }
        
        const currentTriangle = grid.getTriangle(player.row, player.col);
        
        if (!currentTriangle) {
            console.warn('MovementSystem: Player not on valid triangle');
            return;
        }
        
        if (key === 'a' || key === 'arrowleft') {
            // Rotate counter-clockwise
            player.rotateCounterClockwise(currentTriangle.pointsUp);
            console.log(`🔄 Player rotated counter-clockwise, now facing ${player.getOrientation()}`);
            gameState.incrementTurn();
            console.log(`Turn: ${gameState.getCurrentTurn()}`);
        } else if (key === 'd' || key === 'arrowright') {
            // Rotate clockwise
            player.rotateClockwise(currentTriangle.pointsUp);
            console.log(`🔄 Player rotated clockwise, now facing ${player.getOrientation()}`);
            gameState.incrementTurn();
            console.log(`Turn: ${gameState.getCurrentTurn()}`);
        }
    }
    
    getCurrentPhase() {
        return this.currentPhase;
    }
    
    update(deltaTime) {
        // This could be used for animations or timed events in the future
    }
}

export { MovementSystem, MovementPhase };