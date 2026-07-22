import { base44 } from "@/api/base44Client";
import { withPatientOperationTimeout } from "./patientOperationControl.js";

const ADAPTIVE_QUESTION_TIMEOUT_MS = 4000;

/**
 * Calls the controlled, deterministic question_only mode of matchProvidersSemantic.
 * This can only ever influence which already-approved question is shown next —
 * it never touches matching, ranking, Top3 or search results.
 *
 * @param {{ searchText?: string, explicitPrimaryIntent?: string, answers?: any[] }} input
 * @param {{ timeoutMs?: number, requestId?: any }} options
 */
export async function fetchAdaptiveNextQuestionKey(input = {}, options = {}) {
  try {
    const response = await withPatientOperationTimeout(
      () => base44.functions.invoke("matchProvidersSemantic", {
        mode: "question_only",
        search_text: input.searchText || "",
        explicit_primary_intent: input.explicitPrimaryIntent || "",
        answers: Array.isArray(input.answers) ? input.answers.slice(0, 30) : [],
      }),
      {
        timeoutMs: options.timeoutMs || ADAPTIVE_QUESTION_TIMEOUT_MS,
        operation: "patient_guidance_question_selection",
        requestId: options.requestId || null,
      },
    );
    const data = response?.data;
    if (
      !data
      || data.envelope !== "patient_guidance_question_selection"
      || data.status !== "ok"
      || data.safety_interruption === true
    ) {
      return { status: "fallback", nextQuestionKey: null };
    }
    return { status: "ok", nextQuestionKey: data.next_question_key || null };
  } catch (_error) {
    return { status: "fallback", nextQuestionKey: null };
  }
}