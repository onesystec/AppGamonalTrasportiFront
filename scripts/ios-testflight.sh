#!/usr/bin/env bash
# Compila la app de iPhone y la sube a TestFlight (App Store Connect) desde esta Mac.
# Requisitos: Xcode con la cuenta del equipo de pago iniciada (Xcode > Settings > Accounts).
# Uso: scripts/ios-testflight.sh [numero-de-compilacion]   (cada subida necesita un numero mayor al anterior)
set -euo pipefail

EQUIPO="58R4DL52G4"
BUNDLE="com.gamonaltrasporti.app"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$RAIZ"
if [ "${1:-}" != "" ]; then
  sed -i '' -E "s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = $1;/g" ios/App/App.xcodeproj/project.pbxproj
fi

npm run build
npx cap sync ios

# Se archiva sin firmar (con firma automatica Xcode pide un iPhone registrado) y la firma de
# distribucion se hace al exportar. Como un archivo sin firmar pierde los permisos de
# ios/App/App/App.entitlements (push), se firma antes con una firma local solo para llevarlos.
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$TMP/App.xcarchive" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO archive

cat > "$TMP/ent.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>aps-environment</key><string>development</string>
<key>application-identifier</key><string>$EQUIPO.$BUNDLE</string>
<key>com.apple.developer.team-identifier</key><string>$EQUIPO</string>
</dict></plist>
PLIST
codesign -f -s - --entitlements "$TMP/ent.plist" "$TMP/App.xcarchive/Products/Applications/App.app"

cat > "$TMP/export.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>teamID</key><string>$EQUIPO</string>
<key>signingStyle</key><string>automatic</string>
<key>destination</key><string>upload</string>
<key>uploadSymbols</key><true/>
</dict></plist>
PLIST
xcodebuild -exportArchive -archivePath "$TMP/App.xcarchive" -exportOptionsPlist "$TMP/export.plist" \
  -exportPath "$TMP/export" -allowProvisioningUpdates

echo "Listo: la compilacion se esta procesando en App Store Connect > TestFlight."
