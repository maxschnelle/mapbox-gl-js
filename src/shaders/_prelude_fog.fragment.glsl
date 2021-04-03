#ifdef FOG

uniform vec2 u_fog_range;
uniform vec3 u_fog_color;
uniform vec3 u_haze_color_linear;
uniform float u_fog_opacity;
uniform float u_fog_exponent;
uniform float u_fog_sky_blend;
uniform float u_fog_temporal_offset;
uniform float u_haziness;

// A tone map is a smooth min between x and 1.0
vec3 tonemap (vec3 color) {
    // Exponential smooth min
    const float k = 8.0;
    return -log2(exp2(-k * color) + exp2(-k)) * (1.0 / k);

    // Cubic smooth min (works well)
    //const float k = 0.8;
    //vec3 h = max(k - abs(color - 1.0), vec3(0)) / k;
    //return max(vec3(0), min(color, vec3(1)) - h * h * h * k * (1.0 / 6.0));
}

// Assumes z up and camera_dir *normalized* (to avoid computing its length multiple
// times for different functions).
float fog_sky_blending(vec3 camera_dir) {
    float t = max(0.0, camera_dir.z / u_fog_sky_blend);
    // Factor of 3 chosen to roughly match smoothstep.
    // See: https://www.desmos.com/calculator/pub31lvshf
    return u_fog_opacity * exp(-3.0 * t * t);
}

float fog_opacity(vec3 pos) {
    float depth = length(pos);
    float start = u_fog_range.x;
    float end = u_fog_range.y;

    // The fog is not physically accurate, so we seek an expression which satisfies a
    // couple basic constraints:
    //   - opacity should be 0 at the near limit
    //   - opacity should be 1 at the far limit
    //   - the onset should have smooth derivatives to avoid a sharp band
    // To this end, we use an (1 - e^x)^n, where n is set to 3 to ensure the
    // function is C2 continuous at the onset. The fog is about 99% opaque at
    // the far limit, so we simply scale it and clip to achieve 100% opacity.
    // https://www.desmos.com/calculator/3taufutxid
    const float decay = 5.5;
    float falloff = max(0.0, 1.0 - exp(-decay * (depth - start) / (end - start)));

    // Cube without pow()
    falloff *= falloff * falloff;

    // Scale and clip to 1 at the far limit
    falloff = min(1.0, 1.00747 * falloff);

    return falloff * u_fog_opacity;
}

vec3 linear_to_srgb(vec3 color) {
    return pow(color, vec3(1.0 / 2.2));
}

vec3 srgb_to_linear(vec3 color) {
    return pow(color, vec3(2.2));
}

// Assumes z up
vec3 fog_apply_sky_gradient(vec3 camera_ray, vec3 sky_color) {
    return mix(sky_color, u_fog_color, fog_sky_blending(normalize(camera_ray)));
}

vec3 fog_apply(vec3 color, vec3 pos) {
    float haze_opac = fog_opacity(pos);
    // When haze is present, raise the fog to a power to decrease it
    float fog_opac = pow(haze_opac, u_fog_exponent);
    vec3 haze = u_haziness * haze_opac * u_haze_color_linear;

    // When there's any haze, we prefer the tone map, but when haze goes away,
    // we transition to simply the original color
    color = srgb_to_linear(color);
    color = mix(color, tonemap(color + haze), sqrt(haze_opac));

    // Mix the fog color to the result so that it still blends with the sky
    return mix(linear_to_srgb(color), u_fog_color, fog_opac);
}

// Un-premultiply the alpha, then blend fog, then re-premultiply alpha. For
// use with colors using premultiplied alpha
vec4 fog_apply_premultiplied(vec4 color, vec3 pos) {
    float a = 1e-4 + color.a;
    return vec4(fog_apply(min(color.rgb / a, vec3(1)), pos) * a, color.a);
}

vec3 fog_dither(vec3 color) {
    return dither(color, gl_FragCoord.xy + u_fog_temporal_offset);
}

vec4 fog_dither(vec4 color) {
    return vec4(fog_dither(color.rgb), color.a);
}

#endif
