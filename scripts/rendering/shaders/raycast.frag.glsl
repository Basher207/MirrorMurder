uniform sampler2D uMazeTexture;
uniform sampler2D uPlayerTexture;
uniform sampler2D uPlayerBackTexture;
uniform sampler2D uMirrorTexture;
uniform sampler2D uFloorTexture;
uniform sampler2D uMonsterTexture;
uniform vec2 uMazeSize;
uniform float uTriangleSize;
uniform float uTriangleHeight;
uniform vec2 uResolution;
uniform vec3 uPlayerPos;
uniform float uPlayerYaw;
uniform float uPlayerPitch;
uniform vec3 uEnemyPos;
uniform float uFov;
uniform float uTime;

varying vec2 vUv;

// ================================================================
// Constants
// ================================================================

const float FLOOR_Y = 0.0;
const float CEILING_Y = 1.9;
const float MAX_DIST = 1000.0;
const float EPSILON = 0.001;
const int MAX_TRIANGLE_CROSSINGS = 2000; // Max number of triangles to traverse
const float PLAYER_QUAD_WIDTH = 0.5;
const float PLAYER_QUAD_HEIGHT = 1.025;
const float PLAYER_QUAD_Y_OFFSET = 0.35; // Center height of quad above floor

// ================================================================
// Utility Functions
// ================================================================

// Rotate vector around Y axis
vec3 rotateY(vec3 v, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(
        v.x * c - v.z * s,
        v.y,
        v.x * s + v.z * c
    );
}

// Rotate vector around X axis (pitch)
vec3 rotateX(vec3 v, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(
        v.x,
        v.y * c - v.z * s,
        v.y * s + v.z * c
    );
}

// ================================================================
// Sky Rendering
// ================================================================

vec3 renderSky(vec3 rayDir) {
    return vec3(0.0, 0.0, 0.0); // Pitch black
}

// ================================================================
// Maze Helpers
// ================================================================

// Helper: check if point (px, pz) is inside triangle with vertices (v0, v1, v2)
bool pointInTriangle2D(vec2 p, vec2 v0, vec2 v1, vec2 v2) {
    // Using barycentric coordinates
    float d = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);
    float a = ((v1.y - v2.y) * (p.x - v2.x) + (v2.x - v1.x) * (p.y - v2.y)) / d;
    float b = ((v2.y - v0.y) * (p.x - v2.x) + (v0.x - v2.x) * (p.y - v2.y)) / d;
    float c = 1.0 - a - b;
    
    return a >= -0.001 && b >= -0.001 && c >= -0.001; // Small epsilon for edge cases
}

// Get triangle grid coordinates from world position
// Each grid cell (col, row) represents ONE triangle
ivec2 worldToGrid(vec3 pos) {
    // Start with a guess based on rectangular grid
    int baseCol = int(floor(pos.x / (uTriangleSize * 0.5)));
    int row = int(floor(pos.z / uTriangleHeight));
    
    vec2 p = vec2(pos.x, pos.z);
    
    // Check this triangle and its immediate neighbors
    // Triangles span 2 grid cells wide, so check baseCol-1, baseCol, baseCol+1
    for (int offset = -1; offset <= 1; offset++) {
        int testCol = baseCol + offset;
        
        // Get vertices for this triangle
        float x = float(testCol) * uTriangleSize * 0.5;
        float z = float(row) * uTriangleHeight;
        
        bool up = mod(float(row + testCol), 2.0) < 0.5;
        
        vec2 v0, v1, v2;
        if (up) {
            v0 = vec2(x + uTriangleSize * 0.5, z);
            v1 = vec2(x, z + uTriangleHeight);
            v2 = vec2(x + uTriangleSize, z + uTriangleHeight);
        } else {
            v0 = vec2(x + uTriangleSize * 0.5, z + uTriangleHeight);
            v1 = vec2(x, z);
            v2 = vec2(x + uTriangleSize, z);
        }
        
        if (pointInTriangle2D(p, v0, v1, v2)) {
            return ivec2(testCol, row);
        }
    }
    
    // Fallback to base guess
    return ivec2(baseCol, row);
}

// Check if triangle points up (true) or down (false)
bool isPointingUp(ivec2 gridPos) {
    return mod(float(gridPos.y + gridPos.x), 2.0) < 0.5;
}

