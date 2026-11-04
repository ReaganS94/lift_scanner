/**
 * How far past a frame's start time to seek to show that frame. Seeking to exactly 1/30 s on a
 * 30 fps video can land on either neighbouring frame because of rounding. Pose extraction and
 * playback both seek this way, so the frame on screen is the one the skeleton came from.
 */
export const SEEK_NUDGE_SECONDS = 0.001;
