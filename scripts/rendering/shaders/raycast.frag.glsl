uniform sampler2D uMazeTexture;
uniform sampler2D uPlayerTexture;
uniform sampler2D uPlayerBackTexture;
uniform sampler2D uMirrorTexture;
uniform sampler2D uFloorTexture;
uniform vec2 uMazeSize;
uniform float uTriangleSize;
uniform float uTriangleHeight;
uniform vec2 uResolution;
uniform vec3 uPlayerPos;
uniform float uPlayerYaw;
uniform float uPlayerPitch;
uniform float uFov;
uniform float uTime;

varying vec2 vUv;

// ================================================================
// Constants
// ================================================================

const float FLOOR_Y = 0.0;
const float CEILING_Y = 1.8;
const float MAX_DIST = 1000.0;
const float EPSILON = 0.001;
const int MAX_BOUNCES = 20;
const float PLAYER_QUAD_WIDTH = 0.45;
const float PLAYER_QUAD_HEIGHT = 1.05;
const float PLAYER_QUAD_Y_OFFSET = 0.525; // Center height of quad above floor

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

// Get triangle grid coordinates from world position
ivec2 worldToGrid(vec3 pos) {
    int col = int(floor(pos.x / (uTriangleSize * 0.5)));
    int row = int(floor(pos.z / uTriangleHeight));
    return ivec2(col, row);
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

// ================================================================
// DDA Grid Traversal for Triangle Grid
// ================================================================

// Check a single grid cell for wall intersections
void checkGridCell(ivec2 gridPos, vec3 rayOrigin, vec3 rayDir, inout float closestT, 
                   inout vec3 closestHit, inout vec3 closestNormal, inout int hitEdge, 
                   inout bool hitWall, inout bool hitPlayer, inout vec2 wallUV, inout ivec2 hitGridPos) {
    // Skip out-of-bounds cells entirely
    if (gridPos.x < 0 || gridPos.x >= int(uMazeSize.x) || 
        gridPos.y < 0 || gridPos.y >= int(uMazeSize.y)) {
        return;
    }
    
    // Get maze cell data
    vec4 cellData = getMazeCell(gridPos);
    float wallBits = cellData.g * 7.0; // Convert back from normalized
    int walls = int(wallBits + 0.5);
    
    // Skip if no walls
    if (walls == 0) return;
    
    // Get triangle vertices
    vec3 v0, v1, v2;
    getTriangleVertices(gridPos, v0, v1, v2);
    
    // Check each edge for walls
    for (int edgeIdx = 0; edgeIdx < 3; edgeIdx++) {
        // Check if this edge has a wall
        int edgeBit = 1 << edgeIdx;
        if ((walls & edgeBit) != 0) {
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
            
            // Test ray against wall
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
                    hitWall = true;
                    hitPlayer = false; // Wall is closer, so not player
                    wallUV = uv;
                    hitGridPos = gridPos; // Store which grid cell was hit
                }
            }
        }
    }
}

// ================================================================
// Main Raycast
// ================================================================

