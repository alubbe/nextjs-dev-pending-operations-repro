import { EventEmitter } from 'node:events';

async function runSingleSequence({ depth, readyMode, mode, logEvery, stepDelayMs }) {
  const emitter = new EventEmitter();

  const readyPromise =
    readyMode === 'none'
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          const onReady = () => {
            cleanup();
            resolve();
          };
          const onEnd = () => {
            cleanup();
            resolve();
          };
          const onError = error => {
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error)));
          };
          const cleanup = () => {
            emitter.off('ready', onReady);
            emitter.off('end', onEnd);
            emitter.off('error', onError);
          };

          emitter.on('ready', onReady);
          emitter.on('end', onEnd);
          emitter.on('error', onError);
        });

  const finalPromise = (async () => {
    for (let i = 0; i < depth; i++) {
      await Promise.resolve();
      if (i === 0) emitter.emit('ready');

      if (mode === 'console' && (i + 1) % logEvery === 0) {
        console.debug('[next-dev-pending-ops-repro] step=%d', i + 1);
      }

      if (stepDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, stepDelayMs));
      } else {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    emitter.emit('end');
  })();

  if (readyMode === 'event') {
    await readyPromise;
  } else if (readyMode === 'race') {
    await Promise.race([readyPromise, finalPromise]);
  }

  await finalPromise;
  emitter.removeAllListeners();
}

export async function runReproBatch(options) {
  await Promise.all(
    Array.from({ length: options.parallel }, () =>
      runSingleSequence({
        depth: options.depth,
        readyMode: options.readyMode,
        mode: options.mode,
        logEvery: options.logEvery,
        stepDelayMs: options.stepDelayMs,
      }),
    ),
  );
}
