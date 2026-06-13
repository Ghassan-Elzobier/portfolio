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
      "I've never been so happy to draw a triangle in my life! This was my first step into graphic programming, learning the fundamentals of using a graphics api like WebGPU.",
      'The two most essential things WebGPU does is draw triangles/points/lines to textures and run computations on the GPU. It uses three types of shader functions written in WGSL: Vertex, Fragment and Compute Shaders.',
      "After we have done our initial set up for the canvas, requesting the gpu adapter and device, then configuring the context for the canvas; we can then go through the steps of drawing a triangle.",
      "Step 1: Create a shader module with a vertex shader function and a fragment shader function. The vertex shader passes three vertices with clip space positioning and the fragment shader decides the colour (blue).",
      "Step 2: Create render pipeline and render pass descriptor to be able to use the shader functions and target the canvas.",
      "Step 3: Create command encoder to give instructions to the GPU, render pass initiates the canvas, then we set the pipline, draw vertices iterating through the points 3 pixels which then automatically colours the pixels in-between blue using the fragment shader. Finally submit the command buffer!",
      "Step 4: Marvel at your amazing blue triangle!"
    ],
    load: () => import('./triangle.js'),
  },
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

      <main className="max-w-3xl mx-auto px-6 py-16 space-y-24">
        {lessons.map((lesson) => (
          <article key={lesson.id} className="space-y-6">
            <LessonCanvas load={lesson.load} />
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
