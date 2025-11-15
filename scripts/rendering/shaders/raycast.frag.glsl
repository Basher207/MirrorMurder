uniform sampler2D uMazeTexture;
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
const float CEILING_Y = 3.0;
const float MAX_DIST = 100.0;
const float EPSILON = 0.001;

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
    // Procedural sky with gradient and simple clouds
    float horizon = rayDir.y;
    
    // Sky gradient
    vec3 skyTop = vec3(0.1, 0.2, 0.4);
    vec3 skyHorizon = vec3(0.5, 0.7, 0.9);
    vec3 skyColor = mix(skyHorizon, skyTop, max(0.0, horizon));
    
    // Simple cloud-like noise
    float cloudPattern = sin(rayDir.x * 10.0 + uTime * 0.1) * 
                        cos(rayDir.z * 10.0 + uTime * 0.15) * 
                        sin(rayDir.y * 5.0);
    cloudPattern = smoothstep(0.3, 0.8, cloudPattern * 0.5 + 0.5);
    
    // Add clouds only above horizon
    if (horizon > 0.0) {
        skyColor = mix(skyColor, vec3(1.0, 1.0, 1.0), cloudPattern * 0.3 * horizon);
    }
    
    // Sun glow
    vec3 sunDir = normalize(vec3(0.5, 0.3, 0.8));
    float sunDot = max(0.0, dot(rayDir, sunDir));
    float sun = pow(sunDot, 32.0);
    skyColor += vec3(1.0, 0.9, 0.7) * sun * 0.5;
    
    return skyColor;
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
// Floor Rendering
// ================================================================

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
    // Check floor intersection
    float t;
    vec3 hitPos;
    
    if (rayFloorIntersection(origin, dir, t, hitPos)) {
        // Check if hit is within reasonable distance
        if (t < MAX_DIST) {
            return renderFloor(hitPos);
        }
    }
    
    // No hit - render sky
    return renderSky(dir);
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

