import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 600;

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// Counts a displayed number towards its new value instead of swapping it, so an
// EXP or attribute gain is seen being earned. The first render shows the value
// as-is, and anyone who prefers reduced motion gets the new value at once.
export default function useAnimatedNumber(target) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;

    if (prefersReducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return;
    }

    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      // Starting from whatever is on screen means a value that changes
      // mid-count carries on from there rather than jumping back.
      shownRef.current = Math.round(from + (target - from) * eased);
      setShown(shownRef.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}
