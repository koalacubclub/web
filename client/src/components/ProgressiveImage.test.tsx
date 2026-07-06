import { render, screen, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressiveImage } from './ProgressiveImage'

// jsdom (29.x) doesn't implement HTMLImageElement.decode(), never fires onload,
// and leaves .complete false / .naturalWidth 0 after setting src — so with the
// real Image the swap never happens. Stub Image per-test to drive each load
// branch. NOT added to src/test/setup.ts on purpose: a global Image stub would
// silently change behavior for any other test that renders a loading <img>.

type Resolver = () => void
type Rejector = () => void

/** A controllable Image stub; the latest instance is captured for the test. */
function installImageMock(opts: {
  decode?: 'resolve' | 'reject' | 'absent'
  completeOnDecodeReject?: boolean
  naturalWidthOnReject?: number
}) {
  let resolveDecode: Resolver = () => {}
  let rejectDecode: Rejector = () => {}
  const instances: MockImage[] = []

  class MockImage {
    src = ''
    srcset = ''
    sizes = ''
    complete = false
    naturalWidth = 0
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    decode?: () => Promise<void>

    constructor() {
      instances.push(this)
      if (opts.decode !== 'absent') {
        this.decode = () =>
          new Promise<void>((res, rej) => {
            resolveDecode = () => res()
            rejectDecode = () => {
              this.complete = opts.completeOnDecodeReject ?? false
              this.naturalWidth = opts.naturalWidthOnReject ?? 0
              rej(new Error('decode failed'))
            }
          })
      }
    }
  }

  vi.stubGlobal('Image', MockImage as unknown as typeof Image)
  return {
    resolveDecode: () => resolveDecode(),
    rejectDecode: () => rejectDecode(),
    instance: () => instances[instances.length - 1],
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProgressiveImage', () => {
  it('renders lowSrc/lowSrcSet before the high-res is ready', () => {
    installImageMock({ decode: 'resolve' })
    render(
      <ProgressiveImage
        lowSrc="/low.webp"
        lowSrcSet="/low.webp 200w"
        highSrc="/high.webp"
        highSrcSet="/high.webp 800w"
        alt="cat"
      />,
    )
    const img = screen.getByAltText('cat')
    expect(img).toHaveAttribute('src', '/low.webp')
    expect(img).toHaveAttribute('srcset', '/low.webp 200w')
  })

  it('swaps to highSrc/highSrcSet once decode() resolves', async () => {
    const mock = installImageMock({ decode: 'resolve' })
    render(
      <ProgressiveImage
        lowSrc="/low.webp"
        highSrc="/high.webp"
        highSrcSet="/high.webp 800w"
        alt="cat"
      />,
    )
    await act(async () => {
      mock.resolveDecode()
    })
    const img = screen.getByAltText('cat')
    expect(img).toHaveAttribute('src', '/high.webp')
    expect(img).toHaveAttribute('srcset', '/high.webp 800w')
  })

  it('falls back to onload when decode() is unavailable', async () => {
    const mock = installImageMock({ decode: 'absent' })
    render(
      <ProgressiveImage lowSrc="/low.webp" highSrc="/high.webp" alt="cat" />,
    )
    await act(async () => {
      mock.instance().onload?.()
    })
    expect(screen.getByAltText('cat')).toHaveAttribute('src', '/high.webp')
  })

  it('swaps when decode() rejects but the pixels are present', async () => {
    const mock = installImageMock({
      decode: 'reject',
      completeOnDecodeReject: true,
      naturalWidthOnReject: 100,
    })
    render(
      <ProgressiveImage lowSrc="/low.webp" highSrc="/high.webp" alt="cat" />,
    )
    await act(async () => {
      mock.rejectDecode()
    })
    expect(screen.getByAltText('cat')).toHaveAttribute('src', '/high.webp')
  })

  it('stays on lowSrc and calls onHighResError when the high-res fails', async () => {
    const mock = installImageMock({ decode: 'reject', naturalWidthOnReject: 0 })
    const onErr = vi.fn()
    render(
      <ProgressiveImage
        lowSrc="/low.webp"
        highSrc="/high.webp"
        alt="cat"
        onHighResError={onErr}
      />,
    )
    await act(async () => {
      mock.rejectDecode()
    })
    expect(screen.getByAltText('cat')).toHaveAttribute('src', '/low.webp')
    expect(onErr).toHaveBeenCalledOnce()
  })

  it('applies the blur-up filter before the high-res is ready', () => {
    installImageMock({ decode: 'resolve' })
    render(
      <ProgressiveImage
        lowSrc="/low.webp"
        highSrc="/high.webp"
        alt="cat"
        blurUp
      />,
    )
    expect(screen.getByAltText('cat')).toHaveStyle({ filter: 'blur(12px)' })
  })
})
