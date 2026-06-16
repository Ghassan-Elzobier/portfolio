export const myProjects = [
  {
    id: 1,
    title: "WebGPU Fundamentals",
    description:
      "A self-directed journey through WebGPU from the ground up, going from drawing a single blue triangle all the way to compute shaders, GPU memory management and vertex buffers, following the WebGPU Fundamentals articles as a guide along the way.",
    subDescription: [
      "Built the WebGPU render pipeline from scratch, writing WGSL vertex and fragment shaders and submitting command buffers to draw a triangle.",
      "Explored compute shaders and how the GPU organises threads into workgroups, running parallel computations entirely on the GPU.",
      "Progressed through uniform buffers, storage buffers and vertex buffers, learning the tradeoffs between each and how to pass data from JavaScript to the GPU.",
    ],
    href: "/webgpu-fundamentals",
    logo: "",
    image: "/assets/projects/webgpu-fundamentals.png",
    tags: [
      {
        id: 1,
        name: "WebGPU",
        path: "/assets/logos/webgpu.svg",
      },
      {
        id: 2,
        name: "TypeScript",
        path: "/assets/logos/typescript.svg",
      },
    ],
  },
  {
    id: 2,
    title: "Boid Simulator",
    description:
      "700 triangle shaped agents, each following three simple rules, and yet somehow a murmuration emerges. This project was my first attempt at putting everything I learned about WebGPU to use in a real simulation.",
    subDescription: [
      "Each boid only knows about its neighbours, but separation, alignment and cohesion together produce something that looks alive.",
      "The entire simulation runs on the GPU, a compute shader updates every boid in parallel each frame, which is what makes it fast enough to run 700 agents in real time.",
      "Passing tuned weights for each flocking rule from JavaScript to the GPU every frame let me experiment with the behaviour without touching the shader code.",
      "The render shader reads position and velocity from the same buffer the compute shader writes to, orienting each triangle in the direction the boid is moving.",
    ],
    href: "/boid-simulator",
    logo: "",
    image: "/assets/projects/boids.png",
    tags: [
      {
        id: 1,
        name: "WebGPU",
        path: "/assets/logos/webgpu.svg",
      },
      {
        id: 2,
        name: "TypeScript",
        path: "/assets/logos/typescript.svg",
      },
    ],
  },
];

export const mySocials = [
  {
    name: "Linkedin",
    href: "https://www.linkedin.com/in/gelzo/",
    icon: "/assets/socials/linkedIn.svg",
  },
];

export const experiences = [
  {
    title: "Software Engineer",
    job: "Neubond",
    date: "2025 - Present",
    contents: [
      "Building software at the intersection of hardware, clinical research, and mobile for a stroke rehabilitation wearable with the potential to meaningfully improve patient recovery.",
      "Led the PDF progress report feature end-to-end, from research through to data aggregation, chart rendering, and PDF generation natively in Flutter.",
      "Built the complete authentication flow across mobile and web, connecting universal links, password reset, recovery sessions, and deep link routing between a Next.js web layer and the iOS app.",
      "Applied STRIDE threat modelling to design and implement a multi-layer security architecture across device, app, and cloud ahead of an independent penetration test.",
      "Produced IEC 62304 and IEC 81001-5-1 cybersecurity documentation from primary sources to build a regulatory foundation for a connected medical device.",
    ],
  },
];
export const reviews = [
  {
    name: "Jack",
    username: "@jack",
    body: "I've never seen anything like this before. It's amazing. I love it.",
    img: "https://robohash.org/jack",
  },
  {
    name: "Jill",
    username: "@jill",
    body: "I don't know what to say. I'm speechless. This is amazing.",
    img: "https://robohash.org/jill",
  },
  {
    name: "John",
    username: "@john",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: "https://robohash.org/john",
  },
  {
    name: "Alice",
    username: "@alice",
    body: "This is hands down the best thing I've experienced. Highly recommend!",
    img: "https://robohash.org/alice",
  },
  {
    name: "Bob",
    username: "@bob",
    body: "Incredible work! The attention to detail is phenomenal.",
    img: "https://robohash.org/bob",
  },
  {
    name: "Charlie",
    username: "@charlie",
    body: "This exceeded all my expectations. Absolutely stunning!",
    img: "https://robohash.org/charlie",
  },
  {
    name: "Dave",
    username: "@dave",
    body: "Simply breathtaking. The best decision I've made in a while.",
    img: "https://robohash.org/dave",
  },
  {
    name: "Eve",
    username: "@eve",
    body: "So glad I found this. It has changed the game for me.",
    img: "https://robohash.org/eve",
  },
];