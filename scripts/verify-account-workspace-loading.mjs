import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/pages/MyAccount.jsx", import.meta.url), "utf8");

assert.match(source, /const \{ user, logout \} = useAuth\(\)/, "MyAccount must reuse the authenticated user from AuthContext");
assert.doesNotMatch(source, /base44\.auth\.me\(/, "MyAccount must not perform a duplicate authentication request");
assert.doesNotMatch(source, /redirectToLogin/, "Workspace loading failures must not be treated as authentication failures");
assert.match(source, /Account workspace load failed/, "Workspace failures must be logged for diagnosis");
assert.match(source, /Nu am putut încărca contul/, "The account must expose a recoverable error state");
assert.match(source, /onClick=\{\(\) => void load\(\)\}/, "The recoverable state must provide retry");
assert.match(source, /loadRequestRef/, "Overlapping workspace refreshes must ignore stale responses");
assert.match(source, /hasWorkspaceDataRef/, "Refreshes must preserve the loaded workspace instead of remounting the account");
assert.match(source, /if \(initialRequest\) setLoading\(true\)/, "Only the initial account load may show the full-page loading state");

console.log("Account workspace loading regression checks passed.");
