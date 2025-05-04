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
    let currentCategory = 'Quality_images';
    let touchStartY = 0;
    let touchEndY = 0;
    let currentIndex = 0;
    let isLoading = false;
    let hasMoreImages = true;
    let continueToken = null;

    // Top 50 categories from Wikimedia Commons
    const topCategories = [
        'Quality_images',
        'Featured_pictures',
        'Animals',
        'Architecture',
        'Art',
        'Astronomy',
        'Biology',
        'Buildings',
        'Cities',
        'Clouds',
        'Computers',
        'Culture',
        'Earth',
        'Education',
        'Engineering',
        'Environment',
        'Events',
        'Food',
        'Geography',
        'History',
        'Human_body',
        'Industry',
        'Landscapes',
        'Light',
        'Maps',
        'Mathematics',
        'Medicine',
        'Military',
        'Music',
        'Nature',
        'People',
        'Physics',
        'Plants',
        'Politics',
        'Religion',
        'Science',
        'Sports',
        'Technology',
        'Transport',
        'Travel',
        'Weather',
        'Wildlife',
        'World_Heritage_Sites',
        'Zoology',
        'Agriculture',
        'Archaeology',
        'Chemistry',
        'Climate',
        'Economy',
        'Energy',
        'Dogs',
        'Cats'
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
        return localStorage.getItem(SELECTED_CATEGORY_KEY) || 'Quality_images';
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
            const response = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(category)}&gcmtype=file&gcmnamespace=6&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist&gcmlimit=100`);
            const data = await response.json();
            
            if (data.query && data.query.pages) {
                const viewedImages = getViewedImages();
                const newImages = Object.values(data.query.pages)
                    .filter(page => !viewedImages.includes(page.pageid))
                    .map(page => {
                        const license = page.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value;
                        const author = page.imageinfo?.[0]?.extmetadata?.Artist?.value;
                        // Use Wikimedia's Special:FilePath with width parameter
                        const imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(page.title.replace('File:', ''))}?width=800`;
                        return {
                            id: page.pageid,
                            title: page.title,
                            url: imageUrl,
                            license: license || 'Unknown license',
                            author: author || 'Unknown author'
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
                preloadMoreImages();
            } else {
                // If no new images, clear viewed images and try again
                clearViewedImages();
                const freshImages = await fetchImages(currentCategory);
                if (freshImages.length > 0) {
                    currentImages = freshImages;
                    currentIndex = 0;
                    displayCurrentImage();
                    preloadMoreImages();
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

    async function init() {
        loadCategories();
        await loadImages();
        setupSwipeHandlers();
        setupNavigation();
        setupKeyboardNavigation();
        setupScrollHandler();
    }

    function loadCategories() {
        categoriesList.innerHTML = topCategories.map(category => `
            <div class="category-item" data-category="${category}">
                ${category.replace(/_/g, ' ')}
            </div>
        `).join('');

        document.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', async () => {
                // Toggle selected state
                if (item.style.backgroundColor === 'rgb(26, 115, 232)') {
                    item.style.backgroundColor = '';
                    item.style.color = '';
                    currentCategory = 'Quality_images'; // Reset to default category
                } else {
                    // Reset all other items
                    document.querySelectorAll('.category-item').forEach(i => {
                        i.style.backgroundColor = '';
                        i.style.color = '';
                    });
                    // Set selected style
                    item.style.backgroundColor = '#1a73e8';
                    item.style.color = 'white';
                    currentCategory = item.dataset.category;
                }
                
                currentIndex = 0;
                currentImages = [];
                continueToken = null;
                hasMoreImages = true;
                await loadImages();
                showView(mainView);
            });
        });
    }

    function preloadMoreImages() {
        // Preload next 5 images for smoother transitions
        const preloadIndices = [
            currentIndex + 1,
            currentIndex + 2,
            currentIndex + 3,
            currentIndex + 4,
            currentIndex + 5
        ].filter(index => index >= 0 && index < currentImages.length);

        preloadIndices.forEach(index => {
            const img = new Image();
            img.src = currentImages[index].url;
        });

        // If we're getting close to the end, load more images
        if (currentIndex > currentImages.length - 10 && hasMoreImages) {
            loadImages(true);
        }
    }

    function truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    function displayCurrentImage() {
        if (currentImages.length === 0) {
            imageFeed.innerHTML = '<div class="image-card"><p>No images found</p></div>';
            return;
        }

        const image = currentImages[currentIndex];
        imageFeed.innerHTML = `
            <div class="image-card">
                <img src="${image.url}" alt="${image.title}" loading="lazy">
                <div class="image-info">
                    <p>${image.title.replace('File:', '')}</p>
                    <p class="author-info">${truncateText(image.author)}</p>
                    <p class="license-info">${image.license}</p>
                    <a href="https://commons.wikimedia.org/wiki/${encodeURIComponent(image.title)}" target="_blank" class="info-button" onclick="event.stopPropagation();">
                        <i class="fas fa-info-circle"></i>
                    </a>
                </div>
            </div>
        `;
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

        function resetImage(img) {
            if (isResetting) return;
            isResetting = true;
            
            // First reset the transform
            img.style.transform = '';
            
            // Then after transform is done, reset object-fit
            setTimeout(() => {
                img.style.objectFit = 'cover';
                isResetting = false;
            }, 300);
        }

        imageFeed.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Start of pinch gesture
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const distance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                initialScale = currentScale;
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
                const initialDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                currentScale = initialScale * (distance / initialDistance);
                
                // Limit scale to between 0.5 and 1
                currentScale = Math.max(0.5, Math.min(1, currentScale));
                
                const img = currentCard.querySelector('img');
                if (img) {
                    if (currentScale < 1) {
                        img.style.objectFit = 'contain';
                    } else {
                        img.style.objectFit = 'cover';
                    }
                    img.style.transform = `scale(${currentScale})`;
                }
                e.preventDefault();
            } else {
                touchEndY = e.touches[0].clientY;
                const distance = Math.abs(touchStartY - touchEndY);
                
                if (distance > 10) {
                    e.preventDefault();
                    isScrolling = true;
                    
                    // Calculate swipe progress
                    const swipeProgress = (touchEndY - touchStartY) / window.innerHeight;
                    if (currentCard) {
                        currentCard.style.transform = `translateY(${swipeProgress * 100}%)`;
                        currentCard.querySelector('img').style.transform = `scale(${1 - Math.abs(swipeProgress) * 0.1})`;
                    }
                }
            }
        }, { passive: false });

        // Handle trackpad gestures
        imageFeed.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                currentCard = document.querySelector('.image-card');
                const img = currentCard.querySelector('img');
                
                // Adjust scale based on wheel delta
                currentScale += e.deltaY * -0.01;
                
                // Limit scale to between 0.5 and 1
                currentScale = Math.max(0.5, Math.min(1, currentScale));
                
                if (img) {
                    if (currentScale < 1) {
                        img.style.objectFit = 'contain';
                    } else {
                        img.style.objectFit = 'cover';
                    }
                    img.style.transform = `scale(${currentScale})`;
                }
            }
        }, { passive: false });

        imageFeed.addEventListener('touchend', () => {
            touchEndTime = Date.now();
            const timeDiff = touchEndTime - touchStartTime;
            const distance = Math.abs(touchStartY - touchEndY);
            const velocity = distance / timeDiff;
            const swipeProgress = (touchEndY - touchStartY) / window.innerHeight;
            
            if (currentCard) {
                if (isScrolling && (Math.abs(swipeProgress) > 0.2 || velocity > 0.3)) {
                    if (swipeProgress < 0) {
                        currentCard.classList.add('swiping-up');
                        setTimeout(() => {
                            nextImage();
                            currentCard.classList.remove('swiping-up');
                            currentCard.style.transform = '';
                            const img = currentCard.querySelector('img');
                            resetImage(img);
                        }, 300);
                    } else {
                        currentCard.classList.add('swiping-down');
                        setTimeout(() => {
                            previousImage();
                            currentCard.classList.remove('swiping-down');
                            currentCard.style.transform = '';
                            const img = currentCard.querySelector('img');
                            resetImage(img);
                        }, 300);
                    }
                } else {
                    // Reset position if swipe wasn't strong enough
                    currentCard.style.transform = '';
                    const img = currentCard.querySelector('img');
                    resetImage(img);
                }
            }
        });
    }

    function setupScrollHandler() {
        let lastScrollTop = 0;
        let lastScrollTime = Date.now();
        let scrollTimeout;
        let isTouchDevice = 'ontouchstart' in window;

        // Only add scroll handler for non-touch devices
        if (!isTouchDevice) {
            window.addEventListener('scroll', () => {
                const now = Date.now();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const scrollDiff = scrollTop - lastScrollTop;
                const timeDiff = now - lastScrollTime;
                
                clearTimeout(scrollTimeout);
                
                if (Math.abs(scrollDiff) > 50 && timeDiff < 100) {
                    if (scrollDiff > 0) {
                        nextImage();
                    } else {
                        previousImage();
                    }
                    window.scrollTo(0, 0);
                } else {
                    scrollTimeout = setTimeout(() => {
                        if (Math.abs(scrollDiff) > 50) {
                            if (scrollDiff > 0) {
                                nextImage();
                            } else {
                                previousImage();
                            }
                            window.scrollTo(0, 0);
                        }
                    }, 100);
                }
                
                lastScrollTop = scrollTop;
                lastScrollTime = now;
            });
        }
    }

    function setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (mainView.classList.contains('active')) {
                switch (e.key) {
                    case 'ArrowUp':
                        previousImage();
                        break;
                    case 'ArrowDown':
                        nextImage();
                        break;
                    case 'Escape':
                        showView(categoriesView);
                        break;
                }
            } else if (categoriesView.classList.contains('active') && e.key === 'Escape') {
                showView(mainView);
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
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        view.classList.add('active');
        if (view === mainView) {
            window.scrollTo(0, 0);
        }
    }

    function showLoading() {
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = 'Loading...';
        imageFeed.appendChild(loading);
    }

    function hideLoading() {
        const loading = document.querySelector('.loading');
        if (loading) {
            loading.remove();
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
}); 