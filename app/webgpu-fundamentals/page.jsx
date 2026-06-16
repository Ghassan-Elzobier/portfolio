'use client';
import { useRef, useEffect } from 'react';
import Link from 'next/link';

// Add new lessons here as you progress through the tutorial
const lessons = [
  {
    id: 'triangle',
    step: '01',
    title: 'Drawing a Triangle',
    writeup: [
      "I've never been so proud to draw a triangle in my life! This was my first step into graphics programming, learning the fundamentals using a graphics API called WebGPU.",
      "The two most essential things WebGPU does are draw triangles, points and lines to textures, and run computations on the GPU. It uses three types of shader function written in WGSL: vertex, fragment and compute shaders.",
      "After the initial setup for the canvas (requesting the GPU adapter and device, then configuring the canvas context) we can go through the steps of drawing a triangle.",
      "Step 1: Create a shader module with a vertex shader function and a fragment shader function. The vertex shader passes three vertices with clip space positions, and the fragment shader decides the colour (blue).",
      "Step 2: Create the render pipeline and render pass descriptor so we can use the shader functions and target the canvas.",
      "Step 3: Create a command encoder to give instructions to the GPU. The render pass initiates the canvas, then we set the pipeline and draw the vertices, iterating through the 3 points. WebGPU then automatically colours the pixels in between blue using the fragment shader. Finally, submit the command buffer!",
      "Step 4: Marvel at your amazing blue triangle!"
    ],
    load: () => import('./triangle.js'),
  },
  {
    id: 'triangle-inter-stage',
    step: '02',
    title: 'Inter-stage Variables',
    writeup: [
      "These are variables that let you pass a handful of data points between shader stages. In this example we handed RGB colours to the three corners. The rasteriser finds all the pixels in between those 3 corners on the screen, and the intermediate values are interpolated across those pixels based on their distance from each corner. The fragment shader then receives the uniquely blended data for each pixel and paints it onto the screen.",
      "Important note: inter-stage variables are stored in the @location index of the pipeline."
    ],
    load: () => import("./triangle-inter-stage.js")
  },
  {
    id: 'triangle-uniform',
    step: '03',
    title: 'Uniform Variables',
    writeup: [
      "Uniform variables are useful because they store values globally that our shader functions can use. They also let us send variables directly from JavaScript to the GPU via buffers.",
      "Step 1: I added two structures to our original triangle shader. One holds offset and colour, our static uniform variables. The other holds scale, our changing uniform variable.",
      "Step 2: We set up our uniform buffer sizes based on how many bytes we need for each variable.",
      "Step 3: We offset the variables based on where they are stored in the buffer, according to their byte size.",
      "Step 4: Now we create the uniform data for 100 triangles. For each triangle we create a static uniform buffer, then a uniform values JavaScript array the same size as the buffer, and store a random offset and random colour at the correct byte position. Finally we write the values to the static buffer.",
      "Step 5: Still within the loop, we create a uniform buffer and add both buffers to the bind group.",
      "Step 6: We pass the random scale, bind group, uniform buffer and uniform values array into the render function. We can then write the scale to the uniform buffer and change it depending on the size of the canvas.",
      "Step 7: With the pipeline set, the 100 static uniform buffers set, the 100 uniform buffers set and the 100 bind groups set, we can encode and submit our commands to the GPU."
    ],
    load: () => import("./triangle-uniform.js")
  },
  {
    id: 'triangle-storage',
    step: '04',
    title: 'Storage Buffers',
    writeup: [
      "Storage variables are similar to uniform variables in that shader functions can access them globally to work on the data within. The main differences are that storage buffers can hold 128MB of data compared to a uniform buffer's 64KB, and storage buffers can be read/write whereas uniform buffers are read only. The tradeoff is that uniform buffers can be faster for their typical use case of storing lightweight global state.",
      "In this example I used 3 storage variables for my shader functions: one storing an array of colours and offsets, another storing an array of scales, and the last storing the array of vertices we want to paint. The important thing to understand in this vertex shader is that we iterate through our arrays of colour, scale and offset using the instance index, which lets us set those variables for each individual triangle.",
      "Now that we have a way to pass vertices into our vertex shader, we can create a JavaScript float array describing the vertices of triangles laid out in a circle. We divide the circle into rectangular subdivisions (two triangles each), then calculate each vertex using cosine, sine and the radius.",
      "Rather than 100 uniform buffers, we can now have 1 storage buffer per variable with 100 units stored within. This also means we only need one bind group for the three buffers.",
      "Since the vertex data is in a buffer, we pass the number of vertices and the number of instances into the draw command in the render function."
    ],
    load: () => import("./triangle-storage.js")
  },
  {
    id: "triangle-vertex",
    step: '05',
    title: 'Vertex Buffers',
    writeup: [
      "Vertex buffers are specialised storage that connects to the render pipeline through attributes. They let you feed data into the vertex shader one vertex or one instance at a time.",
      "In this example, instead of storing our variables in storage or uniform buffers, I stored them in 5 different attribute locations.",
      "I updated my createCircleVertices function to return index data, so shared vertices don't have to be stored in memory more than once.",
      "I then create a vertex buffer and an index buffer and write the data to memory.",
      "In the pipeline we now describe the attributes and their memory size, then set the array strides to describe how the buffers should be walked through to retrieve the correct data for the shader. We also set the step mode, which decides whether we access the data every vertex or every instance.",
      "Since you only need 8 bits to describe each colour value, we reduced the colour variable to an array of Uint8. The GPU normalises the values back to floats because we set the type to unorm8x4.",
      "Finally, in the render function we set the 3 vertex buffers and the index buffer, and now we draw by the index of the vertices instead."
    ],
    load: () => import("./triangle-vertex.js")
  },
  {
    id: 'computations',
    step: '06',
    title: 'Computations on the GPU',
    writeup: [
      "Compute shaders are functions that run on the GPU, letting you take advantage of its massive parallel processing power and keep data on the GPU to avoid slow CPU transfers. Starting from a simple shader that doubled an array of floats, I moved on to how the GPU actually organises its threads.",
      "The GPU does not run one thread at a time. You dispatch workgroups, each containing a fixed grid of threads defined by your workgroup size. In this example I dispatched [4, 3, 2] workgroups, each containing [2, 3, 4] threads, giving 24 workgroups and 24 threads per workgroup.",
      "The key insight is the three built-in IDs available inside a compute shader. workgroup_id tells you which workgroup a thread belongs to, local_invocation_id gives its position within that workgroup, and global_invocation_id gives its absolute position across every workgroup and thread. The log output in this lesson prints all three for every thread, which makes the structure concrete.",
      "Important note: the magic number of threads a GPU can run simultaneously is 64.",
    ],
    type: 'log',
    load: () => import('./computations.js')
  }
];

