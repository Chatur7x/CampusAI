import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * SpotlightCard — cursor-tracking radial highlight shell
 * (motion-primitives spotlight pattern, project-styled).
 *
 * A pointer-driven `radial-gradient` follows the cursor inside the card,
 * giving stat/panel cards a tactile "light under glass" feel. All math runs
 * on motion values outside the React render cycle (no re-renders on move).
 * Static under prefers-reduced-motion.
 */
export function SpotlightCard({
  children,
  className,
  spotlightColor = 'rgba(129,140,248,0.14)',
  spotlightSize = 320,
}: {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
  spotlightSize?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const mx = useMotionValue(-spotlightSize);
  const my = useMotionValue(-spotlightSize);
  const sx = useSpring(mx, { stiffness: 260, damping: 32, mass: 0.5 });
  const sy = useSpring(my, { stiffness: 260, damping: 32, mass: 0.5 });
  const bg = useMotionTemplate`radial-gradient(${spotlightSize}px circle at ${sx}px ${sy}px, ${spotlightColor}, transparent 70%)`;

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={cn('group/spot relative overflow-hidden', className)}
      onPointerMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        mx.set(e.clientX - rect.left);
        my.set(e.clientY - rect.top);
      }}
      onPointerLeave={() => {
        mx.set(-spotlightSize);
        my.set(-spotlightSize);
      }}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{ background: bg }}
      />
    </motion.div>
  );
}
