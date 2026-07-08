import React from "react";

export default function SocialBrandIcon({ platform, className = "h-3.5 w-3.5" }) {
  if (platform === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
        <path d="M14.2 8.2V6.7c0-.7.5-.9.9-.9h2.2V2.1L14.2 2c-3.5 0-4.3 2.6-4.3 4.3v1.9H7.1V12h2.8v10h4.2V12h3.1l.5-3.8h-3.5z" />
      </svg>
    );
  }

  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (platform === "linkedin") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
        <path d="M5.1 8.8h3.8V21H5.1V8.8zM7 3C5.8 3 4.9 3.9 4.9 5.1c0 1.1.9 2 2.1 2 1.2 0 2.1-.9 2.1-2C9.1 3.9 8.2 3 7 3zM11.2 8.8h3.6v1.7h.1c.5-.9 1.8-1.9 3.6-1.9 3.9 0 4.6 2.6 4.6 5.9V21h-3.8v-5.8c0-1.4 0-3.2-1.9-3.2-2 0-2.3 1.5-2.3 3.1V21h-3.8V8.8z" />
      </svg>
    );
  }

  return null;
}
