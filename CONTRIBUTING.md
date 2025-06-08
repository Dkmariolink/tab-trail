# Contributing to Tab Trail

Thank you for your interest in contributing to Tab Trail! This Chrome extension aims to revolutionize how users understand and visualize their browsing patterns. We welcome contributions from developers, designers, researchers, and users alike.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Types of Contributions](#types-of-contributions)
- [Development Setup](#development-setup)
- [Contribution Guidelines](#contribution-guidelines)
- [Pull Request Process](#pull-request-process)
- [Chrome Extension Guidelines](#chrome-extension-guidelines)
- [Community and Support](#community-and-support)

## Code of Conduct

Tab Trail is committed to providing a welcoming and inclusive environment for all contributors. We expect:

- **Respectful communication** in all interactions
- **Constructive feedback** that helps improve the project
- **Inclusive language** that welcomes contributors of all backgrounds
- **Focus on the project goals** of improving tab management and visualization

## Getting Started

### Quick Overview
Tab Trail is a Chrome extension that:
- Tracks relationships between browser tabs
- Visualizes browsing patterns with D3.js
- Provides privacy-first local data storage
- Offers multiple export formats for research and documentation

### Repository Structure
```
Tab-Trail-final/
├── extension/              # Chrome extension source code
│   ├── manifest.json      # Extension configuration
│   ├── service-worker.js  # Background logic
│   ├── popup/             # Trail popup interface
│   ├── explorer/          # D3.js visualization
│   ├── settings/          # User preferences
│   ├── lib/               # Shared utilities
│   └── assets/            # Icons and resources
├── README.md              # Project documentation
├── LICENSE                # MIT open source license
└── CONTRIBUTING.md        # This file
```

### Branches
- **`master`**: Stable releases ready for Chrome Web Store
- **`development`**: Active development and new features

## Types of Contributions

### 🐛 Bug Reports
Help us improve Tab Trail by reporting issues:
- Use GitHub Issues with the "bug" label
- Include Chrome version and operating system
- Provide steps to reproduce the issue
- Include screenshots if relevant
- Check existing issues before creating new ones

### 💡 Feature Requests
Suggest new functionality:
- Use GitHub Issues with the "enhancement" label
- Describe the problem your feature would solve
- Explain why it would benefit Tab Trail users
- Consider how it fits with privacy-first principles

### 📝 Documentation
Improve project documentation:
- Fix typos or unclear explanations
- Add examples or tutorials
- Translate documentation to other languages
- Create video tutorials or blog posts

### 🎨 Design Contributions
Enhance user experience:
- UI/UX improvements for popup or explorer
- Icon design and visual assets
- Color scheme and accessibility improvements
- User flow optimization

### 💻 Code Contributions
Implement features and fixes:
- Bug fixes and performance improvements
- New visualization layouts or export formats
- Chrome API integrations
- Accessibility enhancements

## Development Setup

### Prerequisites
- **Chrome Browser** (latest version recommended)
- **Git** for version control
- **Text Editor** (VS Code, Sublime Text, etc.)
- **Basic understanding** of JavaScript, HTML, CSS

### Local Development
1. **Fork and Clone**
   ```bash
   git clone https://github.com/[your-username]/tab-trail.git
   cd tab-trail
   ```

2. **Switch to Development Branch**
   ```bash
   git checkout development
   ```

3. **Load Extension in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/` folder

4. **Test Changes**
   - Make your modifications
   - Refresh the extension in Chrome
   - Test functionality thoroughly

### Project Dependencies
- **D3.js v7**: For interactive visualizations
- **Chrome APIs**: tabs, webNavigation, storage
- **No build process**: Pure HTML/CSS/JavaScript

## Contribution Guidelines

### Code Style
- **JavaScript**: Use ES6+ features, clear variable names
- **HTML**: Semantic markup, accessibility attributes
- **CSS**: BEM methodology preferred, responsive design
- **Comments**: Explain complex logic, not obvious code

### Commit Messages
Follow conventional commit format:
```
type(scope): description

Examples:
feat(explorer): add timeline layout for tab visualization
fix(popup): resolve duplicate entries in browsing trail
docs(readme): update installation instructions
style(ui): improve color contrast for accessibility
```

### Testing Guidelines
- **Manual Testing**: Test in clean Chrome profile
- **Feature Testing**: Verify all functionality works
- **Performance Testing**: Check memory usage with 100+ tabs
- **Privacy Testing**: Confirm no external data transmission

### Privacy Requirements
Tab Trail is privacy-first. All contributions must:
- Store data locally only (no external servers)
- Use minimal required Chrome permissions
- Provide user control over data retention
- Include clear explanations of data usage

## Pull Request Process

### Before Submitting
1. **Create Feature Branch**
   ```bash
   git checkout development
   git pull origin development
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow coding guidelines
   - Test thoroughly
   - Update documentation if needed

3. **Commit and Push**
   ```bash
   git add .
   git commit -m "feat(scope): your descriptive message"
   git push origin feature/your-feature-name
   ```

### Pull Request Template
When creating a PR, include:

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Tested in clean Chrome profile
- [ ] Verified no console errors
- [ ] Checked memory usage impact
- [ ] Tested with 50+ tabs

## Privacy Impact
- [ ] No new external requests
- [ ] User data remains local
- [ ] No new permissions required
- [ ] Privacy policy still accurate

## Screenshots (if applicable)
Add screenshots showing changes.
```

### Review Process
1. **Automated Checks**: Basic validation and formatting
2. **Maintainer Review**: Code quality and project alignment
3. **Testing**: Functionality and performance verification
4. **Merge**: To development branch first, then master for releases

## Chrome Extension Guidelines

### Manifest V3 Compliance
- Use service workers, not background pages
- Follow content security policy restrictions
- Minimize requested permissions
- Use chrome.storage.local for data persistence

### Performance Standards
- **Memory Usage**: <50MB with 100+ tabs
- **Startup Time**: <100ms extension initialization
- **Response Time**: <200ms for popup display
- **Storage Efficiency**: <1MB per 1000 tracked tabs

### User Experience Principles
- **Zero Configuration**: Works automatically after installation
- **Clear Visual Hierarchy**: Intuitive interface design
- **Responsive Design**: Works on different screen sizes
- **Accessibility**: Screen reader compatible, keyboard navigation

## Community and Support

### Getting Help
- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and feature requests
- **Extension Support**: Built-in help within the extension

### Communication Channels
- **Primary**: GitHub Issues and Discussions
- **Updates**: Watch repository for notifications
- **Releases**: Follow GitHub releases for new versions

### Recognition
Contributors will be:
- Listed in release notes for their contributions
- Credited in the extension's about section
- Invited to participate in future project decisions

## Development Roadmap

### Current Focus (v1.x)
- Performance optimization and bug fixes
- Additional export formats
- Accessibility improvements
- User experience enhancements

### Future Considerations (v2.x+)
- Advanced analytics and insights
- Cross-browser compatibility
- Team collaboration features
- API for integration with other tools

## Questions?

If you have questions about contributing:
1. Check existing GitHub Issues and Discussions
2. Create a new Discussion for general questions
3. Create an Issue for specific bugs or feature requests

**Thank you for helping make Tab Trail better!** Every contribution, no matter how small, helps improve the browsing experience for users worldwide.

---

*Tab Trail is an open source project licensed under MIT. By contributing, you agree that your contributions will be licensed under the same license.*