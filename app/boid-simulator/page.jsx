'use client';
import { useRef, useEffect } from 'react';
import Link from 'next/link';

// Add sections as you build the simulation
// Boids (WebGPU) — learning journey sections
// First real graphics project: raw WebGPU + WGSL flocking sim.

// Boids (WebGPU) — learning journey sections
// Worked from a reference project and broke it down piece by piece
// using what I'd learned from WebGPU Fundamentals.

// Boids (WebGPU) — learning journey sections
// Worked from a reference project and broke it down using
// what I'd learned from WebGPU Fundamentals.

const sections = [
  {
    id: 'overview',
    type: 'description',
    title: 'Boids in WebGPU: reading before writing',
    content: [
      "This was my way into graphics programming. Instead of starting from a blank file, I worked from an existing boids (flocking) reference project in raw WebGPU and WGSL and spent my time pulling it apart.",
      "I'd just been through webgpufundamentals.org, so I had the building blocks: adapters and devices, uniform and storage buffers, bind groups, pipelines, compute shaders, instanced rendering. The reference used all of them at once, which is why I picked it. It was a chance to see how they fit together in something real.",
      "The honest framing: I didn't invent this. I read it, typed it out with my own comments, broke it in small ways to see what each part did, and put it back together. The comments in the code below are mine.",
    ],
  },

  {
    id: 'setup-code',
    type: 'code',
    filename: 'boids.js',
    language: 'JavaScript',
    code: `const adapter = await navigator.gpu?.requestAdapter();
const device = await adapter?.requestDevice();
if (!device) {
    console.error('need a browser that supports WebGPU');
    return;
}

const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();

context.configure({
  device: device,
  format: format,
  alphaMode: 'premultiplied',
});`,
  },
  {
    id: 'setup-desc',
    type: 'description',
    title: 'Getting WebGPU running',
    content: [
      "Standard WebGPU setup from the fundamentals. You request an adapter (the physical GPU) and then a device (your handle for sending it work).",
      "configure() connects the canvas to the device and uses the browser's preferred texture format. I kept the reference's choices here since they're the sensible defaults.",
    ],
  },

  {
    id: 'boids-code',
    type: 'code',
    filename: 'boids.js',
    language: 'JavaScript',
    code: `const BOID_COUNT = 700; // Number of boids on the screen
const BASE_SIZE = 0.028; // Size of each boid

function makeInitialBoids() {
  const data = new Float32Array(BOID_COUNT * 4); // 4 floats needed to describe boid
  let idx = 0
  for (let i = 0; i < BOID_COUNT; i++) {
    data[idx++] = (Math.random() * 2 - 1) * 0.9; // the x position of the boid on the screen
    data[idx++] = (Math.random() * 2 - 1) * 0.9; // the y position of the boid

    const a = Math.random() * Math.PI * 2; // random angle in radians
    const s = 0.25 + Math.random() * 0.35; // random speed between 0.25 and 0.6
    data[idx++] = Math.cos(a) * s; // Velovity in x direction
    data[idx++] = Math.sin(a) * s; // Velovity in y direction
  }
  return data;
}`,
  },
  {
    id: 'boids-desc',
    type: 'description',
    title: 'A boid is just four numbers',
    content: [
      "Each boid is four floats: x, y, velocity x, velocity y, with all 700 packed into one flat Float32Array. This is the storage buffer pattern from the fundamentals: the GPU wants a contiguous block of numbers, and the shader reads it back as an array of structs.",
      "Positions start near the middle of the screen, and each boid gets a random heading and speed so they don't all set off the same way.",
    ],
  },

  {
    id: 'params-code',
    type: 'code',
    filename: 'boids.js',
    language: 'JavaScript',
    code: `function writeParams(dt) {
  const buf = new ArrayBuffer(64); // A CPU buffer to store all params before transfer to GPU
  const f32 = new Float32Array(buf); // A view into the buffer array to add floats
  const u32 = new Uint32Array(buf); // A view into the buffer array to add unsigned ints

  f32[0] = dt; // time delta for frames

  u32[1] = BOID_COUNT; // how many boids to process

  f32[2] = 0.06; // separationDist (avoid crowding)
  f32[3] = 0.14; // alignmentDist (match heading)

  f32[4] = 0.22; // cohesionDist (move toward center)
  f32[5] = 0.55; // maxSpeed
  f32[6] = 1.25; // maxForce (how hard to steer)
  f32[7] = 0.0; // padding

  f32[8] = 1.35; // separationWeight (how much to care about separation)
  f32[9] = 0.95; // alignmentWeight
  f32[10] = 0.75; // cohesionWeight
  f32[11] = 0.3; // boundsWeight (push toward center if too close to edge)

  device.queue.writeBuffer(paramsBuffer, 0, buf);  // write params to GPU params buffer
}

function writeView() {
  const aspect = canvas.width / Math.max(canvas.height, 1);
  const view = new Float32Array([aspect, BASE_SIZE, 0, 0]);
  device.queue.writeBuffer(viewBuffer, 0, view)
}`,
  },
  {
    id: 'params-desc',
    type: 'description',
    title: 'Uniforms and the padding that matters',
    content: [
      "The params buffer holds the tuning knobs (neighbour distances, max speed, the weight of each rule). They're the same for every boid, so they go in a uniform buffer. The view buffer just carries aspect ratio and boid size.",
      "The f32[7] = 0.0 padding is the detail worth flagging. The uniforms chapter in the fundamentals covers struct alignment, and this is it in practice: the JS layout has to match the shader struct field for field, padding included, or values land in the wrong place.",
    ],
  },

  {
    id: 'pipeline-code',
    type: 'code',
    filename: 'boids.js',
    language: 'JavaScript',
    code: `const computePipeline = device.createComputePipeline({
  layout: "auto",
  compute: {
    module: device.createShaderModule({ code: computeCode }),
    entryPoint: "main",
  }
});

const renderPipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: {
    module: device.createShaderModule({ code: renderCode }),
    entryPoint: "vs_main",
  },
  fragment: {
    module: device.createShaderModule({ code: renderCode }),
    entryPoint: "fs_main",
    targets: [{ format: format }],
  },
  primitive: { topology: "triangle-list" },
});

const computeBindGroup = device.createBindGroup({ // Bind group to feed params and boid data into compute shader
  layout: computePipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: paramsBuffer }},
    { binding: 1, resource: { buffer: boidBuffer }}, // needed to compute and render
  ]
});

const renderBindGroup = device.createBindGroup({
  layout: renderPipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: viewBuffer } },
    { binding: 1, resource: { buffer: boidBuffer } }, // needed to compute and render
  ]
})`,
  },
  {
    id: 'pipeline-desc',
    type: 'description',
    title: 'Two pipelines sharing one buffer',
    content: [
      "The compute pipeline runs the flocking maths and updates every boid; the render pipeline draws them. The fundamentals covered each kind separately, and this project is where they sit side by side.",
      "Both bind groups point at the same boid buffer. The compute shader writes to it, the render shader only reads it. That shared buffer is the whole trick: the simulation and the drawing stay in sync without ever copying data back to the CPU.",
      "The reference uses layout: 'auto', which generates the bind group layouts for you. Explicit layouts give more control, and that's something I'd reach for writing this from scratch.",
    ],
  },

  {
    id: 'frame-code',
    type: 'code',
    filename: 'boids.js',
    language: 'JavaScript',
    code: `function frame(t) {
  const dt = lastT === null ? 1/60 : (t - lastT) / 1000;
  lastT = t;

  const stepDt = Math.min(dt, 1 / 30);
  writeParams(stepDt);
  writeView();

  const encoder = device.createCommandEncoder();

  { // Run compute shader (updates positions / velocities)
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, computeBindGroup);
    pass.dispatchWorkgroups(Math.ceil(BOID_COUNT / 64)); // 700 / 64 = 11 workgroups, 64 threads each
    pass.end();
  }

  {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.02, g: 0.02, b: 0.03, a: 1},
        }
      ]
    });

    pass.setPipeline(renderPipeline);
    pass.setBindGroup(0, renderBindGroup);
    pass.draw(3, BOID_COUNT); // draw a triangle, with BOID_COUNT instances
    pass.end();
  }

  device.queue.submit([encoder.finish()]);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);`,
  },
  {
    id: 'frame-desc',
    type: 'description',
    title: 'What happens each frame',
    content: [
      "Each frame: work out the time delta, push the latest params, run the compute pass, then the render pass. Both passes share one command encoder and submit together, so the boids are drawn using the positions computed that same frame.",
      "The Math.min clamp on stepDt is there so a long pause (like switching tabs) can't feed a huge dt into the simulation and fling everything off screen.",
    ],
  },

  {
    id: 'compute-code',
    type: 'code',
    filename: 'boids_compute.wgsl',
    language: 'WGSL',
    code: `// 64 threads per workgroup
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
    }`,
  },
  {
    id: 'compute-desc',
    type: 'description',
    title: 'The three rules',
    content: [
      "This is the heart of it. One compute thread per boid, dispatched in workgroups of 64. Each boid loops over all the others and accumulates three pulls: separation (don't crowd), alignment (match nearby headings), cohesion (drift toward the group's centre).",
      "Two details worth pointing out: it compares squared distances to skip the square root, and separation uses inverseSqrt so closer neighbours push harder. The loop is O(n squared), which is fine at 700 but doesn't scale. A spatial grid for the neighbour search is the obvious next step.",
    ],
  },

  {
    id: 'steer-code',
    type: 'code',
    filename: 'boids_compute.wgsl',
    language: 'WGSL',
    code: `    var steer = vec2f(0.0);  // initialise steering force

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
}`,
  },
  {
    id: 'steer-desc',
    type: 'description',
    title: 'From three pulls to one steering force',
    content: [
      "Each rule turns into a desired velocity, then steers by the difference between desired and current. That desired-minus-current is what makes turning gradual rather than instant. clampMagnitude caps how hard a boid can steer per frame to keep the motion smooth, and the bounds block is a light nudge back from the edges.",
      "The last lines are plain Euler integration: add steering to velocity, cap the speed, move the position, wrap around the edges, write back to the buffer.",
    ],
  },

  {
    id: 'render-code',
    type: 'code',
    filename: 'boids_render.wgsl',
    language: 'WGSL',
    code: `@vertex
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
}`,
  },
  {
    id: 'render-desc',
    type: 'description',
    title: 'Drawing 700 triangles in one call',
    content: [
      "This is instanced rendering from the fundamentals. draw(3, 700) draws one triangle 700 times, and the shader uses the instance index to pick which boid it's drawing.",
      "Per vertex, the shader builds a small arrow-shaped triangle in local space, rotates it to face the boid's velocity, scales it, corrects for the screen's aspect ratio, then places it at the boid's position. Colour comes from speed through a cosine palette.",
    ],
  },

  {
    id: 'takeaways',
    type: 'description',
    title: 'What I took from it',
    content: [
      "Reading a working reference closely pushed me into patterns I wouldn't have reached for alone, the clearest being one buffer shared between a compute and a render pipeline.",
      "Still on the list: explicit pipeline layouts, a spatial grid for the neighbour search, and writing something like this from scratch rather than from a reference. That last one is the real test.",
    ],
  },
];

function SimulationCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    import('./boids.js')
      .then(({ main }) => { if (!cancelled) main(canvas); })
      .catch(console.error);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-white/10"
      style={{ aspectRatio: '16/9', background: '#06091f' }}
    >
      <div
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{ boxShadow: '0 0 80px rgba(51,194,204,0.07) inset' }}
      />
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}

function CodeBlock({ filename, language, code }) {
  const lines = code.split('\n');
  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/10"
        style={{ background: '#0d1117' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#ffbd2e' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#28ca41' }} />
          </div>
          <span className="text-xs text-neutral-400 font-mono">{filename}</span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded font-mono"
          style={{
            color: '#33c2cc',
            background: 'rgba(51,194,204,0.1)',
            border: '1px solid rgba(51,194,204,0.2)',
          }}
        >
          {language}
        </span>
      </div>
      <div className="overflow-x-auto" style={{ background: '#070b14' }}>
        <table className="border-collapse text-sm font-mono" style={{ minWidth: '100%' }}>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                <td
                  className="text-right pr-4 pl-4 py-px text-xs text-neutral-600"
                  style={{ minWidth: '3rem', userSelect: 'none' }}
                >
                  {i + 1}
                </td>
                <td className="pr-6 py-px text-neutral-300 whitespace-pre">
                  {line || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Description({ title, content }) {
  return (
    <div
      className="space-y-3 pl-5 border-l-2"
      style={{ borderColor: 'rgba(51,194,204,0.35)' }}
    >
      {title && (
        <h3 className="text-white font-semibold text-lg">{title}</h3>
      )}
      {content.map((para, i) => (
        <p key={i} className="text-neutral-400 leading-relaxed">{para}</p>
      ))}
    </div>
  );
}

export default function BoidSimulator() {
  return (
    <div className="min-h-screen bg-primary">
      <header
        className="sticky top-0 z-10 flex items-center gap-4 px-6 py-4 border-b border-white/10"
        style={{ background: 'rgba(6,9,31,0.7)', backdropFilter: 'blur(8px)' }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Back
        </Link>
        <span className="text-white/20 select-none">|</span>
        <h1 className="text-white font-semibold tracking-wide">Boid Simulator</h1>
        <div className="flex gap-2 ml-auto">
          <span className="text-xs font-medium px-2 py-1 rounded-full border" style={{ color: '#33c2cc', borderColor: 'rgba(51,194,204,0.3)', background: 'rgba(51,194,204,0.08)' }}>WebGPU</span>
          <span className="text-xs font-medium px-2 py-1 rounded-full border" style={{ color: '#7a57db', borderColor: 'rgba(122,87,219,0.3)', background: 'rgba(122,87,219,0.08)' }}>TypeScript</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        <SimulationCanvas />
        {sections.map((section) =>
          section.type === 'code' ? (
            <CodeBlock
              key={section.id}
              filename={section.filename}
              language={section.language}
              code={section.code}
            />
          ) : (
            <Description
              key={section.id}
              title={section.title}
              content={section.content}
            />
          )
        )}
      </main>
    </div>
  );
}
