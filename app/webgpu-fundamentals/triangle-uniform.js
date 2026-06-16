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

    @group(0) @binding(0) var<uniform> ourStruct: OurStruct;
    @group(0) @binding(1) var<uniform> otherStruct: OtherStruct;

    @vertex fn vs(
      @builtin(vertex_index) vertexIndex : u32
    ) -> @builtin(position) vec4f {
      let pos = array(
        vec2f(0.0,0.5), // top center
        vec2f(-0.5,-0.5), // bottom left
        vec2f(0.5,-0.5), // bottom right
      );
      return vec4f(pos[vertexIndex] * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
    }

    @fragment fn fs() -> @location(0) vec4f {
      return ourStruct.color;
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

  const staticUniformBufferSize = 
    4 * 4 + // color is 4 32bit floats (4bytes each)
    2 * 4 + // offset is 2 32bit floats (4bytes each)
    2 * 4; // padding

  const uniformBufferSize =
    2 * 4; // scale is 2 32bit floats (4bytes each)


  const kColorOffset = 0;
  const kOffsetOffset = 4;

  const kScaleOffset = 0;

  const kNumbObjects = 100;
  const objectInfos = [];

  for (let i = 0; i < kNumbObjects; i++) {
    const staticUniformBuffer = device.createBuffer({
      label: `static uniforms for obj: ${i}`,
      size: staticUniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    {// create a typed array to hold the values for the uniforms in Javascript  
      const uniformValues = new Float32Array(staticUniformBufferSize / 4);
      uniformValues.set([rand(),rand(),rand(),1], kColorOffset); // set the color
      uniformValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], kOffsetOffset); // set the offset

      device.queue.writeBuffer(staticUniformBuffer, 0, uniformValues);
    }

    const uniformValues = new Float32Array(uniformBufferSize / 4);
    const uniformBuffer = device.createBuffer({
      label: `changing uniforms for obj: ${i}`,
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })


    const bindGroup = device.createBindGroup({
      label: `bind group for obj: ${i}`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {binding: 0, resource: staticUniformBuffer},
        {binding: 1, resource: uniformBuffer},
      ]
    });

    objectInfos.push({
      scale: rand(0.2, 0.5),
      uniformBuffer,
      uniformValues,
      bindGroup,
    })
  }
  
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
    for (const {scale, bindGroup, uniformBuffer, uniformValues} of objectInfos) {
      uniformValues.set([scale / aspect, scale], kScaleOffset); // set the scale
      // copy the values from JavaScript to the GPU
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
    }
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  

  render();
}