function LessonCanvas({ load }) {
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

    load()
      .then(({ main }) => { if (!cancelled) main(canvas); })
      .catch(console.error);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [load]);

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-white/10"
      style={{ aspectRatio: '16/9', background: '#06091f' }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}

function LessonLog({ load }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    load()
      .then(({ main }) => { if (!cancelled) main(container); })
      .catch(console.error);

    return () => { cancelled = true; };
  }, [load]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-y-auto rounded-xl border border-white/10 p-4 font-mono text-sm text-neutral-300"
      style={{ aspectRatio: '16/9', background: '#06091f' }}
    />
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
        <h1 className="text-white font-semibold tracking-wide">WebGPU Fundamentals</h1>
        <div className="flex gap-2 ml-auto">
          <span className="text-xs font-medium px-2 py-1 rounded-full border" style={{ color: '#33c2cc', borderColor: 'rgba(51,194,204,0.3)', background: 'rgba(51,194,204,0.08)' }}>WebGPU</span>
          <span className="text-xs font-medium px-2 py-1 rounded-full border" style={{ color: '#7a57db', borderColor: 'rgba(122,87,219,0.3)', background: 'rgba(122,87,219,0.08)' }}>TypeScript</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 space-y-24">
        {lessons.map((lesson) => (
          <article key={lesson.id} className="space-y-6">
            {lesson.type === 'log'
              ? <LessonLog load={lesson.load} />
              : <LessonCanvas load={lesson.load} />
            }
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-sm font-mono font-semibold" style={{ color: '#33c2cc' }}>{lesson.step}</span>
                <h2 className="text-xl font-semibold text-white">{lesson.title}</h2>
              </div>
              {lesson.writeup.map((para, i) => (
                <p key={i} className="text-neutral-400 leading-relaxed">{para}</p>
              ))}
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}
