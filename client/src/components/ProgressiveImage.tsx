import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'

// Paints an already-available low-res image immediately, then swaps to the
// full-quality one once it has fully decoded in the background — so there's no
// blank flash while the good image downloads. The classic LQIP / blur-up
// pattern, as a drop-in <img> replacement.
//
// Works best when `lowSrc` is already cached (a tiny variant you preloaded, or a
// smaller responsive size the browser fetched earlier), so the first paint is
// instant. If `highSrc` is already cached, it decodes synchronously and the
// component mounts straight at full quality with no visible swap.
//
// Notes for reuse:
// - Pass `width`/`height` (or an `aspectRatio` via `style`) when the layout
//   doesn't otherwise reserve the box, so the first paint and the swap don't
//   shift surrounding content (CLS). `lowSrc` and `highSrc` are assumed to be
//   the same picture, so one aspect ratio covers both.
// - `sizes` must be resolvable independent of layout (use absolute lengths like
//   `208px`, not `vw`/`%`). The background preloader is a detached image with no
//   layout box, so a relative `sizes` could make it pick a different srcset
//   entry than the rendered <img>, causing a second fetch instead of a swap.

type ProgressiveImageProps = {
  /** Small image shown immediately — ideally already cached. */
  lowSrc: string
  /** Full-quality image loaded in the background and swapped in once decoded. */
  highSrc: string
  lowSrcSet?: string
  highSrcSet?: string
  sizes?: string
  alt: string
  /** Blur the low-res until the high-res arrives, then ease to sharp. */
  blurUp?: boolean
  /** Called if the high-res image fails to load — it stays on `lowSrc`. */
  onHighResError?: () => void
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'>

export function ProgressiveImage({
  lowSrc,
  highSrc,
  lowSrcSet,
  highSrcSet,
  sizes,
  alt,
  blurUp = false,
  onHighResError,
  style,
  ...rest
}: ProgressiveImageProps) {
  const [ready, setReady] = useState(false)

  // Kept in a ref so a fresh inline callback doesn't re-run the load effect.
  const onErrRef = useRef(onHighResError)
  onErrRef.current = onHighResError

  useEffect(() => {
    setReady(false)
    let cancelled = false
    const done = () => {
      if (!cancelled) setReady(true)
    }
    // On failure we keep showing lowSrc (graceful) and surface it to the caller.
    const fail = () => {
      if (!cancelled) onErrRef.current?.()
    }

    const img = new Image()
    if (highSrcSet) img.srcset = highSrcSet
    if (sizes) img.sizes = sizes
    img.src = highSrc

    // decode() resolves only when the bitmap is fully ready, so the swap never
    // shows a half-painted image. Fall back to the load/error signals for the
    // rare browser without it, and treat a decode rejection as "loaded anyway"
    // if the pixels are actually there.
    if (typeof img.decode === 'function') {
      img.decode().then(done, () => {
        if (img.complete && img.naturalWidth > 0) done()
        else fail()
      })
    } else {
      img.onload = done
      img.onerror = fail
      if (img.complete) done()
    }

    return () => {
      cancelled = true
    }
  }, [highSrc, highSrcSet, sizes])

  return (
    <img
      src={ready ? highSrc : lowSrc}
      srcSet={ready ? highSrcSet : lowSrcSet}
      sizes={sizes}
      alt={alt}
      style={
        blurUp
          ? {
              filter: ready ? undefined : 'blur(12px)',
              transition: 'filter 300ms ease',
              ...style,
            }
          : style
      }
      {...rest}
    />
  )
}
