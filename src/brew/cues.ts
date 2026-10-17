const STORAGE_KEY = 'barista.pour-sounds'

/** A short sound when the next pour is due. Off unless the person turns it on. */
export function soundsOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function setSoundsOn(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Not remembered; the toggle still works for this visit.
  }
}

let context: AudioContext | null = null

/** Browsers only allow sound after a tap, so call this from the tap that starts the timer. */
export function primeSound(): void {
  if (!soundsOn() || typeof AudioContext === 'undefined') return
  try {
    context ??= new AudioContext()
    void context.resume()
  } catch {
    context = null
  }
}

export function beep(): void {
  if (!soundsOn() || !context) return
  try {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.4)
  } catch {
    // A missed beep is not worth interrupting a brew.
  }
}
