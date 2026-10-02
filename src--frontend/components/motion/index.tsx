import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern';
import { cn } from '@/lib/utils';

/**
 * CampusAI Motion System — springs, page transitions, scroll reveals,
 * 3D tilt cards and the shared Aurora ambience.
 * Every primitive respects prefers-reduced-motion.
 */

/* ── Spring presets ── */
export const springs = {
  soft: { type: 'spring', stiffness: 120, damping: 20 },
  snappy: { type: 'spring', stiffness: 320, damping: 30 },
  bouncy: { type: 'spring', stiffness: 380, damping: 22 },
} as const;

/* ── Page transition (used by route shells) ── */
const pageVariants: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.985, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { ...springs.soft, opacity: { duration: 0.25 } },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.99,
    filter: 'blur(4px)',
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

export function PageTransition({
  routeKey,
  children,
  className,
}: {
  routeKey: string;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        variants={reduce ? undefined : pageVariants}
        initial={reduce ? false : 'initial'}
        animate="animate"
        exit="exit"
        className={cn('w-full', className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Scroll reveal ── */
const revealVariants: Variants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { ...springs.soft, delay },
  }),
};

export function Reveal({
  children,
  delay = 0,
  once = true,
  className,
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  once?: boolean;
  className?: string;
  as?: 'div' | 'section' | 'span';
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      variants={revealVariants}
      custom={delay}
      initial={reduce ? false : 'hidden'}
      whileInView={reduce ? undefined : 'visible'}
      viewport={{ once, margin: '-40px' }}
      className={className}
    >
      {children}
    </Comp>
  );
}

/* ── Stagger container + item ── */
export function Stagger({
  children,
  className,
  gap = 0.07,
  ...rest
}: { children: ReactNode; className?: string; gap?: number } & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={{ visible: { transition: { staggerChildren: gap } } }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 18 },
        visible: { opacity: 1, y: 0, transition: springs.soft },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── 3D tilt card with cursor-tracking glare ── */
export function TiltCard({
  children,
  className,
  maxTilt = 7,
  glare = true,
  scaleOnHover = 1.015,
  ...rest
}: {
  children: ReactNode;
  maxTilt?: number;
  glare?: boolean;
  scaleOnHover?: number;
} & HTMLMotionProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);

  const tiltOpts = { stiffness: 200, damping: 24, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [0, 1], [maxTilt, -maxTilt]), tiltOpts);
  const rotateY = useSpring(useTransform(px, [0, 1], [-maxTilt, maxTilt]), tiltOpts);
  const scale = useSpring(1, tiltOpts);

  const glareX = useTransform(px, [0, 1], ['20%', '80%']);
  const glareY = useTransform(py, [0, 1], ['20%', '80%']);
  const glareBg = useMotionTemplate`radial-gradient(420px circle at ${glareX} ${glareY}, rgba(255,255,255,0.09), transparent 65%)`;

  if (reduce) {
    return (
      <div ref={ref} className={className} {...(rest as object)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        px.set((e.clientX - rect.left) / rect.width);
        py.set((e.clientY - rect.top) / rect.height);
        scale.set(scaleOnHover);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
        scale.set(1);
      }}
      style={{
        rotateX,
        rotateY,
        scale,
        transformStyle: 'preserve-3d',
        transformPerspective: 900,
      }}
      className={cn('relative will-change-transform', className)}
      {...rest}
    >
      {children}
      {glare && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ background: glareBg }}
        />
      )}
    </motion.div>
  );
}

/* ── Shared ambient background: drifting aurora orbs + grid + vignette ── */
export function AuroraBackground({
  hue = 'indigo',
  gridOpacity = 0.06,
  className,
}: {
  /** accent tint of the second orb */
  hue?: 'indigo' | 'cyan' | 'emerald' | 'violet';
  gridOpacity?: number;
  className?: string;
}) {
  const orbColors: Record<string, [string, string]> = {
    indigo: ['rgba(99,102,241,0.16)', 'rgba(34,211,238,0.10)'],
    cyan: ['rgba(34,211,238,0.14)', 'rgba(59,130,246,0.12)'],
    emerald: ['rgba(16,185,129,0.13)', 'rgba(45,212,191,0.10)'],
    violet: ['rgba(139,92,246,0.15)', 'rgba(236,72,153,0.08)'],
  };
  const [c1, c2] = orbColors[hue];
  const reduce = useReducedMotion();
  const driftA = reduce
    ? undefined
    : { x: [0, 60, -30, 0], y: [0, -40, 20, 0], scale: [1, 1.08, 0.96, 1] };
  const driftB = reduce
    ? undefined
    : { x: [0, -50, 25, 0], y: [0, 35, -20, 0], scale: [1, 0.95, 1.06, 1] };

  return (
    <div className={cn('pointer-events-none fixed inset-0 overflow-hidden', className)} aria-hidden>
      {/* base wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(243_90%_66%/0.07),transparent_55%)]" />
      {/* drifting orbs (static under prefers-reduced-motion) */}
      <motion.div
        className="absolute w-[46rem] h-[46rem] rounded-full blur-[130px]"
        style={{ background: c1, top: '-18%', left: '-8%' }}
        animate={driftA}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[38rem] h-[38rem] rounded-full blur-[120px]"
        style={{ background: c2, bottom: '-12%', right: '-6%' }}
        animate={driftB}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut', delay: -8 }}
      />
      {/* reactive grid */}
      <AnimatedGridPattern
        numSquares={26}
        maxOpacity={gridOpacity}
        duration={5}
        repeatDelay={1.2}
        className="inset-0 h-full w-full [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]"
      />
      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,6,23,0.55))]" />
    </div>
  );
}

/* ── Hover lift (subtle, cheap) ── */
export function Lift({
  children,
  className,
  y = -4,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      whileHover={{ y, transition: springs.snappy }}
      whileTap={{ scale: 0.985 }}
    >
      {children}
    </motion.div>
  );
}
