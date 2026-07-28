# Directory runtime-info compatibility

The published Base44 runtime can temporarily resolve `directoryImportOps` directly to the location-first adapter rather than the latest wrapper.

The adapter now answers the same harmless `runtime_info` probe as the wrapper. This lets the frontend verify that the active runtime preserves explicit location and organization classifications before creating any snapshot.

The probe does not create, update, plan, approve, execute, or import directory data.
