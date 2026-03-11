#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

if [ -f "$ROOT/package.json" ]; then
  npm install
fi

if [ -d "$ROOT/macos/TypeLearn.xcodeproj" ] || [ -f "$ROOT/macos/TypeLearn.xcodeproj/project.pbxproj" ]; then
  xcodebuild -list -project "$ROOT/macos/TypeLearn.xcodeproj" >/dev/null
fi
