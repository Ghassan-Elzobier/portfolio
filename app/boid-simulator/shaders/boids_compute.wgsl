struct Params {
    dt: f32, // Time passed since last frame
    count: u32, // number of boids

    separationDist: f32, // how close boids need to be before they repel eachother
    alignmentDist: f32, // How far boids can see before we average their velocity direction

    cohesionDist: f32, // how far a boid can see to move to the center of a flock
    maxSpeed: f32, // max speed cap
    maxForce: f32, // how much a boid can steer per frame
    _pad0: f32, // padding for gpu allignment

    separationWeight: f32, // how much the boid cares about separation
    alignmentWeight: f32, // how much the boid cares about allignment
    cohesionWeight: f32, // how much the boid cares about moving to the center of the flock
    boundsWeight: f32, // how much the boid cares about staying in bounds
};

// Our pipeline updates params every frame with current simulation parameters
@group(0) @binding(0) var<uniform> p: Params;

// Each boid has a position and velocity
struct Boid {
    pos: vec2f, 
    vel: vec2f,
};

// Now we are storing as read write so we can update the boids data
@group(0) @binding(1) var<storage, read_write> boids: array<Boid>;

// squared length helper fn
fn length2(v: vec2f) -> f32 { return dot(v, v); }

// normalise a vector, if near 0 return a 0 vector
fn safeNormalize(v: vec2f) -> vec2f {
    let l2 = length2(v);
    if (l2 < 0.00000001) { 
        return vec2f(0.0, 0.0);
    }
    return v * inverseSqrt(l2);
}

// if the vector is too large, normalise the vector and scale it to max length
// This will help us clamp the max steering force
fn clampMagnitude(v: vec2f, maxLen: f32) -> vec2f {
    let l2 = length2(v);
    if (l2 > maxLen * maxLen) {
        return safeNormalize(v) * maxLen;
    }
    return v;
}

// toroidal wrapping boids, reappear on opposite edge
fn wrap(pos: vec2f) -> vec2f {
    var p2 = pos;
    if (p2.x < -1.1) { p2.x =  1.1; }
    if (p2.x >  1.1) { p2.x = -1.1; }
    if (p2.y < -1.1) { p2.y =  1.1; }
    if (p2.y >  1.1) { p2.y = -1.1; }
    return p2;
}

// 64 threads per workgroup
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x; // use global invocation index to loop through each boid
    if (i >= p.count) { return; }

    let me = boids[i];
    var pos = me.pos; // gets boid position
    var vel = me.vel; // gets boid velocity

    // We use these variables to calculate the stearing force later
    var separation = vec2f(0.0); // Separation accumulator
    var alignment  = vec2f(0.0); // alignment accumulator
    var cohesion   = vec2f(0.0); // cohesion accumulator

    var sepCount: f32 = 0.0; // boids in separation range
    var aliCount: f32 = 0.0; // boids in alignment range
    var cohCount: f32 = 0.0; // boids in cohesion range

    // squared distances before loop for optimisation
    let sepD2 = p.separationDist * p.separationDist;
    let aliD2 = p.alignmentDist  * p.alignmentDist;
    let cohD2 = p.cohesionDist   * p.cohesionDist;

    for (var j: u32 = 0u; j < p.count; j = j + 1u) { // loop through every boid
        if (j == i) { continue; } // skip ourselves

        let other = boids[j]; // fetch boid we are checking
        let d = other.pos - pos; // displacement vector from us to the neighbour
        let d2 = dot(d, d); // squared distance

        if (d2 < sepD2 && d2 > 0.00000001) { // if neighbour is within separation distance
        separation -= d * inverseSqrt(d2); // accumulate a repulsion vector
        sepCount += 1.0; // count this neighbour
        } // accumulate a normalised vector pointing away from neighbours

        if (d2 < aliD2) { // if neighbour is within sight range
        alignment += other.vel; // accumulate their velocity vector
        aliCount += 1.0; // count this neighbour
        }

        // if a neighbour is within sight range we move towards their location
        if (d2 < cohD2) { // if neighbour is within cohesion distance
        cohesion += other.pos; // accumalte their position vector
        cohCount += 1.0; // count this neighbour
        }
    }

    var steer = vec2f(0.0);  // initialise steering force

    if (sepCount > 0.0) {
        // desired is the repulsion direction we want to move in, at max speed
        let desired = safeNormalize(separation / sepCount) * p.maxSpeed;
        // the steering is the difference between the current velocity and repulsion velocity
        steer += clampMagnitude(desired - vel, p.maxForce) * p.separationWeight;
    }

    if (aliCount > 0.0) {
        // move at max speed in the direction the neighbours are moving
        let desired = safeNormalize(alignment / aliCount) * p.maxSpeed;
        // steering to match the neighbours heading
        steer += clampMagnitude(desired - vel, p.maxForce) * p.alignmentWeight;
    }

    if (cohCount > 0.0) {
        let center = cohesion / cohCount; // center of mass of nearby boids
        let desired = safeNormalize(center - pos) * p.maxSpeed; // move at max speed to center
        // steering needed to move to center
        steer += clampMagnitude(desired - vel, p.maxForce) * p.cohesionWeight;
    }

    let margin = 0.95;
    var bounds = vec2f(0.0);
    // at bounds add opposing force
    if (pos.x < -margin) { bounds.x += 1.0; }
    if (pos.x >  margin) { bounds.x -= 1.0; }
    if (pos.y < -margin) { bounds.y += 1.0; }
    if (pos.y >  margin) { bounds.y -= 1.0; }
    // add to steering velocity weighted by parameter
    steer += bounds * p.boundsWeight;

    // apply the steering forces and update the boid's motion.
    vel = vel + steer * p.dt; // Euler integration for velocity
    vel = clampMagnitude(vel, p.maxSpeed);

    pos = pos + vel * p.dt; // Euler Integration for position
    pos = wrap(pos);

    // write to buffer
    boids[i].pos = pos;
    boids[i].vel = vel;
}