vec3 castRay(vec3 origin, vec3 dir) {
    vec3 rayOrigin = origin;
    vec3 rayDir = dir;
    vec3 accumulatedColor = vec3(0.0);
    vec3 reflectivity = vec3(1.0);
    
    // Mirror tint - slightly cyan/blue to indicate mirror surfaces (very subtle)
    vec3 mirrorTint = vec3(0.8, 0.8, 0.8);
    
    for (int bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
        float closestT = MAX_DIST;
        vec3 closestHit = vec3(0.0);
        vec3 closestNormal = vec3(0.0);
        int hitEdge = -1;
        bool hitWall = false;
        bool hitPlayer = false;
        vec2 playerUV = vec2(0.0);
        vec2 wallUV = vec2(0.0);
        ivec2 hitGridPos = ivec2(0, 0); // Track which grid cell was hit
        
        // DDA Grid Traversal - only check cells the ray passes through
        ivec2 currentGrid = worldToGrid(rayOrigin);
        
        // Ray direction in grid space (columns and rows per unit distance)
        float colsPerUnit = 1.0 / (uTriangleSize * 0.5);
        float rowsPerUnit = 1.0 / uTriangleHeight;
        vec2 rayGridDir = vec2(rayDir.x * colsPerUnit, rayDir.z * rowsPerUnit);
        
        // DDA step directions
        ivec2 stepDir = ivec2(sign(rayGridDir.x), sign(rayGridDir.y));
        
        // Distance to next grid boundary (in world units)
        vec2 nextBoundary;
        nextBoundary.x = (stepDir.x > 0) ? 
            (float(currentGrid.x + 1) / colsPerUnit) : 
            (float(currentGrid.x) / colsPerUnit);
        nextBoundary.y = (stepDir.y > 0) ? 
            (float(currentGrid.y + 1) / rowsPerUnit) : 
            (float(currentGrid.y) / rowsPerUnit);
        
        // Calculate tDelta - distance to traverse one grid cell
        vec2 tDelta = abs(vec2(1.0 / rayGridDir.x, 1.0 / rayGridDir.y));
        // Clamp tDelta to prevent huge steps when ray is nearly parallel to grid axis
        const float MAX_TDELTA = 5.0;
        tDelta = min(tDelta, vec2(MAX_TDELTA));
        
        // Calculate initial tMax - distance to next grid boundary
        vec2 tMax;
        tMax.x = (abs(rayGridDir.x) > EPSILON) ? 
            abs(nextBoundary.x - rayOrigin.x) / abs(rayDir.x) : 
            MAX_DIST;
        tMax.y = (abs(rayGridDir.y) > EPSILON) ? 
            abs(nextBoundary.y - rayOrigin.z) / abs(rayDir.z) : 
            MAX_DIST;
        
        // Traverse grid using DDA
        const int MAX_STEPS = 100; // Limit traversal steps to prevent infinite loops
        for (int step = 0; step < MAX_STEPS; step++) {
            // Check current cell AND the cell to the left (col-1).
            // Triangles are 2 grid cells wide (TRIANGLE_SIZE / (TRIANGLE_SIZE * 0.5) = 2),
            // so a triangle at col-1 can extend into the current column.
            checkGridCell(currentGrid, rayOrigin, rayDir, closestT, closestHit, closestNormal, hitEdge, hitWall, hitPlayer, wallUV, hitGridPos);
            checkGridCell(currentGrid + ivec2(-1, 0), rayOrigin, rayDir, closestT, closestHit, closestNormal, hitEdge, hitWall, hitPlayer, wallUV, hitGridPos);
            
            // If we found a hit closer than our current traversal distance, stop
            if (hitWall && closestT < min(tMax.x, tMax.y)) {
                break;
            }
            
            // Step to next grid cell
            if (tMax.x < tMax.y) {
                tMax.x += tDelta.x;
                currentGrid.x += stepDir.x;
            } else {
                tMax.y += tDelta.y;
                currentGrid.y += stepDir.y;
            }
            
            // Stop if we've gone too far or out of bounds
            if (min(tMax.x, tMax.y) > MAX_DIST || 
                currentGrid.x < -1 || currentGrid.x > int(uMazeSize.x) ||
                currentGrid.y < -1 || currentGrid.y > int(uMazeSize.y)) {
                break;
            }
        }
        
        // Check player quad (only for reflected rays, bounce > 0)
        bool playerFrontFacing = false;
        vec4 playerColor = vec4(0.0);
        if (bounce > 0) {
            float playerT;
            vec3 playerHit;
            vec2 tempPlayerUV;
            bool tempFrontFacing;
            if (rayPlayerQuadIntersection(rayOrigin, rayDir, playerT, playerHit, tempPlayerUV, tempFrontFacing)) {
                // If player is closer than wall (or no wall hit), check if pixel is opaque
                if (playerT < closestT && playerT > EPSILON) {
                    // Sample the texture to check alpha
                    vec4 tempPlayerColor = tempFrontFacing ? 
                        texture2D(uPlayerTexture, tempPlayerUV) : 
                        texture2D(uPlayerBackTexture, tempPlayerUV);
                    
                    // Only count as hit if pixel is not fully transparent
                    if (tempPlayerColor.a > 0.1) {
                        closestT = playerT;
                        closestHit = playerHit;
                        playerUV = tempPlayerUV;
                        playerFrontFacing = tempFrontFacing;
                        playerColor = tempPlayerColor;
                        hitPlayer = true;
                        hitWall = false; // Player is closer than wall
                    }
                    // If transparent, ignore player hit and let wall/mirror be used
                }
            }
        }
        
        // Handle player hit (closer than wall and opaque)
        if (hitPlayer) {
            // We already sampled the player texture above
            accumulatedColor += playerColor.rgb * playerColor.a * reflectivity;
            
            // If not fully opaque, blend with background
            if (playerColor.a < 0.99) {
                reflectivity *= (1.0 - playerColor.a);
                // Continue ray through semi-transparent parts
                rayOrigin = closestHit + rayDir * EPSILON * 10.0;
                continue;
            } else {
                break;
            }
        }
        
        // Handle wall hit (check if mirror or solid wall)
        if (hitWall) {
            // Sample the mirror texture to determine if this wall is a mirror
            vec4 mirrorData = texture2D(uMirrorTexture, wallUV);
            bool isMirror = mirrorData.g > 0.7;
            
            if (isMirror) {
                // Mirror surface - reflect the ray with unique wave distortion
                
                // Generate unique wave parameters for this mirror based on grid position and edge
                // Use a hash to create deterministic but varied parameters
                float mirrorSeed = float(hitGridPos.x * 73 + hitGridPos.y * 37 + hitEdge * 19);
                float mirrorHash1 = hash(vec2(mirrorSeed, mirrorSeed * 1.618));
                float mirrorHash2 = hash(vec2(mirrorSeed * 2.718, mirrorSeed * 0.577));
                float mirrorHash3 = hash(vec2(mirrorSeed * 1.414, mirrorSeed * 3.142));
                
                // Unique parameters for each mirror
                float waveOffset = mirrorHash1 * 6.283; // 0 to 2*PI
                float waveScale = 0.15 + mirrorHash2 * 0.025; // 0.015 to 0.04 (subtle)
                float waveFrequency = 11.5 + mirrorHash3 * 3.0; // 1.5 to 4.5
                
                // Apply vertical sin wave distortion to the normal
                float wave = sin(closestHit.y * waveFrequency + waveOffset) * waveScale;
                vec3 distortedNormal = normalize(closestNormal + vec3(0.0, wave, 0.0));
                
                // Apply mirror tint for next bounce
                // This gradually darkens the reflection with each bounce
                // if (bounce > 1) {
                    reflectivity *= mirrorTint;
                // }
                
                // Reflect the ray with the distorted normal
                rayDir = reflect(rayDir, distortedNormal);
                rayOrigin = closestHit + distortedNormal * EPSILON * 10.0; // Offset to avoid self-intersection
                
                continue;
            } else {
                // Solid wall - render it and stop
                accumulatedColor += renderWall(closestHit, hitEdge) * reflectivity;
                break;
            }
        }
        
        // No wall or player hit - check ceiling and floor
        float ceilingT;
        vec3 ceilingHit;
        float floorT;
        vec3 floorHit;
        
        bool hitCeiling = rayCeilingIntersection(rayOrigin, rayDir, ceilingT, ceilingHit);
        bool hitFloor = rayFloorIntersection(rayOrigin, rayDir, floorT, floorHit);
        
        // Check which surface is closer
        if (hitCeiling && ceilingT < MAX_DIST && (!hitFloor || ceilingT < floorT)) {
            // Hit ceiling - reflect the ray
            vec3 ceilingNormal = vec3(0.0, -1.0, 0.0); // Ceiling normal points down
            
            // Apply subtle reflectivity tint (slightly reduce brightness)
            reflectivity *= vec3(0.85, 0.85, 0.9); // Slight blue tint
            
            // Reflect the ray off the ceiling
            rayDir = reflect(rayDir, ceilingNormal);
            rayOrigin = ceilingHit + ceilingNormal * EPSILON * 10.0; // Offset to avoid self-intersection
            
            continue;
        } else if (hitFloor && floorT < MAX_DIST) {
            // Hit floor
            accumulatedColor += renderFloor(floorHit) * reflectivity;
            break;
        }
        
        // No hit - render sky
        accumulatedColor += renderSky(rayDir) * reflectivity;
        break;
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