// Get maze data from texture
vec4 getMazeCell(ivec2 gridPos) {
    if (gridPos.x < 0 || gridPos.x >= int(uMazeSize.x) || 
        gridPos.y < 0 || gridPos.y >= int(uMazeSize.y)) {
        return vec4(0.0, 1.0, 0.0, 1.0); // Out of bounds = all walls
    }
    
    vec2 uv = (vec2(gridPos) + 0.5) / uMazeSize;
    return texture2D(uMazeTexture, uv);
}

// Get triangle vertices in world space
void getTriangleVertices(ivec2 gridPos, out vec3 v0, out vec3 v1, out vec3 v2) {
    float x = float(gridPos.x) * uTriangleSize * 0.5;
    float z = float(gridPos.y) * uTriangleHeight;
    
    if (isPointingUp(gridPos)) {
        // Pointing UP triangle
        v0 = vec3(x + uTriangleSize * 0.5, 0.0, z);                  // Top apex
        v1 = vec3(x, 0.0, z + uTriangleHeight);                      // Bottom-left
        v2 = vec3(x + uTriangleSize, 0.0, z + uTriangleHeight);      // Bottom-right
    } else {
        // Pointing DOWN triangle
        v0 = vec3(x + uTriangleSize * 0.5, 0.0, z + uTriangleHeight); // Bottom apex
        v1 = vec3(x, 0.0, z);                                        // Top-left
        v2 = vec3(x + uTriangleSize, 0.0, z);                        // Top-right
    }
}

// Get neighbor triangle across an edge
// Returns the neighbor's grid position
// Edge indexing: edge N connects vertex (N+1) to vertex (N+2)
ivec2 getNeighbor(ivec2 gridPos, int edgeIndex) {
    bool up = isPointingUp(gridPos);
    
    if (up) {
        // Pointing UP triangle (v0=top, v1=bottom-left, v2=bottom-right)
        // Edge 0: v1-v2 (bottom edge) → neighbor below (row+1, same col)
        // Edge 1: v2-v0 (right diagonal) → neighbor to right (same row, col+1)
        // Edge 2: v0-v1 (left diagonal) → neighbor to left (same row, col-1)
        if (edgeIndex == 0) return ivec2(gridPos.x, gridPos.y + 1); // Bottom edge
        if (edgeIndex == 1) return ivec2(gridPos.x + 1, gridPos.y); // Right edge
        if (edgeIndex == 2) return ivec2(gridPos.x - 1, gridPos.y); // Left edge
    } else {
        // Pointing DOWN triangle (v0=bottom, v1=top-left, v2=top-right)
        // Edge 0: v1-v2 (top edge) → neighbor above (row-1, same col)
        // Edge 1: v2-v0 (right diagonal) → neighbor to right (same row, col+1)
        // Edge 2: v0-v1 (left diagonal) → neighbor to left (same row, col-1)
        if (edgeIndex == 0) return ivec2(gridPos.x, gridPos.y - 1); // Top edge
        if (edgeIndex == 1) return ivec2(gridPos.x + 1, gridPos.y); // Right edge
        if (edgeIndex == 2) return ivec2(gridPos.x - 1, gridPos.y); // Left edge
    }
    
    return ivec2(-1, -1); // Should never reach here
}

// ================================================================
// Ray-Wall Intersection
// ================================================================

