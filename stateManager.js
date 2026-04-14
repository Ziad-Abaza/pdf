/**
 * StateManager - Global state management for PDF Viewer
 * Provides reactive state with localStorage persistence
 */
class StateManager {
  constructor() {
    this._state = {
      // Document state
      pdfDoc: null,
      fileName: null,
      totalPages: 0,
      
      // Navigation state
      currentPage: 1,
      
      // Zoom state
      zoomLevel: 1.0,
      zoomMode: 'fit-page', // 'fit-page', 'fit-width', 'custom'
      
      // UI state
      theme: 'light',
      sidebarVisible: false,
      searchVisible: false,
      isFullscreen: false,
      
      // Search state
      searchQuery: '',
      searchResults: [],
      currentMatchIndex: -1,
      
      // Bookmarks (page numbers)
      bookmarks: new Set(),
      
      // Performance
      pageCache: new Map(),
      thumbnailCache: new Map(),
      lastRenderedPage: 0,
    };

    this._listeners = new Map();
    this._loadFromStorage();
    this._applyTheme();
  }

  /**
   * Get a state property
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Set a state property and trigger listeners
   */
  set(key, value) {
    const oldValue = this._state[key];
    this._state[key] = value;
    this._notify(key, value, oldValue);
    this._saveToStorage(key);
  }

  /**
   * Get entire state object (read-only)
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Batch update multiple properties
   */
  batchSet(updates) {
    const changes = [];
    for (const [key, value] of Object.entries(updates)) {
      const oldValue = this._state[key];
      this._state[key] = value;
      changes.push({ key, value, oldValue });
    }
    // Notify all changes
    changes.forEach(({ key, value }) => {
      this._notify(key, value, this._state[key]);
    });
    // Save to storage
    Object.keys(updates).forEach(key => this._saveToStorage(key));
  }

  /**
   * Subscribe to state changes
   * @param {string} key - State property to watch
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      this._listeners.get(key).delete(callback);
    };
  }

  /**
   * Notify all listeners for a specific key
   */
  _notify(key, newValue, oldValue) {
    if (this._listeners.has(key)) {
      this._listeners.get(key).forEach(callback => {
        callback(newValue, oldValue);
      });
    }
  }

  /**
   * Persist state to localStorage
   */
  _saveToStorage(key) {
    try {
      const persistableKeys = ['theme', 'currentPage', 'zoomLevel', 'bookmarks'];
      if (!persistableKeys.includes(key)) return;

      let saved = JSON.parse(localStorage.getItem('pdf-viewer-state') || '{}');
      
      if (key === 'bookmarks') {
        saved[key] = Array.from(this._state.bookmarks);
      } else {
        saved[key] = this._state[key];
      }
      
      localStorage.setItem('pdf-viewer-state', JSON.stringify(saved));
    } catch (error) {
      console.warn('Failed to save state to localStorage:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  _loadFromStorage() {
    try {
      const saved = JSON.parse(localStorage.getItem('pdf-viewer-state') || '{}');
      
      if (saved.theme) this._state.theme = saved.theme;
      if (saved.currentPage) this._state.currentPage = saved.currentPage;
      if (saved.zoomLevel) this._state.zoomLevel = saved.zoomLevel;
      if (saved.bookmarks) {
        this._state.bookmarks = new Set(saved.bookmarks);
      }
    } catch (error) {
      console.warn('Failed to load state from localStorage:', error);
    }
  }

  /**
   * Apply theme to document
   */
  _applyTheme() {
    document.documentElement.setAttribute('data-theme', this._state.theme);
  }

  /**
   * Toggle theme
   */
  toggleTheme() {
    const newTheme = this._state.theme === 'light' ? 'dark' : 'light';
    this.set('theme', newTheme);
    this._applyTheme();
    return newTheme;
  }

  /**
   * Reset document-specific state
   */
  resetDocumentState() {
    this.batchSet({
      pdfDoc: null,
      fileName: null,
      totalPages: 0,
      currentPage: 1,
      zoomLevel: 1.0,
      zoomMode: 'fit-page',
      searchQuery: '',
      searchResults: [],
      currentMatchIndex: -1,
      pageCache: new Map(),
      thumbnailCache: new Map(),
      lastRenderedPage: 0,
    });
  }

  /**
   * Toggle bookmark for a page
   */
  toggleBookmark(pageNum) {
    const bookmarks = new Set(this._state.bookmarks);
    if (bookmarks.has(pageNum)) {
      bookmarks.delete(pageNum);
    } else {
      bookmarks.add(pageNum);
    }
    this.set('bookmarks', bookmarks);
  }

  /**
   * Check if page is bookmarked
   */
  isBookmarked(pageNum) {
    return this._state.bookmarks.has(pageNum);
  }

  /**
   * Clear search state
   */
  clearSearch() {
    this.batchSet({
      searchQuery: '',
      searchResults: [],
      currentMatchIndex: -1,
    });
  }
}

// Export singleton instance
const AppState = new StateManager();
