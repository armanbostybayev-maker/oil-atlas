import { parseAisTimestamp } from './ais-time.mjs';
export const AIS_POLL_MS = 10_000;
export const AIS_TIMEOUT_MS = 8_000;
export const AIS_STALE_MS = 60_000;

export function snapshotFreshness(snapshot, now = Date.now()) {
  const stream = snapshot.stream;
  const latest = stream?.lastPositionAt ? parseAisTimestamp(stream.lastPositionAt) : Math.max(0,...snapshot.vessels.map(v => Number.isFinite(v?.receivedAt) ? v.receivedAt : parseAisTimestamp(v?.timestamp)).filter(Number.isFinite));
  const age = latest > 0 ? now-latest : Infinity;
  return {fresh:stream?.ok !== false && stream?.connected !== false && age >= -5000 && age <= AIS_STALE_MS,lastPositionAt:latest > 0 ? latest : null};
}

// Schedule only after completion: one in-flight request, including slow failures.
export function startAisPolling({load,onUpdate,interval=AIS_POLL_MS,timeout=AIS_TIMEOUT_MS,now=Date.now}) {
  let stopped = false, timer, deadline, controller, lastSuccessAt = null;
  let vessels = [], lastPositionAt = null;
  async function refresh() {
    controller = new AbortController();
    try {
      const expired = new Promise((_,reject) => {
        deadline = setTimeout(() => {
          controller.abort();
          reject(new Error('AIS request timed out'));
        },timeout);
      });
      const snapshot = await Promise.race([load({signal:controller.signal}),expired]);
      if (stopped) return;
      lastSuccessAt = now();
      vessels = snapshot.vessels;
      const freshness = snapshotFreshness(snapshot,now());
      lastPositionAt = freshness.lastPositionAt;
      onUpdate({vessels,lastSuccessAt,lastPositionAt,status:freshness.fresh ? 'live' : vessels.length ? 'stale' : 'offline'});
    } catch (error) {
      if (!stopped) onUpdate({vessels,lastSuccessAt,lastPositionAt,status:lastSuccessAt !== null || vessels.length ? 'stale' : 'offline',error:error.message});
    } finally {
      clearTimeout(deadline);
      if (!stopped) timer = setTimeout(refresh,interval);
    }
  }
  refresh();
  return () => { stopped = true; clearTimeout(timer); clearTimeout(deadline); controller?.abort(); };
}
