export const motionTokens = {
  duration: {
    instant: 0.12,
    fast: 0.18,
    normal: 0.28,
    slow: 0.42,
  },
  distance: {
    small: 4,
    normal: 10,
    large: 14,
  },
  ease: {
    standard: [0.22, 1, 0.36, 1],
    exit: [0.4, 0, 1, 1],
  },
}

export const revealViewport = {
  once: true,
  amount: 0.08,
  margin: '0px 0px 10% 0px',
}

export function cappedStagger(index) {
  return Math.min(index * 0.04, 0.16)
}

export function pageEntrance(reducedMotion) {
  return {
    initial: { opacity: 0, y: reducedMotion ? 0 : motionTokens.distance.normal },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reducedMotion ? motionTokens.duration.fast : motionTokens.duration.normal,
      ease: motionTokens.ease.standard,
    },
  }
}

export function revealEntrance(reducedMotion, delay = 0) {
  return {
    initial: { opacity: 0, y: reducedMotion ? 0 : motionTokens.distance.large },
    whileInView: { opacity: 1, y: 0 },
    viewport: revealViewport,
    transition: {
      duration: reducedMotion ? motionTokens.duration.fast : motionTokens.duration.slow,
      delay: reducedMotion ? 0 : delay,
      ease: motionTokens.ease.standard,
    },
  }
}

export function heroMotion(reducedMotion) {
  return {
    container: {
      hidden: {},
      visible: {
        transition: reducedMotion
          ? { staggerChildren: 0 }
          : { delayChildren: 0.02, staggerChildren: 0.045 },
      },
    },
    item: {
      hidden: { opacity: 0, y: reducedMotion ? 0 : motionTokens.distance.normal },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: reducedMotion ? motionTokens.duration.fast : motionTokens.duration.normal,
          ease: motionTokens.ease.standard,
        },
      },
    },
  }
}

export const presenceTransition = {
  duration: motionTokens.duration.fast,
  ease: motionTokens.ease.standard,
}
