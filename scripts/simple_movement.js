// Simple Movement Controller
// Handles WASD movement and mouse look

import * as THREE from 'three';
import gameState from './player_logic/game_state.js';
import { TRIANGLE_SIZE, TRIANGLE_HEIGHT } from './maze.js';
import { EYE_HEIGHT } from './rendering/scene_render.js';

class SimpleMovement {
    constructor() {
        // Movement state
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            space: false,
            shift: false
        };
        
        // Mouse state
        this.mouseLocked = false;
        this.mouseMovementX = 0;
        
        // Movement settings
        this.moveSpeed = 0.8; // Units per second
        this.sprintMultiplier = 2.0;
        this.mouseSensitivity = 0.002; // Radians per pixel

        // Touch/click control state
        this.turnSpeedTouch = 2.0; // Radians per second for on-screen turn
        this.pointerActions = new Map(); // pointerId -> 'forward' | 'left' | 'right'
        this.touchMoveForward = false;
        this.touchTurnLeft = false;
        this.touchTurnRight = false;
        
        // Player state (will be synced with scene renderer)
        this.position = new THREE.Vector3(5, EYE_HEIGHT, 5);
        this.yaw = 0;
        this.pitch = 0;
        
        // Reference to scene renderer (set by game loop)
        this.sceneRenderer = null;
        
        // Reference to grid (for coordinate conversion)
        this.grid = null;
        
