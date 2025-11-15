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
        
        // Grid reference (will be set from index.html)
        this.grid = null;
        
        // Create maze texture (will use fallback until grid is set)
        this.mazeTexture = this.createMazeTexture();
        
        // Load player textures (front and back)
        this.playerTexture = null;
        this.playerBackTexture = null;
        this.loadPlayerTextures();
        
        // Create fullscreen shader (async)
        this.init();
    }
    
    /**
     * Set the grid and regenerate maze texture
     * @param {TriangularGrid} grid - The triangular grid system
     */
    setGrid(grid) {
        this.grid = grid;
        console.log('🎮 SceneRenderer: Grid set, regenerating maze texture...');
        
        // Regenerate maze texture with grid data
        this.mazeTexture = this.createMazeTexture();
        
        // Update shader if it's ready
        if (this.fullscreenQuad) {
            const mazeBitmask = grid.toMazeBitmask();
            const newMazeSize = new THREE.Vector2(mazeBitmask[0].length, mazeBitmask.length);
            
            this.fullscreenQuad.material.uniforms.uMazeTexture.value = this.mazeTexture;
            this.fullscreenQuad.material.uniforms.uMazeSize.value = newMazeSize;
            
            console.log('   └─ Shader texture and size updated to', newMazeSize.x, 'x', newMazeSize.y);
        }
    }
    
    async init() {
        await this.createFullscreenShader();
        this.isReady = true;
        console.log('✅ Scene renderer ready');
    }
    
    createMazeTexture() {
        console.log('🖼️  Creating maze texture from encoded data...');
        
        let encoded;
        
        if (this.grid) {
            // Use grid data (preferred)
            console.log('   └─ Source: TriangularGrid');
            const mazeBitmask = this.grid.toMazeBitmask();
            encoded = this.encodeBitmaskToTexture(mazeBitmask);
        } else {
            // Fallback to maze.js
            console.log('   └─ Source: maze.js fallback (no grid set yet)');
            encoded = encodeToTexture();
        }
        
        console.log('   └─ Encoded dimensions:', encoded.width, 'x', encoded.height);
        console.log('   └─ Sample data [0]:', encoded.data[0], encoded.data[1], encoded.data[2], encoded.data[3]);
        
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
        
        console.log('   └─ Texture created and marked for update');
        
        return texture;
    }
    
    /**
     * Encode bitmask maze data to texture format
     * @param {Array<Array<number>>} mazeBitmask - 2D array of wall bitmasks
     */
    encodeBitmaskToTexture(mazeBitmask) {
        const height = mazeBitmask.length;
        const width = mazeBitmask[0]?.length || 0;
        const data = new Float32Array(height * width * 4);
        
        console.log('🎨 Encoding bitmask to texture...');
        
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const idx = (row * width + col) * 4;
                
                // Determine if triangle points up
                const up = (row + col) % 2 === 0;
                const walls = mazeBitmask[row][col];
                
                data[idx + 0] = up ? 1.0 : 0.0;        // R: orientation
                data[idx + 1] = walls / 7.0;           // G: walls normalized to 0-1
                data[idx + 2] = 0.0;                   // B: reserved
                data[idx + 3] = 1.0;                   // A: reserved
                
                if (row === 0) {
                    console.log(`   └─ Cell [${row},${col}]: walls=${walls} (${walls.toString(2).padStart(3, '0')}b), up=${up}, encoded=${(walls/7.0).toFixed(3)}`);
                }
            }
        }
        
        console.log('   └─ Texture size:', width, 'x', height, '=', width * height, 'cells');
        console.log('   └─ Data array length:', data.length, 'floats');
        
        return {
            data: data,
            width: width,
            height: height
        };
    }
    
    loadPlayerTextures() {
        const loader = new THREE.TextureLoader();
        
        // Load front texture (player.png)
        loader.load(
            './assets/player.png',
            (texture) => {
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                this.playerTexture = texture;
                
                // Update uniform if shader is already loaded
                if (this.fullscreenQuad) {
                    this.fullscreenQuad.material.uniforms.uPlayerTexture.value = texture;
                }
                
                console.log('✅ Player front texture loaded');
            },
            undefined,
            (error) => {
                console.error('❌ Failed to load player front texture:', error);
            }
        );
        
        // Load back texture (player_back.png)
        loader.load(
            './assets/player_back.png',
            (texture) => {
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                this.playerBackTexture = texture;
                
                // Update uniform if shader is already loaded
                if (this.fullscreenQuad) {
                    this.fullscreenQuad.material.uniforms.uPlayerBackTexture.value = texture;
                }
                
                console.log('✅ Player back texture loaded');
            },
            undefined,
            (error) => {
                console.error('❌ Failed to load player back texture:', error);
            }
        );
    }
    
    async createFullscreenShader() {
        // Load shader files
        const vertexShader = await this.loadShader('./scripts/rendering/shaders/raycast.vert.glsl');
        const fragmentShader = await this.loadShader('./scripts/rendering/shaders/raycast.frag.glsl');
        
        // Fullscreen quad geometry
        const geometry = new THREE.PlaneGeometry(2, 2);
        
        // Shader material
        // Get maze size from grid if available, otherwise use fallback
        let mazeWidth, mazeHeight;
        if (this.grid) {
            const mazeBitmask = this.grid.toMazeBitmask();
            mazeWidth = mazeBitmask[0].length;
            mazeHeight = mazeBitmask.length;
        } else {
            mazeWidth = MAZE_COLS;
            mazeHeight = MAZE_ROWS;
        }
        
        console.log('🎬 Creating shader material with uniforms:');
        console.log('   └─ uMazeSize:', mazeWidth, 'x', mazeHeight);
        console.log('   └─ uTriangleSize:', TRIANGLE_SIZE);
        console.log('   └─ uTriangleHeight:', TRIANGLE_HEIGHT);
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uMazeTexture: { value: this.mazeTexture },
                uPlayerTexture: { value: this.playerTexture },
                uPlayerBackTexture: { value: this.playerBackTexture },
                uMazeSize: { value: new THREE.Vector2(mazeWidth, mazeHeight) },
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

