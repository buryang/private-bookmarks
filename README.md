# Private Bookmarks - Secure & Smart Bookmark Manager for Chrome

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-blue)](https://chromewebstore.google.com/detail/[你的扩展ID])

**A fully open-source Chrome extension for managing private bookmarks with password protection, hidden storage, configurable encrypted cloud sync, and AI-powered tagging.**

Keep your sensitive bookmarks away from prying eyes — hidden from the main bookmark bar, protected by password, synced securely across devices if you choose, and automatically tagged by AI.

## Features

- **Hidden Bookmarks** — Sensitive links are completely hidden from standard bookmark views.
- **Password Protection** — Access requires your master password (hashed locally).
- **Configurable Cloud Sync** — End-to-end encrypted sync via your chosen provider (WebDAV, self-hosted, etc.). Optional and fully user-controlled.
- **AI Tagging** — Automatically generate smart tags based on title, URL, and content (local-first or via API).
- **Seamless Integration** — Works alongside native Chrome bookmarks; supports import/export, drag-and-drop, keyboard shortcuts.
- **Privacy-First** — All data stored locally by default. No telemetry, no tracking, no data collection.
- **Incognito Friendly** — Fully compatible with private browsing.
- **100% Open Source** — MIT licensed. Audit, fork, contribute!

## Screenshots

<img width="520" height="705" alt="9b81e17f-2ef2-466e-99d3-e845a726822b" src="https://github.com/user-attachments/assets/29b2e8e7-69c5-458c-a304-1c232ab3430a" />
<img width="491" height="695" alt="ec5d29f2-f6b8-4a54-84e0-f33a17a542fb" src="https://github.com/user-attachments/assets/912cae71-f8c6-4529-b11e-d8e274ab63b0" />
<img width="474" height="646" alt="73415fec-14b1-4380-8176-32cadb0b838d" src="https://github.com/user-attachments/assets/aeaa3405-b742-409f-a9f0-76eb5dccfb10" />
<img width="515" height="666" alt="7cf6cf90-5e68-47b5-bb33-532c4dd11b49" src="https://github.com/user-attachments/assets/4d1ce48f-234b-4372-a0c1-78642288bf72" />


## Installation

1. From Chrome Web Store: [链接]
2. For development: Clone repo → `npm install` → `npm run build` → Load unpacked in chrome://extensions/

## Development Setup

```bash
git clone https://github.com/[你的用户名]/private-bookmarks.git
cd private-bookmarks
npm install
npm run dev    # watch mode for development
npm run build  # production build