// Ray-vertical wall intersection (wall is a vertical rectangle)
bool rayWallIntersection(vec3 origin, vec3 dir, vec3 wallStart, vec3 wallEnd, float wallHeight, out float t, out vec3 hitPos, out vec3 normal, out vec2 uv) {
    // Wall is vertical from y=0 to y=wallHeight
    // Wall edge goes from wallStart (x,z) to wallEnd (x,z)
    
    // Convert to 2D line intersection in XZ plane
    vec2 p1 = wallStart.xz;
    vec2 p2 = wallEnd.xz;
    vec2 rayOrigin = origin.xz;
    vec2 rayDir = dir.xz;
    
    // Line segment: p1 + s * (p2 - p1), s in [0,1]
    // Ray: rayOrigin + t * rayDir
    // Solve: p1 + s * (p2 - p1) = rayOrigin + t * rayDir
    
    vec2 v1 = rayOrigin - p1;
    vec2 v2 = p2 - p1;
    vec2 v3 = vec2(-rayDir.y, rayDir.x);
    
    float denom = dot(v2, v3);
    if (abs(denom) < EPSILON) return false; // Parallel
    
    // Correct ray parameter t (distance along ray) using cross products
    // This version ensures walls behind the camera (negative t) are rejected
    float t2D = dot(v2, vec2(v1.y, -v1.x)) / denom;
    float s = dot(v1, v3) / denom;
    
    if (t2D < EPSILON || s < 0.0 || s > 1.0) return false;
    
    // Check if hit is within wall height
    float hitY = origin.y + dir.y * t2D;
    if (hitY < FLOOR_Y || hitY > wallHeight) return false;
    
    t = t2D;
    hitPos = origin + dir * t;
    
    // Calculate wall normal (perpendicular to wall edge in XZ plane, pointing outward)
    vec2 wallDir = normalize(v2);
    vec2 normal2D = vec2(-wallDir.y, wallDir.x);
    // Make sure normal points toward the ray origin (outward from wall)
    if (dot(normal2D, -rayDir) < 0.0) {
        normal2D = -normal2D;
    }
    normal = normalize(vec3(normal2D.x, 0.0, normal2D.y));
    
    // Calculate UV coordinates for the wall
    // U: horizontal position along wall (s from 0 to 1)
    // V: vertical position (y from FLOOR_Y to wallHeight)
    uv = vec2(s, (hitY - FLOOR_Y) / (wallHeight - FLOOR_Y));
    
    return true;
}

// ================================================================
// Ray-Player Quad Intersection
// ================================================================

bool rayPlayerQuadIntersection(vec3 origin, vec3 dir, out float t, out vec3 hitPos, out vec2 uv, out bool isFrontFacing) {
    // Player quad is centered at player position, oriented based on player's yaw
    // Quad is vertical, with width PLAYER_QUAD_WIDTH and height PLAYER_QUAD_HEIGHT
    
    vec3 quadCenter = vec3(uPlayerPos.x, FLOOR_Y + PLAYER_QUAD_Y_OFFSET, uPlayerPos.z);
    
    // Quad faces in the direction the player is facing (based on yaw)
    // Player yaw: 0 = facing +Z, rotates around Y axis (negated for opposite rotation)
    vec3 playerForward = vec3(sin(-uPlayerYaw), 0.0, cos(-uPlayerYaw));
    vec3 quadNormal = playerForward; // Quad normal points in player's facing direction
    
    // Right vector (perpendicular to normal in XZ plane)
    vec3 quadRight = normalize(vec3(quadNormal.z, 0.0, -quadNormal.x));
    
    // Up vector
    vec3 quadUp = vec3(0.0, 1.0, 0.0);
    
    // Ray-plane intersection
    float denom = dot(dir, quadNormal);
    if (abs(denom) < EPSILON) return false; // Ray parallel to quad
    
    // Determine if we're looking at front or back based on the ray's origin (the virtual camera on the mirror)
    vec3 cameraToPlayer = quadCenter - origin;
    float cameraAlignment = dot(normalize(vec3(cameraToPlayer.x, 0.0, cameraToPlayer.z)), quadNormal);
    isFrontFacing = cameraAlignment < 0.0; // We see the front if the viewpoint is opposite to the player's facing direction
    
    t = dot(quadCenter - origin, quadNormal) / denom;
    if (t < EPSILON) return false; // Quad behind camera
    
    // Calculate hit position
    hitPos = origin + dir * t;
    
    // Check if hit is within quad bounds
    vec3 localHit = hitPos - quadCenter;
    float u = dot(localHit, quadRight);
    float v = dot(localHit, quadUp);
    
    float halfWidth = PLAYER_QUAD_WIDTH * 0.5;
    float halfHeight = PLAYER_QUAD_HEIGHT * 0.5;
    
    if (abs(u) > halfWidth || abs(v) > halfHeight) return false;
    
    // Convert to UV coordinates (0 to 1)
    uv = vec2(
        (u + halfWidth) / PLAYER_QUAD_WIDTH,
        (v + halfHeight) / PLAYER_QUAD_HEIGHT
    );
    
    return true;
}

