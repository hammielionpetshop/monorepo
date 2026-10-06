import { describe, expect, it } from 'vitest'
import { canCloneTransaction } from './clone-rules'

describe('canCloneTransaction', () => {
  it('nota menunggu void atau sudah void boleh di-clone', () => {
    expect(canCloneTransaction('PENDING_VOID')).toBe(true)
    expect(canCloneTransaction('VOIDED')).toBe(true)
  })

  it('nota yang masih berlaku tidak boleh', () => {
    expect(canCloneTransaction('COMPLETED')).toBe(false)
    expect(canCloneTransaction('CORRECTED')).toBe(false)
    expect(canCloneTransaction('')).toBe(false)
  })
})
