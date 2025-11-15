uniform sampler2D uMazeTexture;
uniform sampler2D uPlayerTexture;
uniform sampler2D uPlayerBackTexture;
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
const float CEILING_Y = 1.5;
const float MAX_DIST = 100.0;
const float EPSILON = 0.001;
const int MAX_BOUNCES = 15;
const float PLAYER_QUAD_WIDTH = 0.6;
const float PLAYER_QUAD_HEIGHT = 1.2;
const float PLAYER_QUAD_Y_OFFSET = 0.6; // Center height of quad above floor

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
bool rayWallIntersection(vec3 origin, vec3 dir, vec3 wallStart, vec3 wallEnd, float wallHeight, out float t, out vec3 hitPos, out vec3 normal) {
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
// Rendering
// ================================================================

vec3 renderWall(vec3 hitPos, int edgeIndex) {
    // Flat colored walls based on edge orientation
    vec3 wallColors[3];
    wallColors[0] = vec3(0.7, 0.3, 0.3); // Edge 0 - Red
    wallColors[1] = vec3(0.3, 0.7, 0.3); // Edge 1 - Green
    wallColors[2] = vec3(0.3, 0.3, 0.7); // Edge 2 - Blue
    
    vec3 baseColor = wallColors[edgeIndex];
    
    // Distance-based fog
    float dist = length(hitPos - uPlayerPos);
    float fog = exp(-dist * 0.1);
    baseColor = mix(vec3(0.5, 0.7, 0.9), baseColor, fog);
    
    return baseColor;
}

vec3 renderFloor(vec3 hitPos) {
    // Checkerboard pattern based on world position
    float checker = mod(floor(hitPos.x) + floor(hitPos.z), 2.0);
    vec3 color1 = vec3(0.2, 0.2, 0.25);
    vec3 color2 = vec3(0.3, 0.3, 0.35);
    vec3 baseColor = mix(color1, color2, checker);
    
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
// Main Raycast
// ================================================================

vec3 castRay(vec3 origin, vec3 dir) {
    vec3 rayOrigin = origin;
    vec3 rayDir = dir;
    vec3 accumulatedColor = vec3(0.0);
    vec3 reflectivity = vec3(1.0);
    
    // Mirror tint - slightly cyan/blue to indicate mirror surfaces
    vec3 mirrorTint = vec3(0.85, 0.9, 1.0);
    
    for (int bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
        float closestT = MAX_DIST;
        vec3 closestHit = vec3(0.0);
        vec3 closestNormal = vec3(0.0);
        int hitEdge = -1;
        bool hitWall = false;
        bool hitPlayer = false;
        vec2 playerUV = vec2(0.0);
        
        // Check all maze cells for wall intersections
        for (int row = 0; row < int(uMazeSize.y); row++) {
            for (int col = 0; col < int(uMazeSize.x); col++) {
                ivec2 gridPos = ivec2(col, row);
                
                // Get maze cell data
                vec4 cellData = getMazeCell(gridPos);
                float wallBits = cellData.g * 7.0; // Convert back from normalized
                int walls = int(wallBits + 0.5);
                
                // Skip if no walls
                if (walls == 0) continue;
                
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
                        if (rayWallIntersection(rayOrigin, rayDir, edgeStart, edgeEnd, CEILING_Y, t, hitPos, normal)) {
                            if (t < closestT && t > EPSILON) {
                                closestT = t;
                                closestHit = hitPos;
                                closestNormal = normal;
                                hitEdge = edgeIdx;
                                hitWall = true;
                                hitPlayer = false; // Wall is closer, so not player
                            }
                        }
                    }
                }
            }
        }
        
        // Check player quad (only for reflected rays, bounce > 0)
        bool playerFrontFacing = false;
        if (bounce > 0) {
            float playerT;
            vec3 playerHit;
            vec2 tempPlayerUV;
            bool tempFrontFacing;
            if (rayPlayerQuadIntersection(rayOrigin, rayDir, playerT, playerHit, tempPlayerUV, tempFrontFacing)) {
                // If player is closer than wall (or no wall hit), use player
                if (playerT < closestT && playerT > EPSILON) {
                    closestT = playerT;
                    closestHit = playerHit;
                    playerUV = tempPlayerUV;
                    playerFrontFacing = tempFrontFacing;
                    hitPlayer = true;
                    hitWall = false; // Player is closer than wall
                }
            }
        }
        
        // Handle player hit (closer than wall)
        if (hitPlayer) {
            // Sample appropriate player texture based on which side we're looking at
            vec4 playerColor = playerFrontFacing ? 
                texture2D(uPlayerTexture, playerUV) : 
                texture2D(uPlayerBackTexture, playerUV);
            
            // Apply alpha blending - if transparent, continue to background
            if (playerColor.a > 0.1) {
                accumulatedColor += playerColor.rgb * playerColor.a * reflectivity;
                
                // If not fully opaque, blend with background
                if (playerColor.a < 0.99) {
                    reflectivity *= (1.0 - playerColor.a);
                } else {
                    break;
                }
            }
            // Continue ray through transparent parts
            rayOrigin = closestHit + rayDir * EPSILON * 10.0;
            continue;
        }
        
        // Handle wall hit (reflects)
        if (hitWall) {
            // Add a subtle mirror surface color contribution (consistent for all mirrors)
            vec3 mirrorSurfaceColor = vec3(0.9, 0.95, 1.0); // Slight blue-white
            accumulatedColor += mirrorSurfaceColor * reflectivity * 0.12;
            
            // Apply mirror tint for next bounce
            reflectivity *= mirrorTint;
            
            // Reflect the ray
            rayDir = reflect(rayDir, closestNormal);
            rayOrigin = closestHit + closestNormal * EPSILON * 10.0; // Offset to avoid self-intersection
            
            continue;
        }
        
        // No wall or player hit - check floor/sky and finish
        float floorT;
        vec3 floorHit;
        if (rayFloorIntersection(rayOrigin, rayDir, floorT, floorHit)) {
            if (floorT < MAX_DIST) {
                accumulatedColor += renderFloor(floorHit) * reflectivity;
                break;
            }
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

