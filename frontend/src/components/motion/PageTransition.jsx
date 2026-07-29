import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLocation, useOutlet } from 'react-router-dom'

import { routeTransition } from '../../lib/motion.js'

export default function PageTransition() {
  const location = useLocation()
  const outlet = useOutlet()
  const reducedMotion = useReducedMotion()

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        className="route-transition"
        key={location.pathname}
        {...routeTransition(reducedMotion)}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}
