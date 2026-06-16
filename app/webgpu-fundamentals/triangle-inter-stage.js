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
    label: 'our hardcoded rgb triangle shaders',
    code: /* wgsl */ `
    struct OurVertexShaderOutput {
      @builtin(position) position: vec4f,
      @location(0) color: vec4f,
    };

    @vertex fn vs(
      @builtin(vertex_index) vertexIndex : u32
    ) -> OurVertexShaderOutput {
      let pos = array(
        vec2f(0.0,0.5), // top center
        vec2f(-0.5,-0.5), // bottom left
        vec2f(0.5,-0.5), // bottom right
      );
      var color = array<vec4f, 3>(
        vec4f(1,0,0,1),  // red
        vec4f(0,1,0,1),  // green
        vec4f(0,0,1,1),  // blue
      );
      var vsOutput: OurVertexShaderOutput;
      vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
       vsOutput.color = color[vertexIndex];
      return vsOutput;
    }

    @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
      return fsInput.color;
    }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded green triangle pipeline',
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

  function render() {
    // Get the current texture from the canvas context
    // and set it as the texture to render to
    renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();
    
    // make a command encoder to start encoding commands
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

    // make a render pass encoder to encode render specific commands
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  render();
}