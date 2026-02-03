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
    chatItem.dataset.chatId = chat.id; // ✅ ADD: Store chat ID on the item for easier removal
    
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

// ✅ NEW: Delete selected chats with REAL-TIME PROGRESS
deleteButton.addEventListener('click', async () => {
  const checkboxes = Array.from(chatList.querySelectorAll('input[type="checkbox"]:checked'));
  
  if (checkboxes.length === 0) return;
  
  const confirmDelete = confirm(`Are you sure you want to delete ${checkboxes.length} chat(s)? This action cannot be undone.`);
  
  if (!confirmDelete) return;
  
  // Disable all buttons
  deleteButton.disabled = true;
  selectAllButton.disabled = true;
  deselectAllButton.disabled = true;
  scanButton.disabled = true;
  
  const chatIds = checkboxes.map(cb => ({
    id: cb.dataset.chatId,
    href: cb.dataset.href
  }));
  
  const totalChats = chatIds.length;
  let successCount = 0;
  let failedCount = 0;
  const errors = [];
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // ✅ STEP 1: Try bulk delete first
    showStatus(`Attempting bulk delete of ${totalChats} chats...`, 'info');
    
    const bulkResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: tryBulkDelete,
      args: [chatIds]
    });
    
    const bulkSuccess = bulkResult[0].result;
    
    // If bulk delete succeeded, we're done!
    if (bulkSuccess.success && bulkSuccess.method === 'bulk') {
      successCount = totalChats;
      
      showStatus(`Successfully deleted ${totalChats} chat(s) (bulk API)`, 'success');
      
      // Remove all deleted chats from UI
      checkboxes.forEach(cb => {
        const chatItem = cb.closest('.chat-item');
        if (chatItem) chatItem.remove();
      });
      
      // Update chats array
      const deletedIds = new Set(chatIds.map(c => c.id));
      chats = chats.filter(chat => !deletedIds.has(chat.id));
      
      if (chats.length === 0) {
        chatListContainer.classList.add('hidden');
      }
      
      updateDeleteButton();
      
      // Re-enable buttons
      selectAllButton.disabled = false;
      deselectAllButton.disabled = false;
      scanButton.disabled = false;
      
      return;
    }
    
    // ✅ STEP 2: Bulk failed, delete individually with REAL-TIME PROGRESS
    showStatus('Bulk delete not available, deleting individually...', 'info');
    
    // Delete chats one by one
    for (let i = 0; i < totalChats; i++) {
      const chat = chatIds[i];
      
      // Update status with current progress
      showStatus(
        `Deleting chat ${i + 1}/${totalChats}... (${successCount} succeeded, ${failedCount} failed)`,
        'info'
      );
      
      try {
        // Delete single chat
        const deleteResult = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: deleteSingleChat,
          args: [chat.id]
        });
        
        const result = deleteResult[0].result;
        
        if (result.success) {
          successCount++;
          console.log(`✓ Deleted chat ${i + 1}/${totalChats}: ${chat.id}`);
          
          // ✅ Remove from UI immediately for visual feedback
          const chatItem = document.querySelector(`.chat-item[data-chat-id="${chat.id}"]`);
        if (chatItem) {
            // Add 'deleting' class for smooth transition
            chatItem.classList.add('deleting');
            
            // After transition, fade out completely and remove
            setTimeout(() => {
              chatItem.style.opacity = '0';
              setTimeout(() => {
                if (chatItem.parentNode) {
                  chatItem.remove();
                }
              }, 300);
            }, 100);
          }
          
        } else {
          failedCount++;
          errors.push({ id: chat.id, error: result.error });
          console.error(`✗ Failed to delete chat ${i + 1}/${totalChats}: ${chat.id}`, result.error);
        }
        
      } catch (error) {
        failedCount++;
        errors.push({ id: chat.id, error: error.message });
        console.error(`✗ Error deleting chat ${i + 1}/${totalChats}:`, error);
      }
      
      // Small delay between deletions to avoid rate limiting
      if (i < totalChats - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // ✅ STEP 3: Show final results
    if (failedCount === 0) {
      showStatus(`Successfully deleted all ${successCount} chat(s)!`, 'success');
    } else if (successCount > 0) {
      showStatus(
        `Deleted ${successCount} chat(s), ${failedCount} failed. Check console for details.`,
        'error'
      );
      console.error('Failed deletions:', errors);
    } else {
      showStatus(`Failed to delete all ${totalChats} chat(s). Check console for details.`, 'error');
      console.error('Failed deletions:', errors);
    }
    
    // Update the chats array (remove successfully deleted ones)
    const successfulIds = chatIds
      .filter((_, index) => index < successCount)
      .map(c => c.id);
    const deletedIds = new Set(successfulIds);
    chats = chats.filter(chat => !deletedIds.has(chat.id));
    
    if (chats.length === 0) {
      chatListContainer.classList.add('hidden');
    }
    
    updateDeleteButton();
    
    // Suggest page refresh
    if (successCount > 0) {
      setTimeout(() => {
        showStatus('Tip: Refresh claude.ai to see the updated chat list', 'info');
      }, 3000);
    }
    
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
    console.error('Delete error:', error);
  }
  
  // Re-enable buttons
  selectAllButton.disabled = false;
  deselectAllButton.disabled = false;
  scanButton.disabled = false;
});

