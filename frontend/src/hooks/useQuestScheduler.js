import { useEffect, useRef } from "react";

/**
 * Offers a time-limited quest at random intervals for as long as the component
 * is mounted.
 *
 * The scheduler is a self-rescheduling setTimeout chain, which makes two things
 * easy to get wrong:
 *
 * - Every link needs its id kept somewhere cleanup can reach. Tracking only the
 *   first one leaves the chain running for the life of the tab, setting state on
 *   an unmounted component.
 * - The callback runs long after the render that scheduled it, so anything it
 *   reads from a closure is frozen at mount. `isIdle` is called rather than
 *   passed as a boolean for exactly that reason.
 *
 * @param {object}   options
 * @param {[number, number]} options.initialDelayRange  ms range before the first offer
 * @param {[number, number]} options.repeatRange        ms range between later offers
 * @param {() => boolean}    options.isIdle             false while a quest is on screen
 * @param {() => void}       options.onOffer            called when a quest should appear
 * @param {boolean}          options.enabled            pauses the chain when false
 */
export function useQuestScheduler({
  initialDelayRange,
  repeatRange,
  isIdle,
  onOffer,
  enabled = true,
}) {
  const timerRef = useRef(null);
  // Held in refs so changing either does not tear down and restart the chain,
  // which would reset the countdown to the next quest on every render.
  const isIdleRef = useRef(isIdle);
  const onOfferRef = useRef(onOffer);

  useEffect(() => {
    isIdleRef.current = isIdle;
    onOfferRef.current = onOffer;
  }, [isIdle, onOffer]);

  useEffect(() => {
    if (!enabled) return undefined;

    const randomInRange = ([min, max]) => Math.random() * (max - min) + min;

    const scheduleNext = (range) => {
      timerRef.current = setTimeout(() => {
        if (isIdleRef.current()) {
          onOfferRef.current();
        }
        scheduleNext(repeatRange);
      }, randomInRange(range));
    };

    scheduleNext(initialDelayRange);

    return () => {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    // Ranges are module-level constants in practice; listing them keeps the
    // dependency array honest rather than suppressing the rule.
  }, [enabled, initialDelayRange, repeatRange]);
}
