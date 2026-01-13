# How to Find Your Organization ID

The extension needs your Claude.ai organization ID to make API calls. Here are several ways to find it:

## Method 1: From Browser Console (Easiest)

1. Go to [claude.ai](https://claude.ai)
2. Open Browser DevTools (F12 or Right-click → Inspect)
3. Go to the **Console** tab
4. Paste this code and press Enter:

```javascript
// Try multiple methods to find org ID
const methods = {
  localStorage: () => {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      try {
        const data = JSON.parse(localStorage[key]);
        if (data.organization_id) return data.organization_id;
        if (data.organizationId) return data.organizationId;
      } catch (e) {}
    }
  },
  networkRequest: async () => {
    const response = await fetch('https://claude.ai/api/organizations');
    const orgs = await response.json();
    return orgs[0]?.uuid || orgs[0]?.id;
  },
  urlPattern: () => {
    const match = window.location.href.match(/organizations\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }
};

// Try all methods
(async () => {
  for (const [method, fn] of Object.entries(methods)) {
    try {
      const orgId = await fn();
      if (orgId) {
        console.log(`✅ Organization ID found via ${method}:`, orgId);
        return;
      }
    } catch (e) {
      console.log(`❌ ${method} failed:`, e.message);
    }
  }
  console.log('❌ Could not find organization ID');
})();
```

## Method 2: From Network Tab

1. Go to [claude.ai](https://claude.ai)
2. Open Browser DevTools (F12)
3. Go to the **Network** tab
4. Click on any chat or refresh the page
5. Look for requests to URLs like:
   - `https://claude.ai/api/organizations/{ORG_ID}/...`
   - The `{ORG_ID}` part is your organization ID

## Method 3: From URL

Some Claude.ai URLs include the organization ID:
- Example: `https://claude.ai/organizations/12345-67890-abcde-...`
- The UUID after `/organizations/` is your org ID

## Troubleshooting

If the extension can't automatically detect your organization ID:

1. The extension will show an error message
2. Check the browser console for detailed error messages
3. Try the manual methods above to find your org ID
4. The extension code automatically tries multiple detection methods

## Privacy Note

Your organization ID is used only to make authenticated API calls to Claude.ai from your browser session. It never leaves your browser and is not stored by the extension.
