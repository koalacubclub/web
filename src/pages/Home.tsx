/**
 * Koala Cub Club — Fixed Hero + Organic Parallax Content
 *
 * Hero stays fixed. Content rises over it with an organic, wavy
 * SVG edge (not a boring rectangle). Mobile-first vertical video
 * feed with playful animations. Feels alive, not corporate.
 *
 * Palette: Warm dark tones + Cat's Eye Gold accents
 * Font: Cormorant Garamond (display) + Inter (body)
 */

import { useRef, useMemo, type ReactNode } from 'react'
import { motion, useInView, MotionConfig } from 'framer-motion'
import { Instagram, Mail, ArrowDown, Github } from 'lucide-react'
import { TikTokIcon } from '@/components/TikTokIcon'

// Assets (served from /public)
const HERO_IMAGE = '/hero.webp'
const KOALA_WALK_SPRITE = '/koala-walk.png'

// Video feed
const VIDEO_EMBEDS = [
  { embedId: '7489368818505498926', caption: 'Outdoor adventures' },
  { embedId: '7477553685114610990', caption: 'Window watching' },
  { embedId: '7473006775875992878', caption: 'Stroller training' },
  { embedId: '7467562539303207214', caption: 'Dental day' },
  { embedId: '7489368818505498926', caption: 'Park exploration' },
  { embedId: '7477553685114610990', caption: 'Bird TV' },
  { embedId: '7473006775875992878', caption: 'Morning routine' },
  { embedId: '7467562539303207214', caption: 'Treat time' },
]

// Playful paw SVG
function PawPrint({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <ellipse cx="8" cy="6" rx="2.5" ry="3" />
      <ellipse cx="16" cy="6" rx="2.5" ry="3" />
      <ellipse cx="4.5" cy="12" rx="2" ry="2.5" />
      <ellipse cx="19.5" cy="12" rx="2" ry="2.5" />
      <path d="M12 22c-4 0-7-3-7-6 0-2 1.5-3.5 3.5-4 1-.3 2.2-.5 3.5-.5s2.5.2 3.5.5c2 .5 3.5 2 3.5 4 0 3-3 6-7 6z" />
    </svg>
  )
}

// Reveal animation
function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