// ================================================================
// Ray-Monster Sprite Intersection
// ================================================================

bool rayMonsterSpriteIntersection(vec3 origin, vec3 dir, out float t, out vec3 hitPos, out vec2 uv) {
    // Monster sprite is a billboard centered at enemy position
    // Similar to player quad but always faces the camera
    
    float spriteWidth = 0.8;
    float spriteHeight = 0.8;
    float spriteYOffset = 0.4; // Center height above floor
    
    vec3 spriteCenter = vec3(uEnemyPos.x, FLOOR_Y + spriteYOffset, uEnemyPos.z);
    
    // Billboard normal always faces toward the ray origin (camera)
    vec3 toCamera = normalize(origin - spriteCenter);
    vec3 spriteNormal = normalize(vec3(toCamera.x, 0.0, toCamera.z)); // Keep horizontal
    
    // Right vector (perpendicular to normal in XZ plane)
    vec3 spriteRight = normalize(vec3(spriteNormal.z, 0.0, -spriteNormal.x));
    
    // Up vector
    vec3 spriteUp = vec3(0.0, 1.0, 0.0);
    
    // Ray-plane intersection
    float denom = dot(dir, spriteNormal);
    if (abs(denom) < EPSILON) return false; // Ray parallel to sprite
    
    t = dot(spriteCenter - origin, spriteNormal) / denom;
    if (t < EPSILON) return false; // Sprite behind camera
    
    // Calculate hit position
    hitPos = origin + dir * t;
    
    // Check if hit is within sprite bounds
    vec3 localHit = hitPos - spriteCenter;
    float u = dot(localHit, spriteRight);
    float v = dot(localHit, spriteUp);
    
    float halfWidth = spriteWidth * 0.5;
    float halfHeight = spriteHeight * 0.5;
    
    if (abs(u) > halfWidth || abs(v) > halfHeight) return false;
    
    // Convert to UV coordinates (0 to 1)
    uv = vec2(
        (u + halfWidth) / spriteWidth,
        (v + halfHeight) / spriteHeight
    );
    
    return true;
}

// ================================================================
// Ray-Floor Intersection
// ================================================================

bool rayFloorIntersection(vec3 origin, vec3 dir, out float t, out vec3 hitPos) {
    // Ray: P = origin + t * dir
    // Floor plane: y = FLOOR_Y
    // Solve: origin.y + t * dir.y = FLOOR_Y
    
    if (abs(dir.y) < EPSILON) {
        return false; // Ray parallel to floor
    }
    
    t = (FLOOR_Y - origin.y) / dir.y;
    
    if (t < 0.0) {
        return false; // Floor behind camera
    }
    
    hitPos = origin + t * dir;
    return true;
}

// ================================================================
// Ray-Ceiling Intersection
// ================================================================

bool rayCeilingIntersection(vec3 origin, vec3 dir, out float t, out vec3 hitPos) {
    // Ray: P = origin + t * dir
    // Ceiling plane: y = CEILING_Y
    // Solve: origin.y + t * dir.y = CEILING_Y
    
    if (abs(dir.y) < EPSILON) {
        return false; // Ray parallel to ceiling
    }
    
    t = (CEILING_Y - origin.y) / dir.y;
    
    if (t < 0.0) {
        return false; // Ceiling behind camera
    }
    
    hitPos = origin + t * dir;
    return true;
}

// ================================================================
// Noise Functions
// ================================================================

// Improved 2D hash function - more random, less axis-aligned
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.13);
    p3 += dot(p3, p3.yzx + 3.333);
    return fract((p3.x + p3.y) * p3.z);
}

// Smooth noise with better interpolation
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    // Quintic interpolation for smoother results
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    
    // Get corner values with different offsets to avoid axis alignment
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal noise with many octaves for rich detail
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    // 8 octaves for much more detail
    for (int i = 0; i < 8; i++) {
        value += amplitude * noise(p * frequency);
        // Rotate each octave slightly to break up axis alignment
        p = mat2(0.8, -0.6, 0.6, 0.8) * p;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value;
}

// ================================================================
// Rendering
// ================================================================

// Distance from point p to line segment ab
float pointToSegmentDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    // Project pa onto ba, but clamp projection to the segment
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    // Distance from p to the projection
    return length(pa - ba * h);
}

