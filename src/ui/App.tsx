import './styles/fonts';
import './styles/theme.css';
import './styles/motion.css';
import './App.css';
import { useState } from 'react';
import { ChooseClip } from './components/ChooseClip';
import { ConfirmView } from './components/ConfirmView';
import { ExtractionProgress } from './components/ExtractionProgress';
import { FramingCheck } from './components/FramingCheck';
import { SetResults } from './components/results/SetResults';
import type { AnalysisAdapters } from './flow/adapters';
import { useAnalysisFlow } from './flow/use-analysis-flow';

interface AppProps<TImage> {
  adapters: AnalysisAdapters<TImage>;
}

export function App<TImage>({ adapters }: AppProps<TImage>) {
  const { state, livePose, start, cancel, confirmView, changeView, reset } =
    useAnalysisFlow(adapters);
  // The framing check sits outside the analysis flow: it only helps set up the next video.
  const [checkingFraming, setCheckingFraming] = useState(false);

  return (
    <main className="app">
      <header>
        <h1>
          Lift <span className="accent">Scanner</span>
        </h1>
      </header>

      <div key={state.step} className="screen">
        {state.step === 'choose' && checkingFraming && (
          <FramingCheck
            adapters={adapters}
            onClose={() => {
              setCheckingFraming(false);
            }}
          />
        )}

        {state.step === 'choose' && !checkingFraming && (
          <ChooseClip
            onStart={(liftId, file) => {
              void start(liftId, file);
            }}
            onCheckFraming={() => {
              setCheckingFraming(true);
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
