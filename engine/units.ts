/** Display units. Everything is stored in degrees C; the unit is only a display preference. */

export type TempUnit = 'c' | 'f'

export const cToF = (celsius: number): number => (celsius * 9) / 5 + 32
export const fToC = (fahrenheit: number): number => ((fahrenheit - 32) * 5) / 9

/** Value in the display unit: whole degrees F, half-degree C. */
export function toDisplayTemp(celsius: number, unit: TempUnit): number {
  return unit === 'f' ? Math.round(cToF(celsius)) : Math.round(celsius * 2) / 2
}

/** Back to degrees C for storage, rounded to a tenth to avoid float noise. */
export function fromDisplayTemp(value: number, unit: TempUnit): number {
  return unit === 'f' ? Math.round(fToC(value) * 10) / 10 : value
}

export function formatTemp(celsius: number, unit: TempUnit): string {
  return `${toDisplayTemp(celsius, unit)}°${unit === 'f' ? 'F' : 'C'}`
}