vec3 renderWall(vec3 hitPos, int edgeIndex) {
    // Flat colored walls based on edge orientation
    vec3 wallColors[3];
    wallColors[0] = vec3(1.0, 1.0, 1.0);
    wallColors[1] = vec3(1.0, 1.0, 1.0);
    wallColors[2] = vec3(1.0, 1.0, 1.0);
    
    vec3 baseColor = wallColors[edgeIndex];
    
    // Distance-based fog
    float dist = length(hitPos - uPlayerPos);
    float fog = exp(-dist * 0.1);
    baseColor = mix(vec3(0.5, 0.7, 0.9), baseColor, fog);
    
    return baseColor;
}

vec3 renderFloor(vec3 hitPos) {
    // Sample the triangle grid around this point so edges are continuous,
    // even when the point is numerically assigned to the neighbouring cell.
    ivec2 baseGrid = worldToGrid(hitPos);
    float min_dist = 9999.0;

    // Check current cell and four direct neighbours (same pattern as DDA)
    for (int i = 0; i < 5; i++) {
        ivec2 gridPos = baseGrid;
        if (i == 1) gridPos += ivec2(1, 0);
        if (i == 2) gridPos += ivec2(-1, 0);
        if (i == 3) gridPos += ivec2(0, 1);
        if (i == 4) gridPos += ivec2(0, -1);

        vec3 v0, v1, v2;
        getTriangleVertices(gridPos, v0, v1, v2);

        // Distances to the three edges (in XZ plane)
        float d0 = pointToSegmentDist(hitPos.xz, v1.xz, v2.xz);
        float d1 = pointToSegmentDist(hitPos.xz, v2.xz, v0.xz);
        float d2 = pointToSegmentDist(hitPos.xz, v0.xz, v1.xz);

        float localMin = min(d0, min(d1, d2));
        min_dist = min(min_dist, localMin);
    }

    // If close to any edge, make it black
    float edge_thickness = 0.05;
    if (min_dist < edge_thickness) {
        return vec3(0.0); // Pitch black edge overlay
    }

    // Red base color
    vec3 baseColor = vec3(0.8, 0.1, 0.1);
    
    // Add rich noise pattern using world position
    vec2 noiseCoord = vec2(hitPos.x, hitPos.z) * 3.0;
    float noiseValue = fbm(noiseCoord);
    
    // Modulate the red color with noise for variation
    baseColor = mix(baseColor * 0.5, baseColor * 1.3, noiseValue);
    
    // Distance-based fog
    float dist = length(hitPos - uPlayerPos);
    float fog = exp(-dist * 0.05);
    baseColor = mix(vec3(0.5, 0.7, 0.9), baseColor, fog);
    
    // Simple lighting based on distance
    float brightness = 1.0 - smoothstep(0.0, 30.0, dist);
    baseColor *= 0.5 + brightness * 0.5;
    
    return baseColor;
}

vec3 renderCeiling(vec3 hitPos) {
    // Draw ceiling with the same grid edge continuity as the floor,
    // so reflected views look coherent.
    ivec2 baseGrid = worldToGrid(hitPos);
    float min_dist = 9999.0;

    // Check current cell and four direct neighbours
    for (int i = 0; i < 5; i++) {
        ivec2 gridPos = baseGrid;
        if (i == 1) gridPos += ivec2(1, 0);
        if (i == 2) gridPos += ivec2(-1, 0);
        if (i == 3) gridPos += ivec2(0, 1);
        if (i == 4) gridPos += ivec2(0, -1);

        vec3 v0, v1, v2;
        getTriangleVertices(gridPos, v0, v1, v2);

        // Distances to the three edges (in XZ plane)
        float d0 = pointToSegmentDist(hitPos.xz, v1.xz, v2.xz);
        float d1 = pointToSegmentDist(hitPos.xz, v2.xz, v0.xz);
        float d2 = pointToSegmentDist(hitPos.xz, v0.xz, v1.xz);

        float localMin = min(d0, min(d1, d2));
        min_dist = min(min_dist, localMin);
    }

    // If close to any edge, draw edge darker
    float edge_thickness = 0.05;
    if (min_dist < edge_thickness) {
        return vec3(0.0); // edge overlay
    }

    // Soft bluish ceiling base
    vec3 baseColor = vec3(0.85, 0.88, 0.95);

    // Subtle noise variation
    vec2 noiseCoord = vec2(hitPos.x, hitPos.z) * 2.0;
    float noiseValue = fbm(noiseCoord);
    baseColor = mix(baseColor * 0.9, baseColor * 1.05, noiseValue);

    // Distance-based fog similar to floor for consistency
    float dist = length(hitPos - uPlayerPos);
    float fog = exp(-dist * 0.05);
    baseColor = mix(vec3(0.5, 0.7, 0.9), baseColor, fog);

    // Simple lighting falloff
    float brightness = 1.0 - smoothstep(0.0, 30.0, dist);
    baseColor *= 0.6 + brightness * 0.4;

    return baseColor;
}

