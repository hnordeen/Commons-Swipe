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
        'Energy'
    ];

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
                currentCategory = item.dataset.category;
                currentIndex = 0;
                currentImages = [];
                continueToken = null;
                hasMoreImages = true;
                await loadImages();
                showView(mainView);
            });
        });
    }

    async function loadImages(loadMore = false) {
        if (isLoading || (!loadMore && currentImages.length > 0)) return;
        
        showLoading();
        isLoading = true;

        try {
            let url = `https://commons.wikimedia.org/w/api.php?action=query&generator=categorymembers&gcmtitle=Category:${currentCategory}&gcmtype=file&gcmnamespace=6&prop=imageinfo|extracts&iiprop=url|size|mime|extmetadata&exintro=1&explaintext=1&format=json&origin=*`;
            
            if (continueToken) {
                url += `&gcmcontinue=${continueToken}`;
            }

            const response = await fetch(url);
            const data = await response.json();
            
            if (data.query && data.query.pages) {
                const newImages = Object.values(data.query.pages)
                    .filter(page => page.imageinfo && page.imageinfo[0].mime.startsWith('image/'))
                    .map(page => ({
                        url: page.imageinfo[0].url,
                        title: page.title.replace('File:', ''),
                        license: page.imageinfo[0].extmetadata?.LicenseShortName?.value || 'Unknown license',
                        author: page.imageinfo[0].extmetadata?.Artist?.value || 'Unknown author',
                        description: page.extract || ''
                    }));

                if (loadMore) {
                    currentImages = [...currentImages, ...newImages];
                } else {
                    currentImages = newImages;
                }

                continueToken = data.continue?.gcmcontinue || null;
                hasMoreImages = !!continueToken;

                if (!loadMore) {
                    displayCurrentImage();
                }
                
                // Preload more images for smoother transitions
                preloadMoreImages();
            }
        } catch (error) {
            console.error('Error loading images:', error);
        }

        isLoading = false;
        hideLoading();
    }

    function preloadMoreImages() {
        // Preload next 3 images
        const preloadIndices = [
            currentIndex + 1,
            currentIndex + 2,
            currentIndex + 3
        ].filter(index => index >= 0 && index < currentImages.length);

        preloadIndices.forEach(index => {
            const img = new Image();
            img.src = currentImages[index].url;
        });

        // If we're getting close to the end, load more images
        if (currentIndex > currentImages.length - 5 && hasMoreImages) {
            loadImages(true);
        }
    }

    function displayCurrentImage() {
        if (currentImages.length === 0) {
            imageFeed.innerHTML = '<div class="image-card"><p>No images found</p></div>';
            return;
        }

        const image = currentImages[currentIndex];
        imageFeed.innerHTML = `
            <div class="image-card">
                <img src="${image.url}" alt="${image.title}">
                <div class="image-info">
                    <p>${image.author}</p>
                    <p class="license-info">${image.license}</p>
                    ${image.description ? `<p>${image.description}</p>` : ''}
                </div>
            </div>
        `;
    }

    function setupSwipeHandlers() {
        imageFeed.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        });

        imageFeed.addEventListener('touchmove', (e) => {
            touchEndY = e.touches[0].clientY;
            const diff = touchStartY - touchEndY;
            
            // Show swipe indicators
            if (diff > 50) {
                swipeUpIndicator.classList.add('active');
                swipeDownIndicator.classList.remove('active');
            } else if (diff < -50) {
                swipeDownIndicator.classList.add('active');
                swipeUpIndicator.classList.remove('active');
            } else {
                swipeUpIndicator.classList.remove('active');
                swipeDownIndicator.classList.remove('active');
            }
        });

        imageFeed.addEventListener('touchend', () => {
            swipeUpIndicator.classList.remove('active');
            swipeDownIndicator.classList.remove('active');
            
            const diff = touchStartY - touchEndY;
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    nextImage();
                } else {
                    previousImage();
                }
            }
        });
    }

    function setupScrollHandler() {
        let lastScrollTop = 0;
        let lastScrollTime = Date.now();
        let scrollTimeout;

        window.addEventListener('scroll', () => {
            const now = Date.now();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollDiff = scrollTop - lastScrollTop;
            const timeDiff = now - lastScrollTime;
            
            // Clear any existing timeout
            clearTimeout(scrollTimeout);
            
            // If scrolling quickly (more than 50px in less than 100ms)
            if (Math.abs(scrollDiff) > 50 && timeDiff < 100) {
                if (scrollDiff > 0) {
                    nextImage();
                } else {
                    previousImage();
                }
                window.scrollTo(0, 0);
            } else {
                // For slower scrolling, use the original timeout-based approach
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
}); 