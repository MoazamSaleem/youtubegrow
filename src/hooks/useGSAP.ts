import { useEffect, useRef, RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const useGSAP = () => {
  const timeline = useRef(gsap.timeline());

  useEffect(() => {
    return () => {
      timeline.current.kill();
    };
  }, []);

  return {
    timeline: timeline.current,
    gsap,
    ScrollTrigger,
  };
};

export const useFadeIn = <T extends HTMLElement>(
  ref: RefObject<T>,
  options?: {
    delay?: number;
    duration?: number;
    y?: number;
    trigger?: boolean;
  }
) => {
  useEffect(() => {
    if (!ref.current) return;

    const { delay = 0, duration = 0.8, y = 40, trigger = true } = options || {};

    if (trigger) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ref.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        }
      );
    } else {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y },
        { opacity: 1, y: 0, duration, delay, ease: "power3.out" }
      );
    }

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [ref, options]);
};

export const useStaggerFadeIn = <T extends HTMLElement>(
  containerRef: RefObject<T>,
  childSelector: string,
  options?: {
    stagger?: number;
    delay?: number;
    duration?: number;
    y?: number;
  }
) => {
  useEffect(() => {
    if (!containerRef.current) return;

    const { stagger = 0.1, delay = 0, duration = 0.6, y = 30 } = options || {};
    const children = containerRef.current.querySelectorAll(childSelector);

    gsap.fromTo(
      children,
      { opacity: 0, y },
      {
        opacity: 1,
        y: 0,
        duration,
        delay,
        stagger,
        ease: "power3.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [containerRef, childSelector, options]);
};

export const useParallax = <T extends HTMLElement>(
  ref: RefObject<T>,
  speed: number = 0.5
) => {
  useEffect(() => {
    if (!ref.current) return;

    gsap.to(ref.current, {
      yPercent: -30 * speed,
      ease: "none",
      scrollTrigger: {
        trigger: ref.current,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [ref, speed]);
};

export const useHoverScale = <T extends HTMLElement>(
  ref: RefObject<T>,
  scale: number = 1.05
) => {
  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;

    const handleEnter = () => {
      gsap.to(element, { scale, duration: 0.3, ease: "power2.out" });
    };

    const handleLeave = () => {
      gsap.to(element, { scale: 1, duration: 0.3, ease: "power2.out" });
    };

    element.addEventListener("mouseenter", handleEnter);
    element.addEventListener("mouseleave", handleLeave);

    return () => {
      element.removeEventListener("mouseenter", handleEnter);
      element.removeEventListener("mouseleave", handleLeave);
    };
  }, [ref, scale]);
};

export const useMagneticEffect = <T extends HTMLElement>(
  ref: RefObject<T>,
  strength: number = 0.3
) => {
  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;

    const handleMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) * strength;
      const deltaY = (e.clientY - centerY) * strength;

      gsap.to(element, {
        x: deltaX,
        y: deltaY,
        duration: 0.3,
        ease: "power2.out",
      });
    };

    const handleLeave = () => {
      gsap.to(element, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.5)" });
    };

    element.addEventListener("mousemove", handleMove);
    element.addEventListener("mouseleave", handleLeave);

    return () => {
      element.removeEventListener("mousemove", handleMove);
      element.removeEventListener("mouseleave", handleLeave);
    };
  }, [ref, strength]);
};

export const useTextReveal = <T extends HTMLElement>(
  ref: RefObject<T>,
  options?: {
    delay?: number;
    duration?: number;
  }
) => {
  useEffect(() => {
    if (!ref.current) return;

    const { delay = 0, duration = 1 } = options || {};

    gsap.fromTo(
      ref.current,
      {
        backgroundPosition: "0% 50%",
      },
      {
        backgroundPosition: "100% 50%",
        duration,
        delay,
        ease: "power2.inOut",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [ref, options]);
};

export const animateCounter = (
  element: HTMLElement,
  end: number,
  duration: number = 2,
  prefix: string = "",
  suffix: string = ""
) => {
  const obj = { value: 0 };
  gsap.to(obj, {
    value: end,
    duration,
    ease: "power2.out",
    onUpdate: () => {
      element.textContent = `${prefix}${Math.round(obj.value).toLocaleString()}${suffix}`;
    },
    scrollTrigger: {
      trigger: element,
      start: "top 85%",
      toggleActions: "play none none reverse",
    },
  });
};
