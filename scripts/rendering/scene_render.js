// Scene Renderer - Fullscreen Raycast Shader
// Renders the first-person view using GPU raycasting

import * as THREE from 'three';
import { 
    MAZE_ROWS, 
    MAZE_COLS, 
    TRIANGLE_SIZE, 
    TRIANGLE_HEIGHT,
    encodeToTexture 
} from '../maze.js';

class SceneRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.isReady = false;
        
        // Create Three.js renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: false 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Create scene and camera (camera just for the fullscreen quad)
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // Player position and orientation
        this.playerPos = new THREE.Vector3(5, 0.8, 5); // Y is eye height
        this.playerYaw = 0; // Rotation around Y axis (radians)
        this.playerPitch = 0; // Look up/down (radians)
        
        // Camera settings
        this.fov = 75 * Math.PI / 180; // Field of view in radians
        
        // Create maze texture
        this.mazeTexture = this.createMazeTexture();
        
        // Create fullscreen shader (async)
        this.init();
    }
    
    async init() {
        await this.createFullscreenShader();
        this.isReady = true;
        console.log('✅ Scene renderer ready');
    }
    
    createMazeTexture() {
        const encoded = encodeToTexture();
        
        const texture = new THREE.DataTexture(
            encoded.data,
            encoded.width,
            encoded.height,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        
        return texture;
    }
    
    async createFullscreenShader() {
        // Load shader files
        const vertexShader = await this.loadShader('./scripts/rendering/shaders/raycast.vert.glsl');
        const fragmentShader = await this.loadShader('./scripts/rendering/shaders/raycast.frag.glsl');
        
        // Fullscreen quad geometry
        const geometry = new THREE.PlaneGeometry(2, 2);
        
        // Shader material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uMazeTexture: { value: this.mazeTexture },
                uMazeSize: { value: new THREE.Vector2(MAZE_COLS, MAZE_ROWS) },
                uTriangleSize: { value: TRIANGLE_SIZE },
                uTriangleHeight: { value: TRIANGLE_HEIGHT },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                uPlayerPos: { value: this.playerPos },
                uPlayerYaw: { value: this.playerYaw },
                uPlayerPitch: { value: this.playerPitch },
                uFov: { value: this.fov },
                uTime: { value: 0 }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            depthWrite: false,
            depthTest: false
        });
        
        this.fullscreenQuad = new THREE.Mesh(geometry, material);
        this.scene.add(this.fullscreenQuad);
    }
    
    async loadShader(path) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load shader: ${path}`);
        }
        return await response.text();
    }
    
    // Update player position/rotation (will be called by game loop)
    updatePlayer(pos, yaw, pitch) {
        if (pos) this.playerPos.copy(pos);
        if (yaw !== undefined) this.playerYaw = yaw;
        if (pitch !== undefined) this.playerPitch = pitch;
    }
    
    // Update uniforms every frame
    update(deltaTime) {
        if (!this.isReady) return;
        
        const uniforms = this.fullscreenQuad.material.uniforms;
        uniforms.uPlayerPos.value.copy(this.playerPos);
        uniforms.uPlayerYaw.value = this.playerYaw;
        uniforms.uPlayerPitch.value = this.playerPitch;
        uniforms.uTime.value += deltaTime;
    }
    
    // Render the scene
    render() {
        if (!this.isReady) return;
        this.renderer.render(this.scene, this.camera);
    }
    
    // Handle window resize
    handleResize(width, height) {
        this.renderer.setSize(width, height);
        if (this.isReady) {
            this.fullscreenQuad.material.uniforms.uResolution.value.set(width, height);
        }
    }
    
    // Get player position (for other systems to query)
    getPlayerPosition() {
        return this.playerPos.clone();
    }
    
    // Get player direction (for other systems to query)
    getPlayerDirection() {
        let dir = new THREE.Vector3(0, 0, 1);
        dir = dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.playerPitch);
        dir = dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerYaw);
        return dir;
    }
}

export { SceneRenderer };