        // Setup input listeners
        this.setupInputListeners();
    }
    
    setupInputListeners() {
        // Keyboard listeners
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Mouse lock listeners
        document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // Pointer/touch controls
        document.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        document.addEventListener('pointerup', (e) => this.onPointerUp(e));
        document.addEventListener('pointercancel', (e) => this.onPointerUp(e));
        document.addEventListener('pointerleave', (e) => this.onPointerUp(e));
    }
    
    onKeyDown(event) {
        const key = event.key.toLowerCase();
        if (key === 'w') this.keys.w = true;
        if (key === 'a') this.keys.a = true;
        if (key === 's') this.keys.s = true;
        if (key === 'd') this.keys.d = true;
        if (key === ' ') this.keys.space = true;
        if (event.key === 'Shift') this.keys.shift = true;
    }
    
    onKeyUp(event) {
        const key = event.key.toLowerCase();
        if (key === 'w') this.keys.w = false;
        if (key === 'a') this.keys.a = false;
        if (key === 's') this.keys.s = false;
        if (key === 'd') this.keys.d = false;
        if (key === ' ') this.keys.space = false;
        if (event.key === 'Shift') this.keys.shift = false;
    }
    
    requestPointerLock() {
        if (!this.mouseLocked) {
            document.body.requestPointerLock();
        }
    }
    
    onPointerLockChange() {
        this.mouseLocked = document.pointerLockElement === document.body;
        if (this.mouseLocked) {
            console.log('🎮 Mouse locked - WASD to move, Mouse to look');
        } else {
            console.log('🎮 Click to lock mouse and start playing');
        }
    }
    
    onMouseMove(event) {
        if (!this.mouseLocked) return;
        
        // Update yaw (left/right) based on mouse movement
        this.yaw -= event.movementX * this.mouseSensitivity;
        
        // Optionally update pitch (up/down) - uncomment if you want vertical look
        // this.pitch -= event.movementY * this.mouseSensitivity;
        // this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
    }
    
    // Pointer/touch screen controls
    onPointerDown(event) {
        // Desktop: first click requests pointer lock for mouse look
        if (event.pointerType === 'mouse') {
            if (!this.mouseLocked) {
                this.requestPointerLock();
            }
            return;
        }

        // Touch: interpret screen zones
        event.preventDefault();
        const action = this.getActionFromPosition(event.clientX, event.clientY);
        if (!action) return;
        this.pointerActions.set(event.pointerId, action);
        this.updateTouchActionStates();
    }

    onPointerUp(event) {
        if (this.pointerActions.has(event.pointerId)) {
            this.pointerActions.delete(event.pointerId);
            this.updateTouchActionStates();
        }
    }

    getActionFromPosition(x, y) {
        const width = window.innerWidth || 1;
        const height = window.innerHeight || 1;
        const yRatio = y / height;
        const xRatio = x / width;

        // Bottom 30% has three zones: left button (0-30%), forward button (30-70%), right button (70-100%)
        // if (yRatio >= 0.7) {
            if (xRatio < 0.3) {
                return 'left';
            } else if (xRatio >= 0.7) {
                return 'right';
            } else {
                return 'forward';
            }
        // }
        
        // Top 70%: left half turns left, right half turns right
        return xRatio < 0.5 ? 'left' : 'right';
    }

    updateTouchActionStates() {
        let moveForward = false;
        let turnLeft = false;
        let turnRight = false;
        for (const action of this.pointerActions.values()) {
            if (action === 'forward') moveForward = true;
            if (action === 'left') turnLeft = true;
            if (action === 'right') turnRight = true;
        }
        this.touchMoveForward = moveForward;
        this.touchTurnLeft = turnLeft;
        this.touchTurnRight = turnRight;
    }
    
    // Set reference to scene renderer
    setSceneRenderer(sceneRenderer) {
        this.sceneRenderer = sceneRenderer;
        // Sync initial position from renderer
        this.position.copy(sceneRenderer.playerPos);
        this.yaw = sceneRenderer.playerYaw;
        this.pitch = sceneRenderer.playerPitch;
    }
    
    // Set reference to grid
    setGrid(grid) {
        this.grid = grid;
    }
    
    // Convert world position to grid coordinates
    worldToGrid(worldPos) {
        if (!this.grid) return { row: 0, col: 0 };
        
        // Get grid dimensions
        const rowCount = this.grid.getRowCount();
        const colCount = this.grid.getColCount();
        
        // Calculate row (z-axis)
        const row = Math.floor((worldPos.z / TRIANGLE_HEIGHT) * 2);
        
        // Calculate column (x-axis) - accounting for row offset
        const rowOffset = (row % 2 === 1) ? TRIANGLE_SIZE / 2 : 0;
        const col = Math.floor((worldPos.x - rowOffset) / TRIANGLE_SIZE);
        
        // Clamp to grid bounds
        return {
            row: Math.max(0, Math.min(rowCount - 1, row)),
            col: Math.max(0, Math.min(colCount - 1, col))
        };
    }
    
    // Update movement (called every frame)
    update(deltaTime) {
        // Apply on-screen turning (works even without pointer lock)
        const turnDir = (this.touchTurnLeft ? 1 : 0) + (this.touchTurnRight ? -1 : 0);
        if (turnDir !== 0) {
            this.yaw += turnDir * this.turnSpeedTouch * deltaTime;
        }
        
        // Calculate movement direction based on input (in local space)
        const moveDir = new THREE.Vector3(0, 0, 0);
        
        if (this.keys.w) moveDir.z += 1;  // Forward
        if (this.keys.s) moveDir.z -= 1;  // Backward
        if (this.keys.a) moveDir.x -= 1;  // Left
        if (this.keys.d) moveDir.x += 1;  // Right
        if (this.touchMoveForward) moveDir.z += 1; // Touch/click forward (bottom 30%)
        
        // Normalize diagonal movement
        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
        }
        
        // Apply sprint multiplier
        let speed = this.moveSpeed;
        if (this.keys.shift) {
            speed *= this.sprintMultiplier;
        }
        
        // Rotate movement direction by player yaw
        const rotatedMove = new THREE.Vector3();
        rotatedMove.x = moveDir.x * Math.cos(this.yaw) - moveDir.z * Math.sin(this.yaw);
        rotatedMove.z = moveDir.x * Math.sin(this.yaw) + moveDir.z * Math.cos(this.yaw);
        
        // Apply movement to position
        this.position.x += rotatedMove.x * speed * deltaTime;
        this.position.z += rotatedMove.z * speed * deltaTime;
        
        // Update scene renderer if available
        if (this.sceneRenderer) {
            this.sceneRenderer.updatePlayer(this.position, this.yaw, this.pitch);
        }
        
        // Update game state with grid position
        if (this.grid) {
            const gridPos = this.worldToGrid(this.position);
            const player = gameState.getPlayer();
            player.row = gridPos.row;
            player.col = gridPos.col;
            
            // Update facing direction (convert yaw to grid direction)
            // 0° = right, 60° = up-right, 120° = up-left, 180° = left, etc.
            const normalizedYaw = ((this.yaw % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
            const directionIndex = Math.round(normalizedYaw / (Math.PI / 3)) % 6;
            const directions = ['right', 'up-right', 'up-left', 'left', 'down-left', 'down-right'];
            player.facing = directions[directionIndex];
        }
    }
    
    // Get current position (for other systems)
    getPosition() {
        return this.position.clone();
    }
    
    // Get current yaw
    getYaw() {
        return this.yaw;
    }
    
    // Get current pitch
    getPitch() {
        return this.pitch;
    }
    
    // Get forward direction vector
    getForwardDirection() {
        return new THREE.Vector3(
            -Math.sin(this.yaw),
            0,
            Math.cos(this.yaw)
        );
    }
}

export { SimpleMovement };