// ✅ NEW: Function to try bulk delete (runs in page context)
async function tryBulkDelete(chatIds) {
  let organizationId = null;
  
  // Try to get organization ID from localStorage
  try {
    const localStorageData = localStorage.getItem('claude_user_data') || localStorage.getItem('user');
    if (localStorageData) {
      const userData = JSON.parse(localStorageData);
      organizationId = userData.organization_id || userData.organizationId;
    }
  } catch (e) {
    console.log('Could not get org ID from localStorage:', e);
  }
  
  // Try to get from window state
  if (!organizationId) {
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.organization) {
      organizationId = window.__INITIAL_STATE__.organization.id;
    }
  }
  
  // Try to get from API
  if (!organizationId) {
    try {
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
    return { success: false, message: 'Could not find organization ID' };
  }
  
  console.log(`Found organization ID: ${organizationId}`);
  
  // Try bulk delete
  try {
    const conversationUuids = chatIds.map(chat => chat.id);
    console.log(`Attempting bulk delete of ${conversationUuids.length} chats...`);
    
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
      console.log('✓ Bulk delete successful!');
      return { 
        success: true, 
        count: conversationUuids.length,
        method: 'bulk'
      };
    } else {
      const errorText = await bulkResponse.text();
      console.log('Bulk delete failed:', errorText);
      return { success: false, method: 'individual' };
    }
  } catch (error) {
    console.log('Bulk delete error:', error);
    return { success: false, method: 'individual' };
  }
}

// ✅ NEW: Function to delete a single chat (runs in page context)
async function deleteSingleChat(chatId) {
  let organizationId = null;
  
  // Try to get organization ID from localStorage
  try {
    const localStorageData = localStorage.getItem('claude_user_data') || localStorage.getItem('user');
    if (localStorageData) {
      const userData = JSON.parse(localStorageData);
      organizationId = userData.organization_id || userData.organizationId;
    }
  } catch (e) {
    console.log('Could not get org ID from localStorage:', e);
  }
  
  // Try to get from window state
  if (!organizationId) {
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.organization) {
      organizationId = window.__INITIAL_STATE__.organization.id;
    }
  }
  
  // Try to get from API
  if (!organizationId) {
    try {
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
    return { success: false, error: 'No organization ID found' };
  }
  
  // Delete single chat
  try {
    const response = await fetch(
      `https://claude.ai/api/organizations/${organizationId}/chat_conversations/${chatId}`,
      {
        method: 'DELETE'
      }
    );
    
    if (response.ok) {
      return { success: true };
    } else {
      const errorText = await response.text();
      return { success: false, error: errorText || `HTTP ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message || 'Network error' };
  }
}

// ⚠️ REMOVED: Old deleteChatsOnPage function - no longer needed
// We now use tryBulkDelete + deleteSingleChat for better progress tracking
