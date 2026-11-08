export class DepositError extends Error {
  constructor(message: string, readonly status: number = 400, readonly code: string = 'INVALID') {
    super(message)
    this.name = 'DepositError'
  }
}
