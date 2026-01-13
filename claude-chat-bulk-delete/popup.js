// Get DOM elements
const scanButton = document.getElementById('scanChats');
const selectAllButton = document.getElementById('selectAll');
const deselectAllButton = document.getElementById('deselectAll');
const deleteButton = document.getElementById('deleteSelected');
const chatListContainer = document.getElementById('chatListContainer');
const chatList = document.getElementById('chatList');
const statusDiv = document.getElementById('status');

let chats = [];

// Show status message
function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.classList.remove('hidden');
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      statusDiv.classList.add('hidden');
    }, 5000);
  }
}

// Scan for chats on the page
scanButton.addEventListener('click', async () => {
  scanButton.disabled = true;
  showStatus('Scanning chats...', 'info');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('claude.ai')) {
      showStatus('Please navigate to claude.ai first', 'error');
      scanButton.disabled = false;
      return;
    }
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: scanChatsOnPage
    });
    
    chats = results[0].result;
    
    if (chats.length === 0) {
      showStatus('No chats found', 'info');
      scanButton.disabled = false;
      return;
    }
    
    displayChats();
    showStatus(`Found ${chats.length} chats`, 'success');
    chatListContainer.classList.remove('hidden');
    
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
    console.error(error);
  }
  
  scanButton.disabled = false;
});

// Function that runs in the page context to scan chats
function scanChatsOnPage() {
  const chats = [];
  
  // Find the nav element
  const nav = document.querySelector('nav');
  if (!nav) return chats;
  
  // Find all chat links (a tags with href starting with /chat/)
  const chatLinks = nav.querySelectorAll('a[href^="/chat/"]');
  
  chatLinks.forEach((link, index) => {
    const href = link.getAttribute('href');
    const chatId = href.replace('/chat/', '');
    
    // Try to get chat title/preview text
    let title = link.textContent.trim();
    if (!title || title.length === 0) {
      title = `Chat ${index + 1}`;
    }
    
    chats.push({
      id: chatId,
      title: title.substring(0, 50), // Limit title length
      href: href
    });
  });
  
  return chats;
}

// Display chats in the popup
function displayChats() {
  chatList.innerHTML = '';
  
  chats.forEach((chat, index) => {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `chat-${index}`;
    checkbox.dataset.chatId = chat.id;
    checkbox.dataset.href = chat.href;
    checkbox.addEventListener('change', updateDeleteButton);
    
    const label = document.createElement('label');
    label.htmlFor = `chat-${index}`;
    label.textContent = chat.title;
    label.title = chat.title; // Show full title on hover
    
    chatItem.appendChild(checkbox);
    chatItem.appendChild(label);
    chatList.appendChild(chatItem);
  });
}

// Update delete button state
function updateDeleteButton() {
  const checkboxes = chatList.querySelectorAll('input[type="checkbox"]');
  const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  deleteButton.disabled = checkedCount === 0;
  deleteButton.textContent = `Delete Selected (${checkedCount})`;
}

// Select all chats
selectAllButton.addEventListener('click', () => {
  const checkboxes = chatList.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = true);
  updateDeleteButton();
});

// Deselect all chats
deselectAllButton.addEventListener('click', () => {
  const checkboxes = chatList.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = false);
  updateDeleteButton();
});

