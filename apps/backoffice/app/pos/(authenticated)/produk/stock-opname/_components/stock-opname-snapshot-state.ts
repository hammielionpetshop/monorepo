export interface SnapshotStateLine {
  uomId: number
  physicalQty: string
  snapshotToken: string | null
  snapshotPending: boolean
  snapshotVersion: number
}

export function markLineForRecount<T extends SnapshotStateLine>(
  line: T,
  patch: Partial<Pick<T, 'physicalQty' | 'uomId'>>,
): {
  line: T
  shouldSchedule: boolean
  requestVersion: number | null
} {
  const nextVersion = line.snapshotVersion + 1
  const nextPhysicalQty = patch.physicalQty ?? line.physicalQty
  const nextLine = {
    ...line,
    ...patch,
    snapshotToken: null,
    snapshotPending: nextPhysicalQty.trim() !== '',
    snapshotVersion: nextVersion,
  }

  return {
    line: nextLine,
    shouldSchedule: nextLine.snapshotPending,
    requestVersion: nextLine.snapshotPending ? nextVersion : null,
  }
}

export function applySnapshotSuccess<T extends SnapshotStateLine>(
  line: T,
  payload: {
    requestVersion: number
    uomId: number
    snapshotToken: string
  },
): T {
  if (payload.requestVersion !== line.snapshotVersion || payload.uomId !== line.uomId) {
    return line
  }

  return {
    ...line,
    snapshotToken: payload.snapshotToken,
    snapshotPending: false,
  }
}

export function applySnapshotFailure<T extends SnapshotStateLine>(
  line: T,
  requestVersion: number,
): T {
  if (requestVersion !== line.snapshotVersion) {
    return line
  }

  return {
    ...line,
    snapshotPending: false,
  }
}
