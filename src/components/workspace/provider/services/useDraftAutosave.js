import { useEffect, useMemo } from "react";
import { createDraftSaveController } from "./draftSaveController";

export function useDraftAutosave({ scope, ...snapshot }) {
  const controller = useMemo(() => createDraftSaveController(), [scope]);
  controller.update(snapshot);
  useEffect(() => {
    controller.schedule();
    return controller.cancel;
  }, [controller, snapshot.enabled, snapshot.signature, snapshot.baseline]);
  useEffect(() => () => controller.cancel(), [controller]);
  return controller.flush;
}
