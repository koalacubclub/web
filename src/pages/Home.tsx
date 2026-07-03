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

import { useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence, useInView, MotionConfig } from 'framer-motion'
import {
  Instagram,
  Mail,
  ArrowDown,
  Github,
  Play,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { TikTokIcon } from '@/components/TikTokIcon'
import ParkGame from '@/components/ParkGame'
import { IG_PROFILE, REELS, reelPoster, reelUrl } from '@/data/reels'
import {
  FOLLOWERS,
  MEMBERS_PER_PAGE,
  followerAvatar,
  followerUrl,
} from '@/data/followers'

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

// Reel card — poster thumbnail that links out to the reel on Instagram
function ReelCard({
  code,
  caption,
  index,
}: {
  code: string
  caption: string
  index: number
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-5%' })

  // Alternate slight rotations for playfulness
  const rotation = index % 3 === 0 ? -1.5 : index % 3 === 1 ? 1 : -0.5

  return (
    <motion.a
      ref={ref}
      href={reelUrl(code)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Watch on Instagram: ${caption}`}
      className="group relative block"
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
      {/* Poster with organic shadow */}
      <div className="relative aspect-[9/16] rounded-2xl overflow-hidden transform-gpu isolate [clip-path:inset(0_round_1rem)] bg-white/[0.03] border border-white/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
        <img
          src={reelPoster(code)}
          alt={caption}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {/* Legibility gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Instagram glyph, top-right */}
        <Instagram className="absolute top-2.5 right-2.5 w-4 h-4 text-white/80 drop-shadow" />

        {/* Play affordance */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center opacity-80 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110">
            <Play
              className="w-5 h-5 translate-x-[1px] text-white"
              fill="currentColor"
            />
          </div>
        </div>
      </div>

      {/* Caption below */}
      <p className="mt-3 line-clamp-1 text-[11px] tracking-wide text-white/35 font-light text-center">
        {caption}
      </p>
    </motion.a>
  )
}

// Member avatar — circular profile picture that links out to the follower's
// Instagram. Falls back to a monogram if the avatar image is missing/broken.
function MemberAvatar({
  username,
  index,
}: {
  username: string
  index: number
}) {
  const [failed, setFailed] = useState(false)
  const initial = username
    .replace(/[^a-z0-9]/gi, '')
    .charAt(0)
    .toUpperCase()

  return (
    <motion.a
      href={followerUrl(username)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`@${username} on Instagram`}
      className="group flex flex-col items-center gap-2"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: (index % MEMBERS_PER_PAGE) * 0.03,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden bg-white/[0.04] border border-white/[0.08] ring-2 ring-transparent shadow-[0_6px_20px_rgba(0,0,0,0.25)] transition-all duration-300 group-hover:-translate-y-1 group-hover:ring-[oklch(0.75_0.12_80)]/50">
        {failed ? (
          <div
            className="flex h-full w-full items-center justify-center text-lg sm:text-xl lg:text-2xl text-[oklch(0.82_0.13_78)]"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {initial || '🐾'}
          </div>
        ) : (
          <img
            src={followerAvatar(username)}
            alt={`@${username}`}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>
      <span className="max-w-[4.5rem] sm:max-w-[5rem] truncate text-[10px] sm:text-[11px] font-light text-white/40 transition-colors duration-300 group-hover:text-white/70">
        @{username}
      </span>
    </motion.a>
  )
}

// ─── THE CLUB (followers) ───────────────────────────────────────────────────
// A wall of the account's Instagram followers — "the cubs" who make up the club.
// Newest members first, paginated so the whole list is browsable without an
// endless scroll.
function ClubSection() {
  const [page, setPage] = useState(0)
  const pageCount = Math.ceil(FOLLOWERS.length / MEMBERS_PER_PAGE)
  const start = page * MEMBERS_PER_PAGE
  const members = FOLLOWERS.slice(start, start + MEMBERS_PER_PAGE)

  return (
    <>
      {/* Section header — mirrors "The feed" styling */}
      <Reveal className="container mt-16 sm:mt-24 mb-8 sm:mb-12">
        <div className="flex items-center gap-3 mb-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <PawPrint className="w-4 h-4 text-[oklch(0.75_0.12_80)]/60" />
          </motion.div>
          <p className="text-[oklch(0.75_0.12_80)] text-[10px] sm:text-xs uppercase tracking-[0.35em] font-light">
            The club
          </p>
        </div>
        <h2
          className="text-white/85 text-2xl sm:text-3xl lg:text-4xl tracking-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Meet the cubs
        </h2>
        <p className="mt-2 text-sm font-light text-white/35">
          {FOLLOWERS.length} cubs follow Koala&rsquo;s adventures
        </p>
      </Reveal>

      {/* Member grid — fades between pages */}
      <div className="container">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-x-3 gap-y-6 sm:gap-y-7"
          >
            {members.map((username, index) => (
              <MemberAvatar key={username} username={username} index={index} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination — prev / dots / next, cat's-eye gold accent */}
      {pageCount > 1 && (
        <Reveal className="container mt-10 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous members"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/50 transition-all duration-300 hover:border-[oklch(0.75_0.12_80)]/30 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/[0.08] disabled:hover:text-white/50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                aria-label={`Go to page ${i + 1}`}
                aria-current={i === page ? 'true' : undefined}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === page
                    ? 'w-6 bg-[oklch(0.75_0.12_80)]'
                    : 'w-2 bg-white/15 hover:bg-white/30'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
            aria-label="More members"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/50 transition-all duration-300 hover:border-[oklch(0.75_0.12_80)]/30 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/[0.08] disabled:hover:text-white/50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </Reveal>
      )}
    </>
  )
}

// ─── FIXED HERO (mini-game) ─────────────────────────────────────────────────
// The header hosts "Koala's Park" — an interactive pixel-art mini game that
// fills the hero. Move Koala with arrow keys / WASD (or the on-screen D-pad).
function FixedHero() {
  return (
    <div className="fixed inset-0 w-full h-dvh z-0 select-none bg-[oklch(0.12_0.008_60)]">
      {/* Ambient depth behind the letterboxed game canvas */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(42,61,94,0.35)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />

      {/* The mini game — fills the header */}
      <ParkGame />

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

      {/* Wordmark, top-left — Cormorant Garamond display style, matching the
          site's headline/footer branding. Drop shadow keeps it legible over
          the game's night sky. */}
      <div className="absolute top-4 left-5 sm:top-6 sm:left-8 z-20">
        <p
          className="text-[oklch(0.82_0.13_78)] text-2xl sm:text-3xl leading-none tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Koala Cub Club
        </p>
      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.8 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm ring-1 ring-white/20"
        >
          <ArrowDown
            className="h-5 w-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
            strokeWidth={2}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}

// ─── ANIMATED ORGANIC WAVE EDGE ─────────────────────────────────────────────
function OrganicEdge() {
  return (
    <div className="relative w-full h-24 sm:h-32 lg:h-40 -mb-1">
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
      {/* Spacer for hero — pointer-events-none so taps/clicks reach the game
          canvas (and hero social icons) sitting behind it. */}
      <div className="h-dvh pointer-events-none" />

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
              {REELS.map((reel, index) => (
                <ReelCard
                  key={reel.code}
                  code={reel.code}
                  caption={reel.caption}
                  index={index}
                />
              ))}
            </div>
          </div>

          {/* "More" link with playful animation */}
          <Reveal className="container mt-10 sm:mt-14 flex justify-center">
            <a
              href={IG_PROFILE}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-[oklch(0.75_0.12_80)]/30 hover:bg-white/[0.06] transition-all duration-500"
            >
              <Instagram className="w-4 h-4 text-white/50 group-hover:text-[oklch(0.75_0.12_80)] transition-colors duration-500" />
              <span className="text-xs uppercase tracking-[0.2em] text-white/50 group-hover:text-white/80 transition-colors duration-500">
                See all on Instagram
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

          {/* ─── The club: followers wall ─── */}
          <ClubSection />

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
