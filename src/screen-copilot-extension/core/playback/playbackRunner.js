import { createPlaybackSession, RunnerState, StepStatus, appendLog } from "./state.js";
import { executeStep } from "./stepExecutors.js";

export function createRunner(guide, opts = {}) {
  const listeners = new Set();
  let session = createPlaybackSession(guide);
  let abortController = null;

  const notify = () => listeners.forEach((fn) => fn(session));
  const setSession = (next) => {
    session = next;
    notify();
  };

  async function runStep(idx) {
    if (!guide?.steps || idx >= guide.steps.length) {
      setSession({
        ...session,
        state: RunnerState.FINISHED,
        stepIndex: guide?.steps?.length || 0,
      });
      return;
    }
    abortController = new AbortController();
    setSession({ ...session, state: RunnerState.RUNNING_STEP, stepIndex: idx });
    const step = guide.steps[idx];
    const res = await executeStep(step, {
      timeoutMs: opts.stepTimeoutMs || 10000,
      retries: opts.stepRetries ?? 1,
      signal: abortController.signal,
    });
    if (res.status === StepStatus.SUCCESS) {
      setSession(
        appendLog(
          { ...session, stepIndex: idx + 1 },
          { level: "info", message: `Step ${idx + 1} success` }
        )
      );
      return runStep(idx + 1);
    }
    if (res.status === StepStatus.SKIPPED) {
      setSession({ ...session, state: RunnerState.CANCELLED, lastError: res.error });
      return;
    }
    setSession(
      appendLog(
        { ...session, state: RunnerState.PAUSED, lastError: res.error },
        { level: "warn", message: `Step ${idx + 1} failed: ${res.error}` }
      )
    );
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      fn(session);
      return () => listeners.delete(fn);
    },
    start() {
      if (!guide?.steps?.length) return;
      runStep(session.stepIndex);
    },
    retry() {
      if (session.state !== RunnerState.PAUSED) return;
      runStep(session.stepIndex);
    },
    skip() {
      if (!guide?.steps?.length) return;
      runStep(session.stepIndex + 1);
    },
    cancel() {
      abortController?.abort();
      setSession({ ...session, state: RunnerState.CANCELLED });
    },
    getSession() {
      return session;
    },
  };
}
