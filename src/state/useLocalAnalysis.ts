import { useEffect, useSyncExternalStore } from 'react';
import { usePracticeState } from './hooks';
import {
  clearLocalAnalysis,
  getLocalAnalysisState,
  startLocalAnalysis,
  subscribeLocalAnalysis,
} from './localAnalysis';

export function useLocalAnalysis() {
  const { mediaSource, videoId, objectUrl, status } = usePracticeState();
  const analysisState = useSyncExternalStore(subscribeLocalAnalysis, getLocalAnalysisState, getLocalAnalysisState);

  useEffect(() => {
    if (mediaSource !== 'local' || !videoId || !objectUrl || status !== 'ready') {
      if (mediaSource !== 'local') clearLocalAnalysis();
      return;
    }
    startLocalAnalysis(videoId, objectUrl);
  }, [mediaSource, objectUrl, status, videoId]);

  return analysisState;
}
