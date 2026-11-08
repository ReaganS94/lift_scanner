import './styles/fonts';
import './styles/theme.css';
import './styles/motion.css';
import './App.css';
import { ChooseClip } from './components/ChooseClip';
import { ConfirmView } from './components/ConfirmView';
import { ExtractionProgress } from './components/ExtractionProgress';
import { PhotoReading } from './components/photo/PhotoReading';
import { PhotoResults } from './components/photo/PhotoResults';
import { SetResults } from './components/results/SetResults';
import type { AnalysisAdapters } from './flow/adapters';
import { positionOf } from './flow/photo-flow';
import { useAnalysisFlow } from './flow/use-analysis-flow';
import { usePhotoFlow } from './flow/use-photo-flow';
import { liftRegistry } from '../lifts';

interface AppProps<TImage> {
  adapters: AnalysisAdapters<TImage>;
}

export function App<TImage>({ adapters }: AppProps<TImage>) {
  const { state, livePose, start, cancel, confirmView, changeView, reset } =
    useAnalysisFlow(adapters);
  const photo = usePhotoFlow(adapters);
  // Picture mode takes over the screen while a photo is being checked.
  const photoScreen = photo.state.step === 'idle' ? null : <PhotoScreen flow={photo} />;

  return (
    <main className="app">
      <header>
        <h1>
          Lift <span className="accent">Scanner</span>
        </h1>
      </header>

      {photoScreen && (
        <div key={`photo-${photo.state.step}`} className="screen">
          {photoScreen}
        </div>
      )}

      <div key={state.step} className="screen" hidden={photoScreen !== null}>
        {state.step === 'choose' && (
          <ChooseClip
            onStart={(liftId, file) => {
              void start(liftId, file);
            }}
            onStartPhoto={(liftId, positionId, file) => {
              void photo.start(liftId, positionId, file);
            }}
          />
        )}

        {state.step === 'extracting' && (
          <ExtractionProgress progress={state.progress} livePose={livePose} onCancel={cancel} />
        )}

        {state.step === 'confirm-view' && (
          <ConfirmView prepared={state.prepared} onConfirm={confirmView} onStartOver={reset} />
        )}

        {state.step === 'results' && (
          <SetResults
            videoUrl={state.videoUrl}
            raw={state.raw}
            prepared={state.prepared}
            report={state.report}
            onChangeView={changeView}
            onStartOver={reset}
          />
        )}

        {state.step === 'error' && (
          <div className="stack">
            <p role="alert">{state.message}</p>
            <button type="button" className="primary" onClick={reset}>
              Start over
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

/** Picture mode's screens, from reading the photo to its results. */
function PhotoScreen({ flow }: { flow: ReturnType<typeof usePhotoFlow> }) {
  const { state } = flow;
  switch (state.step) {
    case 'idle':
      return null;
    case 'reading':
      return <PhotoReading onCancel={flow.reset} />;
    case 'confirm-view':
      return (
        <ConfirmView
          prepared={state.prepared}
          media="photo"
          onConfirm={flow.confirmView}
          onStartOver={flow.reset}
        />
      );
    case 'results': {
      const position = positionOf(state.liftId, state.positionId);
      if (!position) return null;
      return (
        <PhotoResults
          liftName={liftRegistry.get(state.liftId)?.name ?? state.liftId}
          position={position}
          photo={state.photo}
          raw={state.raw}
          prepared={state.prepared}
          report={state.report}
          onChangeView={flow.changeView}
          onStartOver={flow.reset}
        />
      );
    }
    case 'error':
      return (
        <div className="stack">
          <p role="alert">{state.message}</p>
          <button type="button" className="primary" onClick={flow.reset}>
            Start over
          </button>
        </div>
      );
  }
}
