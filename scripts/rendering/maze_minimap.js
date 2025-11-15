// Maze Minimap Renderer using Three.js
// Renders a top-down view of the triangular maze in the top-right corner

import { maze, WALLS, MAZE_ROWS, MAZE_COLS, hasWall } from '../maze.js';
import * as THREE from 'three';

class MazeMinimap {
    constructor(containerElement) {
        this.container = containerElement;
        
        // Minimap settings
        this.minimapSize = 250; // Size in pixels
        this.padding = 20; // Padding from corner
        
        // Create Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2a2a2a);
        
        // Create orthographic camera for top-down view
        const aspect = 1; // Square minimap
        this.camera = new THREE.OrthographicCamera(
            -5, 5,  // left, right
            5, -5,  // top, bottom
            0.1, 100
        );
        this.camera.position.set(0, 10, 0);
        this.camera.lookAt(0, 0, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(this.minimapSize, this.minimapSize);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = `${this.padding}px`;
        this.renderer.domElement.style.right = `${this.padding}px`;
        this.renderer.domElement.style.border = '2px solid #4a4a4a';
        this.renderer.domElement.style.borderRadius = '8px';
        this.renderer.domElement.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.5)';
        this.renderer.domElement.style.zIndex = '1000';
        
        // Add renderer to container
        this.container.appendChild(this.renderer.domElement);
        
        // Build the maze geometry
        this.buildMaze();
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(0, 10, 5);
        this.scene.add(directionalLight);
    }
    
    buildMaze() {
        // Triangle dimensions
        const triangleSize = 1.5;
        const triangleHeight = (Math.sqrt(3) / 2) * triangleSize;
        
        // Materials
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3a3a3a,
            metalness: 0.1,
            roughness: 0.8
        });
        
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00aaff,
            metalness: 0.3,
            roughness: 0.6,
            emissive: 0x0055aa,
            emissiveIntensity: 0.2
        });
        
        // Center the maze
        const offsetX = -(MAZE_COLS * triangleSize) / 2;
        const offsetZ = -(MAZE_ROWS * triangleHeight) / 2;
        
        // Create floor and walls for each triangle
        for (let row = 0; row < MAZE_ROWS; row++) {
            for (let col = 0; col < MAZE_COLS; col++) {
                const cellValue = maze[row][col];
                
                // Calculate position
                const isPointingUp = (row + col) % 2 === 0;
                const x = col * triangleSize + offsetX;
                const z = row * triangleHeight + offsetZ;
                
                // Create floor triangle
                const floorGeometry = this.createTriangleGeometry(triangleSize, isPointingUp);
                const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
                floorMesh.position.set(x, 0, z);
                floorMesh.rotation.x = -Math.PI / 2;
                this.scene.add(floorMesh);
                
                // Create walls based on cell value
                const wallHeight = 0.5;
                const wallThickness = 0.1;
                
                if (hasWall(cellValue, WALLS.NORTH)) {
                    const wall = this.createWall(triangleSize, wallHeight, wallThickness);
                    if (isPointingUp) {
                        wall.position.set(x, wallHeight / 2, z - triangleHeight / 2);
                        wall.rotation.y = 0;
                    } else {
                        wall.position.set(x, wallHeight / 2, z + triangleHeight / 2);
                        wall.rotation.y = 0;
                    }
                    wall.material = wallMaterial.clone();
                    this.scene.add(wall);
                }
                
                if (hasWall(cellValue, WALLS.SOUTH_WEST)) {
                    const wall = this.createWall(triangleSize, wallHeight, wallThickness);
                    if (isPointingUp) {
                        wall.position.set(x - triangleSize / 4, wallHeight / 2, z + triangleHeight / 4);
                        wall.rotation.y = Math.PI / 3;
                    } else {
                        wall.position.set(x - triangleSize / 4, wallHeight / 2, z - triangleHeight / 4);
                        wall.rotation.y = -Math.PI / 3;
                    }
                    wall.material = wallMaterial.clone();
                    this.scene.add(wall);
                }
                
                if (hasWall(cellValue, WALLS.SOUTH_EAST)) {
                    const wall = this.createWall(triangleSize, wallHeight, wallThickness);
                    if (isPointingUp) {
                        wall.position.set(x + triangleSize / 4, wallHeight / 2, z + triangleHeight / 4);
                        wall.rotation.y = -Math.PI / 3;
                    } else {
                        wall.position.set(x + triangleSize / 4, wallHeight / 2, z - triangleHeight / 4);
                        wall.rotation.y = Math.PI / 3;
                    }
                    wall.material = wallMaterial.clone();
                    this.scene.add(wall);
                }
            }
        }
    }
    
    createTriangleGeometry(size, pointingUp) {
        const height = (Math.sqrt(3) / 2) * size;
        const geometry = new THREE.BufferGeometry();
        
        let vertices;
        if (pointingUp) {
            vertices = new Float32Array([
                0, height / 2, 0,           // Top
                -size / 2, -height / 2, 0,  // Bottom left
                size / 2, -height / 2, 0    // Bottom right
            ]);
        } else {
            vertices = new Float32Array([
                0, -height / 2, 0,          // Bottom
                -size / 2, height / 2, 0,   // Top left
                size / 2, height / 2, 0     // Top right
            ]);
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();
        
        return geometry;
    }
    
    createWall(length, height, thickness) {
        const geometry = new THREE.BoxGeometry(length, height, thickness);
        const material = new THREE.MeshStandardMaterial({ color: 0x00aaff });
        return new THREE.Mesh(geometry, material);
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
    handleResize(width, height) {
        // Minimap stays fixed size, but we could adjust position if needed
        // For now, CSS handles the positioning
    }
    
    destroy() {
        // Cleanup
        if (this.renderer.domElement.parentElement) {
            this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
        }
        this.renderer.dispose();
    }
}

export { MazeMinimap };

