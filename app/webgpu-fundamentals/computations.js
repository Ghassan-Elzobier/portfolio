export async function main(container) {
  function log(...args) {
    const elem = document.createElement('pre');
    elem.textContent = args.join(' ');
    container.appendChild(elem);
  }
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) {
        console.log('need a browser that supports WebGPU');
        return;
    }

    const dispatchCount = [4, 3, 2];
    const workgroupSize = [2, 3, 4];

    // multiply all elements of an array
    const arrayProd = arr => arr.reduce((a,b) => a*b);

    const numThreadsPerWorkgroup = arrayProd(workgroupSize);

    const code = /* wgsl*/ `
        @group(0) @binding(0) var<storage, read_write> workgroupResult: array<vec3u>;
        @group(0) @binding(1) var<storage, read_write> localResult: array<vec3u>;
        @group(0) @binding(2) var<storage, read_write> globalResult: array<vec3u>;

        @compute @workgroup_size(${workgroupSize}) fn computeSomething(
            @builtin(workgroup_id) workgroup_id: vec3<u32>,
            @builtin(local_invocation_id) local_invocation_id: vec3<u32>,
            @builtin(global_invocation_id) global_invocation_id: vec3<u32>,
            @builtin(local_invocation_index) local_invocation_index: u32,
            @builtin(num_workgroups) num_workgroups: vec3<u32>,
        ) {
            let workgroup_index =
                workgroup_id.x +
                workgroup_id.y * num_workgroups.x +
                workgroup_id.y * num_workgroups.x * num_workgroups.z;
                
            let global_invocation_index =
                workgroup_index * ${numThreadsPerWorkgroup} +
                local_invocation_index;
            
            workgroupResult[global_invocation_index] = workgroup_id;
            localResult[global_invocation_index] = local_invocation_id;
            globalResult[global_invocation_index] = global_invocation_id;
        }
        `;
    
    const module = device.createShaderModule({code});

    const numWorkgroups = arrayProd(dispatchCount);
    const numResults = numWorkgroups * numThreadsPerWorkgroup;
    const size = numResults * 4 * 4; // vec3f * u32

    let usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
    const workgroupBuffer = device.createBuffer({size, usage});
    const localBuffer = device.createBuffer({size, usage});
    const globalBuffer = device.createBuffer({size, usage});
    
    usage = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;
    const workgroupReadBuffer = device.createBuffer({size, usage});
    const localReadBuffer = device.createBuffer({size, usage});
    const globalReadBuffer = device.createBuffer({size, usage});
    

    const pipeline = device.createComputePipeline({
        label: 'doubling compute pipeline',
        layout: 'auto',
        compute: {
            module,
        },
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {binding: 0, resource: workgroupBuffer},
            {binding: 1, resource: localBuffer},
            {binding: 2, resource: globalBuffer},
        ]
    })

    // Encode commands to do the computation
    const encoder = device.createCommandEncoder({
        label: 'compute builtin encoder'
    });
    const pass = encoder.beginComputePass({
        label: 'compute builtin pass',
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(...dispatchCount);
    pass.end();
    // Encode a command to copy the results to a mappable buffer
    encoder.copyBufferToBuffer(workgroupBuffer,0,workgroupReadBuffer,0,size);
    encoder.copyBufferToBuffer(localBuffer,0,localReadBuffer,0,size);
    encoder.copyBufferToBuffer(globalBuffer,0,globalReadBuffer,0,size);
    // Finish encoding and submit the commands
    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    // Read the results
    await Promise.all([
        workgroupReadBuffer.mapAsync(GPUMapMode.READ),
        localReadBuffer.mapAsync(GPUMapMode.READ),
        globalReadBuffer.mapAsync(GPUMapMode.READ),
    ]);

    const workgroup = new Uint32Array(workgroupReadBuffer.getMappedRange())
    const local = new Uint32Array(localReadBuffer.getMappedRange())
    const global = new Uint32Array(globalReadBuffer.getMappedRange())

     const get3 = (arr, i) => {
    const off = i * 4;
    return `${arr[off]}, ${arr[off + 1]}, ${arr[off + 2]}`;
  };
 
  for (let i = 0; i < numResults; ++i) {
    if (i % numThreadsPerWorkgroup === 0) {
      log(`\
 ---------------------------------------
 global                 local     global   dispatch: ${i / numThreadsPerWorkgroup}
 invoc.    workgroup    invoc.    invoc.
 index     id           id        id
 ---------------------------------------`);
    }
    log(` ${i.toString().padStart(3)}:      ${get3(workgroup, i)}      ${get3(local, i)}   ${get3(global, i)}`)
  }
}
