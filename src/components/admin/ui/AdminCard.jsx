import React from "react";

// UI-1 shared card primitive used across the redesigned admin workspace.
export default function AdminCard({ className = "", children }) {
  return (
    <div className={`bg-card border border-border rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}