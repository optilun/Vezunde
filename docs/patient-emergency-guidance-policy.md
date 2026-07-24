# VIASEE patient emergency guidance policy

Status: draft policy for the current patient-safety implementation.

## 1. Scope

This policy controls only the patient-facing wording shown after VIASEE has deterministically confirmed a blocking eye-safety signal.

It does not diagnose, perform medical triage, select a provider, rank hospitals or start the normal marketplace search.

## 2. Confirmed emergency guidance

Only a `blocking` / confirmed emergency state may display the emergency destination instructions.

The patient is directed to:

1. the nearest public hospital that has ophthalmology emergencies, an ophthalmology emergency room, or an ophthalmology department with surgery that can receive emergencies;
2. when the exact hospital is unknown, the nearest emergency department of a public hospital, where the patient should state clearly that the problem is an eye emergency;
3. safe accompanied transport when vision is affected.

The normal provider search remains stopped.

## 3. Possible or advisory safety signal

A `possible` or advisory signal must not automatically display hospital directions.

The flow must:

- keep search stopped;
- ask one controlled clarification question;
- avoid claiming that an emergency is confirmed;
- avoid displaying emergency transport instructions until the deterministic policy confirms the blocking state.

## 4. Emergency number policy

The current VIASEE policy does not display, recommend or link to `112`.

This applies to:

- deterministic agent output;
- patient safety UI;
- approved guidance copy;
- evaluation fixtures and synthetic captures.

Any future addition of an emergency-number instruction requires a separate product decision, medical safety review and legal/content review. It must not be introduced through model-generated wording.

## 5. Chemical exposure copy

The fixed chemical-exposure first-aid copy may appear only when the safety state is blocking and chemical exposure is confirmed by the deterministic policy or guided answer.

It must not be displayed as an automatic emergency direction for an advisory-only signal.

## 6. Technical authority

The versioned contract is:

- guidance version: `patient-emergency-guidance-v1`;
- destination policy: `public_ophthalmology_emergency_or_surgery`.

The final canonical conversation boundary replaces any model or intermediate emergency wording with the fixed VIASEE guidance message.

The AI model cannot alter the destination, add telephone numbers, select a hospital or resume normal search.

## 7. Release condition

This policy remains draft until the relevant tests, lint, typecheck, build, controlled safety evaluation and medical review execute successfully.
