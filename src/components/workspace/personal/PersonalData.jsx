import React from "react";

export default function PersonalData({ user }) {
  return (
    <div>
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Datele mele</h1>
      <div className="mt-4 rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
        <div><span className="text-muted-foreground">Nume:</span> {user.full_name || "-"}</div>
        <div><span className="text-muted-foreground">Email:</span> {user.email}</div>
      </div>
    </div>
  );
}