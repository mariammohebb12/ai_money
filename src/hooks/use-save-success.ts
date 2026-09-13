import { useState } from 'react';

// Shows a brief "Saved" success state on a button before running `onDone`
// (usually router.back()), instead of dismissing the screen the instant a
// save succeeds — the same treatment Profile's save button uses.
export function useSaveSuccess(onDone: () => void, delayMs = 900) {
  const [justSaved, setJustSaved] = useState(false);

  function triggerSuccess() {
    setJustSaved(true);
    setTimeout(onDone, delayMs);
  }

  return { justSaved, triggerSuccess };
}
