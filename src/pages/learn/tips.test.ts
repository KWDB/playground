import { describe, expect, it } from 'vitest'
import { LEARN_START_TIPS, pickRandomLearnStartTip } from './tips'

describe('learn start tips', () => {
  it('returns the first tip when random is 0', () => {
    expect(pickRandomLearnStartTip(() => 0)).toBe(LEARN_START_TIPS[0])
  })

  it('returns the last tip when random is close to 1', () => {
    expect(pickRandomLearnStartTip(() => 0.999999)).toBe(LEARN_START_TIPS[LEARN_START_TIPS.length - 1])
  })

  it('contains non-empty tips', () => {
    expect(LEARN_START_TIPS.length).toBeGreaterThan(0)
    expect(LEARN_START_TIPS.every((tip) => tip.trim().length > 0)).toBe(true)
  })
})
