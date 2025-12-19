# Auto-Update Troubleshooting Guide

## macOS Code Signing Validation Error

### Error Message
```
Code signature at URL file:///.../Hector Studio.app/ did not pass validation:
code has no resources but signature indicates they must be present
```

### Root Cause
This error occurs when the macOS code signature verification fails during auto-update. Common causes:

1. **Missing `hardenedRuntime`**: macOS Catalina+ requires hardened runtime for notarized apps
2. **Gatekeeper assessment mismatch**: Update package doesn't match the installed app's signature
3. **Inconsistent signing between builds**: Dev builds vs production builds have different signatures

### Fixes Applied

#### 1. Enable Hardened Runtime (electron-builder.yml)
```yaml
mac:
  hardenedRuntime: true
  gatekeeperAssess: false
```

**Why this helps:**
- `hardenedRuntime: true` - Enables Apple's security hardening (required for notarization)
- `gatekeeperAssess: false` - Skips Gatekeeper assessment during install (prevents signature mismatch)

#### 2. Improved Error Handling (updater.ts)
- Added specific error messages for code signing failures
- Provides actionable guidance to users (manual download link)

### Testing Auto-Updates

#### Local Testing (Before Release)
1. Build a signed version:
   ```bash
   npm run build:mac
   ```

2. Test with a mock update server (optional):
   - Update `dev-app-update.yml` with your test server URL
   - Increment version in package.json
   - Build and host the update

#### Production Testing
1. Create a GitHub release with the built dmg
2. Increment version in package.json
3. Push to trigger auto-update check

### Manual Signing (If Needed)

If you have an Apple Developer certificate:

```bash
# Sign the app
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: YOUR_NAME" \
  --options runtime \
  "dist/mac/Hector Studio.app"

# Verify signature
codesign --verify --deep --strict --verbose=2 \
  "dist/mac/Hector Studio.app"

# Check signing details
codesign -dvvv "dist/mac/Hector Studio.app"
```

### Workarounds for Users

If auto-update continues to fail:

1. **Manual Update**: Download latest version from GitHub Releases
2. **Clean Install**:
   ```bash
   # Remove old app
   rm -rf "/Applications/Hector Studio.app"
   rm -rf "~/Library/Caches/com.verikod.hectorstudio.ShipIt"

   # Install fresh version
   ```

### Related Configuration Files

- `electron-builder.yml` - Build and signing config
- `build/entitlements.mac.plist` - macOS entitlements
- `src/main/updater.ts` - Auto-update logic
- `dev-app-update.yml` - Dev testing config (not used in production)

### References

- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [electron-updater Documentation](https://www.electron.build/auto-update)
- [macOS Code Signing Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
