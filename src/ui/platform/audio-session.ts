/**
 * The page's audio session, from WebKit's Audio Session API (Safari 17+). Not yet in
 * TypeScript's DOM types, so only the part used here is declared.
 */
interface AudioSession {
  type: 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record';
}

/**
 * Tells iOS this app never needs the phone's audio, so music from another app (Spotify, Apple
 * Music) keeps playing while it's open. The app has no sound: its videos are always muted.
 * Does nothing in browsers without the Audio Session API.
 */
export function letOtherAudioKeepPlaying(): void {
  try {
    const session = (navigator as Navigator & { audioSession?: AudioSession }).audioSession;
    if (session) session.type = 'ambient';
  } catch {
    // Unsupported or refused; nothing else to do.
  }
}
