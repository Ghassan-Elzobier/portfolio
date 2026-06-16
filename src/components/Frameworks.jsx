import { OrbitingCircles } from "./OrbitingCircles";

export function Frameworks() {
    const skills = [
        "python",
        "fastapi",
        "flutter",
        "dart",
        "resend",
        "supabase",
        "postgres",
        "css3",
        "git",
        "html5",
        "javascript",
        "react",
        "sqlite",
        "tailwindcss",
        "webgpu",
        "typescript",
    ]
  return (
    <div className="relative flex h-[15rem] w-full flex-col items-center justify-center">
      <OrbitingCircles iconSize={40}>
        {skills.map((skill,index)=>(
            <Icon key={index} src={`assets/logos/${skill}.svg`}/>
        ))}
      </OrbitingCircles>
      <OrbitingCircles iconSize={25} radius={100} reverse speed={2}>
        {skills.reverse().map((skill,index)=>(
            <Icon key={index} src={`assets/logos/${skill}.svg`}/>
        ))}
      </OrbitingCircles>
    </div>
  );
}

const Icon=({src}) =>(
    <img src={src} className="duration-200 rounded-sm hover:scale-110"/>
)