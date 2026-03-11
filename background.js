chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-private-bookmarks') {
    chrome.windows.getCurrent((win) => {
      if (win && win.id) {
        chrome.windows.update(win.id, { focused: true }, () => {
          chrome.action.openPopup({ windowId: win.id });
        });
      } else {
        chrome.action.openPopup();
      }
    });
  }
});

function openPopupWithData(data) {
  chrome.storage.local.set({ pendingBookmarkData: data }, () => {
    chrome.windows.getCurrent((win) => {
      if (win && win.id) {
        chrome.windows.update(win.id, { focused: true }, () => {
          chrome.action.openPopup({ windowId: win.id });
        });
      } else {
        chrome.action.openPopup();
      }
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'addPrivateBookmark',
    title: 'Add to Private Bookmarks',
    contexts: ['page', 'link']
  });
});

chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  if (!bookmark.url) {
    return;
  }

  const data = {
    title: bookmark.title,
    url: bookmark.url,
    chromeId: id
  };

  openPopupWithData(data);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addPrivateBookmark') {
    const url = info.linkUrl || info.pageUrl;
    const title = info.pageTitle || 'Untitled';
    
    const data = { title, url };
    openPopupWithData(data);
  }
});
