import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenisInstance = null;
let tickerCallback = null;

export function initLenis() {
  if (typeof window === 'undefined') return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  if (lenisInstance) return lenisInstance;

  lenisInstance = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.4,
  });

  lenisInstance.on('scroll', ScrollTrigger.update);

  tickerCallback = (time) => {
    lenisInstance?.raf(time * 1000);
  };
  gsap.ticker.add(tickerCallback);
  gsap.ticker.lagSmoothing(0);

  return lenisInstance;
}

export function destroyLenis() {
  if (tickerCallback) {
    gsap.ticker.remove(tickerCallback);
    tickerCallback = null;
  }
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }
}

export function pauseLenis() {
  lenisInstance?.stop();
}

export function resumeLenis() {
  lenisInstance?.start();
}

export function scrollToTopSmooth() {
  if (lenisInstance) {
    lenisInstance.scrollTo(0, { immediate: false, duration: 0.7 });
  } else if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
