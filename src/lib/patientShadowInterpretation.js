export function planPatientShadowInterpretation(completedInterpretation) {
  const status = String(completedInterpretation?.status || "");
  const reusable = ["confirm", "manual_choice"].includes(status)
    && Boolean(completedInterpretation?.intent || completedInterpretation?.version);
  if (!reusable) {
    return {
      shouldRequest: true,
      analyticsStatus: "request_required",
      data: null,
    };
  }
  return {
    shouldRequest: false,
    analyticsStatus: "reused_completed_confirmation",
    data: completedInterpretation,
  };
}
