// Maze Minimap
// Renders a 2D top-down view of the maze in the corner of the screen

class MazeMinimap {
    constructor(containerElement) {
        this.container = containerElement;
        this.canvas = null;
        this.grid = null;
        this.needsRedraw = true;
        
        this.initCanvas();
    }
    
    initCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            border: 3px solid #00ff00;
            background: #1a1a1a;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
            z-index: 1000;
        `;
        this.container.appendChild(this.canvas);
        
        // Set initial size
        this.resize(250, 250);
    }
    
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.needsRedraw = true;
    }
    
    /**
     * Set the grid to visualize
     * @param {TriangularGrid} grid - The grid system to visualize
     */
    setGrid(grid) {
        this.grid = grid;
        this.needsRedraw = true;
        console.log('Minimap: Grid set with', grid.getRowCount(), 'rows');
    }
    
    /**
     * Draw the triangular grid on the minimap
     */
    drawGrid(playerPos = null, playerYaw = null) {
        const ctx = this.canvas.getContext('2d');
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas with visible background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        if (!this.grid) {
            // Draw "No Grid" message
            ctx.fillStyle = '#00ff00';
            ctx.font = '16px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('No Grid Loaded', width / 2, height / 2);
            return;
        }

        const numRows = this.grid.getRowCount();
        if (numRows === 0) {
            ctx.fillStyle = '#ff0000';
            ctx.font = '16px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('Empty Grid', width / 2, height / 2);
            return;
        }

        // Calculate triangle size based on canvas dimensions with padding
        const padding = 10;
        const drawWidth = width - (padding * 2);
        const drawHeight = height - (padding * 2);
        
        const maxTrianglesPerRow = Math.max(...Array.from({length: numRows}, (_, i) => this.grid.getRowLength(i)));
        
        // For triangular tessellation:
        // - Each triangle has width of base
        // - Height is sqrt(3)/2 * base for equilateral triangles
        // - Rows are offset by half the height
        const triangleWidth = drawWidth / maxTrianglesPerRow;
        const triangleHeight = (Math.sqrt(3) / 2) * triangleWidth;
        const rowHeight = triangleHeight; // Each row takes full height

        // Store scale for player position calculation
        const worldToScreenScale = triangleWidth / 2.0; // World units to screen pixels

        // Draw each triangle
        for (let row = 0; row < numRows; row++) {
            const rowLength = this.grid.getRowLength(row);
            
            for (let col = 0; col < rowLength; col++) {
                const triangle = this.grid.getTriangle(row, col);
                if (!triangle) continue;

                // X position - each triangle takes half the width space
                const x = padding + (col * triangleWidth / 2);
                
                // Y position - each row is offset by the triangle height
                const y = padding + (row * rowHeight);

                this.drawTriangle(ctx, triangle, x, y, triangleWidth, triangleHeight);
            }
        }
        
        // Draw player position if available
        if (playerPos) {
            this.drawPlayer(ctx, playerPos, playerYaw, padding, worldToScreenScale, triangleHeight);
        }
    }

    /**
     * Draw a single triangle with its sides
     */
    drawTriangle(ctx, triangle, x, y, width, height) {
        // Draw triangle fill
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        
        if (triangle.pointsUp) {
            // Up-pointing triangle: apex at top
            ctx.moveTo(x + width / 2, y);           // Top point
            ctx.lineTo(x + width, y + height);      // Bottom right
            ctx.lineTo(x, y + height);              // Bottom left
        } else {
            // Down-pointing triangle: apex at bottom
            ctx.moveTo(x, y);                       // Top left
            ctx.lineTo(x + width, y);               // Top right
            ctx.lineTo(x + width / 2, y + height);  // Bottom point
        }
        
        ctx.closePath();
        ctx.fill();

        // Draw sides based on their state
        ctx.lineWidth = 2;
        
        // Draw left side
        this.drawSide(ctx, triangle, 'left', x, y, width, height);
        
        // Draw right side
        this.drawSide(ctx, triangle, 'right', x, y, width, height);
        
        // Draw third side (top/bottom)
        this.drawSide(ctx, triangle, 'third', x, y, width, height);
    }

    /**
     * Draw a specific side of a triangle
     */
    drawSide(ctx, triangle, side, x, y, width, height) {
        const sideState = triangle.getSideState(side);
        
        // Set color based on side state
        if (sideState === 'mirror') {
            ctx.strokeStyle = '#00ff00'; // Bright green for mirrors
        } else if (sideState === 'empty') {
            ctx.strokeStyle = '#555555'; // Medium gray for empty
        } else {
            ctx.strokeStyle = '#777777'; // Light gray for default
        }

        ctx.beginPath();
        
        if (triangle.pointsUp) {
            // Up-pointing triangle
            switch (side) {
                case 'left':
                    ctx.moveTo(x, y + height);
                    ctx.lineTo(x + width / 2, y);
                    break;
                case 'right':
                    ctx.moveTo(x + width / 2, y);
                    ctx.lineTo(x + width, y + height);
                    break;
                case 'third': // bottom
                    ctx.moveTo(x, y + height);
                    ctx.lineTo(x + width, y + height);
                    break;
            }
        } else {
            // Down-pointing triangle
            switch (side) {
                case 'left':
                    ctx.moveTo(x + width / 2, y + height);
                    ctx.lineTo(x, y);
                    break;
                case 'right':
                    ctx.moveTo(x + width, y);
                    ctx.lineTo(x + width / 2, y + height);
                    break;
                case 'third': // top
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + width, y);
                    break;
            }
        }
        
        ctx.stroke();
    }
    
    /**
     * Draw the player position and direction
     */
    drawPlayer(ctx, playerPos, playerYaw, padding, worldToScreenScale, triangleHeight) {
        // Convert world position to screen position
        // World coordinates: x and z
        // Screen coordinates: based on triangular grid layout
        const screenX = padding + (playerPos.x * worldToScreenScale);
        const screenY = padding + (playerPos.z / (Math.sqrt(3) / 2) * worldToScreenScale);
        
        // Draw player circle
        ctx.fillStyle = '#ff00ff'; // Magenta for player
        ctx.strokeStyle = '#ffffff'; // White outline
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw direction indicator if yaw is provided
        if (playerYaw !== null && playerYaw !== undefined) {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            // Direction line pointing in the direction the player is facing
            // Yaw is rotation around Y axis, where 0 points in positive Z direction
            const dirLength = 10;
            const dirX = screenX - Math.sin(playerYaw) * dirLength;
            const dirY = screenY + Math.cos(playerYaw) * dirLength;
            ctx.lineTo(dirX, dirY);
            ctx.stroke();
        }
    }
    
    render(playerPos = null, playerYaw = null) {
        this.drawGrid(playerPos, playerYaw);
        this.needsRedraw = false;
    }
    
    handleResize(width, height) {
        // Keep minimap at a reasonable fixed size
        const minimapSize = Math.min(Math.min(width, height) * 0.3, 300);
        this.resize(minimapSize, minimapSize);
    }
    
    destroy() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

export { MazeMinimap };

