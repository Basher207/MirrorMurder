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
        
        // Compute camera frustum based on maze size so everything fits nicely
        const triangleSize = 1.5;
        const triangleHeight = (Math.sqrt(3) / 2) * triangleSize;
        const worldWidth = MAZE_COLS * triangleSize;
        const worldHeight = MAZE_ROWS * triangleHeight;
        const halfExtent = Math.max(worldWidth, worldHeight) * 0.6;

        // Create orthographic camera for top-down view
        this.camera = new THREE.OrthographicCamera(
            -halfExtent, halfExtent,  // left, right
            halfExtent, -halfExtent,  // top, bottom
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
        const halfSize = triangleSize / 2;
        
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
                this.scene.add(floorMesh);
                
                // Precompute triangle corner positions in world space (XZ plane)
                let pA, pB, pC;
                if (isPointingUp) {
                    // Upward triangle: apex at top, base at bottom
                    pA = new THREE.Vector3(x, 0.01, z - triangleHeight / 2);          // top
                    pB = new THREE.Vector3(x - halfSize, 0.01, z + triangleHeight / 2); // bottom left
                    pC = new THREE.Vector3(x + halfSize, 0.01, z + triangleHeight / 2); // bottom right
                } else {
                    // Downward triangle: apex at bottom, base at top
                    pA = new THREE.Vector3(x, 0.01, z + triangleHeight / 2);          // bottom
                    pB = new THREE.Vector3(x - halfSize, 0.01, z - triangleHeight / 2); // top left
                    pC = new THREE.Vector3(x + halfSize, 0.01, z - triangleHeight / 2); // top right
                }
                
                // Create walls based on cell value
                const wallHeight = 0.5;
                const wallThickness = 0.1;
                
                if (hasWall(cellValue, WALLS.NORTH)) {
                    // Horizontal edge at the "north" side of the triangle
                    const wall = this.createWallBetween(
                        isPointingUp ? pB : pB, // left point of the top/base edge
                        isPointingUp ? pC : pC, // right point of the top/base edge
                        wallHeight,
                        wallThickness,
                        wallMaterial
                    );
                    this.scene.add(wall);
                }
                
                if (hasWall(cellValue, WALLS.SOUTH_WEST)) {
                    // Edge from apex to left base corner
                    const wall = this.createWallBetween(
                        pA,
                        pB,
                        wallHeight,
                        wallThickness,
                        wallMaterial
                    );
                    this.scene.add(wall);
                }
                
                if (hasWall(cellValue, WALLS.SOUTH_EAST)) {
                    // Edge from apex to right base corner
                    const wall = this.createWallBetween(
                        pA,
                        pC,
                        wallHeight,
                        wallThickness,
                        wallMaterial
                    );
                    this.scene.add(wall);
                }
            }
        }
    }
    
    createTriangleGeometry(size, pointingUp) {
        // Triangle geometry directly in the XZ plane (y = 0)
        const height = (Math.sqrt(3) / 2) * size;
        const geometry = new THREE.BufferGeometry();

        let vertices;
        if (pointingUp) {
            // Apex at top, base at bottom
            vertices = new Float32Array([
                0, 0, -height / 2,          // Top
                -size / 2, 0, height / 2,   // Bottom left
                size / 2, 0, height / 2     // Bottom right
            ]);
        } else {
            // Apex at bottom, base at top
            vertices = new Float32Array([
                0, 0, height / 2,           // Bottom
                -size / 2, 0, -height / 2,  // Top left
                size / 2, 0, -height / 2    // Top right
            ]);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();

        return geometry;
    }
    
    createWallBetween(pointA, pointB, height, thickness, baseMaterial) {
        const length = pointA.distanceTo(pointB);
        const geometry = new THREE.BoxGeometry(length, height, thickness);
        const material = baseMaterial.clone();

        const wall = new THREE.Mesh(geometry, material);

        // Position at the midpoint between the two points
        const midpoint = new THREE.Vector3().addVectors(pointA, pointB).multiplyScalar(0.5);
        wall.position.copy(midpoint);
        wall.position.y = height / 2;

        // Rotate to align with the edge
        const dx = pointB.x - pointA.x;
        const dz = pointB.z - pointA.z;
        wall.rotation.y = Math.atan2(dz, dx);

        return wall;
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

