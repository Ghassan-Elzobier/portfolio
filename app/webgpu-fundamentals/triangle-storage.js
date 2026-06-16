export async function main(canvas) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return; 
  }
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  const module = device.createShaderModule({
    label: 'our hardcoded green triangle shaders',
    code: /* wgsl */ `
    struct OurStruct {
      color: vec4f,
      offset: vec2f,
    };

    struct OtherStruct {
      scale: vec2f,
    };

    struct Vertex {
      position: vec2f,
    };

    struct VSOutput {
      @builtin(position) position: vec4f,
      @location(0) color: vec4f,
    };

    @group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
    @group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;
    @group(0) @binding(2) var<storage, read> pos: array<Vertex>;

    @vertex fn vs(
      @builtin(vertex_index) vertexIndex: u32,
      @builtin(instance_index) instanceIndex: u32
    ) -> VSOutput {
      let otherStruct = otherStructs[instanceIndex];
      let ourStruct = ourStructs[instanceIndex];

      var vsOut: VSOutput;
      vsOut.position = vec4f(
        pos[vertexIndex].position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
      vsOut.color = ourStruct.color;
      return vsOut;
    }

    @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
      return vsOut.color;
    }
    `,
  });

  // A random number between [min and max)
  // With 1 argument it will be [0 to min)
  // With no arguments it will be [0 to 1)
  const rand = (min, max) => {
    if (min === undefined) {
      min = 0;
      max = 1;
    } else if (max === undefined) {
      max = min;
      min = 0;
    }
    return min + Math.random() * (max - min);
  }

  function createCircleVertices({
    radius = 1,
    numSubdivisions = 24,
    innerRadius = 0,
    startAngle = 0,
    endAngle = Math.PI * 2,
  } = {}) {
    // 2 triangles per subdivision, 3 verts per tri, 2 values (xy) each.
    const numVertices = numSubdivisions * 3 * 2;
    const vertexData = new Float32Array(numSubdivisions * 2 * 3 * 2);

    let offset = 0;
    const addVertex = (x, y) => {
      vertexData[offset++] = x;
      vertexData[offset++] = y;
    };

    // 2 triangles per subdivision
    //
    // 0--1 4
    // | / /|
    // |/ / |
    // 2 3--5
    for (let i = 0; i < numSubdivisions; ++i) {
      const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
      const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;

      const c1 = Math.cos(angle1);
      const s1 = Math.sin(angle1);
      const c2 = Math.cos(angle2);
      const s2 = Math.sin(angle2);

      // first triangle
      addVertex(c1 * radius, s1 * radius);
      addVertex(c2 * radius, s2 * radius);
      addVertex(c1 * innerRadius, s1 * innerRadius);
      
      // second triangle
      addVertex(c1 * innerRadius, s1 * innerRadius);
      addVertex(c2 * radius, s2 * radius);
      addVertex(c2 * innerRadius, s2 * innerRadius);
    }

    return {
      vertexData,
      numVertices,
    };
  }

  // setup a storage buffer with vertex data
  const { vertexData, numVertices } = createCircleVertices({
    radius: 0.5,
    innerRadius: 0.25,
  });
  const vertexStorageBuffer = device.createBuffer({
    label: 'storage buffer for vertices',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexStorageBuffer, 0, vertexData);

  const pipeline = device.createRenderPipeline({
    label: 'our randomised triangles  pipeline',
    layout: 'auto',
    vertex: {
      entryPoint: 'vs',
      module,
    },
    fragment: {
      entryPoint: 'fs',
      module,
      targets: [{ format: presentationFormat }]
    },
  });

  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [{
      // view: <- to be filled out when we render
      clearValue: [0.1,0.1,0.1,1],
      loadOp: 'clear',
      storeOp: 'store',
    }]
  };

  const kNumbObjects = 100;
  const objectInfos = [];

  const staticUnitSize = 
    4 * 4 + // color is 4 32bit floats (4bytes each)
    2 * 4 + // offset is 2 32bit floats (4bytes each)
    2 * 4; // padding

  const changingUnitSize =
    2 * 4; // scale is 2 32bit floats (4bytes each)
  
  const staticStorageBufferSize = staticUnitSize * kNumbObjects;
  const changingStorageBufferSize = changingUnitSize * kNumbObjects;

  const staticStorageBuffer = device.createBuffer({
    label: "static storage for objects",
    size: staticStorageBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const changingStorageBuffer = device.createBuffer({
    label: "changing storage for objects",
    size: changingStorageBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const kColorOffset = 0;
  const kOffsetOffset = 4;

  const kScaleOffset = 0;

  {// create a typed array to hold the values for the uniforms in Javascript  
    const staticStorageValues = new Float32Array(staticStorageBufferSize / 4);
    for (let i = 0; i < kNumbObjects; ++i) {
      const staticOffset = i * (staticUnitSize / 4);

      staticStorageValues.set([rand(),rand(),rand(),1], staticOffset + kColorOffset); // set the color
      staticStorageValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset+ kOffsetOffset); // set the offset
      
      objectInfos.push({
        scale: rand(0.2, 0.5),
      });
    }
    device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues);
  }

  const storageValues = new Float32Array(changingStorageBufferSize / 4);
  
  const bindGroup = device.createBindGroup({
    label: `bind group for objects`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {binding: 0, resource: staticStorageBuffer},
      {binding: 1, resource: changingStorageBuffer},
      {binding: 2, resource: vertexStorageBuffer},
    ]
  });
  
  
  function render() {
    // Get the current texture from the canvas context
    // and set it as the texture to render to
    renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();
    
    // make a command encoder to start encoding commands
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

    // make a render pass encoder to encode render specific commands
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);

    // Set the uniform values in our JavaScript side Float32Array
    const aspect = canvas.width / canvas.height;
    objectInfos.forEach(({scale}, ndx) => {
      const offset = ndx * (changingUnitSize / 4);
      storageValues.set([scale / aspect, scale], offset + kScaleOffset); // set the scale
    });
    // upload all scales at once
    device.queue.writeBuffer(changingStorageBuffer,0,storageValues);

    pass.setBindGroup(0, bindGroup);
    pass.draw(numVertices, kNumbObjects); // call our vertex shader 3 times for each instance
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  

  render();
}