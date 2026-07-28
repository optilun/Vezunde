# Runtime compatibility checklist

- `runtime_info` is handled before the legacy import handler.
- The reported runtime revision matches the frontend guard.
- The probe is read-only.
- Snapshot creation remains blocked when the expected runtime is unavailable.
- No dry-run or import action is triggered by the probe.
