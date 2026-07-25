export * from "./patientGuidancePlannerCore.js";

import {
  buildPatientGuidancePlannerProfile as buildPatientGuidancePlannerProfileCore,
  runPatientGuidancePlannerShadow as runPatientGuidancePlannerShadowCore,
  runPatientGuidanceRuntimeShadow as runPatientGuidanceRuntimeShadowCore,
} from "./patientGuidancePlannerCore.js";
import { assessPatientEyeSafety } from "./patientEyeSafetyPolicy.js";

const COMPOSED_SAFETY_STATES = new Set(["unchecked", "clear", "advisory", "blocking"]);
const CONTROLLED_CLEAR_SOURCES = new Set(["guided_clear", "explicit_clear"]);

function composedDeterministicSafetyState(input = {}) {
  const suppliedState = COMPOSED_SAFETY_STATES.has(input.deterministicSafetyState)
    ? input.deterministicSafetyState
    : "unchecked";
  if (suppliedState === "blocking") return "blocking";

  const safety = assessPatientEyeSafety({
    text: input.text,
    answers: input.guidedAnswers,
  });
  if (safety.blocking) return "blocking";
  if (safety.advisory) return "advisory";
  if (CONTROLLED_CLEAR_SOURCES.has(safety.source)) return "clear";
  if (suppliedState === "advisory") return "advisory";
  return suppliedState;
}

function withComposedDeterministicSafety(input = {}) {
  return {
    ...input,
    deterministicSafetyState: composedDeterministicSafetyState(input),
  };
}

export function buildPatientGuidancePlannerProfile(input = {}, aiEnvelope = {}) {
  return buildPatientGuidancePlannerProfileCore(
    withComposedDeterministicSafety(input),
    aiEnvelope,
  );
}

export async function runPatientGuidancePlannerShadow(input = {}, options = {}) {
  return runPatientGuidancePlannerShadowCore(
    withComposedDeterministicSafety(input),
    options,
  );
}

export function runPatientGuidanceRuntimeShadow(context = {}, options = {}) {
  return runPatientGuidanceRuntimeShadowCore({
    ...context,
    deterministicSafetyState: composedDeterministicSafetyState({
      text: context.text,
      guidedAnswers: context.guidedAnswers,
      deterministicSafetyState: context.deterministicSafetyState,
    }),
  }, options);
}
