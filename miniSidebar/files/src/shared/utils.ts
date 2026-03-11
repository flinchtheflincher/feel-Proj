export const nextId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const clip = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value

export const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim()
