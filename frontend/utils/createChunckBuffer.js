// utils/createChunkBuffer.js
export const createChunkBuffer = (flush) => {
  let queue = "";
  let raf = null;
  let waiters = [];

  const tick = () => {
    raf = null;

    if (queue) {
      // Reveal more per frame when we're behind, so it never lags far.
      const count = Math.max(2, Math.ceil(queue.length / 10));
      flush(queue.slice(0, count));
      queue = queue.slice(count);
    }

    if (queue) {
      raf = requestAnimationFrame(tick);
    } else {
      waiters.forEach((resolve) => resolve());
      waiters = [];
    }
  };

  return {
    push(text) {
      queue += text;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    drain() {
      if (!queue) return Promise.resolve();
      return new Promise((resolve) => waiters.push(resolve));
    },
    cancel() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      queue = "";
      waiters.forEach((resolve) => resolve());
      waiters = [];
    },
  };
};