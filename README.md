# Tab Trail 🌲

A Chrome extension that tracks and visualizes how you navigate between tabs. Never lose track of how you discovered important content again!

## ✨ Features

- **📍 Automatic Tracking** - Captures every tab navigation and parent-child relationships
- **🌳 Visual Trail Display** - See your browsing path at a glance in the popup  
- **🎯 Interactive Explorer** - Full-page D3.js visualization with tree, radial, and timeline views
- **🔗 Tab Relationships** - Shows how tabs are connected when opened from other tabs
- **📊 Export Options** - Save trails as text, JSON, or Markdown
- **⚡ Keyboard Shortcut** - Quick access with Alt+T
- **🔒 Privacy First** - All data stored locally on your device

## 🚀 Installation

### From Chrome Web Store (Coming Soon)
Tab Trail will be available on the Chrome Web Store soon!

### From Source
1. Clone this repository:
   ```bash
   git clone https://github.com/Dkmariolink/tab-trail.git
   cd tab-trail
   ```

2. Download D3.js (required):
   ```bash
   cd tab-trail/extension/lib/d3
   curl -o d3.v7.min.js https://d3js.org/d3.v7.min.js
   ```
   
   Or manually download from [d3js.org](https://d3js.org/d3.v7.min.js) and save as `extension/lib/d3/d3.v7.min.js`

3. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` folder

## 🎯 Usage

1. **Browse normally** - Tab Trail automatically tracks your navigation
2. **View your trail** - Click the extension icon or press Alt+T
3. **Explore visualizations** - Click "View Full Trail" for the interactive explorer
4. **Export your data** - Use the export buttons to save trails in various formats

## 🔧 Development

### Prerequisites
- Chrome browser
- Basic knowledge of JavaScript and Chrome Extension APIs

### Project Structure
```
tab-trail/
├── extension/
│   ├── manifest.json      # Extension configuration
│   ├── service-worker.js  # Background script
│   ├── popup/            # Popup interface
│   ├── explorer/         # D3.js visualization
│   ├── settings/         # Settings page
│   ├── support/          # Support page
│   └── lib/             # Shared libraries
└── memory-bank/         # Development documentation
```

### Building from Source
No build process required! The extension runs directly from source.

### Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🔐 Privacy Policy

Tab Trail is committed to your privacy:
- **No data collection** - We never collect or transmit your browsing data
- **Local storage only** - All data stays on your device
- **No analytics** - No tracking or telemetry
- **Open source** - Verify our privacy claims in the code

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- D3.js for amazing visualization capabilities
- Chrome Extension community for guidance
- All contributors and users

## ☕ Support

If you find Tab Trail useful, consider:
- ⭐ Starring this repository
- 🐛 Reporting bugs and suggesting features
- ☕ [Buying me a coffee](https://www.buymeacoffee.com/tabtrail)

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/Dkmariolink/tab-trail/issues)
- **GitHub**: [@Dkmariolink](https://github.com/Dkmariolink)
- **Twitter**: [@TheDkmariolink](https://x.com/TheDkmariolink)
- **Email**: Thedkmariolink@gmail.com

---

Made with 💚 by [Dkmariolink](https://github.com/Dkmariolink)
