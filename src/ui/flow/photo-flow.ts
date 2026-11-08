import type { PreparedClip } from '../../analysis';
import type { LiftPosition, PoseSequence } from '../../core';
import { liftRegistry } from '../../lifts';
import type { PhotoReport } from '../../report';

/** The photo being checked, as the screens show it. */
export interface ShownPhoto {
  /** Shows the same upright picture the pose was found in. */
  readonly url: string;
  readonly aspectRatio: number;
}

interface Chosen {
  readonly liftId: string;
  readonly positionId: string;
}

/**
 * The screens of picture mode, and what each one needs. 'idle' means picture mode isn't in
 * use, so the video screens show.
 */
export type PhotoFlowState =
  | { readonly step: 'idle' }
  | (Chosen & { readonly step: 'reading' })
  | (Chosen & {
      readonly step: 'confirm-view';
      readonly photo: ShownPhoto;
      /** The photo as a one-frame clip, before the lifter was picked: for downloading. */
      readonly raw: PoseSequence;
      readonly prepared: PreparedClip;
    })
  | (Chosen & {
      readonly step: 'results';
      readonly photo: ShownPhoto;
      readonly raw: PoseSequence;
      readonly prepared: PreparedClip;
      readonly report: PhotoReport;
    })
  | { readonly step: 'error'; readonly message: string };

export type PhotoFlowEvent =
  | (Chosen & { readonly type: 'start' })
  | {
      readonly type: 'read';
      readonly photo: ShownPhoto;
      readonly raw: PoseSequence;
      readonly prepared: PreparedClip;
    }
  | { readonly type: 'analysed'; readonly report: PhotoReport }
  | { readonly type: 'change-view' }
  | { readonly type: 'failed'; readonly message: string }
  | { readonly type: 'reset' };

export const IDLE_PHOTO_FLOW: PhotoFlowState = { step: 'idle' };

/** Moves between picture mode's screens, ignoring events that don't fit the current one. */
export function photoFlowReducer(state: PhotoFlowState, event: PhotoFlowEvent): PhotoFlowState {
  switch (event.type) {
    case 'start':
      return { step: 'reading', liftId: event.liftId, positionId: event.positionId };

    case 'read':
      if (state.step !== 'reading') return state;
      return {
        step: 'confirm-view',
        liftId: state.liftId,
        positionId: state.positionId,
        photo: event.photo,
        raw: event.raw,
        prepared: event.prepared,
      };

    case 'analysed':
      return state.step === 'confirm-view'
        ? { ...state, step: 'results', report: event.report }
        : state;

    case 'change-view':
      if (state.step !== 'results') return state;
      return {
        step: 'confirm-view',
        liftId: state.liftId,
        positionId: state.positionId,
        photo: state.photo,
        raw: state.raw,
        prepared: state.prepared,
      };

    case 'failed':
      return { step: 'error', message: event.message };

    case 'reset':
      return IDLE_PHOTO_FLOW;
  }
}

/** A lift's position by id, or undefined if the lift or position isn't registered. */
export function positionOf(liftId: string, positionId: string): LiftPosition | undefined {
  return liftRegistry.get(liftId)?.positions?.find((position) => position.id === positionId);
}
