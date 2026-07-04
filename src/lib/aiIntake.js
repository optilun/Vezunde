import { base44 } from "@/api/base44Client";
import { SERVICES } from "@/lib/vezunde";

// Strat AI de intake, strict controlat: primeste mesajul liber al pacientului
// si returneaza doar campuri structurate pentru prefill-ul wizard-ului.
// Nu diagnosticheaza si nu recomanda tratamente.
export async function analyzeIntakeText(text) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Esti un strat de triaj NON-MEDICAL pentru platforma Vezunde (Romania), care ajuta pacientii sa gaseasca servicii optice si oftalmologice.
REGULI STRICTE:
- NU pune diagnostice si NU recomanda tratamente.
- Doar clasifica mesajul in campuri structurate.
- Daca mesajul descrie simptome sau probleme oculare, seteaza safety_note_required la true.

Mesajul pacientului: """${text}"""

Categorii permise (suggested_category): control_vedere, ochelari_lentile, reparatii, problema_ochi, nesigur.
Servicii permise (suggested_services, chei exacte): ${Object.keys(SERVICES).join(", ")}.
next_question_group: una dintre: details, city (daca nevoia e deja clara).
confidence_level: low, medium sau high.`,
    response_json_schema: {
      type: "object",
      properties: {
        suggested_category: { type: "string", enum: ["control_vedere", "ochelari_lentile", "reparatii", "problema_ochi", "nesigur"] },
        suggested_services: { type: "array", items: { type: "string" } },
        next_question_group: { type: "string" },
        confidence_level: { type: "string", enum: ["low", "medium", "high"] },
        safety_note_required: { type: "boolean" },
      },
      required: ["suggested_category", "confidence_level", "safety_note_required"],
    },
  });
  return result;
}