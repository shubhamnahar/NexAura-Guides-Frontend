export const StepStatus = {
  SUCCESS: "SUCCESS",
  RECOVERABLE_FAIL: "RECOVERABLE_FAIL",
  HARD_FAIL: "HARD_FAIL",
  SKIPPED: "SKIPPED",
};

export const RunnerState = {
  IDLE: "IDLE",
  RUNNING_STEP: "RUNNING_STEP",
  PAUSED: "PAUSED",
  FINISHED: "FINISHED",
  CANCELLED: "CANCELLED",
};

export function createPlaybackSession(guide) {
  return {
    guideId: guide?.id ?? null,
    stepIndex: 0,
    state: RunnerState.IDLE,
    lastError: null,
    logs: [],
  };
}

export function appendLog(session, entry) {
  const next = { ...session };
  next.logs = [...(session.logs || []), { ts: Date.now(), ...entry }].slice(-50);
  return next;
}
