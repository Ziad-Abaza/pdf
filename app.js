/**
 * App - Main application controller for PDF Viewer
 * Wires together UI, state, and PDF viewer logic
 */
class App {
  constructor() {
    this.pdfViewer = new PDFViewer();
    this.searchDebounceTimer = null;
    
    // Cache DOM elements
    this.elements = {
      // Views
      emptyState: document.getElementById('empty-state'),
      loadingState: document.getElementById('loading-state'),
      pdfViewer: document.getElementById('pdf-viewer'),
      
      // Toolbar
      fileName: document.getElementById('file-name'),
      btnPrevPage: document.getElementById('btn-prev-page'),
      btnNextPage: document.getElementById('btn-next-page'),
      pageInput: document.getElementById('page-input'),
      pageTotal: document.getElementById('page-total'),
      btnZoomIn: document.getElementById('btn-zoom-in'),
      btnZoomOut: document.getElementById('btn-zoom-out'),
      zoomSelect: document.getElementById('zoom-select'),
      btnSearch: document.getElementById('btn-search'),
      btnBookmark: document.getElementById('btn-bookmark'),
      btnFullscreen: document.getElementById('btn-fullscreen'),
      btnTheme: document.getElementById('btn-theme'),
      btnSidebar: document.getElementById('btn-sidebar'),
      
      // Search
      searchBar: document.getElementById('search-bar'),
      searchInput: document.getElementById('search-input'),
      searchResults: document.getElementById('search-results'),
      searchCount: document.getElementById('search-count'),
      btnPrevMatch: document.getElementById('btn-prev-match'),
      btnNextMatch: document.getElementById('btn-next-match'),
      btnCloseSearch: document.getElementById('btn-close-search'),
      
      // Sidebar
      sidebar: document.getElementById('sidebar'),
      
      // File input
      btnOpenFile: document.getElementById('btn-open-file'),
      fileInput: document.getElementById('file-input'),
      hiddenFileInput: document.getElementById('hidden-file-input'),
      
      // Viewer
      pdfScrollContainer: document.getElementById('pdf-scroll-container'),
    };
    
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    this.bindEvents();
    this.subscribeToState();
    this.restoreLastPosition();
    
    // Load default PDF file if available
    await this.loadDefaultPdf();
    
    console.log('PDF Viewer initialized');
  }

  /**
   * Load the default PDF file (data.pdf)
   */
  async loadDefaultPdf() {
    try {
      const response = await fetch('data.pdf');
      if (!response.ok) {
        console.log('No default PDF found, showing empty state');
        return;
      }
      
      const blob = await response.blob();
      if (blob.type === 'application/pdf' || blob.size > 0) {
        const file = new File([blob], 'data.pdf', { type: 'application/pdf' });
        await this.loadFile(file);
        console.log('Default PDF loaded successfully');
      }
    } catch (error) {
      console.log('Failed to load default PDF:', error);
    }
  }

