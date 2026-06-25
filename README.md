# VoiceOrder

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/nurlybekabiltaevvv/voice-controlled-pwa-development)
[![PWA](https://img.shields.io/badge/PWA-Ready-4CAF50.svg)](https://github.com/nurlybekabiltaevvv/voice-controlled-pwa-development)
[![Web Speech API](https://img.shields.io/badge/Web%20Speech%20API-Enabled-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
[![GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-181717.svg)](https://pages.github.com/)

**VoiceOrder** is a modern Progressive Web Application (PWA) that enables hands-free ordering in restaurants using voice commands. The project includes **two specialized interfaces**: one for customers and one for waiters.

Built as a portfolio project to demonstrate skills in **PWA development**, **Web Speech API**, **Service Workers**, and **voice interface design**.



## 🌟 Live Demo

- **Customer Version**: https://nurlybekabiltaevvv.github.io/voice-controlled-pwa-development/
- **Waiter Version**: [Demo Link](https://nurlybekabiltaevvv.github.io/voice-controlled-pwa-development/waiter/)

*(Update links after deployment)*



## ✨ Key Features

### Customer Interface
- Voice-based menu browsing
- Add items to order using natural speech
- Real-time order summary
- Installable as a mobile app (PWA)

### Waiter (Staff) Interface
- Fast voice order taking
- Multi-table management
- Voice commands for order status updates
- Send orders to kitchen
- Professional dashboard optimized for restaurant staff

### Common Features
- Offline support via Service Worker
- Responsive design for mobile and tablet
- High performance caching
- Voice feedback using Speech Synthesis



## 🛠 Technologies Used

- **HTML5**, **CSS3**, **Vanilla JavaScript**
- **Web Speech API** (Speech Recognition & Speech Synthesis)
- **Progressive Web App (PWA)** — Manifest + Service Worker
- **GitHub Pages** deployment
- Mobile-First Responsive Design



## 📁 Project Structure

```bash
voice-controlled-pwa-development/
├── customer/               # Customer-facing version
├── waiter/                 # Waiter/staff version
├── assets/
├── service-worker.js
├── manifest.json
├── README.md
└── index.html (optional landing page)
```



## 🚀 Installation & Local Development

```bash
git clone https://github.com/nurlybekabiltaevvv/voice-controlled-pwa-development.git
cd voice-controlled-pwa-development

# Recommended way to run (Service Worker requires server)
npx serve
# or
npx http-server
```

> **Note**: This project will not work correctly if opened directly via `file://` due to Service Worker and PWA requirements.



## 🌐 Deployment (GitHub Pages)

1. Go to repository **Settings → Pages**
2. Set source to `main` branch (root folder)
3. Save

The app will be available at:
`https://nurlybekabiltaevvv.github.io/voice-controlled-pwa-development/`



## 🎙 Voice Commands Examples

- *"Show me the menu"*
- *"Add pizza to order"*
- *"I want a coffee"*
- *"What's my order?"*
- *"Send order to kitchen"* (Waiter version)



## 📱 PWA Features

- Installable on Android and iOS
- Works offline
- Fast loading thanks to caching strategies
- Native app-like experience



## 🎯 Purpose & Learning Outcomes

This project was developed to demonstrate:

- Deep understanding of Progressive Web Applications
- Integration of browser voice technologies
- Dual-role system architecture (Customer + Staff)
- Clean, maintainable vanilla JavaScript code
- Real-world problem solving in the HoReCa industry



## 📄 License

This project is open-sourced under the **MIT License**.



## Author

**Nurlybek Abiltaev**

- GitHub: [@nurlybekabiltaevvv](https://github.com/nurlybekabiltaevvv)


**⭐ Feel free to star this repository if you found it useful!**

