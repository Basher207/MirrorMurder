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
import { PlayerAnimation } from './player.js';
import gameState from '../player_logic/game_state.js';

// Constants
const EYE_HEIGHT = 0.8; // Player eye height in world units

class SceneRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.isReady = false;
        
        // Store render dimensions
        this.renderScale = 1.0;
        this.renderHeight = window.innerHeight * this.renderScale;
        this.renderWidth = window.innerWidth * this.renderScale;
        
        // Create Three.js renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: false 
        });
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(this.innerWidth, this.innerHeight, false);
        
        // Create scene and camera (camera just for the fullscreen quad)
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // Player position and orientation - START AT GRID (0,0)
        // Grid (0,0) with orientation 'left' should be the starting position
        this.playerPos = new THREE.Vector3(0.425, EYE_HEIGHT, 0.367); // Starting at grid (0,0)
        this.playerYaw = Math.PI * 2 / 3; // 120 degrees for 'left' orientation on up-pointing triangle
        this.playerPitch = 0; // Look up/down (radians)
        
        // Camera settings
        this.fov = 75 * Math.PI / 180; // Field of view in radians
        
        // Grid reference (will be set from index.html)
        this.grid = null;
        
        // Create maze texture (will use fallback until grid is set)
        this.mazeTexture = this.createMazeTexture();
        
        // Create player animation system
        this.playerAnimation = new PlayerAnimation();
        
        // Load player back texture
        this.playerBackTexture = null;
        this.loadPlayerBackTexture();
        
        // Load mirror texture
        this.mirrorTexture = null;
        this.loadMirrorTexture();
        
        // Load floor texture
        this.floorTexture = null;
        this.loadFloorTexture();
        
        // Load monster texture
        this.monsterTexture = null;
        this.loadMonsterTexture();
        
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
        
        // Calculate center of maze and position player there
        const mazeBitmask = grid.toMazeBitmask();
        const mazeWidth = mazeBitmask[0].length;
        const mazeHeight = mazeBitmask.length;
        
        // Calculate center position in world coordinates
        // The maze spans from x=0 to approximately mazeWidth * TRIANGLE_SIZE * 0.5
        // Each column adds TRIANGLE_SIZE * 0.5 to the width
        // But the first triangle extends from x=0 to x=TRIANGLE_SIZE
        const totalWidth = (mazeWidth - 1) * TRIANGLE_SIZE * 0.5 + TRIANGLE_SIZE;
        const totalHeight = mazeHeight * TRIANGLE_HEIGHT;
        
        const centerX = totalWidth / 2;
        const centerZ = totalHeight / 2;
        
        // Set player position to center (Y is eye height)
        this.playerPos.set(centerX + TRIANGLE_SIZE / 3, EYE_HEIGHT, centerZ + TRIANGLE_HEIGHT / 2);
        
        console.log(`   └─ Maze dimensions: ${mazeWidth} cols x ${mazeHeight} rows`);
        console.log(`   └─ World size: ${totalWidth.toFixed(2)} x ${totalHeight.toFixed(2)}`);
        console.log(`   └─ Player positioned at center: (${centerX.toFixed(2)}, ${EYE_HEIGHT}, ${centerZ.toFixed(2)})`);
        
        // Update shader if it's ready
        if (this.fullscreenQuad) {
            const newMazeSize = new THREE.Vector2(mazeWidth, mazeHeight);
            
            this.fullscreenQuad.material.uniforms.uMazeTexture.value = this.mazeTexture;
            this.fullscreenQuad.material.uniforms.uMazeSize.value = newMazeSize;
            this.fullscreenQuad.material.uniforms.uPlayerPos.value.copy(this.playerPos);
            
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
    
    loadPlayerBackTexture() {
        const loader = new THREE.TextureLoader();
        
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
    
    loadMirrorTexture() {
        const loader = new THREE.TextureLoader();
        
        // Load mirror texture (mirror.png)
        loader.load(
            './assets/mirror.png',
            (texture) => {
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                this.mirrorTexture = texture;
                
                // Update uniform if shader is already loaded
                if (this.fullscreenQuad) {
                    this.fullscreenQuad.material.uniforms.uMirrorTexture.value = texture;
                }
                
                console.log('✅ Mirror texture loaded');
            },
            undefined,
            (error) => {
                console.error('❌ Failed to load mirror texture:', error);
            }
        );
    }
    
    loadFloorTexture() {
        const loader = new THREE.TextureLoader();
        
        // Load floor texture (floor.jpg)
        loader.load(
            './assets/floor.jpg',
            (texture) => {
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                this.floorTexture = texture;
                
                // Update uniform if shader is already loaded
                if (this.fullscreenQuad) {
                    this.fullscreenQuad.material.uniforms.uFloorTexture.value = texture;
                }
                
                console.log('✅ Floor texture loaded');
            },
            undefined,
            (error) => {
                console.error('❌ Failed to load floor texture:', error);
            }
        );
    }
    
    loadMonsterTexture() {
        const loader = new THREE.TextureLoader();
        
        // Load monster texture (monster_v2.png)
        loader.load(
            './assets/player/monster_v2.png',
            (texture) => {
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                this.monsterTexture = texture;
                
                // Update uniform if shader is already loaded
                if (this.fullscreenQuad) {
                    this.fullscreenQuad.material.uniforms.uMonsterTexture.value = texture;
                }
                
                console.log('✅ Monster texture loaded');
            },
            undefined,
            (error) => {
                console.error('❌ Failed to load monster texture:', error);
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
                uPlayerTexture: { value: this.playerAnimation.getCurrentFrame() },
                uPlayerBackTexture: { value: this.playerBackTexture },
                uMirrorTexture: { value: this.mirrorTexture },
                uFloorTexture: { value: this.floorTexture },
                uMonsterTexture: { value: this.monsterTexture },
                uMazeSize: { value: new THREE.Vector2(mazeWidth, mazeHeight) },
                uTriangleSize: { value: TRIANGLE_SIZE },
                uTriangleHeight: { value: TRIANGLE_HEIGHT },
                // Internal render resolution (half-size of window by default)
                uResolution: { value: new THREE.Vector2(this.renderWidth, this.renderHeight) },
                uPlayerPos: { value: this.playerPos },
                uPlayerYaw: { value: this.playerYaw },
                uPlayerPitch: { value: this.playerPitch },
                uEnemyPos: { value: new THREE.Vector3(0, EYE_HEIGHT, 0) },
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
        
        // Update player animation
        this.playerAnimation.update(deltaTime);
        
        const uniforms = this.fullscreenQuad.material.uniforms;
        uniforms.uPlayerPos.value.copy(this.playerPos);
        uniforms.uPlayerYaw.value = this.playerYaw;
        uniforms.uPlayerPitch.value = this.playerPitch;
        uniforms.uTime.value += deltaTime;
        
        // Update enemy position from game state
        if (this.grid) {
            const enemy = gameState.getEnemy();
            const enemyWorldPos = this.gridToWorldPosition(enemy.row, enemy.col);
            uniforms.uEnemyPos.value.set(enemyWorldPos.x, enemyWorldPos.y, enemyWorldPos.z);
        }
        
        // Update player texture with current animation frame
        const currentFrame = this.playerAnimation.getCurrentFrame();
        if (currentFrame) {
            uniforms.uPlayerTexture.value = currentFrame;
        }
    }
    
    // Render the scene
    render() {
        if (!this.isReady) return;
        this.renderer.render(this.scene, this.camera);
    }
    
    // Handle window resize
    handleResize(width, height) {
        this.renderWidth = width * this.renderScale;
        this.renderHeight = height * this.renderScale;
        this.renderer.setSize(width, height, false);
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
    
    // Convert grid coordinates to world coordinates
    gridToWorldPosition(row, col) {
        const x = col * TRIANGLE_SIZE * 0.5 + TRIANGLE_SIZE / 2;
        const z = row * TRIANGLE_HEIGHT + TRIANGLE_HEIGHT / 2;
        const y = EYE_HEIGHT; // Eye height
        
        return { x, y, z };
    }
}

export { SceneRenderer, EYE_HEIGHT };

