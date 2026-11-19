import { createMotion, effect, reduceMotion } from "nsh";

/** Motion tokens: every duration, distance and spring in the app comes from here. */
export const motionTokens = {
  revealMs: 160,
  rise: 4,
  selectionSpring: { stiffness: 420, damping: 40 },
  navHeight: 30,
  navGap: 2,
  /** Pressable controls: hover wash 120ms, press settles to 0.97 on a soft curve. */
  control: "transition duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:active:scale-[0.97] motion-reduce:transition-none",
  /** Rows and nav items: only the wash changes, so columns never move. */
  wash: "transition-colors duration-100 ease-out motion-reduce:transition-none",
};

/** Rises 4pt and fades in each time `identity` changes to a new non-empty value. */
export function revealOn(identity: () => string) {
  const motion = createMotion();
  let previous = "";
  effect(() => {
    const current = identity();
    if (reduceMotion() || !current) motion.reset();
    else if (current !== previous) {
      motion.translateY.set(motionTokens.rise);
      motion.opacity.set(0.6);
      void motion.translateY.timing(0, {duration: motionTokens.revealMs});
      void motion.opacity.timing(1, {duration: motionTokens.revealMs});
    }
    previous = current;
  });
  return motion.style;
}
