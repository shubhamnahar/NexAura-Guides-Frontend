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

  // --- NATIVE BROWSER VOICE FUNCTION ---
  function speakInstruction(text) {
    console.log("🗣️ Attempting to speak:", text); // <--- ADD THIS
    
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;  
    utterance.pitch = 1.0; 
    utterance.volume = 1.0; 
    
    // Sometimes Chrome needs a specific voice assigned to wake up
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        utterance.voice = voices[0]; 
    }

    window.speechSynthesis.speak(utterance);
  }
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
    
    // Grab the step
    const step = guide.steps[idx];

    // 🔊 1. SPEAK THE INSTRUCTION HERE!
    // Trigger the voice right as the step begins executing and the UI updates.
    if (step && step.instruction) {
      speakInstruction(step.instruction);
    }

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
      // 🔊 2. CUT OFF THE VOICE IF CANCELED
      // If the user hits "Stop" mid-sentence, this shuts it up instantly.
      window.speechSynthesis.cancel();
      
      abortController?.abort();
      setSession({ ...session, state: RunnerState.CANCELLED });
    },
    getSession() {
      return session;
    },
  };
}