# App Store Screenshot Manifest

## Required Device Family

- Build 73 target: iPhone only (`TARGETED_DEVICE_FAMILY = 1`, `supportsTablet = false`).
- Required set: 6.9-inch iPhone at an accepted `1320 x 2868` portrait size.
- iPad: not applicable for this binary. Apple requires the 13-inch `2064 x 2752` set only when the app runs natively on iPad.

## Planned Order

1. `01-today-1320x2868.png` - health record overview and score context.
2. `02-records-1320x2868.png` - organized records and processing states.
3. `03-trends-1320x2868.png` - readable status bars and reference ranges.
4. `04-care-1320x2868.png` - medicines, follow-ups, and reminders.
5. `05-assistant-1320x2868.png` - records-grounded answer with source context.

All screenshots must come from the real SwiftUI app in Debug screenshot mode with fictional data only. The capture script replaces this file with validated dimensions and SHA-256 hashes.
