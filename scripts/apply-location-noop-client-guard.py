from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Expected block not found in {path}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


provider_locations = "src/components/workspace/provider/ProviderLocations.jsx"
replace_once(
    provider_locations,
    'import { deriveProviderLocationState, deriveSubmissionState } from "@/lib/providerWorkspaceState";\n',
    'import { deriveProviderLocationState, deriveSubmissionState } from "@/lib/providerWorkspaceState";\nimport { hasPublishedSectionChanges } from "../../../../shared/providerWorkspaceSubmissionComparison.js";\n',
)

replace_once(
    provider_locations,
    '''    const payload = {\n      public_display_name: values.public_display_name || "",\n      address: values.address || "",\n      public_phone: values.public_phone || "",\n      public_email: values.public_email || "",\n      lat: lat === "" ? "" : lat,\n      lng: lng === "" ? "" : lng,\n      place_id: values.place_id || "",\n    };\n    const response = await base44.functions.invoke("submitProviderWorkspaceChange", { action, submission_id: draft?.id, location_id: selectedLocation.id, section: "location_details", payload }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));\n''',
    '''    const payload = {\n      public_display_name: values.public_display_name || "",\n      address: values.address || "",\n      public_phone: values.public_phone || "",\n      public_email: values.public_email || "",\n      lat: lat === "" ? "" : lat,\n      lng: lng === "" ? "" : lng,\n      place_id: values.place_id || "",\n    };\n    if (!hasPublishedSectionChanges("location_details", payload, selectedLocation)) {\n      setSaving(false);\n      setMessage("Nu exista modificari noi de salvat.");\n      return;\n    }\n    const response = await base44.functions.invoke("submitProviderWorkspaceChange", { action, submission_id: draft?.id, location_id: selectedLocation.id, section: "location_details", payload }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));\n''',
)

replace_once(
    provider_locations,
    '''  const submitDraft = async () => {\n    if (!draft || !selectedLocation?.id) return;\n    if (hasCoordinateIssues) { setMessage(coordinateValidation.issues[0]); return; }\n    setSaving(true);\n    setMessage("");\n    const response = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: selectedLocation.id, section: "location_details" }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));\n''',
    '''  const submitDraft = async () => {\n    if (!draft || !selectedLocation?.id) return;\n    if (hasCoordinateIssues) { setMessage(coordinateValidation.issues[0]); return; }\n    let draftPayload = {};\n    try { draftPayload = JSON.parse(draft.payload_json || "{}"); } catch (_error) { draftPayload = {}; }\n    if (!hasPublishedSectionChanges("location_details", draftPayload, selectedLocation)) {\n      setSaving(true);\n      setMessage("");\n      const closeResponse = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "withdraw", submission_id: draft.id, location_id: selectedLocation.id, section: "location_details" }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));\n      setSaving(false);\n      if (closeResponse.data?.error) { setMessage(closeResponse.data.error); return; }\n      setMessage("Nu exista modificari noi de trimis. Draftul a fost inchis.");\n      await loadDraft();\n      await onRefresh?.();\n      return;\n    }\n    setSaving(true);\n    setMessage("");\n    const response = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: selectedLocation.id, section: "location_details" }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));\n''',
)

revision = "// Deployment revision: provider-location-noop-2026-07-12\n"
for relative_path in [
    "base44/functions/submitProviderWorkspaceChange/entry.ts",
    "base44/functions/manageProviderOrganizationProfile/entry.ts",
    "base44/functions/adminWorkspaceReview/entry.ts",
    "base44/functions/adminOrganizationProfileReview/entry.ts",
]:
    file_path = ROOT / relative_path
    text = file_path.read_text(encoding="utf-8")
    if revision.strip() not in text:
        lines = text.splitlines(keepends=True)
        insert_at = 1
        while insert_at < len(lines) and (lines[insert_at].startswith("import ") or lines[insert_at].strip() == "" or lines[insert_at].startswith("  ") or lines[insert_at].startswith("}")):
            insert_at += 1
        lines.insert(insert_at, revision)
        file_path.write_text("".join(lines), encoding="utf-8")

(ROOT / "scripts/apply-location-noop-client-guard.py").unlink()
(ROOT / ".github/workflows/apply-location-noop-client-guard.yml").unlink()
