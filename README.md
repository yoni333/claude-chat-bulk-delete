
# Claude Chat Bulk Delete

Chrome extension for bulk deleting conversations on claude.ai.

## Features

- 🗑️ Bulk delete multiple chats at once
- ✅ Select all or choose specific chats
- 📊 Progress tracking with visual progress bar
- 🔒 Uses official Claude.ai API
- 🚀 Fast and efficient (bulk delete API support)

## Installation

1. Download or clone this repository
2. Open Chrome and go to \`chrome://extensions/\`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the extension folder

## Usage

1. Navigate to [claude.ai](https://claude.ai)
2. Click the extension icon
3. Click "Scan Chats"
4. Select chats to delete
5. Click "Delete Selected"

## Permissions

- **activeTab**: To detect when you're on claude.ai
- **scripting**: To scan chats and make API calls
- **host_permissions**: Limited to claude.ai only

## Privacy

This extension does not collect or transmit any data. All operations happen locally in your browser using Claude.ai's official API.

## Changelog

### Version 1.1.0
- Fixed scrolling issue - delete button always visible
- Wider popup (480px) for better UX
- Improved progress tracking
- Better error handling and logging

### Version 1.0.0
- Initial release
- Bulk delete functionality
- Progress bar
- Select all/deselect all

## License

Note: This project is Source-Available, not Open Source. Redistribution in any form is strictly prohibited. See LICENSE for details.

## Disclaimer

This is an unofficial extension not affiliated with Anthropic or Claude.ai.
EOF
