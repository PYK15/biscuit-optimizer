import { useEffect, useRef, useState } from "react";

/**
 * UX PACING ONLY - this hook never delays or re-fetches data. By the time a
 * component has `targetCount` (e.g. `forecast.horizon_days`), the backend has
 * already computed and returned every one of those days in a single response
 * (see api/main.py - /forecast, /recommendations and /sustainability each
 * loop over the full horizon before responding; there is no per-day
 * streaming). Increasing the horizon is genuinely slow server-side (model
 * retraining on a cache miss), and once that wait is over, dumping all the
 * new days on screen in one instant swap feels jarring. This hook paces how
 * many of the already-fetched days a component is allowed to *render*, so
 * new days appear one at a time instead of all at once.
 *
 * Behavior:
 *  - The very first time a component sees data (nothing revealed yet), it
 *    shows everything immediately - there is no "previous" state for new
 *    days to be added on top of, so there is nothing to stagger.
 *  - When targetCount grows (horizon increased), revealed count ticks up by
 *    1 every REVEAL_STAGGER_MS until it reaches targetCount.
 *  - When targetCount shrinks (horizon decreased), it snaps down
 *    immediately - there's nothing to "reveal" about showing fewer days.
 *  - If targetCount changes again mid-reveal (e.g. the user scrubs the
 *    horizon slider rapidly through several values), the in-flight timer
 *    chain for the abandoned value is superseded via a generation counter -
 *    only the latest targetCount's chain keeps scheduling steps, so reveals
 *    never go out of order or duplicate, and the final state always matches
 *    the last-settled targetCount.
 */
const REVEAL_STAGGER_MS = 200;

export function useStaggeredReveal(targetCount: number | undefined): number {
  const [revealed, setRevealed] = useState(0);
  const revealedRef = useRef(0);
  const generationRef = useRef(0);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    if (targetCount === undefined) return;
    const myGeneration = ++generationRef.current;

    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      revealedRef.current = targetCount;
      setRevealed(targetCount);
      return;
    }

    if (targetCount <= revealedRef.current) {
      revealedRef.current = targetCount;
      setRevealed(targetCount);
      return;
    }

    const step = () => {
      if (generationRef.current !== myGeneration) return; // superseded by a newer targetCount
      revealedRef.current += 1;
      setRevealed(revealedRef.current);
      if (revealedRef.current < targetCount) {
        window.setTimeout(step, REVEAL_STAGGER_MS);
      }
    };
    const timer = window.setTimeout(step, REVEAL_STAGGER_MS);
    return () => window.clearTimeout(timer);
  }, [targetCount]);

  return revealed;
}
