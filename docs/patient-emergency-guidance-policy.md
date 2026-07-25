# VIASEE patient emergency guidance policy

Status: draft policy for the current patient-safety implementation.

## 1. Scope

This policy controls only the patient-facing wording shown after VIASEE has deterministically confirmed a blocking eye-safety signal.

It does not diagnose, perform medical triage, select a provider, rank hospitals or start the normal marketplace search.

## 2. Confirmed emergency guidance

Only a `blocking` / confirmed emergency state may display the emergency destination instructions.

The ordered destination guidance is:

1. go immediately to the nearest public hospital that confirms it receives ophthalmology emergencies, has an ophthalmology emergency room, or has an ophthalmology department with on-call and surgical capability;
2. when the exact hospital is unknown, go to the nearest public-hospital UPU and state clearly that the problem is an eye emergency;
3. do not drive when vision is affected and use accompanied transport;
4. call `112` only when safe transport is not possible or the general condition is worsening rapidly.

The public ophthalmology-capable hospital is the primary destination. `112` is a conditional transport/intervention fallback, not the primary CTA.

The normal provider search remains stopped.

## 3. Injury-specific immediate first aid

The first-aid message is selected only from deterministic blocking flags. The model cannot create, remove or modify it.

### Confirmed chemical exposure

When `chemical_injury` is blocking and no penetrating injury is also present, the fixed message appears before the destination guidance:

- begin rinsing immediately and continuously with plenty of clean water;
- continue for at least 20 minutes;
- do not wait until arrival at the hospital to begin rinsing;
- do not attempt to neutralize the chemical with another product.

### Confirmed penetrating or embedded object injury

When `penetrating_or_high_speed_trauma` is blocking, the fixed message appears before the destination guidance:

- do not attempt to remove the object;
- do not rub the eye;
- do not apply pressure to the eye.

When both chemical and penetrating flags are present, the penetrating-injury precaution takes precedence and the generic irrigation instruction is suppressed. The flow still stops and directs the patient to emergency care.

## 4. Possible or advisory safety signal

A `possible` or advisory signal must not display hospital, first-aid or `112` directions.

The flow must:

- keep search stopped;
- ask one controlled clarification question;
- avoid claiming that an emergency is confirmed;
- avoid displaying emergency destination, transport, first-aid or telephone instructions until the deterministic policy confirms the blocking state.

## 5. Emergency number policy

The current VIASEE policy permits `112` only under all of these conditions:

- the deterministic safety state is blocking/confirmed;
- the hospital and public UPU instructions appear first;
- the wording is conditional on inability to travel safely or rapid worsening of the general condition;
- there is no primary `tel:112` button or commercial-style CTA;
- the model cannot generate or alter the instruction.

Evaluation distinguishes:

- `mention_112`: any mention of the number;
- `generic_112_action`: a direct instruction to call it;
- `generic_112_primary_action`: a 112 instruction presented before, or instead of, the hospital destination.

Confirmed emergency fixtures may allow the fixed conditional fallback while forbidding `generic_112_primary_action`. Advisory fixtures may forbid `mention_112` entirely.

Any broader emergency-number behavior requires a separate product decision, medical safety review and legal/content review.

## 6. Technical authority

The versioned contract is:

- guidance version: `patient-emergency-guidance-v1.2`;
- destination policy: `public_ophthalmology_primary_with_112_transport_fallback`.

The final canonical conversation boundary replaces any model or intermediate emergency wording with the fixed VIASEE guidance message.

The AI model cannot alter the destination, first-aid instruction, move 112 ahead of the hospital instruction, add other telephone numbers, select a hospital or resume normal search.

## 7. Release condition

This policy remains draft until the relevant tests, lint, typecheck, build, controlled safety evaluation and medical review execute successfully.
