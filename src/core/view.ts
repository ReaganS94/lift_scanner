/**
 * The direction the camera faces the lifter from.
 * A 45° angle is deliberately not a view: it distorts most measurements, so it isn't supported.
 */
export type View = 'side' | 'front' | 'back';

export const VIEWS: readonly View[] = ['side', 'front', 'back'];
