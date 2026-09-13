import { useEffect, useRef, useState } from 'react';

// Animates a displayed number from its previous value to a new one whenever
// `target` changes, instead of the number just popping in. Plain
// requestAnimationFrame + React state — no Reanimated needed since this
// drives text content, not a native style prop.
export function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;

    const startTime = Date.now();
    let frameId: number;

    function tick() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (to - from) * eased);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, durationMs]);

  return value;
}
