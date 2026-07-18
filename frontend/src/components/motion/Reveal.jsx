import { m, useReducedMotion } from 'motion/react'
import { revealEntrance } from '../../lib/motion.js'

export default function Reveal({ children, className = '', delay = 0 }) {
  const reducedMotion = useReducedMotion()

  return (
    <m.div className={className} {...revealEntrance(reducedMotion, delay)}>
      {children}
    </m.div>
  )
}
