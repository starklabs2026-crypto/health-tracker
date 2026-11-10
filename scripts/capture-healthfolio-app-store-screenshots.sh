#!/bin/zsh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
OUTPUT_DIR="${1:-$ROOT/docs/app-store/1.0.0/screenshots/iphone-6.9}"
DEVICE_UDID="${HEALTHFOLIO_SCREENSHOT_DEVICE_UDID:-}"
PREBUILT_APP_PATH="${HEALTHFOLIO_SCREENSHOT_APP_PATH:-}"
BUNDLE_ID="com.starklabs.healthfolio"
EXPECTED_WIDTH=1320
EXPECTED_HEIGHT=2868

if rg -n -i 'Nalin|TATA 1MG|nalin@example\.com' \
  "$ROOT/apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioPreviewData.swift"; then
  echo "Screenshot fixture contains prohibited real-person or institution text." >&2
  exit 1
fi

if [[ -z "$DEVICE_UDID" ]]; then
  DEVICE_UDID="$(xcrun simctl list devices available | sed -nE '/iPhone 17 Pro Max.*\([0-9A-F-]{36}\)/s/.*\(([0-9A-F-]{36})\).*/\1/p' | head -1)"
fi
if [[ -z "$DEVICE_UDID" ]]; then
  echo "No available iPhone 17 Pro Max simulator was found." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

xcrun simctl boot "$DEVICE_UDID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$DEVICE_UDID" -b
xcrun simctl status_bar "$DEVICE_UDID" override \
  --time 9:41 \
  --batteryState charged \
  --batteryLevel 100 \
  --wifiBars 3 \
  --cellularBars 4

APP_PATH="$PREBUILT_APP_PATH"
if [[ -z "$APP_PATH" ]]; then
  SNAPSHOT_PARENT="$(mktemp -d /tmp/healthfolio-screenshots.XXXXXX)"
  SNAPSHOT="$SNAPSHOT_PARENT/repo"
  DERIVED_DATA="$SNAPSHOT_PARENT/DerivedData"
  trap 'rm -rf "$SNAPSHOT_PARENT"' EXIT

  echo "Creating no-space release clone..."
  git clone --local --no-hardlinks "$ROOT" "$SNAPSHOT" >/dev/null
  export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"

  echo "Installing snapshot dependencies..."
  (
    cd "$SNAPSHOT"
    npm ci --include=dev --ignore-scripts --no-audit --no-fund
    cd apps/mobile/ios
    pod install
  ) >"$SNAPSHOT_PARENT/dependencies.log"

  echo "Building HealthFolio screenshot fixture..."
  xcodebuild \
    -workspace "$SNAPSHOT/apps/mobile/ios/HealthFolio.xcworkspace" \
    -scheme HealthFolio \
    -configuration Debug \
    -destination "id=$DEVICE_UDID" \
    -derivedDataPath "$DERIVED_DATA" \
    CODE_SIGNING_ALLOWED=NO \
    build >"$SNAPSHOT_PARENT/xcodebuild.log"

  APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphonesimulator/HealthFolio.app"
fi

if [[ ! -d "$APP_PATH" ]]; then
  echo "Simulator app not found at $APP_PATH" >&2
  exit 1
fi
xcrun simctl install "$DEVICE_UDID" "$APP_PATH"

typeset -a tabs=(today records trends care assistant)
typeset -a numbers=(01 02 03 04 05)
for index in {1..5}; do
  tab="${tabs[$index]}"
  number="${numbers[$index]}"
  output="$OUTPUT_DIR/${number}-${tab}-1320x2868.png"
  xcrun simctl terminate "$DEVICE_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl launch "$DEVICE_UDID" "$BUNDLE_ID" \
    -healthfolioScreenshotMode \
    -healthfolioScreenshotTab "$tab" >/dev/null
  sleep 3
  xcrun simctl io "$DEVICE_UDID" screenshot "$output" >/dev/null

  width="$(sips -g pixelWidth "$output" | awk '/pixelWidth/ {print $2}')"
  height="$(sips -g pixelHeight "$output" | awk '/pixelHeight/ {print $2}')"
  if [[ "$width" != "$EXPECTED_WIDTH" || "$height" != "$EXPECTED_HEIGHT" ]]; then
    echo "Invalid screenshot dimensions for $output: ${width}x${height}" >&2
    exit 1
  fi
done

MANIFEST="$ROOT/docs/app-store/1.0.0/screenshots/manifest.md"
{
  echo '# App Store Screenshot Manifest'
  echo
  echo '- Binary device family: iPhone only.'
  echo '- Apple display class: 6.9-inch iPhone.'
  echo '- Validated dimensions: `1320 x 2868` portrait.'
  echo '- iPad: not applicable because build 73 does not run natively on iPad.'
  echo '- Fixture: Debug-only fictional HealthFolio data.'
  echo
  echo '## Files And SHA-256'
  echo
  for screenshot in "$OUTPUT_DIR"/*.png; do
    hash="$(shasum -a 256 "$screenshot" | awk '{print $1}')"
    echo "- \`$(basename "$screenshot")\`: \`$hash\`"
  done
} >"$MANIFEST"

echo "Captured App Store screenshots in $OUTPUT_DIR"
