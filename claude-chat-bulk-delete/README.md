# Claude Chat Bulk Delete - Chrome Extension

A Chrome extension for bulk deleting conversations on claude.ai.

## Features

- Scan and display all available chats from your Claude.ai sidebar
- Select multiple chats for deletion
- Select/Deselect all functionality
- Visual feedback during operations
- Safe deletion with confirmation prompt

## Installation

1. Download or clone this extension folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked"
5. Select the `claude-chat-bulk-delete` folder

## Usage

1. Navigate to [claude.ai](https://claude.ai)
2. Click the extension icon in your Chrome toolbar
3. Click "Scan Chats" to load all available conversations
4. Select the chats you want to delete (or use Select All)
5. Click "Delete Selected" and confirm

## How It Works

The extension:
1. Scans the navigation sidebar for chat links (matching `nav` > `ul` > `li` > `a[href^="/chat/"]`)
2. Extracts chat IDs and titles from the href attributes
3. **Uses Claude.ai's official REST API** to delete conversations:
   - Tries bulk delete endpoint first: `POST /api/organizations/{orgId}/chat_conversations/delete_many`
   - Falls back to individual deletes: `DELETE /api/organizations/{orgId}/chat_conversations/{chatId}`
4. Provides real-time feedback on deletion progress

The extension makes **real API calls** to delete chats, not just hiding them from the UI. Deleted chats are permanently removed from your account (following Anthropic's 30-day backend deletion policy).

## Important Notes

- **Use at your own risk**: This extension permanently deletes chats
- Always double-check your selection before deleting
- The extension requires access to claude.ai to function
- Make sure you're on the main claude.ai page when using the extension

## Known Limitations

- The delete button selectors may need adjustment if Claude.ai updates their UI
- Large batch deletions may take time (500ms delay between each deletion)
- Requires manual confirmation for safety

## Troubleshooting

**"No chats found"**
- Make sure you're on claude.ai
- Ensure your chat sidebar is visible
- Try refreshing the page

**"Could not determine organization ID"**
- See [FIND_ORG_ID.md](FIND_ORG_ID.md) for help finding your organization ID
- Open browser console (F12) to see detailed error messages
- The extension tries multiple methods to auto-detect your org ID

**Deletion doesn't work**
- Check if you're logged into Claude.ai
- Check the browser console for API error messages (F12 → Console tab)
- Ensure you have permission to delete chats
- Network issues or API rate limits may cause failures

## Technical Details

- Manifest V3
- Permissions: `activeTab`, `scripting`
- Host permissions: `https://claude.ai/*`
- Uses Claude.ai's REST API endpoints:
  - `GET /api/organizations` - Get organization info
  - `POST /api/organizations/{orgId}/chat_conversations/delete_many` - Bulk delete
  - `DELETE /api/organizations/{orgId}/chat_conversations/{chatId}` - Individual delete

## API Endpoints Used

The extension automatically detects your organization ID and uses these endpoints:

```
Bulk Delete (preferred):
POST https://claude.ai/api/organizations/{orgId}/chat_conversations/delete_many
Body: { "conversation_uuids": ["uuid1", "uuid2", ...] }

Individual Delete (fallback):
DELETE https://claude.ai/api/organizations/{orgId}/chat_conversations/{chatId}
```

## Modifying the Extension

If the chat scanning stops working due to UI changes, update the selector in `popup.js`:

```javascript
// In scanChatsOnPage function:
const chatLinks = nav.querySelectorAll('a[href^="/chat/"]');
```

The API endpoints are standard REST and shouldn't change frequently.

## License

Free to use and modify as needed.

## Disclaimer

This extension is not affiliated with or endorsed by Anthropic or Claude.ai. Use responsibly.
