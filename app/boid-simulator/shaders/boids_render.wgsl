struct View {
    aspect: f32, // the canvas aspect ratio (width/height)
    baseSize: f32, // base size for each boid triangle
    _pad0: vec2f, // padding for gpu memory alignment
};

// Imports the view struct from GPU memoery that JS wrote.
// Uniform is the same for all invocations
@group(0) @binding(0) var<uniform> view: View;

struct Boid {
    pos: vec2f, // 2d position vector
    vel: vec2f, // 2d velocity vector
};

// Imports an array of boid data as read-only storage;
// slower than uniform but can be large
// render shader just reads from it, the compute shader will update it
@group(0) @binding(1) var<storage, read> boids: array<Boid>;

struct VSOut { // Defines vector shader outputs for each vector
    @builtin(position) pos: vec4f,
    @location(0) color: vec3f,
};

// Safely normalises a vector to length 1 without dividing by 0
// Used to extract the direction the boid is heading 
// from it's velocity vector
fn safeNormalise(v: vec2f) -> vec2f {
    let l2 = dot(v, v); // squared length
    if (l2 < 1e-8) { return vec2f (1.0, 0.0); } // test if squared length is near zero
    return v * inverseSqrt(l2); // this gives us normalised vector
}

// This rotates a triangle's local cooardinates by the boids heading.
fn rotation(v: vec2f, direction: vec2f) -> vec2f {
    let c = direction.x; // cosine of the rotation
    let s = direction.y; // sine of the rotation
    return vec2f(v.x * c - v.y * s, v.x * s + v.y * c); // apply 2D rotation matrix
}

// color function that maps a scalar value t (0 to 1) to an RGB color using a cosine wave
// we will use t = speed / maxSpeed so that faster boids get a different color
fn palette(t: f32) -> vec3f {
  let a = vec3f(0.50, 0.50, 0.50); // color offset - brightness
  let b = vec3f(0.50, 0.50, 0.50); // color amplitude - saturation
  let c = vec3f(1.00, 1.00, 1.00); // frequency - color cycles as to goes from 0 to 1
  let d = vec3f(0.00, 0.10, 0.05); // phase offset - creates a gradient of colors
  return a + b * cos(6.28318 * (c * t + d));
}

@vertex
fn vs_main( // vertex shader function name and entry point
    @builtin(vertex_index) vid: u32, // for pass.draw(3, BOID_COUNT) endcoder command
    @builtin(instance_index) iid: u32
) -> VSOut {
    let b = boids[iid]; // get the boids position and velocity
    let heading = safeNormalise(b.vel); // convert velocity into unit direction vector

    // this is where we define a triangle in local space before rotation, position and size
    var local = vec2f(0.0);
    if (vid == 0u) {
        local = vec2f(1.2, 0.0);
    } else if (vid == 1u) {
        local = vec2f(-0.9, 0.55);
    } else {
        local = vec2f(-0.9, -0.55);
    }

    // graphic technique to produce a pseudo random number between 0 and 1 based on index
    let jitter = fract(sin(f32(iid) * 12.9898) * 43758.5453);
    // allows boids to vary in size
    let size = view.baseSize * (0.85 + 0.45 * jitter);

    // we scale the triangle with size and rotate it so it points in the direction it is heading
    var p = rotation(local * size, heading);
    // correct the x axis stretch by dividing by the x-coord by the aspect ratio
    p.x /= max(view.aspect, 1e-6);

    // we translate the boids position in the world space (canvas)
    let world = b.pos + p;

    let speed = length(b.vel); // gets the maginitude of the velocity vector

    // boid speed over a reference max speed (calculated using baseSize) and clamped to [0,1]
    let t = clamp(speed / (view.baseSize * 20.0), 0.0, 1.0);
    let col = palette(t); // color based on speed

    var out: VSOut;
    out.pos = vec4f(world, 0.0, 1.0); // set position
    out.color = col; // set color
    return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
    return vec4f(in.color, 1.0);
}