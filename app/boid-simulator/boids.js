import computeCode from './shaders/boids_compute.wgsl?raw';
import renderCode from './shaders/boids_render.wgsl?raw';

export async function main(canvas) {
  const adapter = await navigator.gpu?.requestAdapter();
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
  });
  
  let lastT = null;
  let lastWidth = canvas.width;
  let lastHeight = canvas.height;

  const BOID_COUNT = 700; // Number of boids on the screen
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
  }

  function writeParams(dt) {
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
  }

  const initial = makeInitialBoids();
  const boidBuffer = device.createBuffer({
    size: initial.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(
    boidBuffer,
    0,
    initial.buffer,
    initial.byteOffset,
    initial.byteLength,
  );
  
  const paramsBuffer = device.createBuffer({ // Buffer to store the params for the boids
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const viewBuffer = device.createBuffer({ // buffer to store the canvas view
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const computePipeline = device.createComputePipeline({
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
      targets: [{ format: format }]
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
  })

  writeParams(1 / 60);
  writeView();

  function frame(t) {
    const dt = lastT === null ? 1/60 : (t - lastT) / 1000;
    lastT = t;

    if (canvas.width !== lastWidth || canvas.height !== lastHeight) {
      context.configure({
        device: device,
        format: format,
        alphaMode: 'premultiplied',
      });
      lastWidth = canvas.width;
      lastHeight = canvas.height;
      // Also update view buffer with new aspect ratio
      writeView();
    }

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
  requestAnimationFrame(frame);

}
