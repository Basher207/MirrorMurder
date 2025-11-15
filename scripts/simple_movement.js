// Simple Movement Controller
// Handles WASD movement and mouse look

import * as THREE from 'three';

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
        this.moveSpeed = 5.0; // Units per second
        this.sprintMultiplier = 2.0;
        this.mouseSensitivity = 0.002; // Radians per pixel
        
        // Player state (will be synced with scene renderer)
        this.position = new THREE.Vector3(5, 0.8, 5);
        this.yaw = 0;
        this.pitch = 0;
        
        // Reference to scene renderer (set by game loop)
        this.sceneRenderer = null;
        
        // Setup input listeners
        this.setupInputListeners();
    }
    
    setupInputListeners() {
        // Keyboard listeners
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Mouse lock listeners
        document.addEventListener('click', () => this.requestPointerLock());
        document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
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
    
    // Set reference to scene renderer
    setSceneRenderer(sceneRenderer) {
        this.sceneRenderer = sceneRenderer;
        // Sync initial position from renderer
        this.position.copy(sceneRenderer.playerPos);
        this.yaw = sceneRenderer.playerYaw;
        this.pitch = sceneRenderer.playerPitch;
    }
    
    // Update movement (called every frame)
    update(deltaTime) {
        if (!this.mouseLocked) return;
        
        // Calculate movement direction based on input
        const moveDir = new THREE.Vector3(0, 0, 0);
        
        if (this.keys.w) moveDir.z += 1;
        if (this.keys.s) moveDir.z -= 1;
        if (this.keys.a) moveDir.x += 1;
        if (this.keys.d) moveDir.x -= 1;
        
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

