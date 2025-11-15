// Maze Minimap Renderer using Three.js
// Renders a top-down view of the triangular maze in the top-right corner

import { 
    MAZE_ROWS, 
    MAZE_COLS, 
    TRIANGLE_SIZE,
    TRIANGLE_HEIGHT,
    getCell,
    hasWall,
    isPointingUp,
    getTriangleVertices,
    getEdgeVertices
} from '../maze.js';
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
        // Use maze constants scaled down for minimap
        const scale = 0.75;
        
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
        const offsetX = -(MAZE_COLS * TRIANGLE_SIZE * scale) / 2;
        const offsetZ = -(MAZE_ROWS * TRIANGLE_HEIGHT * scale) / 2;
        
        // Create floor and walls for each triangle
        for (let row = 0; row < MAZE_ROWS; row++) {
            for (let col = 0; col < MAZE_COLS; col++) {
                const cellValue = getCell(row, col);
                const up = isPointingUp(row, col);
                
                // Get triangle vertices from maze.js (world space)
                const worldVertices = getTriangleVertices(row, col);
                
                // Scale and offset for minimap, convert to THREE.Vector3
                const vertices = worldVertices.map(v => new THREE.Vector3(
                    v.x * scale + offsetX,
                    0,
                    v.z * scale + offsetZ
                ));
                
                // Create floor triangle using actual vertices
                const floorGeometry = this.createTriangleFromVertices(vertices);
                const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
                this.scene.add(floorMesh);
                
                // Create walls based on edge data
                const wallHeight = 0.5;
                const wallThickness = 0.08;
                
                // Check each of the 3 edges
                for (let edgeIndex = 0; edgeIndex < 3; edgeIndex++) {
                    if (hasWall(cellValue, edgeIndex)) {
                        // Get edge vertices from maze.js
                        const worldEdge = getEdgeVertices(row, col, edgeIndex);
                        const edgeStart = new THREE.Vector3(
                            worldEdge[0].x * scale + offsetX,
                            0,
                            worldEdge[0].z * scale + offsetZ
                        );
                        const edgeEnd = new THREE.Vector3(
                            worldEdge[1].x * scale + offsetX,
                            0,
                            worldEdge[1].z * scale + offsetZ
                        );
                        
                        // Create wall between these points
                        const wall = this.createWallBetween(
                            edgeStart, 
                            edgeEnd, 
                            wallHeight, 
                            wallThickness, 
                            wallMaterial
                        );
                        this.scene.add(wall);
                    }
                }
            }
        }
    }
    
    createTriangleFromVertices(vertices) {
        // vertices is an array of 3 THREE.Vector3 objects
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array([
            vertices[0].x, vertices[0].y, vertices[0].z,
            vertices[1].x, vertices[1].y, vertices[1].z,
            vertices[2].x, vertices[2].y, vertices[2].z
        ]);
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
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

