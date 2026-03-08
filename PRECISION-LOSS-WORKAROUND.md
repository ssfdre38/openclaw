# Large Integer Precision Loss - Critical Workaround

## Problem
Discord snowflake IDs (and other 64-bit integers) lose precision when passed through OpenClaw's tool execution pipeline. Even with the regex-based JSON parser fix in `openai-ws-stream.ts`, precision is still lost due to AJV's type coercion.

## Root Cause
The `@mariozechner/pi-ai` library uses AJV (JSON Schema validator) with `coerceTypes: true`, which automatically converts numeric strings to JavaScript numbers, causing precision loss for values exceeding `Number.MAX_SAFE_INTEGER` (2^53-1).

## Required Workaround (Manual Patch)
**File:** `node_modules/@mariozechner/pi-ai/dist/utils/validation.js`

**Change line 13 from:**
```javascript
coerceTypes: true,
```

**To:**
```javascript
coerceTypes: false, // DISABLED: Prevents precision loss for large integers (Discord snowflakes)
```

### Why This Can't Be Committed
- This file is in `node_modules/` which is excluded from git
- The change is lost when running `npm install` or `npm update`
- Must be re-applied after any dependency updates

## Long-Term Solutions

### Option 1: Fork pi-ai Library
1. Fork `@mariozechner/pi-ai` to your own repo
2. Change `coerceTypes: false` in source
3. Update `package.json` to use your fork:
   ```json
   "@mariozechner/pi-ai": "github:yourusername/pi-ai#your-branch"
   ```

### Option 2: Upstream Fix
1. Submit PR to `@mariozechner/pi-ai` to make `coerceTypes` configurable
2. Or submit PR to disable it by default (breaking change)
3. Wait for merge and new release

### Option 3: Patch Package
Use `patch-package` to automate the workaround:
```bash
npm install patch-package --save-dev
npx patch-package @mariozechner/pi-ai
```

Add to `package.json`:
```json
"scripts": {
  "postinstall": "patch-package"
}
```

This creates a patches directory with the changes that auto-apply after npm install.

## Impact Without Workaround
- ❌ Discord reply, reactions, edit, threads all fail
- ❌ Any MCP tool using 64-bit integer IDs fails
- ❌ Silent data corruption (IDs truncated)

## Impact With Workaround
- ✅ All Discord MCP tools work correctly
- ✅ Large integers preserved as strings
- ⚠️  Must re-apply after dependency updates
- ⚠️  May break other tools that rely on type coercion

## Testing After Applying Workaround
1. Restart OpenClaw gateway
2. Have Ash reply to a Discord message
3. Check that no "Unknown Message" error occurs
4. Verify message ID is preserved (check logs for truncation)

## Status
- ✅ Workaround applied locally
- ⏳ Permanent solution pending (see options above)
- 📝 Documented in session files

---
**Date:** 2026-03-08  
**Discovery Session:** fa135ace-6ad6-47fe-b24d-fc73d74625df  
**Related:** `openclaw-precision-fix.md` in session files
