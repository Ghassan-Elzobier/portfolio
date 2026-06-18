import { useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";

const ProjectDetails = ({
  title,
  description,
  subDescription,
  image,
  tags,
  href,
  closeModal,
}) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={closeModal}
    >
      <motion.div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-gradient-to-l from-midnight to-navy shadow-2xl"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeModal}
          className="absolute z-10 p-2 rounded-sm top-4 right-4 bg-midnight/80 hover:bg-gray-500 transition-colors"
        >
          <img src="assets/close.svg" className="w-5 h-5" />
        </button>
        <img
          src={image}
          alt={title}
          className="w-full rounded-t-xl object-cover max-h-56 sm:max-h-72"
        />
        <div className="p-5 sm:p-6">
          <h5 className="mb-2 text-xl sm:text-2xl font-bold text-white">{title}</h5>
          <p className="mb-3 font-normal text-neutral-400 text-sm sm:text-base">{description}</p>
          {subDescription.map((subDesc, index) => (
            <p key={index} className="mb-3 font-normal text-neutral-400 text-sm sm:text-base">
              {subDesc}
            </p>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-5">
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => (
                <img
                  key={tag.id}
                  src={tag.path}
                  alt={tag.name}
                  className="rounded-lg size-9 sm:size-10 hover-animation"
                />
              ))}
            </div>
            <Link
              href={href || "#"}
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full
                bg-gradient-to-r from-aqua to-mint text-midnight font-semibold text-sm
                shadow-[0_0_12px_rgba(51,194,204,0.35)]
                hover:shadow-[0_0_24px_rgba(51,194,204,0.6)]
                hover:scale-105 transition-all duration-300 cursor-pointer"
            >
              View Project
              <img
                src="assets/arrow-up.svg"
                className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProjectDetails;
