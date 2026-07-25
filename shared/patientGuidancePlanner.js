export * from "./patientGuidancePlannerCore.js";
export {
  PATIENT_GUIDANCE_QUESTION_SELECTION_VERSION,
  buildPatientGuidanceQuestionSelection,
} from "./patientGuidancePlannerCore.js";

import {
  buildPatientGuidancePlannerProfile as buildPatientGuidancePlannerProfileCore,
  buildPatientGuidanceQuestionSelection,
  runPatientGuidancePlannerShadow as runPatientGuidancePlannerShadowCore,
  runPatientGuidanceRuntimeShadow as runPatientGuidanceRuntimeShadowCore,
} from "./patientGuidancePlannerCore.js";
import { assessPatientEyeSafety } from "./patientEyeSafetyPolicy.js";

const COMPOSED_SAFETY_STATES = new Set(["unchecked", "clear", "advisory", "blocking"]);
const CONTROLLED_CLEAR_SOURCES = new Set(["guided_clear", "explicit_clear"]);
const SAFETY_TARGETED_QUESTION_KEY = "safety_targeted_check";

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

function hasControlledSafetyAnswer(input = {}) {
  return (Array.isArray(input.guidedAnswers) ? input.guidedAnswers : []).some((answer) => (
    answer?.question_key === SAFETY_TARGETED_QUESTION_KEY
  ));
}

function prioritizeUnresolvedAdvisorySafety(profile, input = {}) {
  if (
    profile?.safety_state !== "advisory"
    || hasControlledSafetyAnswer(input)
  ) {
    return profile;
  }

  return {
    ...profile,
    sufficient_for_search: false,
    next_question_key: SAFETY_TARGETED_QUESTION_KEY,
    routing_profile: {
      ...(profile?.routing_profile || {}),
      sufficient_for_search: false,
      next_question_key: SAFETY_TARGETED_QUESTION_KEY,
    },
  };
}

function selectionProfileFromObservation(observation = {}) {
  if (observation?.patient_guidance_shadow_profile) {
    return observation.patient_guidance_shadow_profile;
  }
  return {
    status: observation?.summary?.status || "unavailable",
    ai_status: observation?.summary?.ai_status || "unavailable",
    fallback_reason: observation?.summary?.fallback_reason || null,
  };
}

export function buildPatientGuidancePlannerProfile(input = {}, aiEnvelope = {}) {
  const composedInput = withComposedDeterministicSafety(input);
  return prioritizeUnresolvedAdvisorySafety(
    buildPatientGuidancePlannerProfileCore(composedInput, aiEnvelope),
    composedInput,
  );
}

export async function runPatientGuidancePlannerShadow(input = {}, options = {}) {
  const composedInput = withComposedDeterministicSafety(input);
  return prioritizeUnresolvedAdvisorySafety(
    await runPatientGuidancePlannerShadowCore(composedInput, options),
    composedInput,
  );
}

export function runPatientGuidanceRuntimeShadow(context = {}, options = {}) {
  const composedContext = {
    ...context,
    deterministicSafetyState: composedDeterministicSafetyState({
      text: context.text,
      guidedAnswers: context.guidedAnswers,
      deterministicSafetyState: context.deterministicSafetyState,
    }),
  };
  const observation = runPatientGuidanceRuntimeShadowCore(composedContext, {
    ...options,
    buildProfile: buildPatientGuidancePlannerProfile,
  });

  if (observation?.question_selection) return observation;

  return {
    ...observation,
    question_selection: buildPatientGuidanceQuestionSelection(
      selectionProfileFromObservation(observation),
      {
        askedQuestionKeys: context.questionHistory,
        answeredQuestionKeys: (Array.isArray(context.guidedAnswers)
          ? context.guidedAnswers
          : []).map((answer) => answer?.question_key),
      },
    ),
  };
}