// Delete selected chats
deleteButton.addEventListener('click', async () => {
  const checkboxes = Array.from(chatList.querySelectorAll('input[type="checkbox"]:checked'));
  
  if (checkboxes.length === 0) return;
  
  const confirmDelete = confirm(`Are you sure you want to delete ${checkboxes.length} chat(s)? This action cannot be undone.`);
  
  if (!confirmDelete) return;
  
  deleteButton.disabled = true;
  selectAllButton.disabled = true;
  deselectAllButton.disabled = true;
  scanButton.disabled = true;
  
  showStatus(`Deleting ${checkboxes.length} chats...`, 'info');
  
  const chatIds = checkboxes.map(cb => ({
    id: cb.dataset.chatId,
    href: cb.dataset.href
  }));
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: deleteChatsOnPage,
      args: [chatIds]
    });
    
    const deleteResult = result[0].result;
    
    if (!deleteResult.success) {
      showStatus(deleteResult.message || 'Failed to delete chats', 'error');
      return;
    }
    
    const deletedCount = deleteResult.count;
    const method = deleteResult.method === 'bulk' ? ' (bulk)' : '';
    
    showStatus(`Successfully deleted ${deletedCount} chat(s)${method}`, 'success');
    
    if (deleteResult.errors && deleteResult.errors.length > 0) {
      console.warn('Some chats failed to delete:', deleteResult.errors);
      showStatus(`Deleted ${deletedCount} chats, ${deleteResult.errors.length} failed`, 'error');
    }
    
    // Remove deleted chats from the list
    checkboxes.forEach(cb => {
      const chatItem = cb.closest('.chat-item');
      chatItem.remove();
    });
    
    // Update the chats array
    const deletedIds = new Set(chatIds.map(c => c.id));
    chats = chats.filter(chat => !deletedIds.has(chat.id));
    
    if (chats.length === 0) {
      chatListContainer.classList.add('hidden');
    }
    
    updateDeleteButton();
    
    // Suggest page refresh to see changes
    setTimeout(() => {
      showStatus('Tip: Refresh the page to see updated chat list', 'info');
    }, 3000);
    
  } catch (error) {
    showStatus(`Error deleting chats: ${error.message}`, 'error');
    console.error(error);
  }
  
  selectAllButton.disabled = false;
  deselectAllButton.disabled = false;
  scanButton.disabled = false;
});

// Function that runs in the page context to delete chats using the API
async function deleteChatsOnPage(chatIds) {
  // First, get the organization ID from the page
  let organizationId = null;
  
  // Try to extract from localStorage or page data
  try {
    const localStorageData = localStorage.getItem('claude_user_data') || localStorage.getItem('user');
    if (localStorageData) {
      const userData = JSON.parse(localStorageData);
      organizationId = userData.organization_id || userData.organizationId;
    }
  } catch (e) {
    console.log('Could not get org ID from localStorage:', e);
  }
  
  // Try to extract from the current URL or page state
  if (!organizationId) {
    // Check if we can get it from window.__INITIAL_STATE__ or similar
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.organization) {
      organizationId = window.__INITIAL_STATE__.organization.id;
    }
  }
  
  // Try to get from API calls in network tab by making a test request
  if (!organizationId) {
    try {
      // Try to fetch conversations list to get the org ID from the response headers or URL
      const testResponse = await fetch('https://claude.ai/api/organizations');
      if (testResponse.ok) {
        const orgs = await testResponse.json();
        if (orgs && orgs.length > 0) {
          organizationId = orgs[0].uuid || orgs[0].id;
        }
      }
    } catch (e) {
      console.log('Could not get org ID from API:', e);
    }
  }
  
  if (!organizationId) {
    console.error('Could not determine organization ID');
    return { success: false, message: 'Could not determine organization ID. Please check the console for instructions.' };
  }
  
  // Use bulk delete API if available (more efficient)
  const conversationUuids = chatIds.map(chat => chat.id);
  
  try {
    // Try the bulk delete endpoint first
    const bulkResponse = await fetch(
      `https://claude.ai/api/organizations/${organizationId}/chat_conversations/delete_many`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_uuids: conversationUuids
        })
      }
    );
    
    if (bulkResponse.ok) {
      return { 
        success: true, 
        count: conversationUuids.length,
        method: 'bulk'
      };
    } else {
      console.log('Bulk delete failed, falling back to individual deletes');
    }
  } catch (error) {
    console.log('Bulk delete error, falling back to individual deletes:', error);
  }
  
  // Fallback: Delete individually
  let deletedCount = 0;
  const errors = [];
  
  for (const chat of chatIds) {
    try {
      const response = await fetch(
        `https://claude.ai/api/organizations/${organizationId}/chat_conversations/${chat.id}`,
        {
          method: 'DELETE'
        }
      );
      
      if (response.ok) {
        deletedCount++;
        console.log(`Successfully deleted conversation: ${chat.id}`);
      } else {
        const errorText = await response.text();
        console.error(`Failed to delete conversation ${chat.id}:`, errorText);
        errors.push({ id: chat.id, error: errorText });
      }
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error deleting chat ${chat.id}:`, error);
      errors.push({ id: chat.id, error: error.message });
    }
  }
  
  return { 
    success: deletedCount > 0,
    count: deletedCount,
    errors: errors,
    method: 'individual'
  };
}
