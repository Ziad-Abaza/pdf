/**
 * PDFViewer - Core PDF rendering engine using PDF.js
 * Handles document loading, rendering, caching, and search
 */
class PDFViewer {
  constructor() {
    this.canvas = document.getElementById('pdf-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container = document.getElementById('pdf-scroll-container');
    
    // Configure PDF.js worker (local copy)
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    
    // Cache for rendered pages
    this.pageCache = new Map();
    this.thumbnailCache = new Map();
    
    // Current render task (for cancellation)
    this.currentRenderTask = null;
    
    // Search text items
    this.textContent = new Map();
    
    // Bind methods
    this._handleScroll = this._handleScroll.bind(this);
  }

  /**
   * Load a PDF document from File object
   */
  async loadFromFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      
      AppState.batchSet({
        pdfDoc,
        fileName: file.name,
        totalPages: pdfDoc.numPages,
      });
      
      // Preload text content for search
      await this._preloadTextContent();
      
      // Render initial page
      await this.renderPage(AppState.get('currentPage'));
      
      // Generate thumbnails
      this.generateThumbnails();
      
      return pdfDoc;
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw new Error('Failed to load PDF document');
    }
  }

  /**
   * Load a PDF document from URL
   */
  async loadFromUrl(url) {
    try {
      const loadingTask = pdfjsLib.getDocument(url);
      const pdfDoc = await loadingTask.promise;
      
      AppState.batchSet({
        pdfDoc,
        fileName: this._extractFileName(url),
        totalPages: pdfDoc.numPages,
      });
      
      await this._preloadTextContent();
      await this.renderPage(AppState.get('currentPage'));
      this.generateThumbnails();
      
      return pdfDoc;
    } catch (error) {
      console.error('Error loading PDF from URL:', error);
      throw new Error('Failed to load PDF from URL');
    }
  }

  /**
   * Render a specific page
   */
  async renderPage(pageNum) {
    const pdfDoc = AppState.get('pdfDoc');
    if (!pdfDoc) return;
    
    // Validate page number
    if (pageNum < 1 || pageNum > AppState.get('totalPages')) {
      console.warn(`Invalid page number: ${pageNum}`);
      return;
    }
    
    // Cancel previous render if in progress
    if (this.currentRenderTask) {
      this.currentRenderTask.cancel();
    }
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const zoom = AppState.get('zoomLevel');
      
      // Calculate viewport
      const viewport = page.getViewport({ scale: zoom * 1.5 }); // 1.5x for better quality
      
      // Set canvas dimensions
      this.canvas.width = viewport.width;
      this.canvas.height = viewport.height;
      
      // Render PDF page
      const renderContext = {
        canvasContext: this.ctx,
        viewport: viewport,
      };
      
      this.currentRenderTask = page.render(renderContext);
      await this.currentRenderTask.promise;
      
      // Update state
      AppState.set('currentPage', pageNum);
      AppState.set('lastRenderedPage', pageNum);
      
      // Cache the page
      this.pageCache.set(pageNum, { page, viewport });
      
      // Update UI
      this._updatePageIndicator();
      this._updateActiveThumbnail();
      
      // Clear render task
      this.currentRenderTask = null;
      
    } catch (error) {
      if (error.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', error);
      }
    }
  }

  /**
   * Navigate to next page
   */
  async nextPage() {
    const currentPage = AppState.get('currentPage');
    const totalPages = AppState.get('totalPages');
    
    if (currentPage < totalPages) {
      await this.renderPage(currentPage + 1);
      this._scrollToTop();
    }
  }

  /**
   * Navigate to previous page
   */
  async prevPage() {
    const currentPage = AppState.get('currentPage');
    
    if (currentPage > 1) {
      await this.renderPage(currentPage - 1);
      this._scrollToTop();
    }
  }

  /**
   * Jump to a specific page
   */
  async goToPage(pageNum) {
    const totalPages = AppState.get('totalPages');
    
    if (pageNum >= 1 && pageNum <= totalPages) {
      await this.renderPage(pageNum);
      this._scrollToTop();
    }
  }

  /**
   * Zoom in
   */
  async zoomIn() {
    const currentZoom = AppState.get('zoomLevel');
    const newZoom = Math.min(currentZoom + 0.25, 3.0);
    
    AppState.set('zoomLevel', newZoom);
    await this.renderPage(AppState.get('currentPage'));
  }

  /**
   * Zoom out
   */
  async zoomOut() {
    const currentZoom = AppState.get('zoomLevel');
    const newZoom = Math.max(currentZoom - 0.25, 0.25);
    
    AppState.set('zoomLevel', newZoom);
    await this.renderPage(AppState.get('currentPage'));
  }

  /**
   * Set zoom to specific level
   */
  async setZoom(zoomLevel) {
    if (zoomLevel === 'fit-width') {
      await this.fitToWidth();
      AppState.set('zoomMode', 'fit-width');
      return;
    }
    
    if (zoomLevel === 'fit-page') {
      await this.fitToPage();
      AppState.set('zoomMode', 'fit-page');
      return;
    }
    
    AppState.set('zoomLevel', parseFloat(zoomLevel));
    AppState.set('zoomMode', 'custom');
    await this.renderPage(AppState.get('currentPage'));
  }

  /**
   * Fit PDF to container width
   */
  async fitToWidth() {
    const pdfDoc = AppState.get('pdfDoc');
    if (!pdfDoc) return;
    
    const page = await pdfDoc.getPage(AppState.get('currentPage'));
    const viewport = page.getViewport({ scale: 1 });
    
    const containerWidth = this.container.clientWidth - 48; // Account for padding
    const scale = containerWidth / viewport.width;
    
    AppState.set('zoomLevel', scale);
    await this.renderPage(AppState.get('currentPage'));
  }

  /**
   * Fit PDF to page (default scale)
   */
  async fitToPage() {
    AppState.set('zoomLevel', 1.0);
    AppState.set('zoomMode', 'fit-page');
    await this.renderPage(AppState.get('currentPage'));
  }

  /**
   * Generate thumbnails for all pages
   */
  async generateThumbnails() {
    const pdfDoc = AppState.get('pdfDoc');
    if (!pdfDoc) {
      console.warn('No PDF doc available for thumbnails');
      return;
    }

    const totalPages = AppState.get('totalPages');
    const sidebarContent = document.getElementById('sidebar-content');
    
    if (!sidebarContent) {
      console.error('Sidebar content element not found');
      return;
    }
    
    sidebarContent.innerHTML = '';
    console.log(`Generating thumbnails for ${totalPages} pages`);

    // Generate thumbnails in batches for performance
    const batchSize = 5;
    for (let i = 0; i < totalPages; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, totalPages);

      const promises = [];
      for (let pageNum = i + 1; pageNum <= batchEnd; pageNum++) {
        promises.push(this._generateThumbnail(pageNum));
      }

      const thumbnails = await Promise.all(promises);
      thumbnails.forEach(({ pageNum, canvas }) => {
        if (canvas) {
          console.log(`Adding thumbnail for page ${pageNum}`);
          this._addThumbnailToSidebar(pageNum, canvas);
        } else {
          console.warn(`Failed to generate thumbnail for page ${pageNum}`);
        }
      });
    }
    
    console.log('Thumbnail generation complete');
  }

  /**
   * Generate thumbnail for a specific page
   */
  async _generateThumbnail(pageNum) {
    const pdfDoc = AppState.get('pdfDoc');
    if (!pdfDoc) return { pageNum, canvas: null };
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const thumbnailWidth = 150;
      const viewport = page.getViewport({ scale: 1 });
      const scale = thumbnailWidth / viewport.width;
      const thumbnailViewport = page.getViewport({ scale });
      
      // Create offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = thumbnailViewport.width;
      canvas.height = thumbnailViewport.height;
      const ctx = canvas.getContext('2d');
      
      await page.render({
        canvasContext: ctx,
        viewport: thumbnailViewport,
      }).promise;
      
      this.thumbnailCache.set(pageNum, canvas);
      
      return { pageNum, canvas };
    } catch (error) {
      console.warn(`Failed to generate thumbnail for page ${pageNum}:`, error);
      return { pageNum, canvas: null };
    }
  }

  /**
   * Add thumbnail element to sidebar
   */
  _addThumbnailToSidebar(pageNum, canvas) {
    const sidebarContent = document.getElementById('sidebar-content');
    console.log(`Sidebar content element:`, sidebarContent);

    const thumbnailItem = document.createElement('div');
    thumbnailItem.className = 'thumbnail-item';
    thumbnailItem.dataset.pageNum = pageNum;

    // Clone canvas and copy the rendered content
    const displayCanvas = document.createElement('canvas');
    displayCanvas.className = 'thumbnail-canvas';
    displayCanvas.width = canvas.width;
    displayCanvas.height = canvas.height;
    
    // Copy the image data from the source canvas
    const sourceCtx = canvas.getContext('2d');
    const destCtx = displayCanvas.getContext('2d');
    destCtx.drawImage(sourceCtx.canvas, 0, 0);
    
    console.log(`Thumbnail ${pageNum} canvas size: ${canvas.width}x${canvas.height}`);

    const label = document.createElement('div');
    label.className = 'thumbnail-label';
    label.textContent = `Page ${pageNum}`;

    thumbnailItem.appendChild(displayCanvas);
    thumbnailItem.appendChild(label);

    // Click to navigate
    thumbnailItem.addEventListener('click', () => {
      this.goToPage(pageNum);
    });

    sidebarContent.appendChild(thumbnailItem);
    console.log(`Thumbnail appended. Total thumbnails in sidebar:`, sidebarContent.children.length);

    // Mark active page
    if (pageNum === AppState.get('currentPage')) {
      thumbnailItem.classList.add('active');
    }
  }

  /**
   * Update active thumbnail highlight
   */
  _updateActiveThumbnail() {
    const currentPage = AppState.get('currentPage');
    const thumbnails = document.querySelectorAll('.thumbnail-item');
    
    thumbnails.forEach(thumb => {
      const pageNum = parseInt(thumb.dataset.pageNum);
      if (pageNum === currentPage) {
        thumb.classList.add('active');
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        thumb.classList.remove('active');
      }
    });
  }

  /**
   * Search text in PDF
   */
  async searchInPDF(query) {
    if (!query || query.trim().length === 0) {
      AppState.clearSearch();
      return [];
    }
    
    const pdfDoc = AppState.get('pdfDoc');
    if (!pdfDoc) return [];
    
    const results = [];
    const totalPages = AppState.get('totalPages');
    const lowerQuery = query.toLowerCase();
    
    // Search through all pages
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageText = await this._getPageText(pageNum);
      const lowerPageText = pageText.toLowerCase();
      
      let startIndex = 0;
      while ((startIndex = lowerPageText.indexOf(lowerQuery, startIndex)) !== -1) {
        results.push({
          page: pageNum,
          text: pageText.substring(startIndex, startIndex + query.length),
          index: startIndex,
        });
        startIndex += query.length;
      }
    }
    
    AppState.batchSet({
      searchQuery: query,
      searchResults: results,
      currentMatchIndex: results.length > 0 ? 0 : -1,
    });
    
    return results;
  }

  /**
   * Navigate to next search match
   */
  async nextMatch() {
    const results = AppState.get('searchResults');
    let currentIndex = AppState.get('currentMatchIndex');
    
    if (results.length === 0) return;
    
    currentIndex = (currentIndex + 1) % results.length;
    AppState.set('currentMatchIndex', currentIndex);
    
    const match = results[currentIndex];
    await this.goToPage(match.page);
  }

  /**
   * Navigate to previous search match
   */
  async prevMatch() {
    const results = AppState.get('searchResults');
    let currentIndex = AppState.get('currentMatchIndex');
    
    if (results.length === 0) return;
    
    currentIndex = (currentIndex - 1 + results.length) % results.length;
    AppState.set('currentMatchIndex', currentIndex);
    
    const match = results[currentIndex];
    await this.goToPage(match.page);
  }

  /**
   * Preload text content for all pages
   */
  async _preloadTextContent() {
    const pdfDoc = AppState.get('pdfDoc');
    if (!pdfDoc) return;
    
    const totalPages = AppState.get('totalPages');
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ');
        this.textContent.set(pageNum, text);
      } catch (error) {
        console.warn(`Failed to extract text from page ${pageNum}:`, error);
        this.textContent.set(pageNum, '');
      }
    }
  }

  /**
   * Get text content for a page
   */
  async _getPageText(pageNum) {
    if (this.textContent.has(pageNum)) {
      return this.textContent.get(pageNum);
    }
    
    const pdfDoc = AppState.get('pdfDoc');
    if (!pdfDoc) return '';
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str).join(' ');
      this.textContent.set(pageNum, text);
      return text;
    } catch (error) {
      return '';
    }
  }

  /**
   * Handle scroll events for lazy loading
   */
  _handleScroll() {
    // Implement lazy loading if needed
    // For now, we render single pages on demand
  }

  /**
   * Update page indicator in UI
   */
  _updatePageIndicator() {
    const currentPage = AppState.get('currentPage');
    const totalPages = AppState.get('totalPages');
    
    const pageInput = document.getElementById('page-input');
    const pageTotal = document.getElementById('page-total');
    
    if (pageInput) pageInput.value = currentPage;
    if (pageTotal) pageTotal.textContent = totalPages;
  }

  /**
   * Scroll to top of container
   */
  _scrollToTop() {
    if (this.container) {
      this.container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /**
   * Extract file name from URL
   */
  _extractFileName(url) {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'document.pdf';
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.currentRenderTask) {
      this.currentRenderTask.cancel();
    }
    
    this.pageCache.clear();
    this.thumbnailCache.clear();
    this.textContent.clear();
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

// Export class
window.PDFViewer = PDFViewer;