  /**
   * Bind all event listeners
   */
  bindEvents() {
    // File operations
    this.elements.btnOpenFile.addEventListener('click', () => this.openFile());
    this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    this.elements.hiddenFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    
    // Drag and drop
    this.setupDragAndDrop();
    
    // Navigation
    this.elements.btnPrevPage.addEventListener('click', () => this.pdfViewer.prevPage());
    this.elements.btnNextPage.addEventListener('click', () => this.pdfViewer.nextPage());
    this.elements.pageInput.addEventListener('change', (e) => this.handlePageInputChange(e));
    this.elements.pageInput.addEventListener('keydown', (e) => this.handlePageInputKeydown(e));
    
    // Zoom
    this.elements.btnZoomIn.addEventListener('click', () => this.handleZoomIn());
    this.elements.btnZoomOut.addEventListener('click', () => this.handleZoomOut());
    this.elements.zoomSelect.addEventListener('change', (e) => this.handleZoomChange(e));
    
    // Search
    this.elements.btnSearch.addEventListener('click', () => this.toggleSearch());
    this.elements.btnCloseSearch.addEventListener('click', () => this.toggleSearch());
    this.elements.searchInput.addEventListener('input', (e) => this.handleSearchInput(e));
    this.elements.btnPrevMatch.addEventListener('click', () => this.pdfViewer.prevMatch());
    this.elements.btnNextMatch.addEventListener('click', () => this.pdfViewer.nextMatch());
    
    // UI toggles
    this.elements.btnTheme.addEventListener('click', () => this.toggleTheme());
    this.elements.btnSidebar.addEventListener('click', () => this.toggleSidebar());
    this.elements.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    this.elements.btnBookmark.addEventListener('click', () => this.toggleBookmark());
    
    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Subscribe to state changes
   */
  subscribeToState() {
    // Update UI when state changes
    AppState.subscribe('currentPage', (currentPage) => {
      this.updateNavigationButtons();
      this.updateBookmarkButton();
    });
    
    AppState.subscribe('totalPages', (totalPages) => {
      this.elements.pageInput.max = totalPages;
      this.elements.pageInput.disabled = totalPages === 0;
      this.elements.btnPrevPage.disabled = totalPages === 0;
      this.elements.btnNextPage.disabled = totalPages === 0;
      this.updateNavigationButtons();
    });
    
    AppState.subscribe('fileName', (fileName) => {
      this.elements.fileName.textContent = fileName || 'No file loaded';
    });
    
    AppState.subscribe('zoomLevel', () => {
      this.updateZoomButtons();
    });
    
    AppState.subscribe('searchResults', (results) => {
      this.updateSearchResults(results);
    });
    
    AppState.subscribe('currentMatchIndex', (index) => {
      this.updateSearchMatchIndex(index);
    });
    
    AppState.subscribe('theme', (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
    });
    
    AppState.subscribe('sidebarVisible', (visible) => {
      this.elements.sidebar.classList.toggle('hidden', !visible);
    });
    
    AppState.subscribe('searchVisible', (visible) => {
      this.elements.searchBar.classList.toggle('hidden', !visible);
    });
  }

  /**
   * Setup drag and drop
   */
  setupDragAndDrop() {
    const body = document.body;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      body.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    
    body.addEventListener('dragover', () => {
      this.showDropOverlay();
    });
    
    body.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null || e.relatedTarget === body) {
        this.hideDropOverlay();
      }
    });
    
    body.addEventListener('drop', (e) => {
      this.hideDropOverlay();
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === 'application/pdf') {
        this.loadFile(files[0]);
      } else {
        this.showToast('Please drop a valid PDF file', 'error');
      }
    });
  }

  /**
   * Show drop overlay
   */
  showDropOverlay() {
    const overlay = document.getElementById('drop-overlay');
    if (overlay) {
      overlay.classList.add('active');
    }
  }

  /**
   * Hide drop overlay
   */
  hideDropOverlay() {
    const overlay = document.getElementById('drop-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  /**
   * Open file dialog
   */
  openFile() {
    this.elements.hiddenFileInput.click();
  }

  /**
   * Handle file selection
   */
  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      await this.loadFile(file);
    } else {
      this.showToast('Please select a valid PDF file', 'error');
    }
  }

  /**
   * Load and display a PDF file
   */
  async loadFile(file) {
    try {
      // Show loading state
      this.showLoadingState();

      // Reset state
      AppState.resetDocumentState();
      this.pdfViewer.destroy();

      // Load document
      await this.pdfViewer.loadFromFile(file);

      // Show viewer and sidebar
      this.showViewerState();
      
      // Auto-show sidebar for better UX
      AppState.set('sidebarVisible', true);

      // Update zoom controls
      this.elements.btnZoomIn.disabled = false;
      this.elements.btnZoomOut.disabled = false;
      this.elements.zoomSelect.disabled = false;
      this.elements.btnBookmark.disabled = false;

      this.showToast(`Loaded: ${file.name}`, 'success');

    } catch (error) {
      console.error('Failed to load PDF:', error);
      this.showEmptyState();
      this.showToast('Failed to load PDF file', 'error');
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    this.elements.emptyState.classList.add('hidden');
    this.elements.loadingState.classList.remove('hidden');
    this.elements.pdfViewer.classList.add('hidden');
  }

  /**
   * Show viewer state
   */
  showViewerState() {
    this.elements.emptyState.classList.add('hidden');
    this.elements.loadingState.classList.add('hidden');
    this.elements.pdfViewer.classList.remove('hidden');
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    this.elements.emptyState.classList.remove('hidden');
    this.elements.loadingState.classList.add('hidden');
    this.elements.pdfViewer.classList.add('hidden');
  }

  /**
   * Handle page input change
   */
  handlePageInputChange(event) {
    const pageNum = parseInt(event.target.value);
    const totalPages = AppState.get('totalPages');
    
    if (pageNum >= 1 && pageNum <= totalPages) {
      this.pdfViewer.goToPage(pageNum);
    } else {
      // Reset to current page
      event.target.value = AppState.get('currentPage');
    }
  }

  /**
   * Handle page input keydown (Enter to navigate)
   */
  handlePageInputKeydown(event) {
    if (event.key === 'Enter') {
      this.handlePageInputChange(event);
    }
  }

  /**
   * Update navigation buttons state
   */
  updateNavigationButtons() {
    const currentPage = AppState.get('currentPage');
    const totalPages = AppState.get('totalPages');
    
    this.elements.btnPrevPage.disabled = currentPage <= 1 || totalPages === 0;
    this.elements.btnNextPage.disabled = currentPage >= totalPages || totalPages === 0;
  }

  /**
   * Handle zoom in
   */
  async handleZoomIn() {
    await this.pdfViewer.zoomIn();
    this.elements.zoomSelect.value = 'custom';
  }

  /**
   * Handle zoom out
   */
  async handleZoomOut() {
    await this.pdfViewer.zoomOut();
    this.elements.zoomSelect.value = 'custom';
  }

  /**
   * Handle zoom select change
   */
  async handleZoomChange(event) {
    const value = event.target.value;
    await this.pdfViewer.setZoom(value);
  }

  /**
   * Update zoom buttons state
   */
  updateZoomButtons() {
    const zoomLevel = AppState.get('zoomLevel');
    
    // Disable zoom out if at minimum
    this.elements.btnZoomOut.disabled = zoomLevel <= 0.25;
    
    // Disable zoom in if at maximum
    this.elements.btnZoomIn.disabled = zoomLevel >= 3.0;
    
    // Update select dropdown
    const zoomPercentage = Math.round(zoomLevel * 100);
    const options = this.elements.zoomSelect.options;
    
    for (let option of options) {
      if (option.value !== 'fit-width' && option.value !== 'fit-page') {
        const optionValue = Math.round(parseFloat(option.value) * 100);
        if (optionValue === zoomPercentage) {
          this.elements.zoomSelect.value = option.value;
          return;
        }
      }
    }
    
    this.elements.zoomSelect.value = 'custom';
  }

  /**
   * Toggle search bar
   */
  toggleSearch() {
    const isVisible = AppState.get('searchVisible');
    AppState.set('searchVisible', !isVisible);
    
    if (!isVisible) {
      // Focus search input when showing
      setTimeout(() => this.elements.searchInput.focus(), 100);
    } else {
      // Clear search when hiding
      this.elements.searchInput.value = '';
      AppState.clearSearch();
    }
  }

  /**
   * Handle search input (with debounce)
   */
  handleSearchInput(event) {
    // Clear previous timer
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    
    const query = event.target.value.trim();
    
    // Debounce search
    this.searchDebounceTimer = setTimeout(async () => {
      if (query.length > 0) {
        const results = await this.pdfViewer.searchInPDF(query);
        if (results.length === 0) {
          this.showToast('No results found', 'info');
        } else if (results.length > 0) {
          // Navigate to first match
          await this.pdfViewer.goToPage(results[0].page);
        }
      } else {
        AppState.clearSearch();
      }
    }, 300);
  }

  /**
   * Update search results display
   */
  updateSearchResults(results) {
    const count = results.length;
    const currentIndex = AppState.get('currentMatchIndex');
    
    this.elements.searchCount.textContent = count > 0 ? `${currentIndex + 1}/${count}` : '0/0';
    this.elements.btnPrevMatch.disabled = count === 0;
    this.elements.btnNextMatch.disabled = count === 0;
  }

  /**
   * Update search match index display
   */
  updateSearchMatchIndex(index) {
    const results = AppState.get('searchResults');
    this.elements.searchCount.textContent = results.length > 0 ? `${index + 1}/${results.length}` : '0/0';
  }

  /**
   * Toggle theme
   */
  toggleTheme() {
    const newTheme = AppState.toggleTheme();
    this.showToast(`Switched to ${newTheme} mode`, 'info');
  }

  /**
   * Toggle sidebar
   */
  toggleSidebar() {
    const isVisible = AppState.get('sidebarVisible');
    AppState.set('sidebarVisible', !isVisible);
  }

  /**
   * Toggle fullscreen
   */
  toggleFullscreen() {
    const elem = document.documentElement;
    
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
        this.showToast('Fullscreen not supported', 'error');
      });
    } else {
      document.exitFullscreen();
    }
  }

  /**
   * Toggle bookmark for current page
   */
  toggleBookmark() {
    const currentPage = AppState.get('currentPage');
    AppState.toggleBookmark(currentPage);
    
    const isBookmarked = AppState.isBookmarked(currentPage);
    this.showToast(
      isBookmarked ? `Page ${currentPage} bookmarked` : `Bookmark removed`,
      'info'
    );
  }

  /**
   * Update bookmark button appearance
   */
  updateBookmarkButton() {
    const currentPage = AppState.get('currentPage');
    const isBookmarked = AppState.isBookmarked(currentPage);
    
    const btnBookmark = this.elements.btnBookmark;
    const svgIcon = btnBookmark.querySelector('svg');
    
    if (isBookmarked) {
      svgIcon.setAttribute('fill', 'currentColor');
    } else {
      svgIcon.setAttribute('fill', 'none');
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't handle shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.target.blur();
          if (AppState.get('searchVisible')) {
            this.toggleSearch();
          }
        }
        return;
      }
      
      // Ctrl/Cmd + F: Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (!AppState.get('searchVisible')) {
          this.toggleSearch();
        } else {
          this.elements.searchInput.focus();
        }
      }
      
      // Arrow keys: Navigation
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.pdfViewer.prevPage();
      }
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.pdfViewer.nextPage();
      }
      
      // Ctrl/Cmd + Plus: Zoom in
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        this.handleZoomIn();
      }
      
      // Ctrl/Cmd + Minus: Zoom out
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        this.handleZoomOut();
      }
      
      // Ctrl/Cmd + 0: Reset zoom
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        this.pdfViewer.setZoom('fit-page');
        this.elements.zoomSelect.value = 'fit-page';
      }
      
      // Escape: Close search
      if (e.key === 'Escape' && AppState.get('searchVisible')) {
        this.toggleSearch();
      }
      
      // F11: Fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });
  }

  /**
   * Restore last position from localStorage
   */
  restoreLastPosition() {
    const savedPage = AppState.get('currentPage');
    if (savedPage > 1) {
      // Will be applied when document is loaded
      console.log(`Will restore to page ${savedPage} when document loads`);
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 200);
    }, duration);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
