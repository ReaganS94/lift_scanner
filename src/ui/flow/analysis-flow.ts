import type { PoseSequence, View } from '../../core';
import type { PreparedClip } from '../../analysis';
import type { SetReport } from '../../report';

/** The screens the app moves through, and what each one needs. */
export type FlowState =
  | { readonly step: 'choose' }
  | {
      readonly step: 'extracting';
      readonly liftId: string;
      readonly videoUrl: string;
      readonly progress: number;
    }
  | {
      readonly step: 'confirm-view';
      readonly liftId: string;
      readonly videoUrl: string;
      readonly raw: PoseSequence;
      readonly prepared: PreparedClip;
    }
  | {
      readonly step: 'results';
      readonly liftId: string;
      readonly videoUrl: string;
      readonly raw: PoseSequence;
      readonly prepared: PreparedClip;
      readonly report: SetReport;
    }
  | { readonly step: 'error'; readonly message: string };

export type FlowEvent =
  | { readonly type: 'start'; readonly liftId: string; readonly videoUrl: string }
  | { readonly type: 'progress'; readonly progress: number }
  | { readonly type: 'extracted'; readonly raw: PoseSequence; readonly prepared: PreparedClip }
  | { readonly type: 'analysed'; readonly report: SetReport }
  | { readonly type: 'change-view' }
  | { readonly type: 'failed'; readonly message: string }
  | { readonly type: 'reset' };

export const INITIAL_FLOW: FlowState = { step: 'choose' };

/**
 * Moves between screens. Events that don't fit the current screen are ignored, so a late
 * progress update after cancelling can't drag the app back to an old screen.
 */
export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'start':
      return { step: 'extracting', liftId: event.liftId, videoUrl: event.videoUrl, progress: 0 };

    case 'progress':
      return state.step === 'extracting' ? { ...state, progress: event.progress } : state;

    case 'extracted':
      if (state.step !== 'extracting') return state;
      return {
        step: 'confirm-view',
        liftId: state.liftId,
        videoUrl: state.videoUrl,
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
        videoUrl: state.videoUrl,
        raw: state.raw,
        prepared: state.prepared,
      };

    case 'failed':
      return { step: 'error', message: event.message };

    case 'reset':
      return INITIAL_FLOW;
  }
}

/** Whether a view can be confirmed for this clip, or why not. */
export function canAnalyse(prepared: PreparedClip): boolean {
  return prepared.torsoLength !== null;
}

export function viewLabel(view: View): string {
  return { side: 'Side', front: 'Front', back: 'Back' }[view];
}
