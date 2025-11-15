// Maze Minimap
// Renders a 2D top-down view of the maze in the corner of the screen

import { TRIANGLE_SIZE, TRIANGLE_HEIGHT } from '../maze.js';

class MazeMinimap {
    constructor(containerElement) {
        this.container = containerElement;
        this.canvas = null;
        this.grid = null;
        this.gameState = null;
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
        
        // Set initial size - increased from 250x250
        this.resize(400, 400);
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
     * Set the game state to access player and enemy positions
     * @param {GameState} gameState - The game state instance
     */
    setGameState(gameState) {
        this.gameState = gameState;
        this.needsRedraw = true;
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
        const padding = 20;
        const drawWidth = width - (padding * 2);
        const drawHeight = height - (padding * 2);
        
        const maxTrianglesPerRow = Math.max(...Array.from({length: numRows}, (_, i) => this.grid.getRowLength(i)));
        
        // For triangular tessellation:
        // Each column is half a triangle width, so total width = (maxTriangles / 2) * triangleWidth
        // Calculate based on both width and height constraints
        const triangleWidthFromWidth = (drawWidth * 2) / maxTrianglesPerRow;
        const triangleHeightFromWidth = (Math.sqrt(3) / 2) * triangleWidthFromWidth;
        const totalHeightFromWidth = numRows * triangleHeightFromWidth;
        
        // If height-constrained, calculate from height
        const triangleHeightFromHeight = drawHeight / numRows;
        const triangleWidthFromHeight = triangleHeightFromHeight / (Math.sqrt(3) / 2);
        
        // Use whichever gives us the largest fit
        let triangleWidth, triangleHeight;
        if (totalHeightFromWidth <= drawHeight) {
            // Width-constrained
            triangleWidth = triangleWidthFromWidth;
            triangleHeight = triangleHeightFromWidth;
        } else {
            // Height-constrained
            triangleWidth = triangleWidthFromHeight;
            triangleHeight = triangleHeightFromHeight;
        }
        
        const rowHeight = triangleHeight;

        // Calculate offset to center the grid
        const totalWidth = (maxTrianglesPerRow / 2) * triangleWidth;
        const totalHeight = numRows * rowHeight;
        const offsetX = padding + (drawWidth - totalWidth) / 2;
        const offsetY = padding + (drawHeight - totalHeight) / 2;

        // Draw each triangle
        for (let row = 0; row < numRows; row++) {
            const rowLength = this.grid.getRowLength(row);
            
            for (let col = 0; col < rowLength; col++) {
                const triangle = this.grid.getTriangle(row, col);
                if (!triangle) continue;

                // X position - each triangle takes half the width space
                const x = offsetX + (col * triangleWidth / 2);
                
                // Y position - each row is offset by the triangle height
                const y = offsetY + (row * rowHeight);

                this.drawTriangle(ctx, triangle, x, y, triangleWidth, triangleHeight);
            }
        }

        // Draw character markers
        if (this.gameState) {
            this.drawCharacterMarkers(ctx, offsetX, offsetY, triangleWidth, triangleHeight, rowHeight);
        }
        
        // Draw player position if available
        if (playerPos) {
            this.drawPlayer(
                ctx,
                playerPos,
                playerYaw,
                offsetX,
                offsetY,
                triangleWidth,
                triangleHeight
            );
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
     * Draw player and enemy markers
     */
    drawCharacterMarkers(ctx, offsetX, offsetY, triangleWidth, triangleHeight, rowHeight) {
        const player = this.gameState.getPlayer();
        const enemy = this.gameState.getEnemy();

        // Draw player (blue dot with arrow)
        if (player) {
            const playerX = offsetX + (player.col * triangleWidth / 2) + triangleWidth / 2;
            const playerY = offsetY + (player.row * rowHeight) + triangleHeight / 2;
            
            // Draw the dot
            ctx.fillStyle = '#0088ff';
            ctx.beginPath();
            ctx.arc(playerX, playerY, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw a border around the dot
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            // Draw orientation arrow
            const playerTriangle = this.grid.getTriangle(player.row, player.col);
            if (playerTriangle) {
                this.drawOrientationArrow(ctx, playerX, playerY, player.orientation, playerTriangle.pointsUp, '#0088ff', triangleWidth, triangleHeight);
            }
        }

        // Draw enemy (red square with arrow)
        if (enemy) {
            const enemyX = offsetX + (enemy.col * triangleWidth / 2) + triangleWidth / 2;
            const enemyY = offsetY + (enemy.row * rowHeight) + triangleHeight / 2;
            
            const squareSize = 10;
            // Draw the square
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(
                enemyX - squareSize / 2,
                enemyY - squareSize / 2,
                squareSize,
                squareSize
            );
            
            // Draw a border around the square
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(
                enemyX - squareSize / 2,
                enemyY - squareSize / 2,
                squareSize,
                squareSize
            );
            
            // Draw orientation arrow
            const enemyTriangle = this.grid.getTriangle(enemy.row, enemy.col);
            if (enemyTriangle) {
                this.drawOrientationArrow(ctx, enemyX, enemyY, enemy.orientation, enemyTriangle.pointsUp, '#ff0000', triangleWidth, triangleHeight);
            }
        }
    }

    /**
     * Draw an arrow showing which direction a character is facing
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - Character center X
     * @param {number} y - Character center Y
     * @param {string} orientation - 'left', 'right', or 'third'
     * @param {boolean} pointsUp - Whether the triangle points up
     * @param {string} color - Arrow color
     * @param {number} triangleWidth - Width of the triangle
     * @param {number} triangleHeight - Height of the triangle
     */
    drawOrientationArrow(ctx, x, y, orientation, pointsUp, color, triangleWidth, triangleHeight) {
        const arrowLength = Math.min(triangleWidth, triangleHeight) * 0.25;
        const arrowHeadSize = arrowLength * 0.4;
        
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        
        let angle = 0;
        
        // Calculate arrow angle based on orientation and triangle type
        if (pointsUp) {
            // Up-pointing triangle
            switch (orientation) {
                case 'left':
                    angle = Math.PI; // Left (180 degrees)
                    break;
                case 'right':
                    angle = 0; // Right (0 degrees)
                    break;
                case 'third': // Bottom
                    angle = Math.PI / 2; // Down (90 degrees)
                    break;
            }
        } else {
            // Down-pointing triangle
            switch (orientation) {
                case 'left':
                    angle = Math.PI; // Left (180 degrees)
                    break;
                case 'right':
                    angle = 0; // Right (0 degrees)
                    break;
                case 'third': // Top
                    angle = Math.PI * 3 / 2; // Up (270 degrees)
                    break;
            }
        }
        
        // Calculate arrow end point
        const endX = x + Math.cos(angle) * arrowLength;
        const endY = y + Math.sin(angle) * arrowLength;
        
        // Draw arrow line
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Draw arrowhead
        const headAngle1 = angle - Math.PI * 5 / 6;
        const headAngle2 = angle + Math.PI * 5 / 6;
        
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX + Math.cos(headAngle1) * arrowHeadSize,
            endY + Math.sin(headAngle1) * arrowHeadSize
        );
        ctx.lineTo(
            endX + Math.cos(headAngle2) * arrowHeadSize,
            endY + Math.sin(headAngle2) * arrowHeadSize
        );
        ctx.closePath();
        ctx.fill();
    }
    
    /**
     * Draw the player position and direction
     */
    drawPlayer(ctx, playerPos, playerYaw, offsetX, offsetY, triangleWidth, triangleHeight) {
        // Convert world position to screen position using the same world scale
        // used by the raycast shader / maze.js:
        //  - X advances by TRIANGLE_SIZE * 0.5 per column
        //  - Z advances by TRIANGLE_HEIGHT per row
        //
        // The grid drawing uses:
        //  totalWidth  = (maxCols / 2) * triangleWidth
        //  totalHeight = numRows * triangleHeight
        //
        // so the consistent world->screen scaling is:
        //  scaleX = triangleWidth  / TRIANGLE_SIZE
        //  scaleY = triangleHeight / TRIANGLE_HEIGHT
        const scaleX = triangleWidth / TRIANGLE_SIZE;
        const scaleY = triangleHeight / TRIANGLE_HEIGHT;

        const screenX = offsetX + (playerPos.x * scaleX);
        const screenY = offsetY + (playerPos.z * scaleY);
        
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
        // Keep minimap at a reasonable fixed size - increased max size
        const minimapSize = Math.min(Math.min(width, height) * 0.4, 500);
        this.resize(minimapSize, minimapSize);
    }
    
    destroy() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

export { MazeMinimap };

