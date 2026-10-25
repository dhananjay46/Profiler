/**
 * An error with a message that is safe and useful to show to the user as-is.
 * Anything else that is thrown is treated as an unexpected bug.
 */
export class ProfilerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfilerError'
  }
}

export function describeError(error: unknown): string {
  if (error instanceof ProfilerError) return error.message
  const detail = error instanceof Error ? error.message : String(error)
  return `Unexpected error: ${detail}. See the developer console for details.`
}
