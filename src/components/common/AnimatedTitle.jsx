import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Judul animasi per kata menggunakan GSAP + ScrollTrigger.
 */
export default function AnimatedTitle({
  as: Tag = 'h1',
  text = '',
  className = '',
  delay = 0,
}) {
  const containerRef = useRef(null);
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || words.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-word',
        { yPercent: 110, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.65,
          delay,
          stagger: 0.055,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 92%',
            once: true,
          },
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [text, delay, words.length]);

  return (
    <Tag ref={containerRef} className={className} aria-label={text}>
      {words.map((word, idx) => (
        <span
          key={`${word}-${idx}`}
          className="inline-block overflow-hidden align-bottom mr-[0.26em] last:mr-0"
        >
          <span className="gsap-word inline-block will-change-transform">{word}</span>
        </span>
      ))}
    </Tag>
  );
}