// ================================================================
// Triangle-by-Triangle Raycast
// ================================================================

vec3 castRay(vec3 origin, vec3 dir) {
    vec3 rayOrigin = origin;
    vec3 rayDir = dir;
    vec3 accumulatedColor = vec3(0.0);
    vec3 reflectivity = vec3(1.0);
    bool hitSomething = false; // Track if we hit an opaque surface
    
    // Mirror tint - slightly cyan/blue to indicate mirror surfaces (very subtle)
    vec3 mirrorTint = vec3(0.8, 0.8, 0.8);
    
    // Start in the current triangle
    ivec2 currentTriangle = worldToGrid(rayOrigin);
    
    // Triangle-by-triangle traversal
    for (int iteration = 0; iteration < MAX_TRIANGLE_CROSSINGS; iteration++) {
        // Check if we're out of bounds
        if (currentTriangle.x < 0 || currentTriangle.x >= int(uMazeSize.x) || 
            currentTriangle.y < 0 || currentTriangle.y >= int(uMazeSize.y)) {
            // Out of bounds - check floor/ceiling/sky
            break;
        }
        
        // FIRST: Check monster sprite (only for reflected rays, iteration > 0)
        bool hitMonster = false;
        vec4 monsterColor = vec4(0.0);
        float monsterT = MAX_DIST;
        
        if (iteration > 0) {
            vec3 monsterHit;
            vec2 tempMonsterUV;
            if (rayMonsterSpriteIntersection(rayOrigin, rayDir, monsterT, monsterHit, tempMonsterUV)) {
                if (monsterT > EPSILON) {
                    // Sample the texture to check alpha
                    vec4 tempMonsterColor = texture2D(uMonsterTexture, tempMonsterUV);
                    
                    // Only count as hit if pixel is not fully transparent
                    if (tempMonsterColor.a > 0.1) {
                        monsterColor = tempMonsterColor;
                        hitMonster = true;
                    }
                }
            }
        }
        
        // SECOND: Check player quad (only for reflected rays, iteration > 0)
        // Player quad spans multiple triangles, so check it independently
        bool hitPlayer = false;
        vec4 playerColor = vec4(0.0);
        float playerT = MAX_DIST;
        
        if (iteration > 0) {
            vec3 playerHit;
            vec2 tempPlayerUV;
            bool tempFrontFacing;
            if (rayPlayerQuadIntersection(rayOrigin, rayDir, playerT, playerHit, tempPlayerUV, tempFrontFacing)) {
                if (playerT > EPSILON) {
                    // Sample the texture to check alpha
                    vec4 tempPlayerColor = tempFrontFacing ? 
                        texture2D(uPlayerTexture, tempPlayerUV) : 
                        texture2D(uPlayerBackTexture, tempPlayerUV);
                    
                    // Only count as hit if pixel is not fully transparent
                    if (tempPlayerColor.a > 0.1) {
                        playerColor = tempPlayerColor;
                        hitPlayer = true;
                    }
                }
            }
        }
        
        // Check which sprite is closer (monster or player)
        if (hitMonster && hitPlayer) {
            if (monsterT < playerT) {
                accumulatedColor += monsterColor.rgb * reflectivity;
                hitSomething = true;
                break;
            } else {
                accumulatedColor += playerColor.rgb * reflectivity;
                hitSomething = true;
                break;
            }
        } else if (hitMonster) {
            accumulatedColor += monsterColor.rgb * reflectivity;
            hitSomething = true;
            break;
        } else if (hitPlayer) {
            accumulatedColor += playerColor.rgb * reflectivity;
            hitSomething = true;
            break;
        }
        
        // THIRD: Check triangle walls (only if we didn't hit any sprites)
        // Get current triangle's walls
        vec4 cellData = getMazeCell(currentTriangle);
        float wallBits = cellData.g * 7.0;
        int walls = int(wallBits + 0.5);
        
        // Get triangle vertices
        vec3 v0, v1, v2;
        getTriangleVertices(currentTriangle, v0, v1, v2);
        vec3 triCenter = (v0 + v1 + v2) / 3.0;
        
        // Check ray intersection with all 3 edges of current triangle
        float closestT = MAX_DIST;
        vec3 closestHit = vec3(0.0);
        vec3 closestNormal = vec3(0.0);
        int hitEdge = -1;
        vec2 wallUV = vec2(0.0);

        for (int edgeIdx = 0; edgeIdx < 3; edgeIdx++) {
            vec3 edgeStart, edgeEnd;
            
            // Get edge vertices (edge N connects vertex (N+1) to vertex (N+2))
            if (edgeIdx == 0) {
                edgeStart = v1;
                edgeEnd = v2;
            } else if (edgeIdx == 1) {
                edgeStart = v2;
                edgeEnd = v0;
            } else {
                edgeStart = v0;
                edgeEnd = v1;
            }
            
            // One-sided edge test: only consider edges that the ray approaches from the triangle interior.
            // Compute interior-facing normal for this edge in XZ plane.
            vec2 edgeDir2D = normalize(edgeEnd.xz - edgeStart.xz);
            vec2 interiorNormal2D = normalize(vec2(-edgeDir2D.y, edgeDir2D.x));
            vec2 toCenter2D = triCenter.xz - 0.5 * (edgeStart.xz + edgeEnd.xz);
            if (dot(interiorNormal2D, toCenter2D) < 0.0) {
                interiorNormal2D = -interiorNormal2D;
            }
            // If the ray is moving in the same direction as the interior normal (leaving interior),
            // this edge is backfacing for the current triangle - ignore it.
            if (dot(rayDir.xz, interiorNormal2D) >= 0.0) {
                continue;
            }
            
            // Test ray against this edge
            float t;
            vec3 hitPos;
            vec3 normal;
            vec2 uv;
            if (rayWallIntersection(rayOrigin, rayDir, edgeStart, edgeEnd, CEILING_Y, t, hitPos, normal, uv)) {
                if (t < closestT && t > EPSILON) {
                    closestT = t;
                    closestHit = hitPos;
                    closestNormal = normal;
                    hitEdge = edgeIdx;
                    wallUV = uv;
                }
            }
        }

        // If no edge was hit, handle planes (ceiling/floor/sky) within the loop
        if (hitEdge == -1) {
            float ceilingT;
            vec3 ceilingHit;
            float floorT;
            vec3 floorHit;
            
            bool hitCeiling = rayCeilingIntersection(rayOrigin, rayDir, ceilingT, ceilingHit);
            bool hitFloor = rayFloorIntersection(rayOrigin, rayDir, floorT, floorHit);
            
            if (hitCeiling && (!hitFloor || ceilingT < floorT)) {
                // Treat ceiling as a mirror: reflect ray and continue traversal
                vec3 ceilingNormal = vec3(0.0, -1.0, 0.0);
                if (dot(rayDir, ceilingNormal) > 0.0) {
                    ceilingNormal = -ceilingNormal;
                }
                reflectivity *= mirrorTint;
                rayDir = reflect(rayDir, ceilingNormal);
                rayOrigin = ceilingHit + ceilingNormal * EPSILON * 10.0;
                // Stay in the same triangle (XZ), continue loop
                continue;
            } else if (hitFloor) {
                // Hit floor - render and stop
                accumulatedColor += renderFloor(floorHit) * reflectivity;
                hitSomething = true;
                break;
            } else {
                // No hit - render sky and stop
                accumulatedColor += renderSky(rayDir) * reflectivity;
                hitSomething = true;
                break;
            }
        }
        
        // If we're here, a wall was hit. Check if it's solid or a mirror.
        int edgeBit = 1 << hitEdge;
        bool hasWall = (walls & edgeBit) != 0;
        
        if (hasWall) {
            // This edge has a wall - check if it's a mirror
            vec4 mirrorData = texture2D(uMirrorTexture, wallUV);
            bool isMirror = mirrorData.g > 0.7;
            
            if (isMirror) {
                // Mirror - reflect ray and stay in same triangle
                
                // Generate unique wave parameters for this mirror
                float mirrorSeed = float(currentTriangle.x * 730 + currentTriangle.y * 370 + hitEdge * 190);
                float mirrorHash1 = hash(vec2(mirrorSeed, mirrorSeed * 1.618));
                float mirrorHash2 = hash(vec2(mirrorSeed * 2.718, mirrorSeed * 0.577));
                float mirrorHash3 = hash(vec2(mirrorSeed * 1.414, mirrorSeed * 3.142));
                
                // Unique parameters for each mirror
                float waveOffset = mirrorHash1 * 1000.283;
                float waveScale = 0.0 + mirrorHash2 * 0.35;
                float waveFrequency = 0.0 + mirrorHash3 * 9.0;
                
                // waveOffset = 0.0;
                // waveScale = 0.0;
                // waveFrequency = 0.0;
                
                // Apply vertical sin wave distortion to the normal
                float wave = sin(closestHit.y * waveFrequency + waveOffset) * waveScale;
                vec3 distortedNormal = normalize(closestNormal + vec3(0.0, wave, 0.0));
                
                // Apply mirror tint
                reflectivity *= mirrorTint;
                
                // Reflect the ray
                rayDir = reflect(rayDir, distortedNormal);
                rayOrigin = closestHit + distortedNormal * EPSILON * 10.0;
                
                // Stay in same triangle - continue loop
                continue;
            } else {
                // Solid wall - render and stop
                accumulatedColor += renderWall(closestHit, hitEdge) * reflectivity;
                hitSomething = true;
                break;
            }
        } else {
            // No wall on this edge - move to neighbor triangle.
            // We MUST nudge the ray origin slightly past the edge, otherwise we keep
            // re‑hitting the same edge from the same origin and never see the next cell.
            ivec2 neighbor = getNeighbor(currentTriangle, hitEdge);
            currentTriangle = neighbor;
            // Advance a tiny amount along the edge normal so the edge is now behind the ray.
            // rayOrigin = closestHit    + closestNormal * EPSILON * 4.0;
            // Continue to next triangle
            continue;
        }
    }
    
    // If we exit the loop without hitting something opaque, check ceiling and floor
    if (!hitSomething) {
        float ceilingT;
        vec3 ceilingHit;
        float floorT;
        vec3 floorHit;
        
        bool hitCeiling = rayCeilingIntersection(rayOrigin, rayDir, ceilingT, ceilingHit);
        bool hitFloor = rayFloorIntersection(rayOrigin, rayDir, floorT, floorHit);
        
        // Check which surface is closer
    if (hitCeiling && ceilingT < MAX_DIST && (!hitFloor || ceilingT < floorT)) {
        // Hit ceiling
        accumulatedColor += renderCeiling(ceilingHit) * reflectivity;
        } else if (hitFloor && floorT < MAX_DIST) {
            // Hit floor
            accumulatedColor += renderFloor(floorHit) * reflectivity;
        } else {
            // No hit - render sky
            accumulatedColor += renderSky(rayDir) * reflectivity;
        }
    }
    
    return accumulatedColor;
}

// ================================================================
// Main
// ================================================================

void main() {
    // Screen space coordinates (-1 to 1)
    vec2 screenPos = (vUv - 0.5) * 2.0;
    float aspectRatio = uResolution.x / uResolution.y;
    screenPos.x *= aspectRatio;
    
    // Generate ray direction
    float fovScale = tan(uFov / 2.0);
    vec3 rayDir = normalize(vec3(
        screenPos.x * fovScale,
        screenPos.y * fovScale,
        1.0
    ));
    
    // Apply player rotation (pitch, then yaw)
    rayDir = rotateX(rayDir, uPlayerPitch);
    rayDir = rotateY(rayDir, uPlayerYaw);
    
    // Cast ray
    vec3 color = castRay(uPlayerPos, rayDir);
    
    // Output final color
    gl_FragColor = vec4(color, 1.0);
}

