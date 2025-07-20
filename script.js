class VideoPlayer {
    constructor() {
        this.currentSlide = 0;
        // Generate slides dynamically from GitHub repository
        this.slides = this.generateSlidesList();
        
        this.isPlaying = false;
        this.isFullscreen = false;
        this.isMuted = false; // Изменил на false, чтобы звук был включен
        this.volume = 0.5;
        this.controlsVisible = true;
        this.controlsTimeout = null;
        
        // Touch handling
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchThreshold = 50;
        this.isTouch = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadSlide(this.currentSlide);
        this.generateChapters();
        this.updateNavigationButtons();
        this.hideControlsAfterDelay();
    }

    generateSlidesList() {
        const baseUrl = "https://raw.githubusercontent.com/vampuca/vampuca_player/main/";
        const slides = [];
        
        // Title slide (только стрелка вперед)
        slides.push({
            title: "Title",
            videoUrl: baseUrl + "KLKT_TITLE.m4v",
            chapter: 1,
            type: "title"
        });
        
        // Main content slides (обычная навигация)
        for (let i = 1; i <= 20; i++) {
            slides.push({
                title: `KLKT ${i}`,
                videoUrl: baseUrl + `KLKT_${i}.m4v`,
                chapter: Math.ceil(i / 5), // Группируем по 5 слайдов в главу
                type: "content"
            });
        }
        
        // End slide (только play и назад)
        slides.push({
            title: "End",
            videoUrl: baseUrl + "KLKT_END.m4v",
            chapter: 5,
            type: "end"
        });
        
        console.log('Generated slides:', slides);
        return slides;
    }

    initializeElements() {
        this.playerContainer = document.getElementById('playerContainer');
        this.mainVideo = document.getElementById('mainVideo');
        this.playButton = document.getElementById('playButton');
        this.playIcon = document.getElementById('playIcon');
        this.prevButton = document.getElementById('prevButton');
        this.nextButton = document.getElementById('nextButton');
        this.volumeButton = document.getElementById('volumeButton');
        this.volumeIcon = document.getElementById('volumeIcon');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.fullscreenButton = document.getElementById('fullscreenButton');
        this.fullscreenIcon = document.getElementById('fullscreenIcon');
        this.slideCounter = document.getElementById('slideCounter');
        this.controlsContainer = document.getElementById('controlsContainer');
        this.loadingState = document.getElementById('loadingState');
        this.dropdownButton = document.getElementById('dropdownButton');
        this.dropdownMenu = document.getElementById('dropdownMenu');
        this.chapterList = document.getElementById('chapterList');
        this.touchOverlay = document.getElementById('touchOverlay');
        this.videoContainer = document.getElementById('videoContainer');
    }

    setupEventListeners() {
        // Video events
        this.mainVideo.addEventListener('loadstart', () => this.showLoading());
        this.mainVideo.addEventListener('loadeddata', () => this.hideLoading());
        this.mainVideo.addEventListener('canplay', () => this.hideLoading());
        this.mainVideo.addEventListener('waiting', () => this.showLoading());
        this.mainVideo.addEventListener('playing', () => this.hideLoading());
        this.mainVideo.addEventListener('ended', () => this.nextSlide());
        
        // Prevent any native video controls
        this.mainVideo.addEventListener('contextmenu', (e) => e.preventDefault());
        this.mainVideo.addEventListener('click', (e) => e.preventDefault());
        this.mainVideo.addEventListener('dblclick', (e) => e.preventDefault());
        
        // Control buttons
        this.playButton.addEventListener('click', () => this.togglePlay());
        this.prevButton.addEventListener('click', () => this.prevSlide());
        this.nextButton.addEventListener('click', () => this.nextSlide());
        this.volumeButton.addEventListener('click', () => this.toggleMute());
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
        this.fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
        
        // Dropdown
        this.dropdownButton.addEventListener('click', () => this.toggleDropdown());
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
        
        // Touch events for swipe navigation
        this.setupTouchEvents();
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Fullscreen events
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
        
        // Mouse movement for controls
        this.playerContainer.addEventListener('mousemove', () => this.showControlsTemporarily());
        this.playerContainer.addEventListener('mouseleave', () => this.hideControlsAfterDelay());
        
        // Video container click for play/pause
        this.videoContainer.addEventListener('click', () => this.togglePlay());
        
        // Prevent video from receiving any pointer events
        this.mainVideo.style.pointerEvents = 'none';
    }

    setupTouchEvents() {
        // Touch events on the touch overlay
        this.touchOverlay.addEventListener('touchstart', (e) => {
            this.handleTouchStart(e);
        }, { passive: false });
        
        this.touchOverlay.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling
        }, { passive: false });
        
        this.touchOverlay.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        }, { passive: false });
        
        // Also handle touch on video container
        this.videoContainer.addEventListener('touchstart', (e) => {
            this.handleTouchStart(e);
        }, { passive: false });
        
        this.videoContainer.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        }, { passive: false });
        
        // Prevent default touch behaviors
        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('.player-container') && !e.target.closest('.controls-container')) {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('.player-container') && !e.target.closest('.controls-container')) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    handleTouchStart(e) {
        if (e.target.closest('.controls-container')) return;
        
        this.isTouch = true;
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        
        // Show controls on touch
        this.showControlsTemporarily();
        
        e.preventDefault();
    }

    handleTouchEnd(e) {
        if (!this.isTouch || e.target.closest('.controls-container')) return;
        
        const touch = e.changedTouches[0];
        const touchEndX = touch.clientX;
        const touchEndY = touch.clientY;
        
        const deltaX = touchEndX - this.touchStartX;
        const deltaY = touchEndY - this.touchStartY;
        
        // Check if it's a swipe (horizontal movement > vertical movement)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.touchThreshold) {
            if (deltaX > 0) {
                // Swipe right - previous slide
                this.prevSlide();
            } else {
                // Swipe left - next slide
                this.nextSlide();
            }
        } else if (Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) {
            // Tap - toggle play/pause
            this.togglePlay();
        }
        
        this.isTouch = false;
        e.preventDefault();
    }

    handleKeyboard(e) {
        switch(e.key) {
            case ' ':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.prevSlide();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextSlide();
                break;
            case 'm':
            case 'M':
                this.toggleMute();
                break;
            case 'f':
            case 'F':
                this.toggleFullscreen();
                break;
            case 'Escape':
                if (this.isFullscreen) {
                    this.exitFullscreen();
                }
                break;
        }
    }

    showControlsTemporarily() {
        this.controlsContainer.classList.remove('hidden');
        this.controlsVisible = true;
        
        clearTimeout(this.controlsTimeout);
        this.hideControlsAfterDelay();
    }

    hideControlsAfterDelay() {
        clearTimeout(this.controlsTimeout);
        this.controlsTimeout = setTimeout(() => {
            if (!this.playerContainer.matches(':hover') && !this.isTouch) {
                this.controlsContainer.classList.add('hidden');
                this.controlsVisible = false;
            }
        }, 3000);
    }

    async loadSlide(index) {
        if (index < 0 || index >= this.slides.length) return;
        
        this.showLoading();
        this.currentSlide = index;
        
        try {
            // Update video source and sources
            const videoUrl = this.slides[index].videoUrl;
            this.mainVideo.src = videoUrl;
            
            // Update source elements for better compatibility
            const sources = this.mainVideo.querySelectorAll('source');
            sources.forEach(source => {
                source.src = videoUrl;
            });
            
            // Force video attributes
            this.mainVideo.muted = this.isMuted;
            this.mainVideo.volume = this.volume;
            this.mainVideo.controls = false;
            this.mainVideo.setAttribute('playsinline', '');
            this.mainVideo.setAttribute('webkit-playsinline', '');
            this.mainVideo.setAttribute('x5-playsinline', '');
            
            // Wait for video to load
            await new Promise((resolve, reject) => {
                const handleLoad = () => {
                    this.mainVideo.removeEventListener('loadeddata', handleLoad);
                    this.mainVideo.removeEventListener('error', handleError);
                    resolve();
                };
                
                const handleError = () => {
                    this.mainVideo.removeEventListener('loadeddata', handleLoad);
                    this.mainVideo.removeEventListener('error', handleError);
                    reject();
                };
                
                this.mainVideo.addEventListener('loadeddata', handleLoad);
                this.mainVideo.addEventListener('error', handleError);
                
                this.mainVideo.load();
            });
            
            this.updateSlideCounter();
            this.updateChapterActive();
            this.updateNavigationButtons();
            this.hideLoading();
            
            // Auto play new slide с попыткой включить звук
            try {
                this.mainVideo.muted = false; // Пытаемся включить звук
                this.mainVideo.volume = this.volume;
                this.mainVideo.controls = false;
                await this.mainVideo.play();
                this.isPlaying = true;
                this.playIcon.className = 'fas fa-pause';
                this.isMuted = false;
                this.volumeIcon.className = 'fas fa-volume-up';
            } catch (playError) {
                // Если не получается со звуком, пробуем без звука
                try {
                    this.mainVideo.muted = true;
                    await this.mainVideo.play();
                    this.isPlaying = true;
                    this.playIcon.className = 'fas fa-pause';
                    this.isMuted = true;
                    this.volumeIcon.className = 'fas fa-volume-mute';
                    console.log('Auto-play started muted, user can unmute manually');
                } catch (mutedPlayError) {
                    console.log('Auto-play blocked completely, user interaction required');
                    this.isPlaying = false;
                    this.playIcon.className = 'fas fa-play';
                }
            }
            
        } catch (error) {
            console.error('Error loading video:', error);
            console.error('Video URL:', this.slides[index].videoUrl);
            console.error('Video element:', this.mainVideo);
            this.hideLoading();
        }
    }

    async togglePlay() {
        try {
            if (this.isPlaying) {
                this.mainVideo.pause();
                this.isPlaying = false;
                this.playIcon.className = 'fas fa-play';
            } else {
                // Ensure video attributes are correct before playing
                this.mainVideo.muted = this.isMuted;
                this.mainVideo.controls = false;
                
                await this.mainVideo.play();
                this.isPlaying = true;
                this.playIcon.className = 'fas fa-pause';
            }
        } catch (error) {
            console.error('Error toggling play:', error);
        }
    }

    prevSlide() {
        const currentSlide = this.slides[this.currentSlide];
        
        // Title slide не может идти назад
        if (currentSlide.type === "title") return;
        
        if (this.currentSlide > 0) {
            this.loadSlide(this.currentSlide - 1);
        }
    }

    nextSlide() {
        const currentSlide = this.slides[this.currentSlide];
        
        // End slide не может идти вперед
        if (currentSlide.type === "end") return;
        
        if (this.currentSlide < this.slides.length - 1) {
            this.loadSlide(this.currentSlide + 1);
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.mainVideo.muted = this.isMuted;
        
        if (this.isMuted) {
            this.volumeIcon.className = 'fas fa-volume-mute';
        } else {
            this.mainVideo.volume = this.volume;
            if (this.volume < 0.5) {
                this.volumeIcon.className = 'fas fa-volume-down';
            } else {
                this.volumeIcon.className = 'fas fa-volume-up';
            }
        }
    }

    setVolume(value) {
        this.volume = value;
        this.mainVideo.volume = value;
        
        if (value === 0) {
            this.isMuted = true;
            this.mainVideo.muted = true;
            this.volumeIcon.className = 'fas fa-volume-mute';
        } else {
            this.isMuted = false;
            this.mainVideo.muted = false;
            if (value < 0.5) {
                this.volumeIcon.className = 'fas fa-volume-down';
            } else {
                this.volumeIcon.className = 'fas fa-volume-up';
            }
        }
    }

    async toggleFullscreen() {
        try {
            if (!this.isFullscreen) {
                if (this.playerContainer.requestFullscreen) {
                    await this.playerContainer.requestFullscreen();
                } else if (this.playerContainer.webkitRequestFullscreen) {
                    await this.playerContainer.webkitRequestFullscreen();
                } else if (this.playerContainer.mozRequestFullScreen) {
                    await this.playerContainer.mozRequestFullScreen();
                }
            } else {
                this.exitFullscreen();
            }
        } catch (error) {
            console.error('Fullscreen error:', error);
        }
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        }
    }

    handleFullscreenChange() {
        this.isFullscreen = !!(document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement);
        
        if (this.isFullscreen) {
            this.fullscreenIcon.className = 'fas fa-compress';
            // Force video attributes in fullscreen
            this.mainVideo.controls = false;
            this.mainVideo.setAttribute('playsinline', '');
            this.mainVideo.style.pointerEvents = 'none';
        } else {
            this.fullscreenIcon.className = 'fas fa-expand';
        }
        
        // Show controls temporarily when entering/exiting fullscreen
        this.showControlsTemporarily();
    }

    updateSlideCounter() {
        this.slideCounter.textContent = `${this.currentSlide + 1} / ${this.slides.length}`;
    }

    updateNavigationButtons() {
        const currentSlide = this.slides[this.currentSlide];
        
        // Title slide: только стрелка вперед, убираем play button
        if (currentSlide.type === "title") {
            this.prevButton.style.display = "none";
            this.nextButton.style.display = "flex";
            this.nextButton.disabled = false;
            this.playButton.style.display = "none";
        } 
        // End slide: только play и назад
        else if (currentSlide.type === "end") {
            this.prevButton.style.display = "flex";
            this.nextButton.style.display = "none";
            this.prevButton.disabled = false;
            this.playButton.style.display = "flex";
        } 
        // Обычные слайды: полная навигация
        else {
            this.prevButton.style.display = "flex";
            this.nextButton.style.display = "flex";
            this.prevButton.disabled = this.currentSlide === 0;
            this.nextButton.disabled = this.currentSlide === this.slides.length - 1;
            this.playButton.style.display = "flex";
        }
    }

    generateChapters() {
        const chapters = {};
        
        this.slides.forEach((slide, index) => {
            if (!chapters[slide.chapter]) {
                chapters[slide.chapter] = [];
            }
            chapters[slide.chapter].push({ ...slide, index });
        });
        
        this.chapterList.innerHTML = '';
        
        Object.keys(chapters).forEach(chapterNum => {
            chapters[chapterNum].forEach(slide => {
                const chapterItem = document.createElement('button');
                chapterItem.className = 'chapter-item';
                chapterItem.innerHTML = `
                    <span>${slide.title}</span>
                    <span class="chapter-indicator">${slide.index === this.currentSlide ? '▶' : ''}</span>
                `;
                
                chapterItem.addEventListener('click', () => {
                    this.loadSlide(slide.index);
                    this.toggleDropdown();
                });
                
                this.chapterList.appendChild(chapterItem);
            });
        });
        
        this.updateChapterActive();
    }

    updateChapterActive() {
        const items = this.chapterList.querySelectorAll('.chapter-item');
        items.forEach((item, index) => {
            const indicator = item.querySelector('.chapter-indicator');
            if (index === this.currentSlide) {
                item.classList.add('active');
                indicator.textContent = '▶';
            } else {
                item.classList.remove('active');
                indicator.textContent = '';
            }
        });
    }

    toggleDropdown() {
        this.dropdownMenu.classList.toggle('visible');
    }

    handleOutsideClick(e) {
        if (!e.target.closest('.dropdown-button-container')) {
            this.dropdownMenu.classList.remove('visible');
        }
    }

    showLoading() {
        this.loadingState.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingState.classList.add('hidden');
    }
}

// Initialize player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.player = new VideoPlayer();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (window.player && document.hidden && window.player.isPlaying) {
        window.player.mainVideo.pause();
        window.player.isPlaying = false;
        window.player.playIcon.className = 'fas fa-play';
    }
});

// Prevent context menu on video
document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.main-video')) {
        e.preventDefault();
    }
});

// Additional mobile fixes
if ('ontouchstart' in window) {
    // Disable double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // Prevent pinch zoom
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
}
