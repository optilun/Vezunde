import { PROFILE_CONTROL_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

export function deriveProviderLocationState(location = {}) {
  const suspended = location.profile_control_status === "suspended" || location.status === "suspendata";
  const inactive = location.active_status === "inactiva";
  const verified = location.profile_control_status === "verified" || location.claim_verification_status === "approved";
  const published = location.status === "publicata" || location.public_visibility_status === "approved";

  return {
    active: !inactive && !suspended,
    suspended,
    verified,
    published,
    activityLabel: suspended ? "Suspendată" : inactive ? "Inactivă" : "Activă",
    activityClassName: suspended || inactive ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800",
    controlLabel: PROFILE_CONTROL_LABELS[location.profile_control_status] || location.profile_control_status || "Neclasificat",
    publicationLabel: published ? "Publicată" : "Nepublicată",
  };
}

export function deriveSubmissionState(submission) {
  if (!submission) return null;
  const labels = {
    draft: "Draft în lucru",
    pending_review: "În verificare",
    needs_more_info: "Necesită completări",
    approved: "Aprobat",
    rejected: "Respins",
    withdrawn: "Retras",
  };
  const classNames = {
    draft: "bg-amber-100 text-amber-800",
    pending_review: "bg-blue-100 text-blue-800",
    needs_more_info: "bg-amber-100 text-amber-900",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    withdrawn: "bg-secondary text-muted-foreground",
  };
  return {
    label: labels[submission.status] || SUBMISSION_STATUS_LABELS[submission.status] || submission.status,
    className: classNames[submission.status] || "bg-secondary text-muted-foreground",
    editable: ["draft", "needs_more_info"].includes(submission.status),
    pendingReview: submission.status === "pending_review",
  };
}
