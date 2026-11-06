import './styles/fonts';
import './styles/theme.css';
import './styles/motion.css';
import './App.css';
import { ChooseClip } from './components/ChooseClip';
import { ConfirmView } from './components/ConfirmView';
import { ExtractionProgress } from './components/ExtractionProgress';
import { SetResults } from './components/results/SetResults';
import type { AnalysisAdapters } from './flow/adapters';
import { useAnalysisFlow } from './flow/use-analysis-flow';

interface AppProps<TImage> {
  adapters: AnalysisAdapters<TImage>;
}

export function App<TImage>({ adapters }: AppProps<TImage>) {
  const { state, livePose, start, cancel, confirmView, changeView, reset } =
    useAnalysisFlow(adapters);

  return (
    <main className="app">
      <header>
        <h1>
          Lift <span className="accent">Scanner</span>
        </h1>
      </header>

      <div key={state.step} className="screen">
        {state.step === 'choose' && (
          <ChooseClip
            onStart={(liftId, file) => {
              void start(liftId, file);
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
