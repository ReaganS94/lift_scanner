import './App.css';
import { ChooseClip } from './components/ChooseClip';
import { ConfirmView } from './components/ConfirmView';
import { ExtractionProgress } from './components/ExtractionProgress';
import { SetResults } from './components/SetResults';
import { useAnalysisFlow } from './flow/use-analysis-flow';

export function App() {
  const { state, start, cancel, confirmView, changeView, reset } = useAnalysisFlow();

  return (
    <main className="app">
      <header>
        <h1>Lift Scanner</h1>
      </header>

      {state.step === 'choose' && (
        <ChooseClip
          onStart={(liftId, file) => {
            void start(liftId, file);
          }}
        />
      )}

      {state.step === 'extracting' && (
        <ExtractionProgress progress={state.progress} onCancel={cancel} />
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
    </main>
  );
}