// Video card with playful entrance
function VideoCard({
  embedId,
  caption,
  index,
}: {
  embedId: string
  caption: string
  index: number
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-5%' })

  // Alternate slight rotations for playfulness
  const rotation = index % 3 === 0 ? -1.5 : index % 3 === 1 ? 1 : -0.5

  return (
    <motion.div
      ref={ref}
      className="relative"
      initial={{ opacity: 0, y: 60, rotate: rotation * 2 }}
      animate={isInView ? { opacity: 1, y: 0, rotate: rotation } : {}}
      transition={{
        duration: 0.9,
        delay: (index % 2) * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ rotate: 0, scale: 1.02, y: -4 }}
      style={{ transformOrigin: 'center bottom' }}
    >
      {/* Video container with organic shadow */}
      <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
        <iframe
          src={`https://www.tiktok.com/player/v1/${embedId}?description=0&music_info=0&controls=1`}
          className="w-full h-full"
          allow="fullscreen"
          loading="lazy"
          title={`TikTok video: ${caption}`}
        />
      </div>

      {/* Caption below */}
      <p className="mt-3 text-[11px] tracking-wide text-white/35 font-light text-center">
        {caption}
      </p>
    </motion.div>
  )
}

// ─── FLOATING PARTICLES ─────────────────────────────────────────────────────
function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        size: 2.5 + ((i * 7) % 5) * 1.2,
        left: 3 + ((i * 31) % 94),
        top: 5 + ((i * 47) % 90),
        isGold: i % 2 === 0,
        yTravel: -(40 + ((i * 13) % 60)),
        xTravel: ((i * 9) % 30) - 15,
        duration: 5 + ((i * 3) % 7),
        delay: (i * 0.5) % 4,
      })),
    [],
  )

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[5]">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.left}%`,
            top: `${p.top}%`,
            background: p.isGold
              ? 'oklch(0.80 0.14 75 / 0.7)'
              : 'rgba(255,255,255,0.5)',
            boxShadow: p.isGold
              ? '0 0 12px 2px oklch(0.80 0.14 75 / 0.5)'
              : '0 0 8px 1px rgba(255,255,255,0.3)',
          }}
          animate={{
            y: [0, p.yTravel, 0],
            x: [0, p.xTravel, 0],
            opacity: [0.3, 0.9, 0.3],
            scale: [0.8, 1.4, 0.8],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// ─── FIXED HERO ─────────────────────────────────────────────────────────────
function FixedHero() {
  return (
    <div className="fixed inset-0 w-full h-dvh z-0">
      <img
        src={HERO_IMAGE}
        alt="Koala lounging on her window perch"
        className="w-full h-full object-cover object-[65%_center] sm:object-center"
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.5)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/10" />

      {/* Grain */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Floating particles — luminous dust motes */}
      <FloatingParticles />

      {/* Top social icons */}
      <div className="absolute top-5 right-5 sm:top-7 sm:right-7 flex items-center gap-3 z-20">
        <a
          href="https://www.instagram.com/koalacubclub/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 hover:scale-110 transition-all duration-300"
          aria-label="Instagram"
        >
          <Instagram className="w-4 h-4" />
        </a>
        <a
          href="https://tiktok.com/@koalacubclub"
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 hover:scale-110 transition-all duration-300"
          aria-label="TikTok"
        >
          <TikTokIcon className="w-4 h-4" />
        </a>
      </div>

      {/* Hero text */}
      <div className="absolute inset-0 flex flex-col justify-end pb-32 sm:pb-40 lg:pb-44 z-10">
        <div className="container">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="text-[oklch(0.75_0.12_80)] text-xs sm:text-sm uppercase tracking-[0.3em] font-light mb-4"
          >
            Koala Cub Club
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-white text-5xl sm:text-7xl md:text-8xl lg:text-[9rem] xl:text-[10rem] leading-[0.85] tracking-tight max-w-5xl"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            She sees
            <br />
            <span className="italic font-light text-[oklch(0.75_0.12_80)]">
              you.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-white/40 text-sm font-light mt-5 max-w-xs tracking-wide"
          >
            A tabby with opinions. Zero regard for personal space.
          </motion.p>
        </div>
      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.8 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ArrowDown className="w-4 h-4 text-white/25" strokeWidth={1} />
        </motion.div>
      </motion.div>
    </div>
  )
}

// ─── WALKING KOALA SPRITE ───────────────────────────────────────────────
function WalkingKoala() {
  return (
    <motion.div
      className="absolute z-20 pointer-events-none"
      style={{
        bottom: '25%',
        width: '90px',
        height: '70px',
      }}
      animate={{
        x: ['-100px', 'calc(100vw + 100px)'],
        y: [0, -6, 0, -4, 0, -6, 0, -4, 0],
      }}
      transition={{
        x: {
          duration: 14,
          repeat: Infinity,
          ease: 'linear',
        },
        y: {
          duration: 0.6,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
    >
      <img
        src={KOALA_WALK_SPRITE}
        alt="Koala walking"
        className="w-full h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
      />
    </motion.div>
  )
}

// ─── ANIMATED ORGANIC WAVE EDGE ─────────────────────────────────────────────
function OrganicEdge() {
  return (
    <div className="relative w-full h-24 sm:h-32 lg:h-40 -mb-1">
      {/* Koala walking along the wave */}
      <WalkingKoala />
      {/* Back wave — slower, offset animation */}
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 w-full h-full opacity-40"
        fill="oklch(0.15 0.008 60)"
      >
        <path
          d="M0,120 L0,85 C180,65 300,100 480,80 C660,55 780,95 960,70 C1140,50 1260,85 1440,65 L1440,120 Z"
          className="animate-[wave-back_8s_ease-in-out_infinite]"
        />
      </svg>

      {/* Middle wave */}
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 w-full h-full opacity-60"
        fill="oklch(0.13 0.008 60)"
      >
        <path
          d="M0,120 L0,75 C120,90 240,45 360,60 C480,75 600,95 720,80 C840,65 960,35 1080,50 C1200,65 1320,85 1440,70 L1440,120 Z"
          className="animate-[wave-mid_6s_ease-in-out_infinite]"
        />
      </svg>

      {/* Front wave — fastest, most visible */}
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 w-full h-full"
        fill="oklch(0.12 0.008 60)"
      >
        <path
          d="M0,120 L0,80 C120,95 240,40 360,55 C480,70 600,100 720,85 C840,70 960,30 1080,45 C1200,60 1320,90 1440,75 L1440,120 Z"
          className="animate-[wave-front_5s_ease-in-out_infinite]"
        />
      </svg>
    </div>
  )
}

// ─── CONTENT PANEL ──────────────────────────────────────────────────────────
function ContentPanel() {
  return (
    <div id="main-content" className="relative z-10">
      {/* Spacer for hero */}
      <div className="h-dvh" />

      {/* Organic wave transition */}
      <OrganicEdge />

      {/* Main content area — with subtle color-shifting background */}
      <div className="relative animate-[bg-shift_20s_ease-in-out_infinite]">
        {/* Scattered paw prints as decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <PawPrint className="absolute top-[8%] right-[12%] w-5 h-5 text-white/[0.03] rotate-12" />
          <PawPrint className="absolute top-[22%] left-[8%] w-4 h-4 text-white/[0.025] -rotate-20" />
          <PawPrint className="absolute top-[45%] right-[20%] w-6 h-6 text-white/[0.02] rotate-45" />
          <PawPrint className="absolute top-[65%] left-[15%] w-4 h-4 text-white/[0.03] -rotate-12" />
          <PawPrint className="absolute top-[80%] right-[8%] w-5 h-5 text-white/[0.025] rotate-30" />
        </div>

        {/* Grain */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 pt-10 sm:pt-14 pb-16 sm:pb-20">
          {/* Section header — playful, not formal */}
          <Reveal className="container mb-8 sm:mb-12">
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <PawPrint className="w-4 h-4 text-[oklch(0.75_0.12_80)]/60" />
              </motion.div>
              <p className="text-[oklch(0.75_0.12_80)] text-[10px] sm:text-xs uppercase tracking-[0.35em] font-light">
                The feed
              </p>
            </div>
            <h2
              className="text-white/85 text-2xl sm:text-3xl lg:text-4xl tracking-tight"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Watch the chaos unfold
            </h2>
          </Reveal>

          {/* Mobile-first video feed — 2 columns on mobile, scrollable */}
          <div className="container">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {VIDEO_EMBEDS.map((video, index) => (
                <VideoCard
                  key={`${video.embedId}-${index}`}
                  embedId={video.embedId}
                  caption={video.caption}
                  index={index}
                />
              ))}
            </div>
          </div>

          {/* "More" link with playful animation */}
          <Reveal className="container mt-10 sm:mt-14 flex justify-center">
            <a
              href="https://tiktok.com/@koalacubclub"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-[oklch(0.75_0.12_80)]/30 hover:bg-white/[0.06] transition-all duration-500"
            >
              <TikTokIcon className="w-4 h-4 text-white/50 group-hover:text-[oklch(0.75_0.12_80)] transition-colors duration-500" />
              <span className="text-xs uppercase tracking-[0.2em] text-white/50 group-hover:text-white/80 transition-colors duration-500">
                See all videos
              </span>
              <motion.span
                className="text-white/30 group-hover:text-[oklch(0.75_0.12_80)] transition-colors duration-500"
                animate={{ x: [0, 3, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                →
              </motion.span>
            </a>
          </Reveal>

          {/* Decorative divider — whisker lines */}
          <div className="container mt-16 sm:mt-24 mb-10 sm:mb-14 flex items-center justify-center gap-4">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/10" />
            <PawPrint className="w-3 h-3 text-white/10" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/10" />
          </div>

          {/* ─── Footer ─── */}
          <div className="container">
            <div className="flex flex-col items-center text-center gap-8">
              {/* Brand */}
              <Reveal>
                <p
                  className="text-white/50 text-xl tracking-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  Koala Cub Club
                </p>
              </Reveal>

              {/* Links */}
              <Reveal delay={0.1}>
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                  <a
                    href="https://www.instagram.com/koalacubclub/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:border-white/15 hover:bg-white/[0.07] transition-all duration-400 text-xs font-light"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                    <span>Instagram</span>
                  </a>
                  <a
                    href="https://tiktok.com/@koalacubclub"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:border-white/15 hover:bg-white/[0.07] transition-all duration-400 text-xs font-light"
                  >
                    <TikTokIcon className="w-3.5 h-3.5" />
                    <span>TikTok</span>
                  </a>
                  <a
                    href="mailto:hello@koalacub.club"
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:border-white/15 hover:bg-white/[0.07] transition-all duration-400 text-xs font-light"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>hello@koalacub.club</span>
                  </a>
                  <a
                    href="https://github.com/koalacubclub/web"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:border-white/15 hover:bg-white/[0.07] transition-all duration-400 text-xs font-light"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>Source</span>
                  </a>
                </div>
              </Reveal>

              {/* Closing */}
              <Reveal delay={0.2}>
                <p className="text-white/10 text-[9px] uppercase tracking-[0.4em] mt-4">
                  Made with love by Koala's human
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[oklch(0.12_0.008_60)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-black"
        >
          Skip to content
        </a>
        <FixedHero />
        <ContentPanel />
      </div>
    </MotionConfig>
  )
}
