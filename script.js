/*
 * Commons Swipe - Prototype
 * A prototype implementation for browsing Wikimedia Commons images
 */
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const mainView = document.getElementById('mainView');
    const categoriesView = document.getElementById('categoriesView');
    const imageFeed = document.getElementById('imageFeed');
    const categoriesList = document.getElementById('categoriesList');
    const filterButton = document.getElementById('filterButton');
    const backButton = document.getElementById('backButton');

    // State
    let currentImages = [];
    let currentCategory = 'Featured_pictures_on_Wikimedia_Commons';
    let touchStartY = 0;
    let touchEndY = 0;
    let currentIndex = 0;
    let isLoading = false;
    let hasMoreImages = true;
    let continueToken = null;
    let customCategories = [];
    const CUSTOM_CATEGORIES_KEY = 'commonsSwipe_customCategories';

    // Top 50 categories from Wikimedia Commons
    const topCategories = [
        // Featured categories first
        'Featured_pictures_on_Wikimedia_Commons',
        'Quality_images',
        'Images_from_Wiki_Loves_Monuments_2024',
        'Images_from_Wiki_Loves_Earth_2024',
        'Images_from_Wiki_Loves_Earth_2023',
        
        // Rest in alphabetical order
        'Agriculture',
        'Archaeology',
        'Architecture',
        'Art',
        'Astronomy',
        'Biology',
        'Buildings',
        'Climate',
        'Computers',
        'Culture',
        'Cats',
        'Dogs',
        'Earth',
        'Economy',
        'Education',
        'Energy',
        'Engineering',
        'Environment',
        'Events',
        'Food',
        'Geography',
        'History',
        'Human_body',
        'Landscapes',
        'Light',
        'Mathematics',
        'Military',
        'Music',
        'People',
        'Physics',
        'Politics',
        'Religion',
        'Sports',
        'Technology',
        'Transport',
        'Travel',
        'Wildlife',
        'Works_of_art',
        'World_Heritage_Sites',
        'Zoology'
    ];

    // Add local storage keys
    const VIEWED_IMAGES_KEY = 'commonsSwipe_viewedImages';
    const SELECTED_CATEGORY_KEY = 'commonsSwipe_selectedCategory';
    const MAX_STORED_IMAGES = 1000; // Limit the number of stored images to prevent excessive storage usage

    // Function to get viewed images from local storage
    function getViewedImages() {
        const stored = localStorage.getItem(VIEWED_IMAGES_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    // Function to add an image to viewed images
    function addToViewedImages(imageId) {
        const viewedImages = getViewedImages();
        viewedImages.push(imageId);
        
        // Keep only the most recent MAX_STORED_IMAGES
        if (viewedImages.length > MAX_STORED_IMAGES) {
            viewedImages.splice(0, viewedImages.length - MAX_STORED_IMAGES);
        }
        
        localStorage.setItem(VIEWED_IMAGES_KEY, JSON.stringify(viewedImages));
    }

    // Function to check if an image has been viewed
    function hasViewedImage(imageId) {
        return getViewedImages().includes(imageId);
    }

    // Function to get selected category from local storage
    function getSelectedCategory() {
        return localStorage.getItem(SELECTED_CATEGORY_KEY) || 'Featured_pictures_on_Wikimedia_Commons';
    }

    // Function to set selected category in local storage
    function setSelectedCategory(category) {
        localStorage.setItem(SELECTED_CATEGORY_KEY, category);
    }

    // Function to shuffle array randomly
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Add function to calculate optimal image size
    function getOptimalImageSize() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const pixelRatio = window.devicePixelRatio || 1;
        
        // Calculate dimensions that will fill the screen while maintaining aspect ratio
        const width = Math.min(screenWidth * pixelRatio, 1200); // Cap at 1200px
        const height = Math.min(screenHeight * pixelRatio, 1200);
        
        return { width, height };
    }

    // Modify the fetchImages function to filter out viewed images and shuffle
    async function fetchImages(category = '') {
        try {
            const response = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(category)}&gcmtype=file&gcmnamespace=6&prop=imageinfo&iiprop=url|extmetadata|mime&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist&gcmlimit=100`);
            const data = await response.json();
            
            if (data.query && data.query.pages) {
                const viewedImages = getViewedImages();
                const newImages = Object.values(data.query.pages)
                    .filter(page => {
                        // Check if file is JPG or PNG
                        const mime = page.imageinfo?.[0]?.mime;
                        return mime && (mime.includes('image/jpeg') || mime.includes('image/png'));
                    })
                    .filter(page => !viewedImages.includes(page.pageid))
                    .map(page => {
                        const license = page.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value;
                        const author = page.imageinfo?.[0]?.extmetadata?.Artist?.value;
                        // Strip any HTML from the author field
                        const cleanAuthor = author ? author.replace(/<[^>]*>/g, '') : 'Unknown author';
                        // Use Wikimedia's Special:FilePath with width parameter
                        const imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(page.title.replace('File:', ''))}?width=800`;
                        return {
                            id: page.pageid,
                            title: page.title,
                            url: imageUrl,
                            license: license || 'Unknown license',
                            author: cleanAuthor
                        };
                    });
                
                // Shuffle the new images
                return shuffleArray(newImages);
            }
            return [];
        } catch (error) {
            console.error('Error fetching images:', error);
            return [];
        }
    }

    // Modify the loadImages function to handle random selection
    async function loadImages(loadMore = false) {
        if (isLoading || (!loadMore && currentImages.length > 0)) return;
        
        showLoading();
        isLoading = true;

        try {
            const newImages = await fetchImages(currentCategory);
            if (newImages.length > 0) {
                if (loadMore) {
                    currentImages = [...currentImages, ...newImages];
                } else {
                    currentImages = newImages;
                }
                currentIndex = 0;
                displayCurrentImage();
            } else {
                // If no new images, clear viewed images and try again
                clearViewedImages();
                const freshImages = await fetchImages(currentCategory);
                if (freshImages.length > 0) {
                    currentImages = freshImages;
                    currentIndex = 0;
                    displayCurrentImage();
                } else {
                    imageFeed.innerHTML = '<div class="image-card"><p>No new images found</p></div>';
                }
            }
        } catch (error) {
            console.error('Error loading images:', error);
            imageFeed.innerHTML = '<div class="image-card"><p>Error loading images</p></div>';
        }

        isLoading = false;
        hideLoading();
    }

    // Add a function to clear viewed images
    function clearViewedImages() {
        localStorage.removeItem(VIEWED_IMAGES_KEY);
    }

    // Initialize the app
    init();

    function init() {
        loadCategories();
        loadImages();
        setupSwipeHandlers();
        setupNavigation();
        setupKeyboardNavigation();
        setupScrollHandler();
        setupScrollIndicator();
    }

    function loadCategories() {
        // Load custom categories from localStorage
        const storedCategories = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
        if (storedCategories) {
            customCategories = JSON.parse(storedCategories);
        }

        // Combine top categories with custom categories
        const allCategories = [...topCategories, ...customCategories];
        
        categoriesList.innerHTML = allCategories.map(category => {
            let displayName = category.replace(/_/g, ' ');
            // Special cases for display names
            if (category === 'Featured_pictures_on_Wikimedia_Commons') {
                displayName = 'Featured Pictures';
            } else if (category === 'Images_from_Wiki_Loves_Monuments_2024') {
                displayName = 'Wiki Loves Monuments 2024';
            } else if (category === 'Images_from_Wiki_Loves_Earth_2024') {
                displayName = 'Wiki Loves Earth 2024';
            }
            const isSelected = category === currentCategory;
            const isCustom = customCategories.includes(category);
            return `
                <div class="category-item ${isSelected ? 'selected' : ''}" data-category="${category}">
                    <i class="fas fa-${getCategoryIcon(category)}"></i>
                    <span>${displayName}</span>
                    ${isCustom ? `<button class="remove-category" onclick="removeCustomCategory('${category}')">
                        <i class="fas fa-times"></i>
                    </button>` : ''}
                </div>
            `;
        }).join('');

        // Update filter button state
        if (filterButton) {
            if (currentCategory !== 'Featured_pictures_on_Wikimedia_Commons') {
                filterButton.classList.add('active');
            } else {
                filterButton.classList.remove('active');
            }
        }

        // Add click handlers
        document.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                // Don't trigger if clicking the remove button
                if (e.target.closest('.remove-category')) return;
                
                const category = item.dataset.category;
                document.querySelectorAll('.category-item').forEach(i => {
                    i.classList.remove('selected');
                });
                item.classList.add('selected');
                
                currentCategory = category;
                setSelectedCategory(category);
                currentImages = [];
                currentIndex = 0;
                
                // Update filter button state
                if (filterButton) {
                    if (category !== 'Featured_pictures_on_Wikimedia_Commons') {
                        filterButton.classList.add('active');
                    } else {
                        filterButton.classList.remove('active');
                    }
                }
                
                // Show loading state
                showLoading();
                
                // Load new images
                await loadImages();
                
                // Hide loading and show main view with zoom effect
                hideLoading();
                showView(mainView);
            });
        });
    }

    function getCategoryIcon(category) {
        // Map categories to appropriate Font Awesome icons
        const iconMap = {
            'Animals': 'paw',
            'Architecture': 'building',
            'Art': 'palette',
            'Astronomy': 'moon',
            'Biology': 'dna',
            'Buildings': 'building',
            'Cities': 'city',
            'Computers': 'laptop',
            'Culture': 'theater-masks',
            'Earth': 'globe',
            'Education': 'graduation-cap',
            'Engineering': 'cogs',
            'Environment': 'leaf',
            'Events': 'calendar',
            'Food': 'utensils',
            'Geography': 'map',
            'History': 'landmark',
            'Human_body': 'user',
            'Industry': 'industry',
            'Landscapes': 'mountain',
            'Light': 'lightbulb',
            'Maps': 'map',
            'Mathematics': 'calculator',
            'Medicine': 'medkit',
            'Military': 'shield-alt',
            'Music': 'music',
            'Nature': 'tree',
            'People': 'users',
            'Physics': 'atom',
            'Plants': 'seedling',
            'Politics': 'vote-yea',
            'Religion': 'pray',
            'Science': 'flask',
            'Sports': 'running',
            'Technology': 'microchip',
            'Transport': 'car',
            'Travel': 'plane',
            'Weather': 'cloud-sun',
            'Wildlife': 'paw',
            'World_Heritage_Sites': 'university',
            'Zoology': 'paw'
        };

        return iconMap[category] || 'image';
    }

    function getCategoryCount(category) {
        // This is a placeholder - in a real implementation, you would fetch this from the API
        return '100+';
    }

    function preloadMoreImages() {
        if (currentImages.length === 0) return;
        
        // Preload next 3 images in memory (not displayed)
        for (let i = 1; i <= 3; i++) {
            const nextIndex = (currentIndex + i) % currentImages.length;
            const nextImage = currentImages[nextIndex];
            const img = new Image();
            img.src = nextImage.url;
        }
    }

    function truncateText(text, maxLength = 100) {
        // Remove file extension
        text = text.replace(/\.[^/.]+$/, '');
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    function displayCurrentImage() {
        if (currentImages.length === 0) return;
        
        const currentImage = currentImages[currentIndex];
        
        // Clear existing content
        imageFeed.innerHTML = '';
        
        // Create current image card
        const currentCard = document.createElement('div');
        currentCard.className = 'image-card';
        
        const currentImg = new Image();
        currentImg.onload = () => {
            currentCard.classList.add('loaded');
            addToViewedImages(currentImage.id);
        };
        currentImg.src = currentImage.url;
        
        const commonsBaseUrl = isMobileDevice() ? 'https://commons.m.wikimedia.org/wiki/File:' : 'https://commons.wikimedia.org/wiki/File:';
        const fileTitle = currentImage.title.replace('File:', '');
        const fileUrl = `${commonsBaseUrl}${encodeURIComponent(fileTitle)}`;
        
        currentCard.innerHTML = `
            <div class="image-loading"></div>
            <img src="${currentImage.url}" alt="${currentImage.title}">
            <div class="image-info">
                <p>${truncateText(fileTitle)}</p>
                <p class="license-info">
                    ${currentImage.license} by ${currentImage.author || 'Unknown author'}
                </p>
            </div>
            <a href="${fileUrl}" 
               class="info-link" 
               target="_blank" 
               rel="noopener noreferrer">
                <i class="fas fa-info-circle"></i>
            </a>
        `;
        
        // Only append the current card
        imageFeed.appendChild(currentCard);
        
        // Preload next image in memory (not displayed)
        const nextImage = currentImages[(currentIndex + 1) % currentImages.length];
        const nextImg = new Image();
        nextImg.src = nextImage.url;
        
        // Preload more images
        preloadMoreImages();
    }

    function setupSwipeHandlers() {
        let touchStartY = 0;
        let touchEndY = 0;
        let touchStartTime = 0;
        let touchEndTime = 0;
        let isScrolling = false;
        let currentCard = null;
        let initialScale = 1;
        let currentScale = 1;
        let isResetting = false;
        let initialDistance = 0;
        let isZooming = false;

        function resetImage(img) {
            if (isResetting) return;
            isResetting = true;
            
            currentScale = 1;
            img.style.transform = '';
            img.style.objectFit = 'cover';
            
            setTimeout(() => {
                isResetting = false;
            }, 300);
        }

        function getCurrentImage() {
            return document.querySelector('.image-card img');
        }

        function handleZoom(scale) {
            const img = getCurrentImage();
            if (img) {
                currentScale = Math.max(0.5, Math.min(2, scale));
                img.style.transform = `scale(${currentScale})`;
                img.style.objectFit = currentScale < 1 ? 'contain' : 'cover';
            }
        }

        imageFeed.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Start of pinch gesture
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                initialDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                initialScale = currentScale;
                isZooming = true;
                e.preventDefault();
            } else {
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
                isScrolling = false;
                currentCard = document.querySelector('.image-card');
            }
        });

        imageFeed.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                // Pinch gesture
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const distance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                const scale = initialScale * (distance / initialDistance);
                handleZoom(scale);
                e.preventDefault();
            } else {
                touchEndY = e.touches[0].clientY;
                const distance = Math.abs(touchStartY - touchEndY);
                
                if (distance > 10) {
                    e.preventDefault();
                    isScrolling = true;
                    
                    // Calculate swipe progress
                    const swipeProgress = (touchEndY - touchStartY) / window.innerHeight;
                    const currentCard = document.querySelector('.image-card');
                    
                    if (currentCard) {
                        currentCard.style.transform = `translateY(${swipeProgress * 100}%)`;
                    }
                }
            }
        }, { passive: false });

        imageFeed.addEventListener('touchend', () => {
            touchEndTime = Date.now();
            const timeDiff = touchEndTime - touchStartTime;
            const distance = Math.abs(touchStartY - touchEndY);
            const velocity = distance / timeDiff;
            const swipeProgress = (touchEndY - touchStartY) / window.innerHeight;
            
            if (isZooming) {
                isZooming = false;
                // Don't reset zoom on touchend, let it stay at the current scale
            } else if (isScrolling && (Math.abs(swipeProgress) > 0.2 || velocity > 0.3)) {
                if (swipeProgress < 0) {
                    nextImage();
                } else {
                    previousImage();
                }
            } else {
                // Reset position
                const currentCard = document.querySelector('.image-card');
                if (currentCard) {
                    currentCard.style.transform = 'translateY(0)';
                }
            }
        });

        // Add wheel event for trackpad zoom
        imageFeed.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const zoomFactor = 0.01;
                const delta = e.deltaY;
                const newScale = currentScale - delta * zoomFactor;
                handleZoom(newScale);
            }
        }, { passive: false });

        // Reset zoom when changing images
        const originalDisplayCurrentImage = displayCurrentImage;
        displayCurrentImage = function() {
            originalDisplayCurrentImage.apply(this, arguments);
            currentScale = 1;
            const img = getCurrentImage();
            if (img) {
                img.style.transform = '';
                img.style.objectFit = 'cover';
            }
        };
    }

    function setupScrollHandler() {
        let lastScrollTime = Date.now();
        let scrollTimeout;
        let isTouchDevice = 'ontouchstart' in window;
        let scrollProgress = 0;
        let isScrolling = false;

        // Only add scroll handler for non-touch devices
        if (!isTouchDevice) {
            window.addEventListener('wheel', (e) => {
                // Only prevent default if we're on the main view
                if (mainView.classList.contains('active')) {
                    e.preventDefault();
                    
                    const now = Date.now();
                    const timeDiff = now - lastScrollTime;
                    
                    // Calculate scroll progress based on deltaY
                    const delta = e.deltaY;
                    scrollProgress = Math.max(-1, Math.min(1, delta * 0.002));
                    
                    const currentCard = document.querySelector('.image-card');
                    const preview = document.querySelector('.image-preview');
                    
                    if (delta < 0) {
                        // Scrolling up (next image)
                        if (currentCard) {
                            currentCard.style.transform = `translateY(${scrollProgress * 100}%)`;
                        }
                        if (preview) {
                            preview.style.transform = `translateY(${100 + scrollProgress * 100}%)`;
                        }
                    } else {
                        // Scrolling down (previous image)
                        if (currentCard) {
                            currentCard.style.transform = `translateY(${scrollProgress * 100}%)`;
                        }
                        if (preview) {
                            preview.style.transform = 'translateY(100%)';
                        }
                    }
                    
                    // If scroll is significant, transition to next/previous image
                    if (Math.abs(scrollProgress) > 0.3) {
                        isScrolling = true;
                        if (scrollProgress < 0) {
                            nextImage();
                        } else {
                            previousImage();
                        }
                        scrollProgress = 0;
                    }
                    
                    // Reset scroll progress if no movement for 200ms
                    clearTimeout(scrollTimeout);
                    scrollTimeout = setTimeout(() => {
                        if (!isScrolling) {
                            scrollProgress = 0;
                            if (currentCard) {
                                currentCard.style.transform = 'translateY(0)';
                            }
                            if (preview) {
                                preview.style.transform = 'translateY(100%)';
                            }
                        }
                        isScrolling = false;
                    }, 200);
                    
                    lastScrollTime = now;
                }
            }, { passive: false });
        }
    }

    function setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowRight':
                case 'ArrowDown':
                    nextImage();
                    break;
                case 'ArrowLeft':
                case 'ArrowUp':
                    previousImage();
                    break;
                case 'f':
                    showView(categoriesView);
                    break;
                case 'b':
                    showView(mainView);
                    break;
                case 'r':
                    clearViewedImages();
                    loadImages();
                    break;
            }
        });
    }

    function nextImage() {
        if (currentIndex < currentImages.length - 1) {
            currentIndex++;
            displayCurrentImage();
            preloadMoreImages();
        } else if (hasMoreImages) {
            loadImages(true);
        }
    }

    function previousImage() {
        if (currentIndex > 0) {
            currentIndex--;
            displayCurrentImage();
            preloadMoreImages();
        }
    }

    function setupNavigation() {
        filterButton.addEventListener('click', () => showView(categoriesView));
        backButton.addEventListener('click', () => showView(mainView));
    }

    function showView(view) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active', 'zooming');
        });
        
        if (view === mainView) {
            view.classList.add('active');
        } else {
            view.classList.add('active');
            // Reset scroll position
            const container = view.querySelector('.categories-container');
            if (container) {
                container.scrollTop = 0;
            }
        }
    }

    function showLoading() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading';
        loadingDiv.innerHTML = `
            <div class="loading-spinner"></div>
            <div>Loading images...</div>
        `;
        document.body.appendChild(loadingDiv);
    }

    function hideLoading() {
        const loadingDiv = document.querySelector('.loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    // Add preloading for next image
    function preloadNextImage() {
        if (currentIndex < currentImages.length - 1) {
            const nextImage = currentImages[currentIndex + 1];
            const img = new Image();
            img.src = nextImage.url;
        }
    }

    function addCustomCategory(category) {
        if (!customCategories.includes(category)) {
            customCategories.push(category);
            localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(customCategories));
            loadCategories();
        }
    }

    function removeCustomCategory(category) {
        customCategories = customCategories.filter(c => c !== category);
        localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(customCategories));
        loadCategories();
    }

    // Add this function near the top of the file
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Add this after the DOM is loaded
    const titleLink = document.querySelector('.title-link');
    if (titleLink) {
        titleLink.href = isMobileDevice() ? 'https://commons.m.wikimedia.org/' : 'https://commons.wikimedia.org/wiki/Main_Page';
    }

    function setupScrollIndicator() {
        const scrollIndicator = document.querySelector('.scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.addEventListener('click', () => {
                nextImage();
            });
        }
    }
}); 