/**
 * A Quiet Place to Post
 * ----------------------
 * Configuration & Logic (Supabase)
 */

// ============================================
// CONFIGURATION — Edit these values
// ============================================

const CONFIG = {
    // Your Supabase project URL
    SUPABASE_URL: 'https://hyxobyxeeayuorzldyuy.supabase.co',
    // Your Supabase anon/public key (safe to expose)
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5eG9ieXhlZWF5dW9yemxkeXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NzYyNjYsImV4cCI6MjA4MDQ1MjI2Nn0.LjY5IHeROzUuFT9SXMwCOabAOk6ccSq7k9Z8xtGDltA'
};

// ============================================
// Initialize Supabase Client
// ============================================

let supabaseClient = null;

// Initialize Supabase client
function initializeSupabase() {
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded');
        return false;
    }
    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    return true;
}

// ============================================
// State
// ============================================

let isAuthenticated = false;
let posts = [];
let suggestions = [];
let playlistUrl = null;
let playlistType = 'youtube';
let playlistMuted = true; // Start muted to allow autoplay
let realtimeChannels = [];
let letterboxdReviews = [];
let letterboxdUrl = null;
let letterboxdPollInterval = null; // Store interval ID for cleanup

// ============================================
// Scroll Prevention for Fullscreen Panels
// ============================================

let scrollPreventionHandler = null;
let bodyScrollPreventionHandler = null;

function enableScrollPrevention() {
    if (scrollPreventionHandler) return; // Already enabled
    
    scrollPreventionHandler = function(e) {
        // Allow scrolling only within textareas
        const target = e.target;
        if (target.tagName === 'TEXTAREA') {
            return; // Allow textarea scrolling
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
    };
    
    // Prevent all scroll-related events with multiple strategies
    document.addEventListener('touchmove', scrollPreventionHandler, { passive: false, capture: true });
    document.addEventListener('wheel', scrollPreventionHandler, { passive: false, capture: true });
    document.addEventListener('scroll', scrollPreventionHandler, { passive: false, capture: true });
    window.addEventListener('scroll', scrollPreventionHandler, { passive: false, capture: true });
    document.addEventListener('touchstart', scrollPreventionHandler, { passive: false, capture: true });
    
    // Also prevent scroll on the document body directly
    bodyScrollPreventionHandler = function(e) {
        if (e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    };
    document.body.addEventListener('touchmove', bodyScrollPreventionHandler, { passive: false });
    document.body.addEventListener('wheel', bodyScrollPreventionHandler, { passive: false });
}

function disableScrollPrevention() {
    if (scrollPreventionHandler) {
        document.removeEventListener('touchmove', scrollPreventionHandler, { capture: true });
        document.removeEventListener('wheel', scrollPreventionHandler, { capture: true });
        document.removeEventListener('scroll', scrollPreventionHandler, { capture: true });
        window.removeEventListener('scroll', scrollPreventionHandler, { capture: true });
        document.removeEventListener('touchstart', scrollPreventionHandler, { capture: true });
        scrollPreventionHandler = null;
    }
    
    if (bodyScrollPreventionHandler) {
        document.body.removeEventListener('touchmove', bodyScrollPreventionHandler);
        document.body.removeEventListener('wheel', bodyScrollPreventionHandler);
        bodyScrollPreventionHandler = null;
    }
}

// ============================================
// DOM Elements
// ============================================

const elements = {
    statusToggle: document.getElementById('status-toggle'),
    statusWord: document.getElementById('status-word'),
    statusDot: document.getElementById('status-dot'),
    authPanel: document.getElementById('auth-panel'),
    emailInput: document.getElementById('email-input'),
    passwordInput: document.getElementById('password-input'),
    authSubmit: document.getElementById('auth-submit'),
    writePanel: document.getElementById('write-panel'),
    writePanelClose: document.getElementById('write-panel-close'),
    postContent: document.getElementById('post-content'),
    postTag: document.getElementById('post-tag'),
    postSubmit: document.getElementById('post-submit'),
    suggestPanel: document.getElementById('suggest-panel'),
    suggestPanelClose: document.getElementById('suggest-panel-close'),
    suggestContent: document.getElementById('suggest-content'),
    suggestSubmit: document.getElementById('suggest-submit'),
    randomWordButton: document.getElementById('random-word'),
    inboxPanel: document.getElementById('inbox-panel'),
    inboxContainer: document.getElementById('inbox-container'),
    inboxEmpty: document.getElementById('inbox-empty'),
    postsContainer: document.getElementById('posts-container'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('empty-state'),
    playlistSection: document.getElementById('playlist-section'),
    playlistContainer: document.getElementById('playlist-container'),
    playlistUrlInput: document.getElementById('playlist-url-input'),
    playlistSaveButton: document.getElementById('playlist-save'),
    playlistVolumeToggle: document.getElementById('playlist-volume-toggle'),
    playlistVolumeIcon: document.getElementById('playlist-volume-icon'),
    playlistSkipBackward: document.getElementById('playlist-skip-backward'),
    playlistSkipForward: document.getElementById('playlist-skip-forward'),
    playlistSticker: document.querySelector('.playlist-sticker'),
    tabsNav: document.getElementById('tabs-nav'),
    tabFeed: document.getElementById('tab-feed'),
    tabSuggestions: document.getElementById('tab-suggestions'),
    tabAdmin: document.getElementById('tab-admin'),
    letterboxdUrlInput: document.getElementById('letterboxd-url-input'),
    letterboxdFetch: document.getElementById('letterboxd-fetch'),
    letterboxdReviewsContainer: document.getElementById('letterboxd-reviews-container'),
    letterboxdReviewsList: document.getElementById('letterboxd-reviews-list'),
    letterboxdSaveSelection: document.getElementById('letterboxd-save-selection'),
    letterboxdToggleAll: document.getElementById('letterboxd-toggle-all'),
    fullscreenOverlay: document.getElementById('fullscreen-overlay'),
    appStatusInfo: document.getElementById('app-status-info'),
    appStatusText: document.getElementById('app-status-text'),
    appStatusClose: document.getElementById('app-status-close')
};

// ============================================
// Supabase Data Functions
// ============================================

async function fetchData() {
    if (!supabaseClient) {
        console.error('Cannot fetch data: supabase is not initialized');
        updateAppStatus('error: cannot fetch data - supabase not initialized', 'error');
        return { posts: [], suggestions: [] };
    }
    
    try {
        // Fetch posts (public read)
        const { data: postsData, error: postsError } = await supabaseClient
            .from('posts')
            .select('*')
            .order('timestamp', { ascending: false });

        // Fetch suggestions (public read)
        const { data: suggestionsData, error: suggestionsError } = await supabaseClient
            .from('suggestions')
            .select('*')
            .order('timestamp', { ascending: false });

        // Fetch selected Letterboxd reviews
        // Get current username from settings to filter reviews
        const letterboxdSettings = await fetchLetterboxdSettings();
        let usernameFilter = null;
        if (letterboxdSettings.url) {
            const usernameMatch = letterboxdSettings.url.match(/letterboxd\.com\/([^\/\?]+)/);
            if (usernameMatch) {
                usernameFilter = usernameMatch[1].replace(/\/$/, '');
            }
        }
        
        let reviewsQuery = supabaseClient
            .from('letterboxd_reviews')
            .select('*')
            .eq('is_selected', true);
        
        if (usernameFilter) {
            reviewsQuery = reviewsQuery.eq('letterboxd_username', usernameFilter);
        }
        
        const { data: reviewsData, error: reviewsError } = await reviewsQuery
            .order('review_timestamp', { ascending: false });

        if (postsError) console.error('Error fetching posts:', postsError);
        if (suggestionsError) console.error('Error fetching suggestions:', suggestionsError);
        if (reviewsError) console.error('Error fetching reviews:', reviewsError);

        // Combine posts and selected reviews, sort by timestamp
        const allPosts = [
            ...(postsData || []).map(p => ({ ...p, type: 'post' })),
            ...(reviewsData || []).map(r => ({
                id: `review-${r.id}`,
                content: formatReviewContent(r),
                timestamp: r.review_timestamp,
                likes: 0,
                tag: 'letterboxd',
                type: 'review',
                review_data: r
            }))
        ].sort((a, b) => b.timestamp - a.timestamp);

        return {
            posts: allPosts,
            suggestions: suggestionsData || []
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        return { posts: [], suggestions: [] };
    }
}

function formatReviewContent(review) {
    let content = review.film_title;
    if (review.film_year) {
        content += ` (${review.film_year})`;
    }
    // Rating is now displayed in the footer, not in the content
    if (review.review_text) {
        let reviewText = review.review_text;
        
        // Remove date patterns from review text (safety check for existing data)
        // Remove "[day] [month] [date], [year]." patterns (like "Wednesday December 10, 2025.")
        reviewText = reviewText.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+[a-z]+\s+\d{1,2},?\s+\d{4}\.?/gi, '').trim();
        
        // Remove "[month] [date], [year]" patterns
        reviewText = reviewText.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\.?/gi, '').trim();
        
        // Remove "Watched on [date]" patterns
        reviewText = reviewText.replace(/\b(watched\s+on|on)\s+[a-z]+\s+[a-z]+\s+\d{1,2},?\s+\d{4}\.?/gi, '').trim();
        reviewText = reviewText.replace(/\bwatched\s+on\s+\d{1,2}\/\d{1,2}\/\d{4}\.?/gi, '').trim();
        reviewText = reviewText.replace(/\bwatched\s+on\s+\d{1,2}\.\d{1,2}\.\d{4}\.?/gi, '').trim();
        
        // Remove standalone date patterns
        reviewText = reviewText.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '').trim();
        reviewText = reviewText.replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g, '').trim();
        reviewText = reviewText.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '').trim();
        
        // Clean up any double spaces, leading/trailing punctuation
        reviewText = reviewText.replace(/\s+/g, ' ').trim();
        reviewText = reviewText.replace(/^[\.\-\s,;:]+|[\.\-\s,;:]+$/g, '').trim();
        
        if (reviewText) {
            content += `\n\n${reviewText}`;
        }
    }
    return content;
}

async function fetchLetterboxdSettings() {
    try {
        const { data, error } = await supabaseClient
            .from('letterboxd_settings')
            .select('letterboxd_url')
            .eq('id', 1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return { url: null };
            }
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                console.error('Letterboxd settings table does not exist. Please run the SQL migration from supabase-schema.sql');
                return { url: null };
            }
            throw error;
        }
        
        return {
            url: data?.letterboxd_url || null
        };
    } catch (error) {
        console.error('Error fetching letterboxd settings:', error);
        return { url: null };
    }
}

async function saveLetterboxdUrl(url) {
    if (!isAuthenticated) {
        alert('You must be signed in to save letterboxd url.');
        return false;
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        const { error } = await supabaseClient
            .from('letterboxd_settings')
            .upsert({
                id: 1,
                letterboxd_url: url || null,
                updated_at: new Date().toISOString(),
                updated_by: user?.id || null
            });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error saving letterboxd URL:', error);
        alert('Failed to save letterboxd URL: ' + error.message);
        return false;
    }
}

// Helper function to parse Letterboxd dates in various formats
// Returns a date normalized to local timezone to avoid day shifts
function parseLetterboxdDate(dateString) {
    if (!dateString) return null;
    
    let date = null;
    let year, month, day;
    
    // Try ISO format (YYYY-MM-DD) - most reliable for date-only values
    const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        year = parseInt(isoMatch[1], 10);
        month = parseInt(isoMatch[2], 10) - 1; // JavaScript months are 0-indexed
        day = parseInt(isoMatch[3], 10);
        // Create date in local timezone to avoid day shifts
        date = new Date(year, month, day, 12, 0, 0); // Use noon to avoid timezone edge cases
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    
    // Try RFC 822 format (common in RSS feeds)
    // "Wed, 10 Dec 2025 00:00:00 +0000" or "Wed, 10 Dec 2025"
    const rfcMatch = dateString.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
    if (rfcMatch) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthName = rfcMatch[2].toLowerCase().substring(0, 3);
        const monthIndex = monthNames.indexOf(monthName);
        if (monthIndex !== -1) {
            year = parseInt(rfcMatch[3], 10);
            month = monthIndex;
            day = parseInt(rfcMatch[1], 10);
            // Create date in local timezone
            date = new Date(year, month, day, 12, 0, 0);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }
    
    // Fallback: try standard Date parsing
    date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        // If we got a valid date, extract the date components and recreate in local timezone
        // This prevents timezone shifts
        year = date.getUTCFullYear();
        month = date.getUTCMonth();
        day = date.getUTCDate();
        // Recreate in local timezone at noon
        return new Date(year, month, day, 12, 0, 0);
    }
    
    return null;
}

async function fetchLetterboxdReviews(url) {
    if (!url) return { reviews: [], username: null };

    try {
        // Extract username from URL
        // Handle various formats: letterboxd.com/username, letterboxd.com/username/, etc.
        let usernameMatch = url.match(/letterboxd\.com\/([^\/\?]+)/);
        if (!usernameMatch) {
            throw new Error('Invalid Letterboxd URL format. Please use: https://letterboxd.com/username/');
        }
        let username = usernameMatch[1];
        
        // Remove trailing slash if present
        username = username.replace(/\/$/, '');

        // Fetch RSS feed
        const rssUrl = `https://letterboxd.com/${username}/rss/`;
        
        // Use a CORS proxy to fetch the RSS feed
        // Try multiple proxies as fallbacks
        let data = null;
        let error = null;
        
        // First, try direct fetch (might work in some browsers/environments)
        // Note: This will likely fail due to CORS, but we try it first
        try {
            const directResponse = await fetch(rssUrl, {
                mode: 'cors',
                headers: {
                    'Accept': 'application/rss+xml, application/xml, text/xml'
                }
            });
            
            if (directResponse.ok) {
                const text = await directResponse.text();
                const trimmed = text.trim();
                if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rss') || trimmed.startsWith('<feed')) {
                    data = text;
                }
            }
        } catch (directError) {
            // Direct fetch failed (expected due to CORS), will try proxies
            // Silently ignore CORS errors - they're expected
            if (!directError.message || !directError.message.includes('CORS')) {
                console.log('Direct fetch failed (expected):', directError.message);
            }
        }
        
        // If direct fetch didn't work, try proxies
        if (!data) {
            try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.contents) {
                let contents = result.contents;
                
                // Check if the response is base64-encoded (data URI format)
                if (contents.startsWith('data:application/rss+xml') || contents.startsWith('data:text/xml')) {
                    // Extract base64 data from data URI
                    const base64Match = contents.match(/base64,(.+)/);
                    if (base64Match) {
                        try {
                            contents = atob(base64Match[1]);
                        } catch (e) {
                            console.error('Failed to decode base64 data:', e);
                            throw new Error('Failed to decode base64-encoded response');
                        }
                    }
                }
                
                // Check if it's actually XML (RSS feeds start with <?xml or <rss)
                const trimmed = contents.trim();
                if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rss') || trimmed.startsWith('<feed')) {
                    data = contents;
                } else if (trimmed.toLowerCase().includes('<html')) {
                    console.error('Received HTML instead of XML (likely an error page):', trimmed.substring(0, 300));
                    throw new Error('Received HTML error page instead of RSS feed. The user may not exist or have no reviews.');
                } else {
                    console.error('Response is not XML:', trimmed.substring(0, 200));
                    throw new Error('Response is not valid XML');
                }
            } else {
                throw new Error('No contents in response');
            }
        } catch (e) {
            // Try fallback proxy
            try {
                const fallbackUrl = `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`;
                const response = await fetch(fallbackUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const text = await response.text();
                
                const trimmed = text.trim();
                if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rss') || trimmed.startsWith('<feed')) {
                    data = text;
                } else if (trimmed.toLowerCase().includes('<html')) {
                    console.error('Fallback received HTML instead of XML:', trimmed.substring(0, 300));
                    throw new Error('Received HTML error page. The user may not exist or have no reviews.');
                } else {
                    console.error('Fallback response is not XML:', trimmed.substring(0, 200));
                    throw new Error('Response is not valid XML');
                }
            } catch (e2) {
                console.error('Both proxies failed:', e2);
                // Try one more proxy
                try {
                    const proxyUrl2 = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`;
                    const response = await fetch(proxyUrl2);
                    const text = await response.text();
                    
                    const trimmed = text.trim();
                    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rss') || trimmed.startsWith('<feed')) {
                        data = text;
                    } else {
                        console.error('Third proxy response:', trimmed.substring(0, 200));
                        throw new Error('Third proxy also failed');
                    }
                } catch (e3) {
                    console.error('All three proxies failed');
                    error = new Error('Failed to fetch RSS feed. This could be because:\n\n1. The username doesn\'t exist\n2. The user has no reviews\n3. The RSS feed is private\n4. CORS proxies are being blocked\n\nPlease verify the Letterboxd URL and try again.');
                    throw error;
                }
            }
        }
        } // Close the if (!data) block
        
        if (!data) {
            throw new Error('Failed to fetch RSS feed from all sources');
        }

        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data, 'text/xml');
        
        // Check for parsing errors
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            console.error('XML parsing error:', parseError.textContent);
            console.error('Data received (first 500 chars):', data.substring(0, 500));
            throw new Error('Failed to parse RSS feed. The feed may be invalid or the user may not have any reviews.');
        }
        
        const items = xmlDoc.querySelectorAll('item');
        
        if (items.length === 0) {
            return { reviews: [], username: username };
        }
        
        const reviews = [];

        items.forEach((item, index) => {
            const link = item.querySelector('link')?.textContent || '';
            const description = item.querySelector('description')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';
            
            // Letterboxd RSS uses namespaced elements for film data
            // The namespace is typically "https://letterboxd.com"
            let filmTitle = '';
            let filmYear = null;
            let rating = null;
            let watchedDate = null;
            
            // Try to get from namespaced elements using getElementsByTagNameNS
            try {
                const letterboxdNS = 'https://letterboxd.com';
                const filmTitleEl = item.getElementsByTagNameNS(letterboxdNS, 'filmTitle')[0];
                const filmYearEl = item.getElementsByTagNameNS(letterboxdNS, 'filmYear')[0];
                const ratingEl = item.getElementsByTagNameNS(letterboxdNS, 'memberRating')[0];
                const watchedDateEl = item.getElementsByTagNameNS(letterboxdNS, 'watchedDate')[0];
                
                if (filmTitleEl) {
                    filmTitle = filmTitleEl.textContent?.trim() || '';
                }
                if (filmYearEl) {
                    filmYear = filmYearEl.textContent?.trim() || null;
                }
                if (ratingEl) {
                    rating = ratingEl.textContent?.trim() || null;
                    // Convert numeric rating (1-5) to stars if needed
                    if (rating && /^\d+$/.test(rating)) {
                        const numRating = parseInt(rating, 10);
                        if (numRating >= 1 && numRating <= 5) {
                            rating = '★'.repeat(numRating) + '☆'.repeat(5 - numRating);
                        }
                    }
                }
                if (watchedDateEl) {
                    watchedDate = watchedDateEl.textContent?.trim() || null;
                } else {
                    // Also try without namespace (some feeds might not use it)
                    const watchedDateAlt = item.querySelector('watchedDate');
                    if (watchedDateAlt) {
                        watchedDate = watchedDateAlt.textContent?.trim() || null;
                    }
                }
            } catch (e) {
                // Namespace lookup failed, will fall back to title parsing
            }
            
            // If we didn't get film title from namespaced element, parse from title
            if (!filmTitle) {
                const title = item.querySelector('title')?.textContent || '';
                
                // Title might be "Username watched Film Title (Year) ★★★★☆" or just "Film Title (Year)"
                // Try to extract just the film title part
                let titleMatch = title.match(/watched\s+(.+?)\s*\((\d{4})\)/i);
                if (titleMatch) {
                    filmTitle = titleMatch[1].trim();
                    if (!filmYear) filmYear = titleMatch[2];
                    } else {
                        // Fallback: try standard format "Film Title (Year) ★★★★☆"
                        titleMatch = title.match(/^(.+?)\s*\((\d{4})\)\s*(.*)$/);
                        if (titleMatch) {
                            filmTitle = titleMatch[1].trim();
                            if (!filmYear) filmYear = titleMatch[2];
                            const ratingPart = titleMatch[3].trim();
                            if (ratingPart && !rating) {
                                // Check if it contains stars or is a numeric rating
                                if (ratingPart.includes('★') || ratingPart.includes('☆')) {
                                    rating = ratingPart;
                                } else if (/^\d+$/.test(ratingPart)) {
                                    // Convert numeric rating to stars
                                    const numRating = parseInt(ratingPart, 10);
                                    if (numRating >= 1 && numRating <= 5) {
                                        rating = '★'.repeat(numRating) + '☆'.repeat(5 - numRating);
                                    }
                                } else {
                                    rating = ratingPart;
                                }
                            }
                        } else {
                        // Last resort: use the whole title, but try to clean it
                        // Remove "watched" prefix if present
                        filmTitle = title.replace(/^.*?watched\s+/i, '').trim();
                        if (!filmTitle) {
                            filmTitle = title.trim();
                        }
                    }
                }
            }
            
            // Clean up film title (remove any extra text that might have slipped through)
            filmTitle = filmTitle.trim();
            
            // Remove common prefixes that might appear
            filmTitle = filmTitle.replace(/^(watched|reviewed|rated)\s+/i, '').trim();
            
            // Parse description to get review text (if any)
            // Description is HTML, extract text content
            let reviewText = '';
            if (description) {
                try {
                    const descDoc = parser.parseFromString(description, 'text/html');
                    reviewText = descDoc.body?.textContent?.trim() || '';
                } catch (e) {
                    // If parsing fails, try to extract plain text
                    reviewText = description.replace(/<[^>]*>/g, '').trim();
                }
                
                // Remove all date patterns from review text
                // Dates should only appear in the post timestamp, not in the content
                
                // Remove "Watched on [day] [month] [date], [year]." patterns
                reviewText = reviewText.replace(/\b(watched\s+on|on)\s+[a-z]+\s+[a-z]+\s+\d{1,2},?\s+\d{4}\.?/gi, '').trim();
                
                // Remove "[day] [month] [date], [year]." patterns (like "Wednesday December 10, 2025.")
                // Make the regex more flexible to catch variations
                reviewText = reviewText.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+[a-z]+\s+\d{1,2},?\s+\d{4}\.?\s*/gi, '').trim();
                // Also catch without day of week
                reviewText = reviewText.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\.?\s*/gi, '').trim();
                
                // Remove "[month] [date], [year]" patterns
                reviewText = reviewText.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\.?/gi, '').trim();
                
                // Remove "Watched on [date]" with various date formats
                reviewText = reviewText.replace(/\bwatched\s+on\s+\d{1,2}\/\d{1,2}\/\d{4}\.?/gi, '').trim();
                reviewText = reviewText.replace(/\bwatched\s+on\s+\d{1,2}\.\d{1,2}\.\d{4}\.?/gi, '').trim();
                reviewText = reviewText.replace(/\bwatched\s+on\s+\d{4}-\d{2}-\d{2}\.?/gi, '').trim();
                
                // Remove standalone date patterns (MM/DD/YYYY, DD/MM/YYYY, etc.)
                reviewText = reviewText.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '').trim();
                reviewText = reviewText.replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g, '').trim();
                reviewText = reviewText.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '').trim();
                
                // Remove common prefixes
                reviewText = reviewText.replace(/^(watched\s+on|on|review:)\s*/i, '').trim();
                
                // Clean up any double spaces, leading/trailing punctuation, or empty sentences
                reviewText = reviewText.replace(/\s+/g, ' ').trim();
                reviewText = reviewText.replace(/^[\.\-\s,;:]+|[\.\-\s,;:]+$/g, '').trim();
                
                // Remove any remaining standalone periods or commas at the start
                reviewText = reviewText.replace(/^[\.\s,]+/, '').trim();
            }
            
            // Parse date - prefer watchedDate from Letterboxd namespace, fallback to pubDate
            let timestamp = Date.now();
            let dateToUse = null;
            let dateSource = 'none';
            
            // Use watchedDate if available (more accurate for diary entries)
            if (watchedDate) {
                // Try parsing watchedDate - it might be in ISO format (YYYY-MM-DD) or other formats
                dateToUse = parseLetterboxdDate(watchedDate);
                if (dateToUse && !isNaN(dateToUse.getTime())) {
                    dateSource = 'watchedDate';
                } else {
                    console.warn(`Failed to parse watchedDate: "${watchedDate}"`);
                }
            }
            
            // Fallback to pubDate if watchedDate wasn't available or couldn't be parsed
            if (!dateToUse || isNaN(dateToUse.getTime())) {
                if (pubDate) {
                    dateToUse = parseLetterboxdDate(pubDate);
                    if (dateToUse && !isNaN(dateToUse.getTime())) {
                        dateSource = 'pubDate';
                    } else {
                        console.warn(`Failed to parse pubDate: "${pubDate}"`);
                    }
                }
            }
            
            if (dateToUse && !isNaN(dateToUse.getTime())) {
                timestamp = dateToUse.getTime();
            }
            
            reviews.push({
                review_url: link,
                film_title: filmTitle,
                film_year: filmYear,
                review_text: reviewText,
                rating: rating || null,
                watched_date: null,
                review_timestamp: timestamp,
                letterboxd_username: username
            });
        });

        return { reviews, username };
    } catch (error) {
        console.error('Error fetching Letterboxd reviews:', error);
        
        // Log detailed error information for debugging
        const errorDetails = {
            message: error.message,
            url: url,
            timestamp: new Date().toISOString(),
            errorType: error.name || 'Unknown',
            stack: error.stack
        };
        
        console.error('Letterboxd fetch error details:', errorDetails);
        
        throw error;
    }
}

async function saveLetterboxdReviews(reviews, username) {
    if (!isAuthenticated) {
        return false;
    }

    try {
        // If username is provided, get existing reviews for this user to preserve is_selected status
        let existingReviews = [];
        if (username) {
            const { data } = await supabaseClient
                .from('letterboxd_reviews')
                .select('review_url, is_selected')
                .eq('letterboxd_username', username);
            existingReviews = data || [];
        } else {
            // Fallback: get all existing reviews (for backward compatibility)
            const { data } = await supabaseClient
                .from('letterboxd_reviews')
                .select('review_url, is_selected');
            existingReviews = data || [];
        }
        
        const existingMap = new Map();
        existingReviews.forEach(r => {
            existingMap.set(r.review_url, r.is_selected);
        });
        
        // Preserve is_selected for existing reviews
        const reviewsToSave = reviews.map(review => ({
            ...review,
            is_selected: existingMap.has(review.review_url) 
                ? existingMap.get(review.review_url) 
                : false
        }));
        
        // If username is provided, delete old reviews from different users first
        if (username) {
            const { error: deleteError } = await supabaseClient
                .from('letterboxd_reviews')
                .delete()
                .neq('letterboxd_username', username);
            
            if (deleteError) {
                console.error('Error deleting old reviews:', deleteError);
                // Don't throw - continue with saving new reviews
            }
        }
        
        // Upsert reviews (insert or update if review_url exists)
        const { error } = await supabaseClient
            .from('letterboxd_reviews')
            .upsert(reviewsToSave, {
                onConflict: 'review_url',
                ignoreDuplicates: false
            });

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        return true;
    } catch (error) {
        console.error('Error saving reviews:', error);
        throw error;
    }
}

async function loadLetterboxdReviews(username) {
    try {
        let query = supabaseClient
            .from('letterboxd_reviews')
            .select('*');
        
        // Filter by username if provided
        if (username) {
            query = query.eq('letterboxd_username', username);
        }
        
        const { data, error } = await query
            .order('review_timestamp', { ascending: false });

        if (error) {
            console.error('Error loading reviews:', error);
            throw error;
        }
        
        return data || [];
    } catch (error) {
        console.error('Error loading reviews:', error);
        return [];
    }
}

async function updateReviewSelection(reviewId, isSelected) {
    if (!isAuthenticated) {
        return false;
    }

    try {
        const { error } = await supabaseClient
            .from('letterboxd_reviews')
            .update({ is_selected: isSelected })
            .eq('id', reviewId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating review selection:', error);
        return false;
    }
}

async function fetchPlaylistSettings() {
    try {
        const { data, error } = await supabaseClient
            .from('playlist_settings')
            .select('playlist_url, playlist_type')
            .eq('id', 1)
            .single();

        if (error) {
            // PGRST116 = no rows (table might not exist or no data)
            if (error.code === 'PGRST116') {
                return { url: null, type: 'youtube' };
            }
            // 42P01 = relation does not exist (table not created)
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                console.error('Playlist settings table does not exist. Please run the SQL migration from supabase-schema.sql');
                return { url: null, type: 'youtube' };
            }
            throw error;
        }
        
        return {
            url: data?.playlist_url || null,
            type: data?.playlist_type || 'youtube'
        };
    } catch (error) {
        console.error('Error fetching playlist settings:', error);
        return { url: null, type: 'youtube' };
    }
}

async function savePlaylistUrl(url, type) {
    if (!isAuthenticated) {
        alert('You must be signed in to save playlist.');
        return false;
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        const { error } = await supabaseClient
            .from('playlist_settings')
            .upsert({
                id: 1,
                playlist_url: url || null,
                playlist_type: type || 'youtube',
                updated_at: new Date().toISOString(),
                updated_by: user?.id || null
            });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error saving playlist URL:', error);
        alert('Failed to save playlist: ' + error.message);
        return false;
    }
}

function renderPlaylist(url, type) {
    if (!elements.playlistSection || !elements.playlistContainer) {
        console.error('Playlist elements not found');
        return;
    }
    
    if (!url) {
        // Hide volume toggle when no playlist is set
        if (elements.playlistVolumeToggle) {
            elements.playlistVolumeToggle.style.display = 'none';
        }
        elements.playlistContainer.innerHTML = '';
        // Clean up SoundCloud filtering if switching away (disabled for now)
        // if (playlistType === 'soundcloud') {
        //     cleanupSoundCloudFiltering();
        // }
        return;
    }

    // Clean up SoundCloud filtering if switching to a different playlist type (disabled for now)
    // if (playlistType === 'soundcloud' && type !== 'soundcloud') {
    //     cleanupSoundCloudFiltering();
    // }

    // Show volume toggle when playlist exists
    elements.playlistSection.classList.remove('hidden');
    
    if (elements.playlistVolumeToggle) {
        elements.playlistVolumeToggle.style.display = 'block';
        elements.playlistVolumeToggle.style.visibility = 'visible';
    }
    
    // Initially hide skip buttons (they'll show when unmuted)
    if (elements.playlistSkipBackward && elements.playlistSkipForward) {
        elements.playlistSkipBackward.classList.add('hidden');
        elements.playlistSkipForward.classList.add('hidden');
    }
    
    let embedHtml = '';
    
    switch (type) {
        case 'youtube':
            embedHtml = renderYouTubeEmbed(url);
            break;
        case 'apple':
            embedHtml = renderAppleMusicEmbed(url);
            break;
        case 'spotify':
            embedHtml = renderSpotifyEmbed(url);
            break;
        case 'soundcloud':
            embedHtml = renderSoundCloudEmbed(url);
            break;
        default:
            embedHtml = '<p class="playlist-error">unsupported playlist type</p>';
    }
    
    elements.playlistContainer.innerHTML = embedHtml;
    
    // Update volume state for all playlist types
    updateVolumeState();
    
    if (type === 'apple') {
        // Apple Music embeds require user interaction to start playback
        // due to browser autoplay policies. The iframe is loaded but won't autoplay.
        // User needs to click the play button inside the iframe to start playback.
        console.log('Apple Music embed loaded. Click the play button in the player to start playback.');
        
        // Move the iframe from the hidden container to the body so it's visible
        setTimeout(() => {
            const appleMusicIframe = document.getElementById('apple-music-player');
            if (appleMusicIframe) {
                document.body.appendChild(appleMusicIframe);
                console.log('Moved Apple Music iframe to body');
            } else {
                console.error('Apple Music iframe not found');
            }
        }, 100);
        
        // For non-YouTube playlists, update volume state immediately
        updateVolumeState();
    } else if (type === 'spotify') {
        // Spotify embeds - move to body so they're visible
        console.log('Spotify embed loaded. Click play in the player to start.');
        setTimeout(() => {
            const spotifyIframe = document.getElementById('spotify-player');
            if (spotifyIframe) {
                document.body.appendChild(spotifyIframe);
                console.log('Moved Spotify iframe to body');
            } else {
                console.error('Spotify iframe not found');
            }
        }, 100);
        updateVolumeState();
    } else if (type === 'soundcloud') {
        // Set up SoundCloud preview track filtering (disabled for now)
        // setupSoundCloudFiltering();
        updateVolumeState();
    } else {
        // For other non-YouTube playlists, update volume state immediately
        updateVolumeState();
    }
    
}

function renderYouTubeEmbed(url) {
    // YouTube URL formats:
    // - Playlist: https://www.youtube.com/playlist?list=PLxxxxx
    // - Video: https://www.youtube.com/watch?v=xxxxx
    // - Short: https://youtu.be/xxxxx
    
    let playlistId = null;
    let videoId = null;
    
    // Clean the URL - remove any extra whitespace
    url = url.trim();
    
    // Check for playlist ID (can be in various formats)
    const playlistMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (playlistMatch) {
        playlistId = playlistMatch[1];
    }
    
    // Check for video ID in various formats
    // Format 1: youtube.com/watch?v=VIDEO_ID
    let videoMatch = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/);
    if (videoMatch) {
        videoId = videoMatch[1];
    }
    
    // Format 2: youtu.be/VIDEO_ID
    if (!videoId) {
        videoMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (videoMatch) {
            videoId = videoMatch[1];
        }
    }
    
    // Format 3: youtube.com/embed/VIDEO_ID
    if (!videoId) {
        videoMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
        if (videoMatch) {
            videoId = videoMatch[1];
        }
    }
    
    // Format 4: youtube.com/v/VIDEO_ID
    if (!videoId) {
        videoMatch = url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
        if (videoMatch) {
            videoId = videoMatch[1];
        }
    }
    
    if (!playlistId && !videoId) {
        console.error('Could not parse YouTube URL:', url);
        return '<p class="playlist-error">invalid youtube url format</p>';
    }
    
        // Use youtube-nocookie.com which is YouTube's privacy-friendly embed domain
        const domain = 'www.youtube-nocookie.com';
        let embedUrl = '';
        
        if (playlistId) {
        // Use videoseries format for playlists
        embedUrl = `https://${domain}/embed/videoseries?list=${playlistId}`;
        } else if (videoId) {
            // Single video embed
            embedUrl = `https://${domain}/embed/${videoId}`;
        }
        
        // Build query parameters
        // IMPORTANT: mute=1 is REQUIRED for autoplay to work in modern browsers
        const params = new URLSearchParams({
            autoplay: '1',
            controls: '1',
            modestbranding: '1',
            rel: '0',
            mute: '1', // Always start muted - required for autoplay
            playsinline: '1',
            enablejsapi: '1' // Required for postMessage commands to work
        });
        
        // Add params to URL (handle existing query string)
        const separator = embedUrl.includes('?') ? '&' : '?';
        embedUrl += separator + params.toString();
        
        return `
            <iframe 
                id="youtube-player"
                src="${embedUrl}"
                frameborder="0"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                referrerpolicy="no-referrer-when-downgrade"
                style="width: 100%; height: 100%; position: fixed; top: 0; left: 0; z-index: 9998;">
            </iframe>
        `;
    }
    
// Removed dead YouTube API functions - using simple iframe only

/* Dead YouTube API code removed - was using YT.Player API which we no longer use
function setupYouTubePlayer(videoId, playlistId) {
    
    // Wait for the div element to be in DOM
    setTimeout(() => {
        const playerDiv = document.getElementById('youtube-player');
        if (!playerDiv) {
            console.error('YouTube player div not found');
            return;
        }
        
        if (!window.YT || !window.YT.Player) {
            console.error('YouTube API not loaded yet');
            // Try again in a bit, but fallback to iframe after 3 attempts
            const retryCount = setupYouTubePlayer.retryCount || 0;
            setupYouTubePlayer.retryCount = retryCount + 1;
            if (retryCount < 3) {
                setTimeout(() => setupYouTubePlayer(videoId, playlistId), 1000);
            } else {
                console.log('API failed to load, using simple iframe fallback');
                createSimpleYouTubeIframe(videoId, playlistId);
            }
            return;
        }
        
        // Reset retry count on success
        setupYouTubePlayer.retryCount = 0;
        
        try {
            const playerVars = {
                autoplay: 1,
                controls: 0, // Hide controls
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                mute: 1, // Always start muted (browsers block autoplay with sound)
                enablejsapi: 1,
                playsinline: 1,
                iv_load_policy: 3
            };
            
            // Handle playlist
            if (playlistId) {
                if (videoId) {
                    // Start with specific video, then continue with playlist
                    playerVars.list = playlistId;
                    
                    // Track errors to skip non-embeddable videos
                    let errorCount = 0;
                    const maxErrors = 10;
                    
                    youtubePlayer = new YT.Player('youtube-player', {
                        videoId: videoId,
                        playerVars: playerVars,
                        events: {
                            onReady: (event) => {
                                playerReady = true;
                                try {
                                    // Start muted to allow autoplay
                                    event.target.mute();
                                    event.target.playVideo();
                                    updateVolumeState();
                                } catch (e) {
                                    console.error('Error starting playback:', e);
                                }
                            },
                            onStateChange: (event) => {
                                // Auto-play next video when current ends
                                if (event.data === YT.PlayerState.ENDED) {
                                    event.target.nextVideo();
                                }
                            },
                            onError: (event) => {
                                // Error 150 or 101 means video not embeddable - try next video
                                if ((event.data === 150 || event.data === 101) && errorCount < maxErrors) {
                                    errorCount++;
                                    console.warn('Video not embeddable, trying next video... (attempt ' + errorCount + ')');
                                    // Use global player reference
                                    try {
                                        if (youtubePlayer && typeof youtubePlayer.nextVideo === 'function') {
                                            youtubePlayer.nextVideo();
                                        }
                                    } catch (e) {
                                        console.error('Could not skip to next video:', e);
                                    }
                                } else if (event.data !== 150 && event.data !== 101) {
                                    // Only show error for non-embedding issues
                                    console.error('YouTube player error:', event.data);
                                    handleYouTubeError(event.data);
                                }
                            }
                        }
                    });
                } else {
                    // Pure playlist URL - use standard approach with listType
                    playerVars.listType = 'playlist';
                    playerVars.list = playlistId;
                    // Start at index 0 - YouTube will auto-skip unavailable videos
                    playerVars.index = 0;
                    
                    // Track current index and errors to skip non-embeddable videos
                    let currentIndex = 0;
                    let errorCount = 0;
                    let isReloading = false; // Flag to prevent multiple simultaneous reloads
                    const maxErrors = 20; // Don't try more than 20 times
                    
                    youtubePlayer = new YT.Player('youtube-player', {
                        playerVars: playerVars,
                        events: {
                            onReady: (event) => {
                                playerReady = true;
                                console.log('YouTube player ready, starting at index: 0');
                                
                                // Start playback immediately - if it fails, error handler will reload with next index
                                setTimeout(() => {
                                try {
                                    event.target.mute();
                                    event.target.playVideo();
                                    updateVolumeState();
                                } catch (e) {
                                    console.error('Error starting playlist:', e);
                                }
                                }, 500);
                            },
                            onStateChange: (event) => {
                                // Track current index when playing
                                if (event.data === YT.PlayerState.PLAYING) {
                                    try {
                                        const newIndex = event.target.getPlaylistIndex();
                                        if (newIndex !== -1) {
                                            currentIndex = newIndex;
                                        console.log('Now playing index:', currentIndex);
                                        }
                                    } catch (e) {
                                        // Ignore
                                    }
                                }
                                // Auto-play next video when current ends
                                if (event.data === YT.PlayerState.ENDED) {
                                    event.target.nextVideo();
                                }
                            },
                            onError: (event) => {
                                // Error 150 or 101 means video not embeddable - try next video
                                if ((event.data === 150 || event.data === 101) && errorCount < maxErrors) {
                                    errorCount++;
                                    console.warn('Video not embeddable, trying next video... (attempt ' + errorCount + ')');
                                    
                                    // Helper function to reload player with a specific index
                                    const reloadPlayerWithIndex = (targetIndex) => {
                                        if (targetIndex >= 5) {
                                            // After 5 failed attempts with API, switch to iframe-nocookie strategy
                                            console.log('API approach failing after 5 attempts, switching to iframe-nocookie');
                                            isReloading = false;
                                            
                                            // Switch strategy to iframe-nocookie
                                            youtubeEmbedStrategy = 'iframe-nocookie';
                                            
                                            // Destroy API player
                                            try {
                                                if (youtubePlayer && typeof youtubePlayer.destroy === 'function') {
                                                    youtubePlayer.destroy();
                                                }
                                            } catch (e) {
                                                // Ignore
                                            }
                                            youtubePlayer = null;
                                            playerReady = false;
                                            
                                            // Clear and recreate with iframe
                                            const playerDiv = document.getElementById('youtube-player');
                                            if (playerDiv) {
                                                playerDiv.innerHTML = '';
                                            }
                                            
                                            // Re-render with iframe strategy
                                            setTimeout(() => {
                                                renderPlaylist(playlistUrl, playlistType);
                                            }, 500);
                                            return;
                                        }
                                        
                                        if (targetIndex >= 20) {
                                            // After 20 failed attempts total, try proxy as last resort
                                            console.log('Iframe-nocookie also failing, trying iframe-only mode as last resort');
                                            isReloading = false;
                                            
                                            // Switch to proxy
                                            useYouTubeProxy = true;
                                            youtubeEmbedStrategy = 'proxy';
                                            
                                            // Destroy any existing player
                                            try {
                                                if (youtubePlayer && typeof youtubePlayer.destroy === 'function') {
                                                    youtubePlayer.destroy();
                                                }
                                            } catch (e) {
                                                // Ignore
                                            }
                                            youtubePlayer = null;
                                            playerReady = false;
                                            
                                            // Clear and recreate with proxy
                                            const playerDiv = document.getElementById('youtube-player');
                                            if (playerDiv) {
                                                playerDiv.innerHTML = '';
                                            }
                                            
                                            // Re-render with proxy
                                            setTimeout(() => {
                                                renderPlaylist(playlistUrl, playlistType);
                                            }, 500);
                                            return;
                                        }
                                        
                                        // Final fallback - show error
                                        if (targetIndex >= 50) {
                                                console.error('Too many failed attempts, giving up');
                                                if (elements.playlistContainer) {
                                                    elements.playlistContainer.innerHTML = `
                                                        <div class="playlist-error-message">
                                                            <p>Unable to play this playlist</p>
                                                            <p style="font-size: 0.7rem; margin-top: 0.5rem; opacity: 0.7;">
                                                                Too many videos in this playlist have embedding disabled. Even if a playlist shows an "Embed" option in YouTube, individual videos may have embedding disabled by their creators. This is a YouTube limitation.
                                                            </p>
                                                            <p style="font-size: 0.7rem; margin-top: 0.5rem; opacity: 0.7;">
                                                                Try a different playlist or check that the videos allow embedding.
                                                            </p>
                                                        </div>
                                                    `;
                                                } else {
                                                    handleYouTubeError(150);
                                                }
                                                return;
                                            }
                                        
                                        // Prevent multiple simultaneous reloads
                                        if (isReloading) {
                                            console.log('Already reloading, skipping...');
                                            return;
                                        }
                                        
                                        isReloading = true;
                                        console.log('Reloading player starting at index ' + targetIndex);
                                        
                                        try {
                                            if (youtubePlayer && typeof youtubePlayer.destroy === 'function') {
                                                youtubePlayer.destroy();
                                            }
                                            
                                            // Clear the player div
                                            const playerDiv = document.getElementById('youtube-player');
                                            if (playerDiv) {
                                                playerDiv.innerHTML = '';
                                            }
                                            
                                            // Wait a moment, then recreate player with new index
                                            setTimeout(() => {
                                                // Update playerVars to start at target index
                                                playerVars.index = targetIndex;
                                                currentIndex = targetIndex;
                                                
                                                youtubePlayer = new YT.Player('youtube-player', {
                                                    playerVars: playerVars,
                                                    events: {
                                                        onReady: (event) => {
                                                            playerReady = true;
                                                            isReloading = false; // Reset flag when player is ready
                                                            console.log('YouTube player reloaded, starting at index: ' + targetIndex);
                                                            // Start playing immediately without waiting for playlist index
                                                            setTimeout(() => {
                                                                try {
                                                                    event.target.mute();
                                                                    event.target.playVideo();
                                                                    updateVolumeState();
                                                                } catch (e) {
                                                                    console.error('Error starting playlist:', e);
                                                                }
                                                            }, 500);
                                                        },
                                                        onStateChange: (event) => {
                                                            if (event.data === YT.PlayerState.PLAYING) {
                                                                try {
                                                                    const newIndex = event.target.getPlaylistIndex();
                                                                    if (newIndex !== -1) {
                                                                        currentIndex = newIndex;
                                                                        console.log('Now playing index:', currentIndex);
                                                                    }
                                                                } catch (e) {
                                                                    // Ignore
                                                                }
                                                            }
                                                            if (event.data === YT.PlayerState.ENDED) {
                                                                event.target.nextVideo();
                                                            }
                                                        },
                                                        onError: (event) => {
                                                            if ((event.data === 150 || event.data === 101) && errorCount < maxErrors) {
                                                                errorCount++;
                                                                console.warn('Video not embeddable at index ' + targetIndex + ', trying next... (attempt ' + errorCount + ')');
                                                                
                                                                // Wait longer before checking - give the player time to fully process the error
                                                                // and potentially auto-advance if YouTube handles it
                                                                setTimeout(() => {
                                                                    try {
                                                                        if (!youtubePlayer) {
                                                                            reloadPlayerWithIndex(targetIndex + 1);
                                                                            return;
                                                                        }
                                                                        
                                                                        // Check player state - if it's playing, YouTube might have auto-advanced
                                                                        let playerState = -1;
                                                                        try {
                                                                            playerState = youtubePlayer.getPlayerState();
                                                                        } catch (e) {
                                                                            // Player might not be ready
                                                                        }
                                                                        
                                                                        // If player is playing, don't reload - YouTube handled it
                                                                        if (playerState === YT.PlayerState.PLAYING) {
                                                                            console.log('Player is playing, YouTube auto-advanced');
                                                                            return;
                                                                        }
                                                                        
                                                                        // Check if playlist is initialized
                                                                        let playlistReady = false;
                                                                        try {
                                                                            const idx = youtubePlayer.getPlaylistIndex();
                                                                            if (idx !== -1) {
                                                                                playlistReady = true;
                                                                                console.log('Playlist ready at index:', idx);
                                                                            }
                                                                        } catch (e) {
                                                                            // Ignore
                                                                        }
                                                                        
                                                                        if (playlistReady && typeof youtubePlayer.nextVideo === 'function') {
                                                                            console.log('Playlist ready, using nextVideo()');
                                                                            youtubePlayer.nextVideo();
                                                                        } else {
                                                                            // Playlist not ready, reload with next index
                                                                            console.log('Playlist not ready, reloading with index ' + (targetIndex + 1));
                                                                            reloadPlayerWithIndex(targetIndex + 1);
                                                                        }
                                                                    } catch (e) {
                                                                        console.error('Could not skip to next video:', e);
                                                                        // Reload with next index as fallback
                                                                        reloadPlayerWithIndex(targetIndex + 1);
                                                                    }
                                                                }, 3000); // Wait 3 seconds before checking - give YouTube time to process
                                } else if (errorCount >= maxErrors) {
                                    console.error('Too many non-embeddable videos in playlist');
                                                                // Show a more helpful error message for playlists
                                                                if (elements.playlistContainer) {
                                                                    elements.playlistContainer.innerHTML = `
                                                                        <div class="playlist-error-message">
                                                                            <p>Unable to play this playlist</p>
                                                                            <p style="font-size: 0.7rem; margin-top: 0.5rem; opacity: 0.7;">
                                                                                Too many videos in this playlist have embedding disabled. Even if a playlist shows an "Embed" option in YouTube, individual videos may have embedding disabled by their creators. This is a YouTube limitation.
                                                                            </p>
                                                                            <p style="font-size: 0.7rem; margin-top: 0.5rem; opacity: 0.7;">
                                                                                Try a different playlist or check that the videos allow embedding.
                                                                            </p>
                                                                        </div>
                                                                    `;
                                                                } else {
                                    handleYouTubeError(event.data);
                                                                }
                                                            } else if (event.data !== 150 && event.data !== 101) {
                                                                console.error('YouTube playlist error:', event.data);
                                                                handleYouTubeError(event.data);
                                                            }
                                                        }
                                                    }
                                                });
                                            }, 500);
                                        } catch (e) {
                                            console.error('Could not reload player:', e);
                                        }
                                    };
                                    
                                    // If this is the first error and we're at index 0, the playlist might not be initialized
                                    // In this case, we need to reload the player starting at index 1
                                    if (errorCount === 1 && currentIndex === 0) {
                                        reloadPlayerWithIndex(1);
                                    } else {
                                        // Not the first error, or not at index 0 - try nextVideo directly
                                        setTimeout(() => {
                                            try {
                                                if (youtubePlayer) {
                                                    // Try nextVideo first (works even if playlist index isn't available)
                                                    if (typeof youtubePlayer.nextVideo === 'function') {
                                                        console.log('Trying nextVideo()');
                                                        youtubePlayer.nextVideo();
                                                    } else if (typeof youtubePlayer.playVideoAt === 'function') {
                                                        // Fallback to playVideoAt
                                                        const nextIdx = currentIndex + 1;
                                                        console.log('Trying playVideoAt(' + nextIdx + ')');
                                                        youtubePlayer.playVideoAt(nextIdx);
                                                    }
                                                }
                                            } catch (e) {
                                                console.error('Could not skip to next video:', e);
                                            }
                                        }, 1000);
                                    }
                                } else if (errorCount >= maxErrors) {
                                    console.error('Too many non-embeddable videos in playlist');
                                    // Show a more helpful error message for playlists
                                    if (elements.playlistContainer) {
                                        elements.playlistContainer.innerHTML = `
                                            <div class="playlist-error-message">
                                                <p>Unable to play this playlist</p>
                                                <p style="font-size: 0.7rem; margin-top: 0.5rem; opacity: 0.7;">
                                                    Too many videos in this playlist have embedding disabled. Even if a playlist shows an "Embed" option in YouTube, individual videos may have embedding disabled by their creators. This is a YouTube limitation.
                                                </p>
                                                <p style="font-size: 0.7rem; margin-top: 0.5rem; opacity: 0.7;">
                                                    Try a different playlist or check that the videos allow embedding.
                                                </p>
                                            </div>
                                        `;
                                    } else {
                                        handleYouTubeError(event.data);
                                    }
                                } else if (event.data !== 150 && event.data !== 101) {
                                    // Only show error for non-embedding issues
                                    console.error('YouTube playlist error:', event.data);
                                    handleYouTubeError(event.data);
                                }
                            }
                        }
                    });
                }
            } else if (videoId) {
                // Single video
                playerVars.loop = 1;
                youtubePlayer = new YT.Player('youtube-player', {
                    videoId: videoId,
                    playerVars: playerVars,
                    events: {
                        onReady: (event) => {
                                playerReady = true;
                                try {
                                    event.target.mute();
                                    event.target.playVideo();
                                    
                                    // Update volume state now that player is ready
                                    updateVolumeState();
                            } catch (e) {
                                console.error('Error starting video:', e);
                            }
                        },
                        onStateChange: (event) => {
                        },
                            onError: (event) => {
                                console.error('YouTube video error:', event.data);
                                handleYouTubeError(event.data);
                            }
                    }
                });
            }
        } catch (e) {
            console.error('YouTube API initialization failed:', e);
        }
    }, 500);
}
*/

function renderSpotifyEmbed(url) {
    // Spotify URL formats:
    // - Playlist: https://open.spotify.com/playlist/xxxxx
    // - Album: https://open.spotify.com/album/xxxxx
    // - Track: https://open.spotify.com/track/xxxxx
    
    const match = url.match(/spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
    if (!match) {
        return '<p class="playlist-error">invalid spotify url</p>';
    }
    
    const type = match[1];
    const id = match[2];
    
    // Spotify embed - make it visible and clickable
    // Spotify embeds work well and don't require subscription for free tier
    console.log('Spotify embed:', type, id);
    return `
        <iframe 
            id="spotify-player"
            style="position: fixed; bottom: 20px; right: 20px; width: 352px; height: 152px; border-radius: 12px; z-index: 9999; border: none; box-shadow: 0 8px 24px rgba(0,0,0,0.4);" 
            src="https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0" 
            frameborder="0" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="eager">
        </iframe>
    `;
}

function renderSoundCloudEmbed(url) {
    // SoundCloud URL: https://soundcloud.com/user/set/playlist-name
    // Hidden iframe for SoundCloud - supports play/pause via postMessage
    // Preview track filtering is disabled for now
    
    return `
        <iframe 
            id="soundcloud-player"
            width="0" 
            height="0" 
            scrolling="no" 
            frameborder="no" 
            allow="autoplay; encrypted-media" 
            src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff69b4&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false"
            style="display: none;">
        </iframe>
    `;
}

/* SoundCloud preview filtering - disabled for now
// Store SoundCloud filtering state for cleanup
let soundCloudFilteringState = null;
// Filter out preview-only tracks from SoundCloud playlists
// Preview tracks are typically 30 seconds and require Go+ subscription
function setupSoundCloudFiltering() {
    // Clean up any existing filtering first
    if (soundCloudFilteringState) {
        if (soundCloudFilteringState.messageHandler) {
            window.removeEventListener('message', soundCloudFilteringState.messageHandler);
        }
        if (soundCloudFilteringState.checkInterval) {
            clearInterval(soundCloudFilteringState.checkInterval);
        }
        if (soundCloudFilteringState.skipCheckTimeout) {
            clearTimeout(soundCloudFilteringState.skipCheckTimeout);
        }
    }
    
    const soundcloudIframe = document.getElementById('soundcloud-player');
    if (!soundcloudIframe) {
        // Retry after a short delay if iframe isn't ready yet
        setTimeout(setupSoundCloudFiltering, 500);
        return;
    }
    
    let currentTrackDuration = null;
    let trackStartTime = null;
    let skipCheckTimeout = null;
    let isCheckingTrack = false;
    let checkInterval = null;
    
    // Listen for messages from SoundCloud widget
    // The widget broadcasts events via postMessage with specific event types
    const messageHandler = (event) => {
        // Only accept messages from SoundCloud
        if (event.origin !== 'https://w.soundcloud.com') return;
        
        try {
            // SoundCloud widget sends events in different formats
            // Try to parse as JSON first
            let data;
            if (typeof event.data === 'string') {
                try {
                    data = JSON.parse(event.data);
                } catch (e) {
                    // Not JSON, might be a different format
                    return;
                }
            } else {
                data = event.data;
            }
            
            // Debug: log all SoundCloud events to see what we're getting
            if (data && (data.method || data.event || data.type)) {
                console.log('SoundCloud event:', data);
            }
            
            // SoundCloud widget events can come in different formats:
            // 1. Widget API format: { method: 'getCurrentSound', value: {...} }
            // 2. Event format: { event: 'onMediaStart', data: {...} }
            // 3. Progress format: { type: 'progress', currentPosition: 123, duration: 456 }
            
            // Listen for track start events
            if (data.event === 'onMediaStart' || (data.method === 'getCurrentSound' && data.value)) {
                const sound = data.data || data.value;
                if (sound) {
                    const duration = sound.duration || sound.duration_ms / 1000;
                    const title = sound.title || sound.permalink || 'Unknown';
                    
                    if (duration) {
                        currentTrackDuration = duration;
                        trackStartTime = Date.now();
                        isCheckingTrack = true;
                        
                        console.log(`Track started: "${title}" (${duration}s)`);
                        
                        // Preview tracks are typically 30 seconds or less
                        // Also check for tracks that are suspiciously short (under 60 seconds)
                        const PREVIEW_THRESHOLD = 60; // seconds
                        
                        if (currentTrackDuration < PREVIEW_THRESHOLD) {
                            console.log(`⚠️ Skipping preview track: "${title}" (${currentTrackDuration}s)`);
                            
                            // Skip to next track immediately
                            setTimeout(() => {
                                if (soundcloudIframe && soundcloudIframe.contentWindow) {
                                    soundcloudIframe.contentWindow.postMessage(JSON.stringify({
                                        method: 'next'
                                    }), 'https://w.soundcloud.com');
                                    console.log('Sent skip command to SoundCloud widget');
                                }
                            }, 1000); // Give it a moment to start playing
                            return;
                        }
                        
                        // Set up a check to see if track ends early (another sign of preview)
                        if (skipCheckTimeout) clearTimeout(skipCheckTimeout);
                        skipCheckTimeout = setTimeout(() => {
                            // Check if track ended at exactly its duration (preview sign)
                            if (isCheckingTrack && currentTrackDuration) {
                                const elapsed = (Date.now() - trackStartTime) / 1000;
                                // If we're close to the duration, it might have ended
                                if (elapsed >= currentTrackDuration - 2 && elapsed <= currentTrackDuration + 3) {
                                    console.log(`⚠️ Track ended at ${elapsed}s (duration: ${currentTrackDuration}s) - likely preview, skipping`);
                                    if (soundcloudIframe && soundcloudIframe.contentWindow) {
                                        soundcloudIframe.contentWindow.postMessage(JSON.stringify({
                                            method: 'next'
                                        }), 'https://w.soundcloud.com');
                                    }
                                }
                            }
                        }, (currentTrackDuration + 3) * 1000); // Check 3 seconds after track should end
                        // Update state with new timeout
                        if (soundCloudFilteringState) {
                            soundCloudFilteringState.skipCheckTimeout = skipCheckTimeout;
                        }
                    }
                }
            }
            
            // Listen for track end events
            if (data.event === 'onMediaEnd' || data.event === 'onFinish') {
                if (currentTrackDuration && trackStartTime) {
                    const elapsed = (Date.now() - trackStartTime) / 1000;
                    console.log(`Track ended after ${elapsed}s (expected: ${currentTrackDuration}s)`);
                    
                    // If track ended significantly before its duration, it might be a preview
                    if (elapsed < currentTrackDuration * 0.8 && elapsed < 35) {
                        console.log('⚠️ Track ended early, likely preview - skipping to next');
                        if (soundcloudIframe && soundcloudIframe.contentWindow) {
                            setTimeout(() => {
                                soundcloudIframe.contentWindow.postMessage(JSON.stringify({
                                    method: 'next'
                                }), 'https://w.soundcloud.com');
                            }, 500);
                        }
                    }
                }
                // Reset tracking
                isCheckingTrack = false;
                currentTrackDuration = null;
                trackStartTime = null;
                positionCheckCount = 0;
            }
            
            // When playback starts, begin tracking (fallback if onMediaStart doesn't fire)
            if (data.event === 'onPlay' || data.event === 'onPlayStart') {
                if (!isCheckingTrack) {
                    trackStartTime = Date.now();
                    isCheckingTrack = true;
                    positionCheckCount = 0;
                    console.log('Playback started, beginning preview detection...');
                }
            }
            
            // Listen for progress updates to detect early endings
            if (data.type === 'progress' || (data.method === 'getPosition' && typeof data.value === 'number')) {
                const position = data.currentPosition || data.value || 0;
                const duration = data.duration || currentTrackDuration;
                
                // If position resets to 0 while we're tracking, track might have ended
                if (position === 0 && currentTrackDuration && trackStartTime && duration) {
                    const elapsed = (Date.now() - trackStartTime) / 1000;
                    // If we're at position 0 but haven't played the full duration, it might be a preview
                    if (elapsed < duration * 0.9 && elapsed < 35) {
                        console.log(`⚠️ Position reset early (${elapsed}s / ${duration}s) - likely preview`);
                        if (soundcloudIframe && soundcloudIframe.contentWindow) {
                            setTimeout(() => {
                                soundcloudIframe.contentWindow.postMessage(JSON.stringify({
                                    method: 'next'
                                }), 'https://w.soundcloud.com');
                            }, 500);
                        }
                    }
                }
            }
            
        } catch (e) {
            // Not a JSON message or invalid format, ignore
            console.debug('SoundCloud message parse error:', e);
        }
    };
    
    // Add event listener
    window.addEventListener('message', messageHandler);
    
    // Periodically request track info to detect previews
    // This helps catch tracks that start playing before we get events
    let lastPosition = null;
    let positionCheckCount = 0;
    
    checkInterval = setInterval(() => {
        if (soundcloudIframe && soundcloudIframe.contentWindow) {
            // Request current sound info - widget may respond via postMessage
            try {
                soundcloudIframe.contentWindow.postMessage(JSON.stringify({
                    method: 'getCurrentSound'
                }), 'https://w.soundcloud.com');
                
                // Also request position to detect early endings
                soundcloudIframe.contentWindow.postMessage(JSON.stringify({
                    method: 'getPosition'
                }), 'https://w.soundcloud.com');
                
                // Simple time-based detection: if we've been tracking a track and it's been ~30 seconds
                // and we don't have duration info, it might be a preview
                if (isCheckingTrack && trackStartTime && !currentTrackDuration) {
                    const elapsed = (Date.now() - trackStartTime) / 1000;
                    positionCheckCount++;
                    
                    // If we've been checking for a while and no duration info, try to detect 30-second previews
                    if (positionCheckCount > 10 && elapsed > 28 && elapsed < 32) {
                        console.log(`⚠️ Track playing for ~30s with no duration info - likely preview, skipping`);
                        if (soundcloudIframe && soundcloudIframe.contentWindow) {
                            soundcloudIframe.contentWindow.postMessage(JSON.stringify({
                                method: 'next'
                            }), 'https://w.soundcloud.com');
                            // Reset tracking
                            isCheckingTrack = false;
                            currentTrackDuration = null;
                            trackStartTime = null;
                            positionCheckCount = 0;
                        }
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        }
    }, 1000); // Check every second for more responsive detection
    
    // Store state for cleanup
    soundCloudFilteringState = {
        messageHandler,
        checkInterval,
        skipCheckTimeout
    };
}

// Clean up SoundCloud filtering when switching away from SoundCloud
function cleanupSoundCloudFiltering() {
    if (soundCloudFilteringState) {
        if (soundCloudFilteringState.messageHandler) {
            window.removeEventListener('message', soundCloudFilteringState.messageHandler);
        }
        if (soundCloudFilteringState.checkInterval) {
            clearInterval(soundCloudFilteringState.checkInterval);
        }
        if (soundCloudFilteringState.skipCheckTimeout) {
            clearTimeout(soundCloudFilteringState.skipCheckTimeout);
        }
        soundCloudFilteringState = null;
    }
}
*/

function renderAppleMusicEmbed(url) {
    // Apple Music URL formats:
    // - Playlist: https://music.apple.com/us/playlist/playlist-name/pl.xxxxx
    // - Playlist: https://music.apple.com/playlist/playlist-name/pl.xxxxx
    // - Album: https://music.apple.com/us/album/album-name/xxxxx
    // - Song: https://music.apple.com/us/song/song-name/xxxxx
    
    // Clean the URL
    url = url.trim();
    
    // Extract playlist/album/song ID and type
    // Pattern: music.apple.com/[country/]playlist|album|song/name/id
    // More flexible regex to handle various URL formats
    const playlistMatch = url.match(/music\.apple\.com\/(?:[a-z]{2}\/)?playlist\/[^/]+\/(pl\.[a-zA-Z0-9._-]+)/i);
    const albumMatch = url.match(/music\.apple\.com\/(?:[a-z]{2}\/)?album\/[^/]+\/([a-zA-Z0-9]+)/i);
    const songMatch = url.match(/music\.apple\.com\/(?:[a-z]{2}\/)?song\/[^/]+\/([a-zA-Z0-9]+)/i);
    
    // Extract country code (default to 'us' if not found)
    const countryMatch = url.match(/music\.apple\.com\/([a-z]{2})\//i);
    const country = countryMatch ? countryMatch[1] : 'us';
    
    let embedUrl = '';
    let type = '';
    
    if (playlistMatch) {
        const playlistId = playlistMatch[1];
        embedUrl = `https://embed.music.apple.com/${country}/playlist/${playlistId}`;
        type = 'playlist';
    } else if (albumMatch) {
        const albumId = albumMatch[1];
        embedUrl = `https://embed.music.apple.com/${country}/album/${albumId}`;
        type = 'album';
    } else if (songMatch) {
        const songId = songMatch[1];
        embedUrl = `https://embed.music.apple.com/${country}/song/${songId}`;
        type = 'song';
    } else {
        console.error('Could not parse Apple Music URL:', url);
        return '<p class="playlist-error">invalid apple music url format</p>';
    }
    
    // Apple Music embeds need to be visible and clickable
    // User MUST click inside the iframe to start playback (no API control available)
    // Make it larger for easier interaction
    console.log('Apple Music embed URL:', embedUrl);
    // Try different URL format - Apple Music might need specific parameters
    const embedSrc = `${embedUrl}?app=music`;
    console.log('Full embed src:', embedSrc);
    
    return `
        <iframe 
            id="apple-music-player"
            style="position: fixed; bottom: 20px; right: 20px; width: 450px; height: 300px; border-radius: 12px; z-index: 9999; border: 2px solid #fa2d48; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: auto; background: white;" 
            src="${embedSrc}" 
            frameborder="0" 
            allow="autoplay; encrypted-media; fullscreen"
            loading="eager">
        </iframe>
    `;
}

function detectPlaylistType(url) {
    if (!url || !url.trim()) {
        return 'youtube'; // Default
    }
    
    const trimmedUrl = url.trim().toLowerCase();
    
    // Check for Apple Music
    if (trimmedUrl.includes('music.apple.com')) {
        return 'apple';
    }
    
    // Check for YouTube
    if (trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be')) {
        return 'youtube';
    }
    
    // Check for Spotify
    if (trimmedUrl.includes('spotify.com')) {
        return 'spotify';
    }
    
    // Check for SoundCloud
    if (trimmedUrl.includes('soundcloud.com')) {
        return 'soundcloud';
    }
    
    // Default to YouTube
    return 'youtube';
}

function handleYouTubeError(errorCode) {
    // YouTube error codes:
    // 2 - Invalid parameter value
    // 5 - HTML5 player error
    // 100 - Video not found
    // 101 - Video not allowed to be played in embedded players
    // 150 - Video not allowed to be played in embedded players (same as 101)
    
    let errorMessage = '';
    switch (errorCode) {
        case 2:
            errorMessage = 'Invalid video parameters';
            break;
        case 5:
            errorMessage = 'HTML5 player error';
            break;
        case 100:
            errorMessage = 'Video not found';
            break;
        case 101:
        case 150:
            errorMessage = 'This video does not allow embedding.';
            break;
        default:
            errorMessage = 'Error playing video (code: ' + errorCode + ')';
    }
    
    console.error('YouTube Error:', errorMessage);
    
    // Show error message in the playlist container
    if (elements.playlistContainer) {
        let helpText = 'Try a different video or check that embedding is enabled.';
        
        // Special message for embedding errors (101, 150) - explain playlist limitation
        if (errorCode === 101 || errorCode === 150) {
            helpText = 'Note: Even if a playlist shows an "Embed" option in YouTube, individual videos within the playlist may have embedding disabled by their creators. This is a YouTube limitation, not an issue with this app.';
        }
        
        elements.playlistContainer.innerHTML = `
            <div class="playlist-error-message">
                <p>${errorMessage}</p>
                <p style="font-size: 0.7rem; margin-top: 0.5rem; opacity: 0.7;">
                    ${helpText}
                </p>
            </div>
        `;
    }
}

function togglePlaylistVolume() {
    playlistMuted = !playlistMuted;
    updateVolumeState();
    
    // Hide the sticker once clicked
    if (elements.playlistSticker) {
        elements.playlistSticker.style.display = 'none';
    }
    
    // Control YouTube iframe via postMessage
    if (playlistType === 'youtube') {
        const youtubeIframe = document.getElementById('youtube-player');
        if (youtubeIframe && youtubeIframe.tagName === 'IFRAME' && youtubeIframe.contentWindow) {
            try {
                if (playlistMuted) {
                    youtubeIframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
                } else {
                    youtubeIframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
                    youtubeIframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
            }
        } catch (e) {
                console.error('Could not control YouTube iframe:', e);
            }
        }
    }
    
    // Control SoundCloud via postMessage
    if (playlistType === 'soundcloud') {
        const soundcloudIframe = document.getElementById('soundcloud-player');
        if (soundcloudIframe && soundcloudIframe.contentWindow) {
            try {
                if (playlistMuted) {
                    // Pause SoundCloud
                    soundcloudIframe.contentWindow.postMessage(JSON.stringify({
                        method: 'pause'
                    }), 'https://w.soundcloud.com');
                } else {
                    // Play SoundCloud
                    soundcloudIframe.contentWindow.postMessage(JSON.stringify({
                        method: 'play'
                    }), 'https://w.soundcloud.com');
                }
            } catch (e) {
                console.error('Could not control SoundCloud iframe:', e);
            }
        }
    }
    
    // For Apple Music, try to trigger playback on user interaction
    if (playlistType === 'apple' && !playlistMuted) {
        try {
            const appleMusicIframe = document.getElementById('apple-music-player');
            if (appleMusicIframe) {
                appleMusicIframe.focus();
            }
        } catch (e) {
            console.error('Could not interact with Apple Music player:', e);
        }
    }
}

function updateVolumeState() {
    if (elements.playlistVolumeIcon) {
        if (playlistMuted) {
            elements.playlistVolumeIcon.textContent = '🔇';
        } else {
            elements.playlistVolumeIcon.textContent = '🔈';
        }
    }
    
    // Show/hide skip buttons when unmuted
    if (elements.playlistSkipBackward && elements.playlistSkipForward) {
        if (playlistMuted) {
            elements.playlistSkipBackward.classList.add('hidden');
            elements.playlistSkipForward.classList.add('hidden');
        } else {
            elements.playlistSkipBackward.classList.remove('hidden');
            elements.playlistSkipForward.classList.remove('hidden');
        }
    }
}

function skipPlaylistBackward() {
    if (playlistType === 'youtube') {
        const youtubeIframe = document.getElementById('youtube-player');
        if (youtubeIframe && youtubeIframe.tagName === 'IFRAME' && youtubeIframe.contentWindow) {
            try {
                youtubeIframe.contentWindow.postMessage('{"event":"command","func":"previousVideo","args":""}', '*');
            } catch (e) {
                console.error('Could not skip YouTube backward:', e);
            }
        }
    } else if (playlistType === 'soundcloud') {
        const soundcloudIframe = document.getElementById('soundcloud-player');
        if (soundcloudIframe && soundcloudIframe.contentWindow) {
            try {
                soundcloudIframe.contentWindow.postMessage(JSON.stringify({
                    method: 'prev'
                }), 'https://w.soundcloud.com');
            } catch (e) {
                console.error('Could not skip SoundCloud backward:', e);
            }
        }
    }
    // Spotify and Apple Music don't support programmatic skip via iframe
}

function skipPlaylistForward() {
    if (playlistType === 'youtube') {
        const youtubeIframe = document.getElementById('youtube-player');
        if (youtubeIframe && youtubeIframe.tagName === 'IFRAME' && youtubeIframe.contentWindow) {
            try {
                youtubeIframe.contentWindow.postMessage('{"event":"command","func":"nextVideo","args":""}', '*');
        } catch (e) {
                console.error('Could not skip YouTube forward:', e);
            }
        }
    } else if (playlistType === 'soundcloud') {
        const soundcloudIframe = document.getElementById('soundcloud-player');
        if (soundcloudIframe && soundcloudIframe.contentWindow) {
            try {
                soundcloudIframe.contentWindow.postMessage(JSON.stringify({
                    method: 'next'
                }), 'https://w.soundcloud.com');
            } catch (e) {
                console.error('Could not skip SoundCloud forward:', e);
            }
        }
    }
    // Spotify and Apple Music don't support programmatic skip via iframe
}

async function handleSavePlaylist() {
    const url = elements.playlistUrlInput.value.trim();
    const type = detectPlaylistType(url); // Auto-detect playlist type
    
    elements.playlistSaveButton.textContent = '...';
    elements.playlistSaveButton.disabled = true;
    
    const success = await savePlaylistUrl(url, type);
    
    if (success) {
        // Update local state
        playlistUrl = url || null;
        playlistType = type;
        renderPlaylist(playlistUrl, playlistType);
        elements.playlistSaveButton.textContent = 'saved';
        setTimeout(() => {
            elements.playlistSaveButton.textContent = 'save playlist';
        }, 1500);
        
        // Re-fetch playlist settings to ensure consistency
        const playlistData = await fetchPlaylistSettings();
        playlistUrl = playlistData.url;
        playlistType = playlistData.type;
        renderPlaylist(playlistUrl, playlistType);
    }
    
    elements.playlistSaveButton.disabled = false;
}

async function createPost(content, tag) {
    if (!isAuthenticated) {
        alert('You must be signed in to post.');
        return null;
    }

    try {
        // Clean tag - remove # if present, trim whitespace, limit to 10 chars
        let cleanTag = tag ? tag.trim().replace(/^#+/, '').trim() : null;
        if (cleanTag && cleanTag.length > 10) {
            cleanTag = cleanTag.substring(0, 10);
        }
        
        // Try with tag first, fallback to without tag if column doesn't exist
        let insertData = {
            content: content,
            timestamp: Date.now(),
            likes: 0
        };
        
        if (cleanTag) {
            insertData.tag = cleanTag;
        }
        
        const { data, error } = await supabaseClient
            .from('posts')
            .insert(insertData)
            .select();

        if (error) {
            // If tag column doesn't exist, try without it
            if (error.message && error.message.includes("Could not find the 'tag' column")) {
                delete insertData.tag;
                const { data: fallbackData, error: fallbackError } = await supabaseClient
                    .from('posts')
                    .insert(insertData)
                    .select();
                if (fallbackError) throw fallbackError;
                return fallbackData?.[0] || null;
            }
            throw error;
        }
        return data?.[0] || null;
    } catch (error) {
        console.error('Error creating post:', error);
        alert('Failed to create post: ' + error.message);
        return null;
    }
}

async function deletePost(postId) {
    if (!isAuthenticated) {
        return false;
    }

    try {
        const { error } = await supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post: ' + error.message);
        return false;
    }
}

async function likePost(postId, currentLikes) {
    try {
        // Use the secure database function that ONLY allows incrementing likes
        // This prevents public users from modifying any other columns
        // Convert postId to number if it's a string (database function expects bigint)
        const postIdNum = typeof postId === 'string' ? parseInt(postId, 10) : postId;
        
        const { data, error } = await supabaseClient.rpc('increment_post_likes', {
            post_id: postIdNum
        });

        if (error) {
            console.error('Error calling increment_post_likes:', error);
            throw error;
        }
        
        return true;
    } catch (error) {
        console.error('Error liking post:', error);
        return false;
    }
}

async function createSuggestion(content) {
    try {
        const { data, error } = await supabaseClient
            .from('suggestions')
            .insert({
                content: content,
                timestamp: Date.now()
            })
            .select();

        if (error) throw error;
        return data?.[0] || null;
    } catch (error) {
        console.error('Error creating suggestion:', error);
        alert('Failed to submit suggestion: ' + error.message);
        return null;
    }
}

async function deleteSuggestion(suggestionId) {
    if (!isAuthenticated) {
        return false;
    }

    try {
        const { error } = await supabaseClient
            .from('suggestions')
            .delete()
            .eq('id', suggestionId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting suggestion:', error);
        alert('Failed to delete suggestion: ' + error.message);
        return false;
    }
}

async function approveSuggestion(suggestionId, content) {
    if (!isAuthenticated) {
        return null;
    }

    try {
        // Create post from suggestion with "suggestion" tag
        const { data: postData, error: postError } = await supabaseClient
            .from('posts')
            .insert({
                content: content,
                tag: 'suggestion',
                timestamp: Date.now(),
                likes: 0
            })
            .select();

        if (postError) {
            console.error('Error creating post from suggestion:', postError);
            // If tag column doesn't exist, try without it (backward compatibility)
            if (postError.message && postError.message.includes('column') && postError.message.includes('tag')) {
                const { data: fallbackData, error: fallbackError } = await supabaseClient
                    .from('posts')
                    .insert({
                        content: content,
                        from_suggestion: true,
                        timestamp: Date.now(),
                        likes: 0
                    })
                    .select();
                if (fallbackError) throw fallbackError;
                return fallbackData?.[0] || null;
            }
            throw postError;
        }

        // Delete the suggestion
        const { error: deleteError } = await supabaseClient
            .from('suggestions')
            .delete()
            .eq('id', suggestionId);

        if (deleteError) throw deleteError;

        return postData?.[0] || null;
    } catch (error) {
        console.error('Error approving suggestion:', error);
        alert('Failed to approve suggestion: ' + error.message);
        return null;
    }
}

// ============================================
// Rendering
// ============================================

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options).toLowerCase();
}

function renderPosts() {
    elements.loading.classList.add('hidden');
    
    if (posts.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.postsContainer.innerHTML = '';
        return;
    }
    
    elements.emptyState.classList.add('hidden');
    
    elements.postsContainer.innerHTML = posts.map((post, index) => {
        const likes = post.likes || 0;
        const filledHearts = '♥'.repeat(likes);
        const emptyHeart = '♡';
        const hearts = filledHearts + emptyHeart;
        const isLiked = hasLikedPost(post.id);
        // Handle both new tag system and old from_suggestion for backward compatibility
        let tag = '';
        if (post.tag) {
            tag = `#${escapeHtml(post.tag)}`;
        } else if (post.from_suggestion) {
            tag = '#suggestion';
        }
        
        // Add review class for styling
        const isReview = post.type === 'review';
        const postClass = isReview ? 'post post-review' : 'post';
        
        // Extract rating for reviews and format it like likes
        let ratingStars = '';
        if (isReview && post.review_data && post.review_data.rating) {
            let ratingDisplay = post.review_data.rating;
            // Convert numeric ratings (including decimals like "5.0") to stars
            const numericMatch = ratingDisplay.match(/^(\d+(?:\.\d+)?)/);
            if (numericMatch) {
                const numRating = Math.round(parseFloat(numericMatch[1]));
                if (numRating >= 1 && numRating <= 5) {
                    ratingDisplay = '★'.repeat(numRating) + '☆'.repeat(5 - numRating);
                }
            }
            ratingStars = ratingDisplay;
        }
        
        // Remove rating from content if it exists (for backward compatibility)
        let postContent = post.content;
        if (isReview && ratingStars) {
            // Remove rating pattern like " - ★★★★☆" from content
            // Escape special regex characters in ratingStars
            const escapedRating = ratingStars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const ratingPattern = new RegExp(`\\s*-\\s*${escapedRating}\\s*`, 'g');
            postContent = postContent.replace(ratingPattern, '').trim();
            // Also try to remove any star pattern at the end (for old data formats)
            const starPattern = /\s*-\s*[★☆]+\s*/g;
            postContent = postContent.replace(starPattern, '').trim();
        }
        
        return `
        <article class="${postClass}" style="animation-delay: ${index * 0.1}s">
            <div class="post-header">
                <time class="post-date">${formatDate(post.timestamp)}</time>
                ${tag ? `<span class="post-badge">${tag}</span>` : ''}
            </div>
            <div class="post-content">${escapeHtml(postContent)}</div>
            <div class="post-footer">
                ${!isReview ? `
                    <button class="post-like ${isLiked ? 'post-liked' : ''}" data-id="${post.id}" data-likes="${likes}">
                        <span class="like-hearts">${hearts}</span>
                    </button>
                ` : ratingStars ? `
                    <div class="post-rating">
                        <span class="rating-stars">${escapeHtml(ratingStars)}</span>
                    </div>
                ` : '<div></div>'}
                ${isAuthenticated && !isReview ? `<button class="post-delete" data-id="${post.id}">delete</button>` : ''}
            </div>
        </article>
    `;
    }).join('');
    
    // Attach delete handlers if authenticated
    if (isAuthenticated) {
        document.querySelectorAll('.post-delete').forEach(btn => {
            btn.addEventListener('click', handleDelete);
        });
    }
    
    // Attach like handlers
    document.querySelectorAll('.post-like').forEach(btn => {
        btn.addEventListener('click', handleLike);
        // Also attach to span inside to catch clicks on the heart icon
        const heartsSpan = btn.querySelector('.like-hearts');
        if (heartsSpan) {
            heartsSpan.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent double-firing
                handleLike(e);
            });
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Authentication
// ============================================

async function checkAuthState() {
    if (!supabaseClient) {
        console.error('Cannot check auth state: supabase is not initialized');
        updateAppStatus('error: cannot check auth - supabase not initialized', 'error');
        // Still try to load public data
        try {
            const data = await fetchData();
            posts = data.posts;
            suggestions = data.suggestions;
            renderPosts();
            updateTagSuggestions();
        } catch (error) {
            console.error('Failed to load public data:', error);
            updateAppStatus(`error: failed to load data - ${error.message || 'unknown error'}`, 'error');
        }
        return;
    }
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    isAuthenticated = !!session;
    updateUIForAuth();
    
    // Load playlist settings (public)
    const playlistData = await fetchPlaylistSettings();
    playlistUrl = playlistData.url;
    playlistType = playlistData.type;
    
    renderPlaylist(playlistUrl, playlistType);
    
    if (isAuthenticated) {
        // Load data when authenticated
        updateAppStatus('loading data...', 'info');
        try {
        const data = await fetchData();
        posts = data.posts;
        suggestions = data.suggestions;
        renderPosts();
        renderInbox();
        updateTagSuggestions();
            updateAppStatus(`loaded ${posts.length} posts, ${suggestions.length} suggestions`, 'info');
        } catch (error) {
            console.error('Error loading data:', error);
            updateAppStatus(`error loading data: ${error.message || 'unknown error'}`, 'error');
        }
        
        // Load playlist settings into inputs for admin
        if (playlistUrl) {
            elements.playlistUrlInput.value = playlistUrl;
        }
        
        // Load Letterboxd settings
        const letterboxdData = await fetchLetterboxdSettings();
        letterboxdUrl = letterboxdData.url;
        if (letterboxdUrl && elements.letterboxdUrlInput) {
            elements.letterboxdUrlInput.value = letterboxdUrl;
        }
        
        // Extract username and load reviews for current user only
        let currentUsername = null;
        if (letterboxdUrl) {
            const usernameMatch = letterboxdUrl.match(/letterboxd\.com\/([^\/\?]+)/);
            if (usernameMatch) {
                currentUsername = usernameMatch[1].replace(/\/$/, '');
            }
        }
        
        // Load reviews for current user only
        letterboxdReviews = await loadLetterboxdReviews(currentUsername);
        renderLetterboxdReviews();
        
        // Start automatic polling for new reviews
        startLetterboxdPolling();
    } else {
        // Load public data
        updateAppStatus('loading public data...', 'info');
        try {
        const data = await fetchData();
        posts = data.posts;
        suggestions = data.suggestions;
        renderPosts();
        updateTagSuggestions();
            updateAppStatus(`loaded ${posts.length} posts`, 'info');
        } catch (error) {
            console.error('Error loading public data:', error);
            updateAppStatus(`error loading data: ${error.message || 'unknown error'}`, 'error');
        }
    }
    
    // Set up real-time subscriptions
    setupRealtimeSubscriptions();
}

// Load active tab from localStorage, default to 'feed'
let activeTab = (() => {
    try {
        const saved = localStorage.getItem('activeTab');
        return saved && ['feed', 'suggestions', 'admin'].includes(saved) ? saved : 'feed';
    } catch (e) {
        return 'feed';
    }
})();

function switchTab(tabName) {
    activeTab = tabName;
    
    // Save to localStorage
    try {
        localStorage.setItem('activeTab', tabName);
    } catch (e) {
        // Ignore localStorage errors
    }
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Show/hide tab content
    elements.tabFeed.classList.toggle('hidden', tabName !== 'feed');
    elements.tabSuggestions.classList.toggle('hidden', tabName !== 'suggestions');
    elements.tabAdmin.classList.toggle('hidden', tabName !== 'admin');
    
    // Show/hide feed (show in feed tab, hide in others)
    const feedElement = document.getElementById('feed');
    if (feedElement) {
        if (tabName === 'feed') {
            feedElement.classList.remove('hidden');
        } else {
            feedElement.classList.add('hidden');
        }
    }
    
    // Show/hide write panel (only in feed tab)
    if (tabName === 'feed' && isAuthenticated) {
        elements.writePanel.classList.remove('hidden');
    } else {
        elements.writePanel.classList.add('hidden');
    }
    
    // Render inbox when switching to suggestions tab
    if (tabName === 'suggestions' && isAuthenticated) {
        renderInbox();
    }
}

function updateUIForAuth() {
    const feedElement = document.getElementById('feed');
    
    if (isAuthenticated) {
        elements.authPanel.classList.add('hidden');
        elements.statusWord.textContent = 'online';
        elements.statusDot.classList.remove('status-dot-offline');
        elements.statusDot.classList.add('status-dot-online');
        elements.statusToggle.classList.add('online');
        elements.tabsNav.classList.remove('hidden');
        elements.suggestPanel.classList.add('hidden');
        
        // Hide feed directly, it will be shown via tab
        if (feedElement) {
            feedElement.classList.add('hidden');
        }
        
        // Restore saved tab or show feed tab by default
        switchTab(activeTab);
    } else {
        elements.statusWord.textContent = 'offline';
        elements.statusDot.classList.remove('status-dot-online');
        elements.statusDot.classList.add('status-dot-offline');
        elements.statusToggle.classList.remove('online');
        elements.tabsNav.classList.add('hidden');
        elements.writePanel.classList.add('hidden');
        elements.tabFeed.classList.add('hidden');
        elements.tabSuggestions.classList.add('hidden');
        elements.tabAdmin.classList.add('hidden');
        elements.suggestPanel.classList.remove('hidden');
        
        // Show feed directly when logged out
        if (feedElement) {
            feedElement.classList.remove('hidden');
        }
    }
    renderPosts(); // Re-render to show/hide delete buttons
}

function showAuthPanel() {
    elements.authPanel.classList.remove('hidden');
    elements.emailInput.focus();
}

function hideAuthPanel() {
    elements.authPanel.classList.add('hidden');
    elements.emailInput.value = '';
    elements.passwordInput.value = '';
}

async function authenticate() {
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;
    
    if (!email || !password) {
        elements.passwordInput.value = '';
        elements.emailInput.placeholder = 'email required';
        setTimeout(() => {
            elements.emailInput.placeholder = 'email';
        }, 1500);
        return;
    }
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            elements.passwordInput.value = '';
            elements.emailInput.value = '';
            elements.emailInput.placeholder = 'incorrect';
            setTimeout(() => {
                elements.emailInput.placeholder = 'email';
            }, 1500);
            return;
        }
        
        if (data.session) {
            isAuthenticated = true;
            hideAuthPanel();
            updateUIForAuth();
            switchTab('feed'); // Ensure feed tab is active
            // Don't auto-focus on login to prevent fullscreen from opening
            // elements.postContent.focus();
            
            // Reload data
            const feedData = await fetchData();
            posts = feedData.posts;
            suggestions = feedData.suggestions;
            renderPosts();
            renderInbox();
            updateTagSuggestions();
        }
    } catch (error) {
        console.error('Auth error:', error);
        elements.passwordInput.value = '';
        elements.emailInput.value = '';
        elements.emailInput.placeholder = 'error';
        setTimeout(() => {
            elements.emailInput.placeholder = 'email';
        }, 1500);
    }
}

async function signOut() {
    await supabaseClient.auth.signOut();
    isAuthenticated = false;
    
    // Clean up real-time subscriptions
    cleanupRealtimeSubscriptions();
    
    // Stop automatic polling when signed out
    stopLetterboxdPolling();
    
    updateUIForAuth();
    
    // Reload public data
    const data = await fetchData();
    posts = data.posts;
    suggestions = data.suggestions;
    renderPosts();
    updateTagSuggestions();
    
    // Re-setup subscriptions for public access
    setupRealtimeSubscriptions();
}

// ============================================
// Real-time Subscriptions
// ============================================

function setupRealtimeSubscriptions() {
    // Clean up existing subscriptions
    cleanupRealtimeSubscriptions();
    
    // Subscribe to posts changes
    const postsChannel = supabaseClient
        .channel('posts-changes')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'posts' },
            (payload) => {
                // Add new post to the beginning of the array
                posts.unshift(payload.new);
                renderPosts();
                updateTagSuggestions();
            }
        )
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'posts' },
            (payload) => {
                // Update existing post
                const index = posts.findIndex(p => p.id === payload.new.id);
                if (index !== -1) {
                    posts[index] = payload.new;
                    // Update just the like button instead of re-rendering everything
                    const postId = payload.new.id;
                    const likes = payload.new.likes || 0;
                    const isLiked = hasLikedPost(postId);
                    updateLikeButton(postId, likes, isLiked);
                }
            }
        )
        .on('postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'posts' },
            (payload) => {
                // Remove deleted post
                posts = posts.filter(p => p.id !== payload.old.id);
                renderPosts();
                updateTagSuggestions();
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                // Successfully subscribed
            } else if (status === 'CHANNEL_ERROR') {
                // Handle subscription error gracefully
            }
        });
    
    // Subscribe to suggestions changes
    const suggestionsChannel = supabaseClient
        .channel('suggestions-changes')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'suggestions' },
            (payload) => {
                // Add new suggestion
                suggestions.unshift(payload.new);
                if (isAuthenticated) {
                    renderInbox();
                }
            }
        )
        .on('postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'suggestions' },
            (payload) => {
                // Remove deleted suggestion - convert both to strings for consistent comparison
                const deletedId = String(payload.old.id);
                suggestions = suggestions.filter(s => String(s.id) !== deletedId);
                if (isAuthenticated) {
                    renderInbox();
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                // Successfully subscribed
            } else if (status === 'CHANNEL_ERROR') {
                // Handle subscription error gracefully
            }
        });
    
    realtimeChannels.push(postsChannel, suggestionsChannel);
}

function cleanupRealtimeSubscriptions() {
    realtimeChannels.forEach(channel => {
        supabaseClient.removeChannel(channel);
    });
    realtimeChannels = [];
}

// ============================================
// Like Tracking (localStorage)
// ============================================

function getLikedPosts() {
    try {
        const liked = localStorage.getItem('likedPosts');
        return liked ? JSON.parse(liked) : [];
    } catch (e) {
        return [];
    }
}

function setLikedPost(postId) {
    try {
        const liked = getLikedPosts();
        const postIdStr = String(postId);
        // Check if already liked (using string comparison)
        if (!liked.some(id => String(id) === postIdStr)) {
            liked.push(postIdStr);
            localStorage.setItem('likedPosts', JSON.stringify(liked));
        }
    } catch (e) {
        // Ignore localStorage errors
    }
}

function hasLikedPost(postId) {
    const liked = getLikedPosts();
    // Convert both to strings for consistent comparison
    const postIdStr = String(postId);
    return liked.some(id => String(id) === postIdStr);
}

// ============================================
// Post Actions
// ============================================

function updateLikeButton(postId, likes, isLiked) {
    const likeButton = document.querySelector(`.post-like[data-id="${postId}"]`);
    if (!likeButton) return;
    
    const filledHearts = '♥'.repeat(likes);
    const emptyHeart = '♡';
    const hearts = filledHearts + emptyHeart;
    
    // Update the hearts display
    const heartsSpan = likeButton.querySelector('.like-hearts');
    if (heartsSpan) {
        heartsSpan.textContent = hearts;
    }
    
    // Update button state
    // Don't disable the button - disabled buttons don't fire click events
    // Instead, rely on handleLike's early return to prevent duplicate likes
    likeButton.dataset.likes = likes;
    if (isLiked) {
        likeButton.classList.add('post-liked');
    } else {
        likeButton.classList.remove('post-liked');
    }
}

function resizeTagInput(input) {
    if (!input) return;
    const placeholder = input.placeholder || '#tag';
    const value = input.value || placeholder;
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.fontFamily = getComputedStyle(input).fontFamily;
    tempSpan.style.fontSize = getComputedStyle(input).fontSize;
    tempSpan.style.fontWeight = getComputedStyle(input).fontWeight;
    tempSpan.style.letterSpacing = getComputedStyle(input).letterSpacing;
    tempSpan.style.whiteSpace = 'pre';
    tempSpan.textContent = value;
    document.body.appendChild(tempSpan);
    const width = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);
    input.style.width = Math.max(width + 4, 0) + 'px';
}

function saveTagToHistory(tag) {
    if (!tag || tag.toLowerCase() === 'suggestion') return;
    
    const cleanTag = tag.trim().replace(/^#+/, '').trim().toLowerCase();
    if (!cleanTag || cleanTag.length > 10) return;
    
    try {
        const savedTags = JSON.parse(localStorage.getItem('postTags') || '[]');
        // Remove if exists and add to front
        const filtered = savedTags.filter(t => t !== cleanTag);
        filtered.unshift(cleanTag);
        // Keep only last 10 tags
        const limited = filtered.slice(0, 10);
        localStorage.setItem('postTags', JSON.stringify(limited));
        updateTagSuggestions();
    } catch (e) {
        console.error('Error saving tag:', e);
    }
}

function updateTagSuggestions() {
    try {
        const savedTags = JSON.parse(localStorage.getItem('postTags') || '[]');
        const suggestionsContainer = document.getElementById('tag-suggestions');
        
        // Get unique tags from current posts (excluding 'suggestion' tag)
        const postTags = new Set();
        posts.forEach(post => {
            if (post.tag && post.tag.toLowerCase() !== 'suggestion') {
                postTags.add(post.tag.toLowerCase().trim());
            }
        });
        
        // Combine saved tags with current post tags, prioritizing saved tags
        const allTags = new Set();
        savedTags.forEach(tag => allTags.add(tag.toLowerCase().trim()));
        postTags.forEach(tag => allTags.add(tag));
        
        // Filter out invalid tags and convert to array
        const validTags = Array.from(allTags).filter(tag => 
            tag && tag.length > 0 && tag.length <= 10 && tag !== 'suggestion'
        );
        
        if (suggestionsContainer && validTags.length > 0) {
            // Show last 3 tags (prioritize saved tags, then post tags)
            const recentTags = validTags.slice(0, 3);
            suggestionsContainer.innerHTML = recentTags.map(tag => 
                `<button type="button" class="tag-chip" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`
            ).join('');
            
            // Attach click handlers
            suggestionsContainer.querySelectorAll('.tag-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const tag = chip.dataset.tag;
                    elements.postTag.value = `#${tag}`;
                    elements.postTag.focus();
                });
            });
            
            suggestionsContainer.classList.remove('hidden');
        } else if (suggestionsContainer) {
            suggestionsContainer.classList.add('hidden');
        }
    } catch (e) {
        console.error('Error updating tag suggestions:', e);
    }
}

async function handleCreatePost() {
    const content = elements.postContent.value.trim();
    const tag = elements.postTag.value.trim();
    
    if (!content) return;
    
    // Set flag to prevent blur handler from interfering during submit
    if (elements.writePanel) {
        elements.writePanel._isSubmitting = true;
    }
    
    elements.postSubmit.textContent = '...';
    elements.postSubmit.disabled = true;
    
    // Remove fullscreen mode when submitting - use the proper exit function
    if (elements.writePanel && elements.writePanel.exitFullscreen) {
        elements.writePanel.exitFullscreen();
    } else if (elements.writePanel) {
        // Fallback cleanup if exitFullscreen isn't available
        const scrollY = elements.writePanel._savedScrollY || 0;
        elements.writePanel.classList.remove('write-panel-fullscreen');
        document.documentElement.classList.remove('panel-fullscreen-mode');
        document.body.classList.remove('panel-fullscreen-mode');
        document.body.style.setProperty('overflow', 'auto', 'important');
        document.documentElement.style.setProperty('overflow', 'auto', 'important');
        document.body.style.setProperty('background', 'var(--bg)', 'important');
        document.documentElement.style.setProperty('background', 'var(--bg)', 'important');
        disableScrollPrevention();
        window.scrollTo(0, scrollY);
        elements.writePanel._savedScrollY = null;
    }
    
    const newPost = await createPost(content, tag);
    
    if (newPost) {
        // Trigger kiss emoji explosion
        triggerKissExplosion();
        
        // Save tag to history (except suggestions)
        if (tag) {
            saveTagToHistory(tag);
        }
        
        // Add to local state
        posts.unshift(newPost);
        elements.postContent.value = '';
        elements.postTag.value = '';
        resizeTagInput(elements.postTag);
        renderPosts();
        
        // Update tag suggestions to include new post's tag
        updateTagSuggestions();
        // Real-time subscription will handle the update automatically
        
        // Switch back to feed tab after posting
        if (isAuthenticated) {
            switchTab('feed');
        }
    }
    
    // Clear submitting flag
    if (elements.writePanel) {
        elements.writePanel._isSubmitting = false;
    }
    
    elements.postSubmit.textContent = 'post';
    elements.postSubmit.disabled = false;
}

async function handleDelete(e) {
    const postId = e.target.dataset.id;
    
    if (!confirm('delete this post?')) return;
    
    const success = await deletePost(postId);
    
    if (success) {
        // Remove from local state
        posts = posts.filter(p => p.id !== postId);
        renderPosts();
        
        // Refresh tag suggestions to reflect deleted post
        updateTagSuggestions();
        // Real-time subscription will handle the update automatically
    }
}

async function handleLike(e) {
    const likeButton = e.target.closest('.post-like');
    if (!likeButton) return;
    const postId = likeButton.dataset.id;
    const currentLikes = parseInt(likeButton.dataset.likes, 10);
    const post = posts.find(p => p.id == postId); // Use == for type coercion
    
    if (!post) return;
    
    // Check if user has already liked this post
    if (hasLikedPost(postId)) {
        return; // Already liked, don't allow duplicate likes
    }
    
    // Mark as liked
    setLikedPost(postId);
    
    // Optimistically update UI - just update the button, not the whole page
    const previousLikes = post.likes || 0;
    const newLikes = previousLikes + 1;
    post.likes = newLikes;
    updateLikeButton(postId, newLikes, true);
    
    // Save to database
    const success = await likePost(postId, currentLikes);
    
    if (!success) {
        // Revert on failure
        post.likes = previousLikes;
        // Remove from liked list
        try {
            const liked = getLikedPosts();
            const postIdStr = String(postId);
            const filtered = liked.filter(id => String(id) !== postIdStr);
            localStorage.setItem('likedPosts', JSON.stringify(filtered));
        } catch (e) {
            // Ignore localStorage errors
        }
        updateLikeButton(postId, previousLikes, false);
    }
    // Note: Real-time subscription will handle the update, but we'll update just the button
}

// ============================================
// Random Word Generator
// ============================================

const RANDOM_WORDS = [
    'whisper', 'dawn', 'silence', 'echo', 'shadow', 'light', 'breath', 'dream',
    'river', 'stone', 'wind', 'star', 'moon', 'cloud', 'rain', 'snow',
    'flower', 'leaf', 'tree', 'bird', 'wing', 'feather', 'nest', 'song',
    'memory', 'moment', 'time', 'space', 'distance', 'journey', 'path', 'road',
    'door', 'window', 'key', 'lock', 'chain', 'thread', 'fabric', 'cloth',
    'ink', 'paper', 'letter', 'word', 'sentence', 'story', 'tale', 'myth',
    'hope', 'fear', 'joy', 'sorrow', 'love', 'loss', 'gain', 'change',
    'stillness', 'movement', 'rhythm', 'beat', 'pulse', 'heart', 'soul', 'spirit'
];

function getRandomWord() {
    return RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)];
}

// ============================================
// Suggestions
// ============================================

async function handleCreateSuggestion() {
    const content = elements.suggestContent.value.trim();
    
    if (!content) return;
    
    // Set flag to prevent blur handler from interfering
    if (elements.suggestPanel) {
        elements.suggestPanel._isSubmitting = true;
    }
    
    elements.suggestSubmit.textContent = '...';
    elements.suggestSubmit.disabled = true;
    
    // Remove fullscreen mode when submitting - use the proper exit function
    if (elements.suggestPanel && elements.suggestPanel.exitFullscreen) {
        elements.suggestPanel.exitFullscreen();
    }
    
    const newSuggestion = await createSuggestion(content);
    
    if (newSuggestion) {
        // Trigger kiss emoji explosion
        triggerKissExplosion();
        
        // Update local state
        suggestions.push(newSuggestion);
        elements.suggestContent.value = '';
        elements.suggestSubmit.textContent = 'suggested';
        setTimeout(() => {
            elements.suggestSubmit.textContent = 'suggest';
        }, 1500);
        
        if (isAuthenticated) {
            renderInbox();
        }
        // Real-time subscription will handle the update automatically
    }
    
    elements.suggestSubmit.disabled = false;
    
    // Clear submitting flag
    if (elements.suggestPanel) {
        elements.suggestPanel._isSubmitting = false;
    }
}

// ============================================
// Inbox
// ============================================

function renderInbox() {
    if (suggestions.length === 0) {
        elements.inboxEmpty.classList.remove('hidden');
        elements.inboxContainer.innerHTML = '';
        return;
    }
    
    elements.inboxEmpty.classList.add('hidden');
    
    elements.inboxContainer.innerHTML = suggestions.map((suggestion) => `
        <div class="inbox-item">
            <div class="inbox-content">${escapeHtml(suggestion.content)}</div>
            <div class="inbox-actions">
                <button class="inbox-approve" data-id="${suggestion.id}" data-content="${escapeHtml(suggestion.content)}">approve</button>
                <button class="inbox-delete" data-id="${suggestion.id}">delete</button>
            </div>
        </div>
    `).join('');
    
    // Attach handlers
    document.querySelectorAll('.inbox-approve').forEach(btn => {
        btn.addEventListener('click', handleApproveSuggestion);
    });
    
    document.querySelectorAll('.inbox-delete').forEach(btn => {
        btn.addEventListener('click', handleDeleteSuggestion);
    });
}

async function handleApproveSuggestion(e) {
    const suggestionId = e.target.dataset.id;
    const content = e.target.dataset.content;
    
    const newPost = await approveSuggestion(suggestionId, content);
    
    if (newPost) {
        // Update local state - convert both to strings for consistent comparison
        posts.unshift(newPost);
        const suggestionIdStr = String(suggestionId);
        suggestions = suggestions.filter(s => String(s.id) !== suggestionIdStr);
        renderPosts();
        renderInbox();
        
        // Update tag suggestions (though suggestion tag is excluded, this ensures consistency)
        updateTagSuggestions();
        // Real-time subscription will also handle the update, but we update immediately for better UX
    }
}

async function handleDeleteSuggestion(e) {
    const suggestionId = e.target.dataset.id;
    
    if (!confirm('delete this suggestion?')) return;
    
    const success = await deleteSuggestion(suggestionId);
    
    if (success) {
        // Update local state - convert both to strings for consistent comparison
        const suggestionIdStr = String(suggestionId);
        suggestions = suggestions.filter(s => String(s.id) !== suggestionIdStr);
        renderInbox();
        
        // Real-time subscription will also handle the update, but we update immediately for better UX
    }
}

// ============================================
// Letterboxd
// ============================================

function renderLetterboxdReviews() {
    if (!elements.letterboxdReviewsList) return;
    
    if (letterboxdReviews.length === 0) {
        elements.letterboxdReviewsList.innerHTML = '<p class="letterboxd-empty">no reviews loaded</p>';
        // Hide container if no reviews
        if (elements.letterboxdReviewsContainer) {
            elements.letterboxdReviewsContainer.classList.add('hidden');
        }
        return;
    }
    
    // Show container if reviews exist
    if (elements.letterboxdReviewsContainer) {
        elements.letterboxdReviewsContainer.classList.remove('hidden');
    }
    
    // Update toggle all button text based on current selection state
    if (elements.letterboxdToggleAll) {
        const allSelected = letterboxdReviews.length > 0 && letterboxdReviews.every(review => review.is_selected);
        elements.letterboxdToggleAll.textContent = allSelected ? 'deselect all' : 'select all';
    }
    
    elements.letterboxdReviewsList.innerHTML = letterboxdReviews.map(review => {
        const reviewTitle = `${review.film_title}${review.film_year ? ` (${review.film_year})` : ''}`;
        const reviewPreview = review.review_text ? 
            (review.review_text.length > 100 ? review.review_text.substring(0, 100) + '...' : review.review_text) : 
            '';
        
        return `
            <div class="letterboxd-review-item ${review.is_selected ? 'review-selected' : 'review-unselected'}">
                <label class="letterboxd-review-checkbox">
                    <input type="checkbox" ${review.is_selected ? 'checked' : ''} data-id="${review.id}">
                    <div class="letterboxd-review-content">
                        <div class="letterboxd-review-title">${escapeHtml(reviewTitle)}</div>
                        ${review.rating ? `<div class="letterboxd-review-rating">${escapeHtml(review.rating)}</div>` : ''}
                        ${reviewPreview ? `<div class="letterboxd-review-preview">${escapeHtml(reviewPreview)}</div>` : ''}
                    </div>
                </label>
            </div>
        `;
    }).join('');
    
    // Attach checkbox handlers
    elements.letterboxdReviewsList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const reviewId = parseInt(e.target.dataset.id);
            const isSelected = e.target.checked;
            const success = await updateReviewSelection(reviewId, isSelected);
            
            if (success) {
                // Update local state
                const review = letterboxdReviews.find(r => r.id === reviewId);
                if (review) {
                    review.is_selected = isSelected;
                }
                
                // Update toggle all button text based on current selection state
                if (elements.letterboxdToggleAll) {
                    const allSelected = letterboxdReviews.every(r => r.is_selected);
                    elements.letterboxdToggleAll.textContent = allSelected ? 'deselect all' : 'select all';
                }
                
                // Refresh the feed immediately
                const data = await fetchData();
                posts = data.posts;
                renderPosts();
            }
        });
    });
}

async function handleFetchLetterboxdReviews() {
    const url = elements.letterboxdUrlInput.value.trim();
    
    if (!url) {
        alert('Please enter a Letterboxd URL');
        return;
    }
    
    // Extract username from URL
    const usernameMatch = url.match(/letterboxd\.com\/([^\/\?]+)/);
    if (!usernameMatch) {
        alert('Invalid Letterboxd URL format. Please use: https://letterboxd.com/username/');
        return;
    }
    const username = usernameMatch[1].replace(/\/$/, '');
    
    elements.letterboxdFetch.textContent = 'fetching...';
    elements.letterboxdFetch.disabled = true;
    
    try {
        // Save URL
        await saveLetterboxdUrl(url);
        letterboxdUrl = url;
        
        // Start/restart automatic polling with new URL
        startLetterboxdPolling();
        
        // Fetch reviews
        const result = await fetchLetterboxdReviews(url);
        const reviews = result.reviews;
        const fetchedUsername = result.username;
        
        if (reviews.length === 0) {
            alert('No reviews found. The user may not have any reviews, or the RSS feed may be empty.');
            elements.letterboxdFetch.textContent = 'fetch reviews';
            elements.letterboxdFetch.disabled = false;
            return;
        }
        
        // Save reviews to database (this will also clean up old reviews from other users)
        await saveLetterboxdReviews(reviews, fetchedUsername);
        
        // Reload reviews for this user only
        letterboxdReviews = await loadLetterboxdReviews(fetchedUsername);
        
        // Render reviews (this will show/hide container as needed)
        renderLetterboxdReviews();
        
        elements.letterboxdFetch.textContent = 'fetched';
        setTimeout(() => {
            elements.letterboxdFetch.textContent = 'fetch reviews';
        }, 1500);
        
        // Refresh feed to show new reviews
        const data = await fetchData();
        posts = data.posts;
        renderPosts();
    } catch (error) {
        console.error('Error fetching reviews:', error);
        let errorMessage = error.message;
        
        // Provide more helpful error messages
        if (errorMessage.includes('HTML') || errorMessage.includes('error page')) {
            errorMessage = 'Could not fetch reviews. This might be because:\n\n• The username doesn\'t exist\n• The user has no reviews\n• The RSS feed is private\n• CORS proxies are being blocked\n\nPlease verify the Letterboxd URL and try again.';
        }
        
        alert(errorMessage);
        elements.letterboxdFetch.textContent = 'fetch reviews';
    }
    
    elements.letterboxdFetch.disabled = false;
}

async function handleSaveLetterboxdSelection() {
    elements.letterboxdSaveSelection.textContent = 'saving...';
    elements.letterboxdSaveSelection.disabled = true;
    
    try {
        // Selection is already saved via checkbox handlers
        // Reload reviews to get updated selection state
        letterboxdReviews = await loadLetterboxdReviews();
        renderLetterboxdReviews();
        
        // Refresh the feed
        const data = await fetchData();
        posts = data.posts;
        renderPosts();
        
        elements.letterboxdSaveSelection.textContent = 'saved';
        setTimeout(() => {
            elements.letterboxdSaveSelection.textContent = 'save selection';
        }, 1500);
    } catch (error) {
        console.error('Error saving selection:', error);
        alert('Failed to save selection: ' + error.message);
        elements.letterboxdSaveSelection.textContent = 'save selection';
    }
    
    elements.letterboxdSaveSelection.disabled = false;
}

async function handleToggleAllReviews() {
    if (!isAuthenticated || letterboxdReviews.length === 0) {
        return;
    }
    
    // Check if all are selected
    const allSelected = letterboxdReviews.every(review => review.is_selected);
    const newSelectionState = !allSelected;
    
    // Update button text
    elements.letterboxdToggleAll.textContent = newSelectionState ? 'deselect all' : 'select all';
    elements.letterboxdToggleAll.disabled = true;
    
    try {
        // Update all reviews in parallel
        const updatePromises = letterboxdReviews.map(review => 
            updateReviewSelection(review.id, newSelectionState)
        );
        
        await Promise.all(updatePromises);
        
        // Update local state
        letterboxdReviews.forEach(review => {
            review.is_selected = newSelectionState;
        });
        
        // Re-render to update checkboxes and visual state
        renderLetterboxdReviews();
        
        // Refresh the feed
        const data = await fetchData();
        posts = data.posts;
        renderPosts();
        
    } catch (error) {
        console.error('Error toggling all reviews:', error);
        alert('Failed to toggle selection: ' + error.message);
    }
    
    elements.letterboxdToggleAll.disabled = false;
}

// ============================================
// Automatic Letterboxd Review Polling
// ============================================

/**
 * Automatically fetch new reviews from the configured Letterboxd URL
 * This runs periodically to check for new reviews
 */
async function pollForNewLetterboxdReviews() {
    if (!isAuthenticated || !letterboxdUrl) {
        return; // Only poll when authenticated and URL is set
    }
    
    try {
        console.log('Polling for new Letterboxd reviews...');
        
        // Fetch reviews from the saved URL
        const result = await fetchLetterboxdReviews(letterboxdUrl);
        const reviews = result.reviews;
        const fetchedUsername = result.username;
        
        if (reviews.length === 0) {
            console.log('No reviews found during polling');
            return;
        }
        
        // Save reviews (this will preserve is_selected for existing reviews)
        await saveLetterboxdReviews(reviews, fetchedUsername);
        
        // Reload reviews to get updated list
        letterboxdReviews = await loadLetterboxdReviews(fetchedUsername);
        renderLetterboxdReviews();
        
        // Refresh the feed to show any newly selected reviews
        const data = await fetchData();
        posts = data.posts;
        renderPosts();
        
        console.log(`Polling complete: ${reviews.length} reviews processed`);
    } catch (error) {
        console.error('Error during automatic polling:', error);
        
        // Log detailed error information for debugging
        const errorDetails = {
            message: error.message,
            url: letterboxdUrl,
            timestamp: new Date().toISOString(),
            errorType: error.name || 'Unknown'
        };
        
        console.error('Letterboxd polling error details:', errorDetails);
        
        // Show a non-intrusive status message for persistent errors
        // Only show if it's a network/proxy error (not user-related like "no reviews")
        if (error.message && (
            error.message.includes('proxy') || 
            error.message.includes('CORS') || 
            error.message.includes('fetch') ||
            error.message.includes('network')
        )) {
            updateAppStatus(`letterboxd polling error: ${error.message.substring(0, 50)}...`, 'warning');
            // Auto-hide after 5 seconds
            setTimeout(() => hideAppStatus(), 5000);
        }
        
        // Don't show alerts for polling errors - just log them
    }
}

/**
 * Start automatic polling for new Letterboxd reviews
 * Polls every hour (3600000 ms)
 */
function startLetterboxdPolling() {
    if (!letterboxdUrl || !isAuthenticated) {
        // No URL configured or not authenticated, don't poll
        stopLetterboxdPolling(); // Make sure any existing polling is stopped
        return;
    }
    
    // Check if polling is already running (prevent duplicate calls)
    if (letterboxdPollInterval) {
        // Already running, no need to restart
        return;
    }
    
    // Clear any existing interval to prevent duplicates (shouldn't happen due to check above, but just in case)
    stopLetterboxdPolling();
    
    // Poll immediately on start (after a short delay to avoid blocking initialization)
    setTimeout(() => {
        if (isAuthenticated && letterboxdUrl && !letterboxdPollInterval) {
            // Double-check interval wasn't set while waiting
            if (!letterboxdPollInterval) {
                pollForNewLetterboxdReviews();
            }
        }
    }, 5000); // Wait 5 seconds after initialization
    
    // Then poll every hour
    letterboxdPollInterval = setInterval(() => {
        if (isAuthenticated && letterboxdUrl) {
            pollForNewLetterboxdReviews();
        } else {
            // Stop polling if no longer authenticated or URL removed
            stopLetterboxdPolling();
        }
    }, 3600000); // 1 hour = 3600000 ms
    
    console.log('Letterboxd automatic polling started (every hour)');
}

/**
 * Stop automatic polling for new Letterboxd reviews
 */
function stopLetterboxdPolling() {
    if (letterboxdPollInterval) {
        clearInterval(letterboxdPollInterval);
        letterboxdPollInterval = null;
        // Only log if we're actually stopping something (not just being called as a safety check)
    }
}

// ============================================
// Kiss Emoji Explosion
// ============================================

function triggerKissExplosion() {
    const explosion = document.createElement('div');
    explosion.className = 'kiss-explosion';
    document.body.appendChild(explosion);
    
    const emojiCount = 30;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    for (let i = 0; i < emojiCount; i++) {
        const emoji = document.createElement('span');
        emoji.className = 'kiss-emoji';
        emoji.textContent = '💋';
        
        // Random angle and distance for explosion
        const angle = (Math.PI * 2 * i) / emojiCount + (Math.random() - 0.5) * 0.5;
        const distance = 150 + Math.random() * 100;
        const randomX = Math.cos(angle) * distance;
        const randomY = Math.sin(angle) * distance;
        const randomRotate = (Math.random() - 0.5) * 720; // Random rotation up to 360 degrees
        
        emoji.style.setProperty('--random-x', `${randomX}px`);
        emoji.style.setProperty('--random-y', `${randomY}px`);
        emoji.style.setProperty('--random-rotate', `${randomRotate}deg`);
        
        // Random delay for staggered effect
        emoji.style.animationDelay = `${Math.random() * 0.2}s`;
        
        explosion.appendChild(emoji);
    }
    
    // Remove the explosion container after animation completes
    setTimeout(() => {
        explosion.remove();
    }, 2000);
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isAuthenticated) {
                switchTab(btn.dataset.tab);
            }
        });
    });
    
    // Status toggle - click "offline" to sign in, click "online" to sign out
    if (!elements.statusToggle) {
        console.error('statusToggle element not found');
        return;
    }
    elements.statusToggle.addEventListener('click', () => {
        if (!isAuthenticated) {
            // Clicking "offline" - show auth panel
            if (elements.authPanel.classList.contains('hidden')) {
                showAuthPanel();
            } else {
                hideAuthPanel();
            }
        } else {
            // Clicking "online" - sign out
            if (confirm('sign out?')) {
                signOut();
            }
        }
    });
    
    // Auth submit
    if (elements.authSubmit) {
        elements.authSubmit.addEventListener('click', authenticate);
    }
    if (elements.passwordInput) {
        elements.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') authenticate();
        });
    }
    if (elements.emailInput) {
        elements.emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') authenticate();
        });
    }
    
    // Post submit
    if (elements.postSubmit) {
        elements.postSubmit.addEventListener('click', handleCreatePost);
    }
    if (elements.postContent) {
        elements.postContent.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.metaKey) handleCreatePost();
        });
    }
    if (elements.postTag) {
        elements.postTag.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCreatePost();
            }
        });
    }
    
    // Close button handler for write panel
    if (elements.writePanelClose) {
        elements.writePanelClose.addEventListener('click', () => {
            // Use the proper exitFullscreen function if available (set up later in fullscreen setup)
            if (elements.writePanel && elements.writePanel.exitFullscreen) {
                elements.writePanel.exitFullscreen();
            } else {
                // Fallback for when exitFullscreen isn't set up yet
            const scrollY = elements.writePanel._savedScrollY || 0;
            elements.writePanel.classList.remove('write-panel-fullscreen');
            if (isAuthenticated) {
                elements.writePanel.classList.add('write-panel-sticky');
            }
                document.body.classList.remove('panel-fullscreen-mode');
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.width = '';
            document.body.style.top = '';
            window.scrollTo(0, scrollY);
            elements.writePanel._savedScrollY = null;
            }
            // Blur any focused inputs
            if (document.activeElement === elements.postContent || document.activeElement === elements.postTag) {
                document.activeElement.blur();
            }
        });
    }
    
    // Fullscreen panel on mobile when input is focused - treat as separate page
    if (elements.postContent && elements.writePanel) {
        let viewportHandler = null;
        
        const updatePanelSize = () => {
            if (!elements.writePanel.classList.contains('write-panel-fullscreen')) return;
            
                        if (window.visualViewport) {
                            // Use visual viewport height (space above keyboard)
                const viewportHeight = window.visualViewport.height;
                const viewportTop = window.visualViewport.offsetTop || 0;
                
                // Set panel to fill visible viewport above keyboard
                // Use box-sizing: border-box so padding is included in height
                // IMPORTANT: The height includes padding, so content area is smaller
                // Buttons must be visible, so textarea will scroll if needed
                elements.writePanel.style.setProperty('height', `${viewportHeight}px`, 'important');
                elements.writePanel.style.top = `${viewportTop}px`;
                elements.writePanel.style.bottom = '';
                // Override min-height from CSS to use exact viewport height (with !important)
                elements.writePanel.style.setProperty('min-height', `${viewportHeight}px`, 'important');
                elements.writePanel.style.setProperty('max-height', `${viewportHeight}px`, 'important');
                // Ensure buttons are visible by using flexbox properly
                elements.writePanel.style.display = 'flex';
                elements.writePanel.style.flexDirection = 'column';
                // Ensure buttons container is always visible
                const actionsEl = elements.writePanel.querySelector('.write-actions');
                if (actionsEl) {
                    actionsEl.style.flexShrink = '0';
                    actionsEl.style.flexGrow = '0';
                    actionsEl.style.marginTop = 'auto';
                    actionsEl.style.visibility = 'visible';
                    actionsEl.style.display = 'flex';
                }
                
                // Force a reflow to ensure styles are applied
                void elements.writePanel.offsetHeight;
                        } else {
                // Fallback
                            elements.writePanel.style.height = `${window.innerHeight}px`;
                            elements.writePanel.style.top = '0px';
                        }
        };
        
        const enterFullscreen = () => {
            if (window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                
                // Save scroll position
                const scrollY = window.scrollY;
                elements.writePanel._savedScrollY = scrollY;
                
                // Hide all main content
                document.documentElement.classList.add('panel-fullscreen-mode');
                document.body.classList.add('panel-fullscreen-mode');
                
                // Remove sticky, add fullscreen class
                elements.writePanel.classList.remove('write-panel-sticky');
                elements.writePanel.classList.add('write-panel-fullscreen');
                
                // Clear any inline styles from previous sticky positioning before applying fullscreen
                elements.writePanel.style.bottom = '';
                elements.writePanel.style.left = '';
                elements.writePanel.style.right = '';
                elements.writePanel.style.transform = '';
                elements.writePanel.style.width = '';
                elements.writePanel.style.maxWidth = '';
                // Set top to 0 immediately to ensure proper positioning
                elements.writePanel.style.top = '0px';
                
                // CRITICAL: Remove allowScrollFirst listener if it exists (from previous exit)
                // This MUST be removed completely or it will interfere with scroll prevention
                if (elements.writePanel._allowScrollFirst) {
                    const allowScroll = elements.writePanel._allowScrollFirst;
                    // Remove from all possible locations with all possible options
                    try {
                        document.removeEventListener('touchmove', allowScroll, { capture: true });
                        document.removeEventListener('touchmove', allowScroll, { capture: false });
                        document.removeEventListener('touchmove', allowScroll);
                        document.body.removeEventListener('touchmove', allowScroll, { capture: true });
                        document.body.removeEventListener('touchmove', allowScroll, { capture: false });
                        document.body.removeEventListener('touchmove', allowScroll);
                        window.removeEventListener('touchmove', allowScroll, { capture: true });
                        window.removeEventListener('touchmove', allowScroll, { capture: false });
                        window.removeEventListener('touchmove', allowScroll);
                    } catch (e) {
                        // Ignore errors
                    }
                    elements.writePanel._allowScrollFirst = null;
                }
                // Force a small delay to ensure removal is complete
                void document.body.offsetHeight;
                
                // Scroll prevention using inline styles with !important for reliability
                // Don't use position: fixed to avoid layout shifts
                document.body.style.setProperty('overflow', 'hidden', 'important');
                document.documentElement.style.setProperty('overflow', 'hidden', 'important');
                
                // Set pink background on body/html to cover keyboard toolbar area
                document.body.style.setProperty('background', 'rgba(255, 245, 250, 1)', 'important');
                document.documentElement.style.setProperty('background', 'rgba(255, 245, 250, 1)', 'important');
                
                // Prevent scroll events
                const preventScroll = (e) => {
                    if (e.target.tagName !== 'TEXTAREA') {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                };
                document.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
                document.addEventListener('wheel', preventScroll, { passive: false, capture: true });
                document.addEventListener('scroll', preventScroll, { passive: false, capture: true });
                elements.writePanel._preventScroll = preventScroll;
                
                // Set initial size
                updatePanelSize();
                
                // Update when keyboard appears/disappears
                if (window.visualViewport) {
                    viewportHandler = () => {
                        updatePanelSize();
                    };
                    window.visualViewport.addEventListener('resize', viewportHandler);
                    window.visualViewport.addEventListener('scroll', viewportHandler);
                }
            }
        };
        
        const exitFullscreen = () => {
            // Check if we already exited or never entered (prevent double-calls)
            // Also check if panel is actually in fullscreen mode
            const wasFullscreen = elements.writePanel.classList.contains('write-panel-fullscreen');
            if (elements.writePanel._savedScrollY == null && !wasFullscreen) {
                // But still ensure scroll is restored if it was hidden
                if (document.body.style.overflow === 'hidden' || document.body.style.overflow === '') {
                    document.body.style.setProperty('overflow', 'auto', 'important');
                    document.documentElement.style.setProperty('overflow', 'auto', 'important');
                }
                return;
            }
            
            // If _savedScrollY is null but panel is still in fullscreen, use current scroll position
            if (elements.writePanel._savedScrollY == null) {
                elements.writePanel._savedScrollY = window.scrollY || 0;
            }
            
            // Get saved scroll position FIRST, before any cleanup
            const scrollY = elements.writePanel._savedScrollY || 0;
            elements.writePanel._savedScrollY = null; // Clear immediately to prevent double-calls
            
            // CRITICAL: Add allowScrollFirst FIRST (before removing preventScroll)
            // This ensures it runs before any other listeners and allows scrolling
            const allowScrollFirst = (e) => {
                const target = e.target;
                // Allow scrolling on the main page content, but not on inputs/textareas
                if (target.tagName !== 'TEXTAREA' && 
                    target.tagName !== 'INPUT' && 
                    !target.closest('textarea') && 
                    !target.closest('input')) {
                    // For main page content, stop propagation so other listeners don't prevent scroll
                    e.stopImmediatePropagation();
                    // Don't prevent default - let the scroll happen
                }
            };
            // Add FIRST with highest priority (capture phase)
            document.addEventListener('touchmove', allowScrollFirst, { passive: false, capture: true });
            document.body.addEventListener('touchmove', allowScrollFirst, { passive: false, capture: true });
            window.addEventListener('touchmove', allowScrollFirst, { passive: false, capture: true });
            elements.writePanel._allowScrollFirst = allowScrollFirst;
            
            // NOW remove scroll prevention (after allowScrollFirst is in place)
            if (elements.writePanel._preventScroll) {
                const preventScroll = elements.writePanel._preventScroll;
                document.body.removeEventListener('touchmove', preventScroll, { capture: true });
                document.removeEventListener('touchmove', preventScroll, { capture: true });
                window.removeEventListener('touchmove', preventScroll, { capture: true });
                document.removeEventListener('wheel', preventScroll, { capture: true });
                document.removeEventListener('scroll', preventScroll, { capture: true });
                elements.writePanel._preventScroll = null;
            }
            
            // CRITICAL: Also disable the global scroll prevention system if it's enabled
            if (typeof disableScrollPrevention === 'function') {
                disableScrollPrevention();
                disableScrollPrevention(); // Call it again to be sure
            }
            
            // Remove viewport listener
            if (viewportHandler && window.visualViewport) {
                window.visualViewport.removeEventListener('resize', viewportHandler);
                window.visualViewport.removeEventListener('scroll', viewportHandler);
                viewportHandler = null;
            }
            
            // Remove fullscreen mode from body/html FIRST (before panel changes)
            document.documentElement.classList.remove('panel-fullscreen-mode');
            document.body.classList.remove('panel-fullscreen-mode');
            
            // CRITICAL: Explicitly reset body/html backgrounds BEFORE removing panel class
            // This ensures the pink safe areas disappear immediately
            // Also reset any ::before pseudo-elements by forcing a reflow
            document.body.style.setProperty('background', 'var(--bg)', 'important');
            document.documentElement.style.setProperty('background', 'var(--bg)', 'important');
            // Remove any inline styles that might be causing pink backgrounds
            document.body.style.removeProperty('background-color');
            document.documentElement.style.removeProperty('background-color');
            // Force reflow to apply background changes and remove pseudo-elements
            void document.body.offsetHeight;
            // Use requestAnimationFrame to ensure CSS pseudo-elements update
            requestAnimationFrame(() => {
                document.body.style.setProperty('background', 'var(--bg)', 'important');
                document.documentElement.style.setProperty('background', 'var(--bg)', 'important');
            });
            
            // Remove fullscreen class, restore sticky
            // Toggle the class off and on to force CSS pseudo-elements to update
                    elements.writePanel.classList.remove('write-panel-fullscreen');
            // Force a reflow to ensure CSS pseudo-elements are removed
            void elements.writePanel.offsetHeight;
            // Add a temporary class to force re-render, then remove it
            elements.writePanel.classList.add('write-panel-temp');
            void elements.writePanel.offsetHeight;
            elements.writePanel.classList.remove('write-panel-temp');
                        elements.writePanel.classList.add('write-panel-sticky');
            
            // Ensure the panel background is correct for sticky mode
            elements.writePanel.style.setProperty('background', 'rgba(255, 245, 250, 0.95)', 'important');
            
            // Force multiple reflows to ensure all CSS updates
            void document.body.offsetHeight;
            void elements.writePanel.offsetHeight;
            void document.documentElement.offsetHeight;
            
            // Final check: ensure no pink backgrounds remain
            requestAnimationFrame(() => {
                document.body.style.setProperty('background', 'var(--bg)', 'important');
                document.documentElement.style.setProperty('background', 'var(--bg)', 'important');
            });
            
            // Force sticky positioning with inline styles
            // Clear ALL fullscreen styles first
            elements.writePanel.style.height = '';
            elements.writePanel.style.minHeight = '';
            elements.writePanel.style.maxHeight = '';
            elements.writePanel.style.top = '';
            elements.writePanel.style.bottom = '';
            elements.writePanel.style.left = '';
            elements.writePanel.style.right = '';
            elements.writePanel.style.transform = '';
            elements.writePanel.style.width = '';
            elements.writePanel.style.maxWidth = '';
            elements.writePanel.style.display = '';
            // Force reflow to clear styles
            void elements.writePanel.offsetHeight;
            // Now set sticky styles
            elements.writePanel.style.position = 'fixed';
            elements.writePanel.style.bottom = 'calc(1.5rem + env(safe-area-inset-bottom, 0px))';
            elements.writePanel.style.left = '50%';
            elements.writePanel.style.transform = 'translateX(-50%)';
            elements.writePanel.style.top = 'auto';
            elements.writePanel.style.right = 'auto';
            elements.writePanel.style.width = 'calc(100% - 4rem)';
            elements.writePanel.style.maxWidth = 'calc(var(--max-width) - 2rem)';
            
            // Remove ALL inline styles that could possibly affect scrolling
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('overflow-x');
            document.body.style.removeProperty('overflow-y');
            document.body.style.removeProperty('position');
            document.body.style.removeProperty('top');
            document.body.style.removeProperty('left');
            document.body.style.removeProperty('width');
            document.body.style.removeProperty('height');
            document.body.style.removeProperty('max-height');
            document.body.style.removeProperty('overscroll-behavior');
            document.body.style.removeProperty('touch-action');
            document.body.style.removeProperty('pointer-events');
            document.documentElement.style.removeProperty('overflow');
            document.documentElement.style.removeProperty('overflow-x');
            document.documentElement.style.removeProperty('overflow-y');
            document.documentElement.style.removeProperty('height');
            document.documentElement.style.removeProperty('max-height');
            document.documentElement.style.removeProperty('overscroll-behavior');
            document.documentElement.style.removeProperty('touch-action');
            document.documentElement.style.removeProperty('pointer-events');
            
            // CRITICAL FIX: Set overflow to auto to fully restore scrolling
            document.body.style.setProperty('overflow', 'auto', 'important');
            document.documentElement.style.setProperty('overflow', 'auto', 'important');
            
            // Force multiple reflows to ensure iOS Safari recognizes scroll is enabled
            void document.body.offsetHeight;
            void document.documentElement.offsetHeight;
            document.body.style.transform = 'translateZ(0)';
            void document.body.offsetHeight;
            document.body.style.removeProperty('transform');
            
            // Force multiple reflows to ensure styles are applied
            void document.body.offsetHeight;
            void document.documentElement.offsetHeight;
            
            // Restore scroll position immediately
            window.scrollTo(0, scrollY);
        };
        
        // Make exitFullscreen available on the panel element
        elements.writePanel.exitFullscreen = exitFullscreen;
        
        // Flag to prevent blur from exiting when clicking to enter
        let isClickingToEnter = false;
        
        // Focus handler - enters fullscreen when textarea is focused
        elements.postContent.addEventListener('focus', () => {
            // Don't enter fullscreen if we're just focusing textarea to enable tag input
            if (elements.writePanel._isFocusingTagInput) {
                return;
            }
            // Only enter fullscreen if not already in fullscreen
            if (!elements.writePanel.classList.contains('write-panel-fullscreen')) {
                enterFullscreen();
            }
        });
        
        // Click handler - ensure focus happens and prevent blur from exiting
        elements.postContent.addEventListener('click', (e) => {
            // Set flag to prevent blur from exiting
            isClickingToEnter = true;
            // Let the natural click behavior focus the textarea
            // The focus event will handle entering fullscreen
            setTimeout(() => {
                // Ensure focus happened
                if (document.activeElement !== elements.postContent) {
                    elements.postContent.focus();
                }
            }, 10);
            // Reset flag after delay
            setTimeout(() => {
                isClickingToEnter = false;
            }, 500);
        });
        
        elements.postContent.addEventListener('touchstart', (e) => {
            // Set flag to prevent blur from exiting
            isClickingToEnter = true;
            // Let the natural touchstart behavior focus the textarea
            setTimeout(() => {
                isClickingToEnter = false;
            }, 500);
        });
        
        // Also handle clicks on the panel itself (for sticky panel clicks)
        elements.writePanel.addEventListener('click', (e) => {
            const target = e.target;
            // Don't interfere with button clicks
            if (target.tagName === 'BUTTON' || target.closest('button')) {
                return;
            }
            // Don't interfere with tag input clicks - let the tag input handle its own focus
            if (target === elements.postTag || target.closest('.write-tag-section') || target.closest('#tag-suggestions')) {
                return;
            }
            // If clicking anywhere in the panel (not a button), focus the textarea
            if (target === elements.postContent || 
                target.closest('textarea') === elements.postContent ||
                (target.closest('.write-panel') === elements.writePanel && !target.closest('button'))) {
                // Set flag to prevent blur from exiting fullscreen
                isClickingToEnter = true;
                // Focus the textarea immediately - this should trigger focus event
                elements.postContent.focus();
                // Also ensure focus happens after a tiny delay
                setTimeout(() => {
                    if (document.activeElement !== elements.postContent) {
                        elements.postContent.focus();
                    }
                }, 10);
                // Keep flag set longer to prevent blur from exiting
                setTimeout(() => {
                    isClickingToEnter = false;
                }, 500);
            }
        }, true); // Use capture phase to catch it early
        
        elements.postContent.addEventListener('blur', () => {
            // Delay to allow submit button clicks to work and keyboard to appear
            setTimeout(() => {
                // Don't exit if we're currently submitting (handleCreatePost will handle it)
                if (elements.writePanel._isSubmitting) {
                    return;
                }
                
                // Don't exit if user is clicking to re-enter fullscreen
                if (isClickingToEnter) {
                    // Don't reset flag here - let the timeout in click handler do it
                    return;
                }
                
                // Check if textarea is actually focused now (keyboard might have refocused it)
                if (document.activeElement === elements.postContent) {
                    return;
                }
                
                // Don't exit if tag input is focused
                if (document.activeElement === elements.postTag) {
                    return;
                }
                
                exitFullscreen();
            }, 300); // Increased delay to allow keyboard to appear
        });
    }
    
    if (elements.postTag && elements.writePanel) {
        // When tag input is focused, ensure panel is in fullscreen
        // If panel is not already fullscreen, trigger it by focusing textarea first
        let isHandlingTagFocus = false;
        const ensureFullscreen = () => {
            // Prevent multiple simultaneous calls
            if (isHandlingTagFocus) return;
            isHandlingTagFocus = true;
            
            if (window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                if (!elements.writePanel.classList.contains('write-panel-fullscreen')) {
                    // Panel not in fullscreen, trigger the main fullscreen logic
                    // Set flag to prevent textarea focus handler from interfering
                    elements.writePanel._isFocusingTagInput = true;
                    // Focus textarea briefly to trigger fullscreen entry
                    elements.postContent.focus();
                    // Then immediately focus the tag input
                    setTimeout(() => {
                        elements.postTag.focus();
                        isHandlingTagFocus = false;
                        // Clear flag after a short delay
                        setTimeout(() => {
                            elements.writePanel._isFocusingTagInput = false;
                        }, 100);
                    }, 10); // Reduced delay for faster response
                } else {
                    // Already fullscreen, just ensure tag input is focused
                    if (document.activeElement !== elements.postTag) {
                        elements.postTag.focus();
                    }
                    isHandlingTagFocus = false;
                }
                // If already fullscreen, the viewport listeners from main handler will keep it updated
            } else {
                isHandlingTagFocus = false;
            }
        };
        
        // Only use focus event - click and touchstart will naturally trigger focus
        elements.postTag.addEventListener('focus', ensureFullscreen);
        
        // No blur handler needed - the main textarea blur handler will handle exiting fullscreen
        // when both inputs lose focus
    }
    
    // Limit input to 10 characters (excluding #) and resize dynamically
    if (elements.postTag) {
        elements.postTag.addEventListener('input', (e) => {
            let value = e.target.value;
            // Remove # for counting
            const withoutHash = value.replace(/^#+/, '');
            if (withoutHash.length > 10) {
                const hash = value.match(/^#+/)?.[0] || '';
                e.target.value = hash + withoutHash.substring(0, 10);
            }
            // Resize input based on content
            resizeTagInput(e.target);
        });
        
        // Resize on focus and initial load
        elements.postTag.addEventListener('focus', () => {
            resizeTagInput(elements.postTag);
            updateTagSuggestions();
        });
        
        // Initial resize
        resizeTagInput(elements.postTag);
    }
    
    // Suggest submit
    if (elements.suggestSubmit) {
        elements.suggestSubmit.addEventListener('click', handleCreateSuggestion);
    }
    if (elements.suggestContent) {
        elements.suggestContent.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.metaKey) handleCreateSuggestion();
        });
    }
    
    // Close button handler for suggest panel
    if (elements.suggestPanelClose) {
        elements.suggestPanelClose.addEventListener('click', () => {
            // Use the proper exitFullscreen function if available (set up later in fullscreen setup)
            if (elements.suggestPanel && elements.suggestPanel.exitFullscreen) {
                elements.suggestPanel.exitFullscreen();
            } else {
                // Fallback for when exitFullscreen isn't set up yet
            elements.suggestPanel.classList.remove('suggest-panel-fullscreen');
            elements.suggestPanel.classList.add('suggest-panel-sticky');
                document.body.classList.remove('panel-fullscreen-mode');
                document.body.style.overflow = '';
            }
            elements.suggestContent.value = '';
            if (document.activeElement === elements.suggestContent) {
                elements.suggestContent.blur();
            }
        });
    }
    
    // Fullscreen panel on mobile when input is focused - treat as separate page
    if (elements.suggestContent && elements.suggestPanel) {
        let viewportHandler = null;
        
        const updatePanelSize = () => {
            if (!elements.suggestPanel.classList.contains('suggest-panel-fullscreen')) return;
            
                        if (window.visualViewport) {
                            // Use visual viewport height (space above keyboard)
                const viewportHeight = window.visualViewport.height;
                
                // Set panel to fill visible viewport above keyboard
                // Always position at top: 0
                // Use the full viewport height - the panel will fill it completely
                // Use box-sizing: border-box so padding is included in height
                // IMPORTANT: The height includes padding, so content area is smaller
                // Buttons must be visible, so textarea will scroll if needed
                elements.suggestPanel.style.setProperty('height', `${viewportHeight}px`, 'important');
                elements.suggestPanel.style.top = '0px';
                elements.suggestPanel.style.bottom = '';
                // Override min-height from CSS to use exact viewport height (with !important)
                elements.suggestPanel.style.setProperty('min-height', `${viewportHeight}px`, 'important');
                elements.suggestPanel.style.setProperty('max-height', `${viewportHeight}px`, 'important');
                // Ensure buttons are visible by using flexbox properly
                elements.suggestPanel.style.display = 'flex';
                elements.suggestPanel.style.flexDirection = 'column';
                // Ensure buttons container is always visible
                const actionsEl = elements.suggestPanel.querySelector('.suggest-actions');
                if (actionsEl) {
                    actionsEl.style.flexShrink = '0';
                    actionsEl.style.flexGrow = '0';
                    actionsEl.style.marginTop = 'auto';
                    actionsEl.style.visibility = 'visible';
                    actionsEl.style.display = 'flex';
                }
                
                // Force a reflow to ensure styles are applied
                void elements.suggestPanel.offsetHeight;
                        } else {
                // Fallback
                            elements.suggestPanel.style.height = `${window.innerHeight}px`;
                            elements.suggestPanel.style.top = '0px';
                        }
        };
        
        const enterFullscreen = () => {
            if (window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                
                // Save scroll position
                const scrollY = window.scrollY;
                elements.suggestPanel._savedScrollY = scrollY;
                
                // Hide all main content
                document.documentElement.classList.add('panel-fullscreen-mode');
                document.body.classList.add('panel-fullscreen-mode');
                
                // Remove sticky, add fullscreen class
                elements.suggestPanel.classList.remove('suggest-panel-sticky');
                elements.suggestPanel.classList.add('suggest-panel-fullscreen');
                
                // Clear any inline styles from previous sticky positioning before applying fullscreen
                elements.suggestPanel.style.bottom = '';
                elements.suggestPanel.style.left = '';
                elements.suggestPanel.style.right = '';
                elements.suggestPanel.style.transform = '';
                elements.suggestPanel.style.width = '';
                elements.suggestPanel.style.maxWidth = '';
                // Set top to 0 immediately to ensure proper positioning
                elements.suggestPanel.style.top = '0px';
                
                // CRITICAL: Remove allowScrollFirst listener if it exists (from previous exit)
                // This MUST be removed completely or it will interfere with scroll prevention
                if (elements.suggestPanel._allowScrollFirst) {
                    const allowScroll = elements.suggestPanel._allowScrollFirst;
                    // Remove from all possible locations with all possible options
                    try {
                        document.removeEventListener('touchmove', allowScroll, { capture: true });
                        document.removeEventListener('touchmove', allowScroll, { capture: false });
                        document.removeEventListener('touchmove', allowScroll);
                        document.body.removeEventListener('touchmove', allowScroll, { capture: true });
                        document.body.removeEventListener('touchmove', allowScroll, { capture: false });
                        document.body.removeEventListener('touchmove', allowScroll);
                        window.removeEventListener('touchmove', allowScroll, { capture: true });
                        window.removeEventListener('touchmove', allowScroll, { capture: false });
                        window.removeEventListener('touchmove', allowScroll);
                    } catch (e) {
                        // Ignore errors
                    }
                    elements.suggestPanel._allowScrollFirst = null;
                }
                // Force a small delay to ensure removal is complete
                void document.body.offsetHeight;
                
                // Scroll prevention using inline styles with !important for reliability
                // This prevents layout shifts and ensures we can cleanly remove it later
                document.body.style.setProperty('overflow', 'hidden', 'important');
                document.documentElement.style.setProperty('overflow', 'hidden', 'important');
                
                // Set pink background on body/html to cover keyboard toolbar area
                document.body.style.setProperty('background', 'rgba(255, 245, 250, 1)', 'important');
                document.documentElement.style.setProperty('background', 'rgba(255, 245, 250, 1)', 'important');
                
                // Scroll prevention - ONLY allow scrolling in TEXTAREA (this was the working solution!)
                const preventScroll = (e) => {
                    // Check both target and currentTarget to catch all cases
                    const target = e.target;
                    const currentTarget = e.currentTarget;
                    
                    // ONLY allow scrolling in textarea - nothing else
                    // Check if the event is coming from or going to a textarea
                    const isTextarea = (target && target.tagName === 'TEXTAREA') ||
                                      (target && target.closest('textarea')) ||
                                      (currentTarget && currentTarget.tagName === 'TEXTAREA');
                    
                    if (isTextarea) {
                        // Only allow if it's actually the textarea element
                        if (target && target.tagName === 'TEXTAREA') {
                            return; // Allow textarea to scroll (keyboard works!)
                        }
                        // If it's within textarea but not the textarea itself, still prevent
                    }
                    
                    // Prevent ALL touchmove events for scrolling
                    e.preventDefault();
                    e.stopImmediatePropagation(); // Stop ALL other listeners
                    e.stopPropagation();
                    return false;
                };
                
                // Also prevent scroll and wheel events
                const preventScrollEvents = (e) => {
                    const target = e.target;
                    // Only allow scroll events in textarea
                    if (target && target.tagName === 'TEXTAREA') {
                        return;
                    }
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return false;
                };
                
                // Add preventScroll with HIGHEST priority (capture phase, first to register)
                // This must run BEFORE any other listeners to prevent scrolling
                // Remove any existing listeners first to ensure clean state
                document.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
                document.body.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
                window.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
                // Also prevent scroll and wheel events
                document.addEventListener('scroll', preventScrollEvents, { passive: false, capture: true });
                window.addEventListener('scroll', preventScrollEvents, { passive: false, capture: true });
                document.addEventListener('wheel', preventScrollEvents, { passive: false, capture: true });
                elements.suggestPanel._preventScroll = preventScroll;
                elements.suggestPanel._preventScrollEvents = preventScrollEvents;
                
                // Lock scroll position - prevent any programmatic scrolling
                const savedScrollY = window.scrollY;
                const lockScroll = () => {
                    if (window.scrollY !== savedScrollY) {
                        window.scrollTo(0, savedScrollY);
                    }
                };
                const scrollLockInterval = setInterval(lockScroll, 50);
                elements.suggestPanel._scrollLockInterval = scrollLockInterval;
                
                // Set initial size
                updatePanelSize();
                
                // Update when keyboard appears/disappears
                if (window.visualViewport) {
                    viewportHandler = () => {
                        // Only update if still in fullscreen
                        if (elements.suggestPanel.classList.contains('suggest-panel-fullscreen')) {
                            updatePanelSize();
                } else {
                            // Panel is no longer fullscreen, remove this handler
                            window.visualViewport.removeEventListener('resize', viewportHandler);
                            elements.suggestPanel._viewportHandler = null;
                        }
                    };
                    window.visualViewport.addEventListener('resize', viewportHandler);
                    elements.suggestPanel._viewportHandler = viewportHandler;
                }
            }
        };
        
        const exitFullscreen = () => {
            // Check if we already exited or never entered (prevent double-calls)
            if (elements.suggestPanel._savedScrollY == null) {
                return;
            }
            
            // Get saved scroll position FIRST, before any cleanup
                        const scrollY = elements.suggestPanel._savedScrollY || 0;
            elements.suggestPanel._savedScrollY = null; // Clear immediately to prevent double-calls
            
            // CRITICAL: Add allowScrollFirst FIRST (before removing preventScroll)
            // This ensures it runs before any other listeners and allows scrolling
            const allowScrollFirst = (e) => {
                const target = e.target;
                // Allow scrolling on the main page content, but not on inputs/textareas
                if (target.tagName !== 'TEXTAREA' && 
                    target.tagName !== 'INPUT' && 
                    !target.closest('textarea') && 
                    !target.closest('input')) {
                    // For main page content, stop propagation so other listeners don't prevent scroll
                    e.stopImmediatePropagation();
                    // Don't prevent default - let the scroll happen
                }
            };
            // Add FIRST with highest priority (capture phase)
            document.addEventListener('touchmove', allowScrollFirst, { passive: false, capture: true });
            document.body.addEventListener('touchmove', allowScrollFirst, { passive: false, capture: true });
            window.addEventListener('touchmove', allowScrollFirst, { passive: false, capture: true });
            elements.suggestPanel._allowScrollFirst = allowScrollFirst;
            
            // NOW remove scroll prevention (after allowScrollFirst is in place)
            if (elements.suggestPanel._preventScroll) {
                const preventScroll = elements.suggestPanel._preventScroll;
                document.body.removeEventListener('touchmove', preventScroll, { capture: true });
                document.removeEventListener('touchmove', preventScroll, { capture: true });
                window.removeEventListener('touchmove', preventScroll, { capture: true });
                elements.suggestPanel._preventScroll = null;
            }
            // Also remove scroll/wheel event prevention
            if (elements.suggestPanel._preventScrollEvents) {
                const preventScrollEvents = elements.suggestPanel._preventScrollEvents;
                document.removeEventListener('scroll', preventScrollEvents, { capture: true });
                window.removeEventListener('scroll', preventScrollEvents, { capture: true });
                document.removeEventListener('wheel', preventScrollEvents, { capture: true });
                elements.suggestPanel._preventScrollEvents = null;
            }
            
            // CRITICAL: Also disable the global scroll prevention system if it's enabled
            if (typeof disableScrollPrevention === 'function') {
                disableScrollPrevention();
                disableScrollPrevention(); // Call it again to be absolutely sure
            }
            
            // Also try to manually remove global listeners if they exist
            if (typeof scrollPreventionHandler !== 'undefined' && scrollPreventionHandler !== null) {
                try {
                    document.removeEventListener('touchmove', scrollPreventionHandler, { capture: true });
                    document.removeEventListener('wheel', scrollPreventionHandler, { capture: true });
                    document.removeEventListener('scroll', scrollPreventionHandler, { capture: true });
                    window.removeEventListener('scroll', scrollPreventionHandler, { capture: true });
                    document.removeEventListener('touchstart', scrollPreventionHandler, { capture: true });
                    scrollPreventionHandler = null;
                } catch (e) {
                    // Ignore errors
                }
            }
            if (typeof bodyScrollPreventionHandler !== 'undefined' && bodyScrollPreventionHandler !== null) {
                try {
                    document.body.removeEventListener('touchmove', bodyScrollPreventionHandler);
                    document.body.removeEventListener('wheel', bodyScrollPreventionHandler);
                    bodyScrollPreventionHandler = null;
                } catch (e) {
                    // Ignore errors
                }
            }
            
            // Remove scroll lock interval if it exists
            if (elements.suggestPanel._scrollLockInterval) {
                clearInterval(elements.suggestPanel._scrollLockInterval);
                elements.suggestPanel._scrollLockInterval = null;
            }
            
            // Remove viewport listener FIRST to prevent interference
            if (elements.suggestPanel._viewportHandler && window.visualViewport) {
                const handler = elements.suggestPanel._viewportHandler;
                window.visualViewport.removeEventListener('resize', handler);
                // Also try removing scroll listener just in case
                try {
                    window.visualViewport.removeEventListener('scroll', handler);
                } catch (e) {
                    // Ignore if scroll listener wasn't added
                }
                elements.suggestPanel._viewportHandler = null;
            }
            
            // Remove fullscreen mode from body/html FIRST (before panel changes)
            document.documentElement.classList.remove('panel-fullscreen-mode');
            document.body.classList.remove('panel-fullscreen-mode');
            
            // CRITICAL: Explicitly reset body/html backgrounds BEFORE removing panel class
            // This ensures the pink safe areas disappear immediately
            // Also reset any ::before pseudo-elements by forcing a reflow
            document.body.style.setProperty('background', 'var(--bg)', 'important');
            document.documentElement.style.setProperty('background', 'var(--bg)', 'important');
            // Remove any inline styles that might be causing pink backgrounds
            document.body.style.removeProperty('background-color');
            document.documentElement.style.removeProperty('background-color');
            // Force reflow to apply background changes and remove pseudo-elements
            void document.body.offsetHeight;
            // Use requestAnimationFrame to ensure CSS pseudo-elements update
            requestAnimationFrame(() => {
                document.body.style.setProperty('background', 'var(--bg)', 'important');
                document.documentElement.style.setProperty('background', 'var(--bg)', 'important');
            });
            
            // Remove fullscreen class, restore sticky
            // Toggle the class off and on to force CSS pseudo-elements to update
            elements.suggestPanel.classList.remove('suggest-panel-fullscreen');
            // Force a reflow to ensure CSS pseudo-elements are removed
            void elements.suggestPanel.offsetHeight;
            // Add a temporary class to force re-render, then remove it
            elements.suggestPanel.classList.add('suggest-panel-temp');
            void elements.suggestPanel.offsetHeight;
            elements.suggestPanel.classList.remove('suggest-panel-temp');
            elements.suggestPanel.classList.add('suggest-panel-sticky');
            
            // Ensure the panel background is correct for sticky mode
            elements.suggestPanel.style.setProperty('background', 'rgba(255, 245, 250, 0.95)', 'important');
            
            // Force multiple reflows to ensure all CSS updates
            void document.body.offsetHeight;
            void elements.suggestPanel.offsetHeight;
            void document.documentElement.offsetHeight;
            
            // Final check: ensure no pink backgrounds remain
            requestAnimationFrame(() => {
                document.body.style.setProperty('background', 'var(--bg)', 'important');
                document.documentElement.style.setProperty('background', 'var(--bg)', 'important');
            });
            
            // Force sticky positioning with inline styles
            // Clear ALL fullscreen styles first
            elements.suggestPanel.style.height = '';
            elements.suggestPanel.style.minHeight = '';
            elements.suggestPanel.style.maxHeight = '';
            elements.suggestPanel.style.top = '';
            elements.suggestPanel.style.bottom = '';
            elements.suggestPanel.style.left = '';
            elements.suggestPanel.style.right = '';
            elements.suggestPanel.style.transform = '';
            elements.suggestPanel.style.width = '';
            elements.suggestPanel.style.maxWidth = '';
            elements.suggestPanel.style.display = '';
            // Force reflow to clear styles
            void elements.suggestPanel.offsetHeight;
            // Now set sticky styles
            elements.suggestPanel.style.position = 'fixed';
            elements.suggestPanel.style.bottom = 'calc(1.5rem + env(safe-area-inset-bottom, 0px))';
            elements.suggestPanel.style.left = '50%';
            elements.suggestPanel.style.transform = 'translateX(-50%)';
            elements.suggestPanel.style.top = 'auto';
            elements.suggestPanel.style.right = 'auto';
            elements.suggestPanel.style.width = 'calc(100% - 4rem)';
            elements.suggestPanel.style.maxWidth = 'calc(var(--max-width) - 2rem)';
            
            // Remove ALL inline styles that could possibly affect scrolling
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('overflow-x');
            document.body.style.removeProperty('overflow-y');
            document.body.style.removeProperty('position');
            document.body.style.removeProperty('top');
            document.body.style.removeProperty('left');
            document.body.style.removeProperty('width');
            document.body.style.removeProperty('height');
            document.body.style.removeProperty('max-height');
            document.body.style.removeProperty('overscroll-behavior');
            document.body.style.removeProperty('touch-action');
            document.body.style.removeProperty('pointer-events');
            document.documentElement.style.removeProperty('overflow');
            document.documentElement.style.removeProperty('overflow-x');
            document.documentElement.style.removeProperty('overflow-y');
            document.documentElement.style.removeProperty('height');
            document.documentElement.style.removeProperty('max-height');
            document.documentElement.style.removeProperty('overscroll-behavior');
            document.documentElement.style.removeProperty('touch-action');
            document.documentElement.style.removeProperty('pointer-events');
            
            // CRITICAL FIX: Set overflow to auto to fully restore scrolling
            // Don't set height to auto - just remove it and let natural height take over
            document.body.style.setProperty('overflow', 'auto', 'important');
            document.documentElement.style.setProperty('overflow', 'auto', 'important');
            
            // Force multiple reflows to ensure iOS Safari recognizes scroll is enabled
            void document.body.offsetHeight;
            void document.documentElement.offsetHeight;
            document.body.style.transform = 'translateZ(0)';
            void document.body.offsetHeight;
            document.body.style.removeProperty('transform');
            
            // Force multiple reflows to ensure styles are applied
            void document.body.offsetHeight;
            void document.documentElement.offsetHeight;
            
            // Restore scroll position immediately
            window.scrollTo(0, scrollY);
            
            // iOS Safari workaround: Force scroll capability by temporarily enabling scroll
            // and then restoring position. Sometimes iOS needs this to "unlock" scrolling.
            setTimeout(() => {
                // Check if we can actually scroll
                const canScroll = document.body.scrollHeight > window.innerHeight;
                const currentScroll = window.scrollY;
                
                if (canScroll && currentScroll === 0 && scrollY > 0) {
                    // Try to scroll to the saved position
                    window.scrollTo({
                        top: scrollY,
                        left: 0,
                        behavior: 'auto'
                    });
                }
                
                // Force a tiny scroll movement to "unlock" iOS Safari scrolling
                const testScroll = window.scrollY;
                if (testScroll === 0 && canScroll) {
                    // Try scrolling down 1px and back
                    window.scrollTo(0, 1);
                    setTimeout(() => {
                        window.scrollTo(0, scrollY);
                    }, 10);
                }
            }, 50);
            
            // Try scrolling documentElement if body doesn't work (iOS Safari sometimes uses html)
            if (document.documentElement.scrollHeight > window.innerHeight) {
                document.documentElement.scrollTop = scrollY;
            }
        };
        
        // Make exitFullscreen accessible from outside
        elements.suggestPanel.exitFullscreen = exitFullscreen;
        
        // Focus event handler - enters fullscreen when textarea is focused
        elements.suggestContent.addEventListener('focus', (e) => {
            // Enter fullscreen on focus (this is the working solution!)
            // Only enter if not already in fullscreen to avoid double-entry
            if (!elements.suggestPanel.classList.contains('suggest-panel-fullscreen')) {
            enterFullscreen();
            } else {
                // Ensure focus is maintained for keyboard
                if (document.activeElement !== elements.suggestContent) {
                    setTimeout(() => {
            elements.suggestContent.focus();
                    }, 0);
                }
            }
        });
        
        // Click handler - ensure focus happens and prevent blur from exiting
        elements.suggestContent.addEventListener('click', (e) => {
            // Set flag to prevent blur from exiting
            isClickingToEnter = true;
            // Let the natural click behavior focus the textarea
            // The focus event will handle entering fullscreen
            setTimeout(() => {
                // Ensure focus happened
                if (document.activeElement !== elements.suggestContent) {
                    elements.suggestContent.focus();
                }
            }, 10);
            // Reset flag after delay
            setTimeout(() => {
                isClickingToEnter = false;
            }, 500);
        });
        
        elements.suggestContent.addEventListener('touchstart', (e) => {
            // Set flag to prevent blur from exiting
            isClickingToEnter = true;
            // Let the natural touchstart behavior focus the textarea
            setTimeout(() => {
                isClickingToEnter = false;
            }, 500);
        });
        
        // Also handle clicks on the panel itself (for sticky panel clicks)
        // When clicking "suggest something" placeholder text in sticky panel
        elements.suggestPanel.addEventListener('click', (e) => {
            const target = e.target;
            // Don't interfere with button clicks
            if (target.tagName === 'BUTTON' || target.closest('button')) {
                return;
            }
            // If clicking anywhere in the panel (not a button), focus the textarea
            // This ensures clicking the placeholder or panel focuses the textarea
            if (target === elements.suggestContent || 
                target.closest('textarea') === elements.suggestContent ||
                (target.closest('.suggest-panel') === elements.suggestPanel && !target.closest('button'))) {
                // Set flag to prevent blur from exiting fullscreen
                isClickingToEnter = true;
                // Don't stop propagation - let the natural click behavior happen
                // Focus the textarea immediately - this should trigger focus event
                elements.suggestContent.focus();
                // Also ensure focus happens after a tiny delay
                setTimeout(() => {
                    if (document.activeElement !== elements.suggestContent) {
                        elements.suggestContent.focus();
                    }
                }, 10);
                // Keep flag set longer to prevent blur from exiting
                setTimeout(() => {
                    isClickingToEnter = false;
                }, 500);
            }
        }, true); // Use capture phase to catch it early
        
        elements.suggestContent.addEventListener('blur', () => {
            // Delay to allow submit button clicks to work and keyboard to appear
            setTimeout(() => {
                // Don't exit if we're currently submitting (handleCreateSuggestion will handle it)
                if (elements.suggestPanel._isSubmitting) {
                    return;
                }
                
                // Don't exit if user is clicking to re-enter fullscreen
                if (isClickingToEnter) {
                    // Don't reset flag here - let the timeout in click handler do it
                    return;
                }
                
                // Check if textarea is actually focused now (keyboard might have refocused it)
                if (document.activeElement === elements.suggestContent) {
                    return;
                }
                
                // Only exit fullscreen if the active element is not within the suggest panel
                const activeElement = document.activeElement;
                const isWithinPanel = activeElement && elements.suggestPanel.contains(activeElement);
                
                // Don't exit fullscreen if user clicked a button within the panel
                if (!isWithinPanel) {
                    exitFullscreen();
                }
            }, 300); // Increased delay to allow keyboard to appear
        });
    }
    
    // Random word
    if (!elements.randomWordButton) {
        console.error('randomWordButton element not found');
    } else {
        elements.randomWordButton.addEventListener('click', (e) => {
        e.preventDefault();
        const word = getRandomWord();
        const currentText = elements.suggestContent.value.trim();
        const newText = currentText ? `${currentText} ${word}` : word;
        elements.suggestContent.value = newText;
        
            // Trigger focus to enter fullscreen (if on mobile) and open keyboard
            // The focus event handler will handle entering fullscreen
        elements.suggestContent.focus();
            
        // Set cursor position to the end of the text
        const textLength = elements.suggestContent.value.length;
        elements.suggestContent.setSelectionRange(textLength, textLength);
        });
    }
    
    // Playlist save
    if (elements.playlistSaveButton) {
        elements.playlistSaveButton.addEventListener('click', handleSavePlaylist);
    }
    if (elements.playlistUrlInput) {
        elements.playlistUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSavePlaylist();
        });
    }
    
    
    // Playlist volume toggle
    if (elements.playlistVolumeToggle) {
        elements.playlistVolumeToggle.addEventListener('click', togglePlaylistVolume);
    }
    
    // Skip buttons
    if (elements.playlistSkipBackward) {
        elements.playlistSkipBackward.addEventListener('click', skipPlaylistBackward);
    }
    
    if (elements.playlistSkipForward) {
        elements.playlistSkipForward.addEventListener('click', skipPlaylistForward);
    }
    
    // Letterboxd fetch
    if (elements.letterboxdFetch) {
        elements.letterboxdFetch.addEventListener('click', handleFetchLetterboxdReviews);
    }
    if (elements.letterboxdUrlInput) {
        elements.letterboxdUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleFetchLetterboxdReviews();
        });
    }
    
    // Letterboxd save selection
    if (elements.letterboxdSaveSelection) {
        elements.letterboxdSaveSelection.addEventListener('click', handleSaveLetterboxdSelection);
    }
    
    // Letterboxd toggle all
    if (elements.letterboxdToggleAll) {
        elements.letterboxdToggleAll.addEventListener('click', handleToggleAllReviews);
    }
    
    // Listen for auth state changes
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                checkAuthState();
            }
        });
    } else {
        console.error('Cannot set up auth state listener: supabase is not initialized');
    }
    
    // App status close button
    if (elements.appStatusClose) {
        elements.appStatusClose.addEventListener('click', () => {
            hideAppStatus();
        });
    }
}

// ============================================
// App Status Display
// ============================================

function updateAppStatus(message, type = 'info') {
    if (!elements.appStatusInfo || !elements.appStatusText) return;
    
    elements.appStatusText.textContent = message;
    elements.appStatusInfo.classList.remove('hidden', 'error', 'warning', 'info');
    
    if (type === 'error') {
        elements.appStatusInfo.classList.add('error');
    } else if (type === 'warning') {
        elements.appStatusInfo.classList.add('warning');
    }
    
    elements.appStatusInfo.classList.remove('hidden');
}

function hideAppStatus() {
    if (elements.appStatusInfo) {
        elements.appStatusInfo.classList.add('hidden');
    }
}

// ============================================
// Initialize
// ============================================

// Suppress ERR_BLOCKED_BY_CLIENT errors from YouTube (caused by ad blockers)
// These are non-critical and don't affect functionality
const originalError = console.error;
console.error = function(...args) {
    // Filter out YouTube analytics errors that are blocked by ad blockers
    const message = args.join(' ');
    if (message.includes('ERR_BLOCKED_BY_CLIENT') || 
        message.includes('youtubei/v1/log_event') ||
        message.includes('generate_204')) {
        // Silently ignore - these are expected when ad blockers are active
        return;
    }
    // Call original error handler for other errors
    originalError.apply(console, args);
};

// Prevent and reset text zoom on iOS
function setupZoomPrevention() {
    // Get all input and textarea elements
    const inputs = document.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
        // On focus, ensure font-size is at least 16px to prevent zoom
        input.addEventListener('focus', () => {
            const computedStyle = window.getComputedStyle(input);
            const fontSize = parseFloat(computedStyle.fontSize);
            if (fontSize < 16) {
                input.style.fontSize = '16px';
            }
        });
        
        // On blur, reset zoom if it occurred (fallback)
        input.addEventListener('blur', () => {
            // Small delay to ensure blur completes
            setTimeout(() => {
                // Check if viewport is zoomed
                if (window.visualViewport && window.visualViewport.scale > 1) {
                    // Reset zoom by scrolling slightly and back
                    const scrollY = window.scrollY;
                    window.scrollTo(0, scrollY + 1);
                    window.scrollTo(0, scrollY);
                }
            }, 100);
        });
    });
}

async function init() {
    console.log('Initializing app...');
    
    // Suppress noisy errors from SoundCloud widget (internal widget errors that don't affect functionality)
    const originalError = console.error;
    console.error = function(...args) {
        const errorString = args.join(' ');
        // Filter out SoundCloud widget internal errors
        if (errorString.includes('widget-') && (errorString.includes('isPlaying') || errorString.includes('Cannot read properties'))) {
            // Suppress this specific SoundCloud widget error
            return;
        }
        // Pass through all other errors
        originalError.apply(console, args);
    };
    
    // Also suppress uncaught exceptions from SoundCloud widget
    window.addEventListener('error', (event) => {
        const errorMessage = event.message || '';
        const errorSource = event.filename || '';
        // Suppress SoundCloud widget errors
        if ((errorSource.includes('widget-') || errorSource.includes('soundcloud')) && 
            (errorMessage.includes('isPlaying') || errorMessage.includes('Cannot read properties'))) {
            event.preventDefault();
            return false;
        }
    }, true);
    
    updateAppStatus('initializing app...', 'info');
    
    // Ensure Supabase is loaded before proceeding
    if (!window.supabase) {
        console.log('Waiting for Supabase library to load...');
        updateAppStatus('waiting for supabase library...', 'info');
        // Wait for the script to load
        await new Promise(resolve => {
            const checkSupabase = setInterval(() => {
                if (window.supabase) {
                    clearInterval(checkSupabase);
                    console.log('Supabase library loaded, initializing client...');
                    updateAppStatus('initializing supabase client...', 'info');
                    if (initializeSupabase()) {
                        console.log('Supabase client initialized successfully');
                        updateAppStatus('supabase connected', 'info');
                        resolve();
                    } else {
                        console.error('Failed to initialize Supabase client');
                        updateAppStatus('error: failed to initialize supabase client', 'error');
                        resolve();
                    }
                }
            }, 100);
            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(checkSupabase);
                console.error('Supabase library failed to load after 5 seconds');
                updateAppStatus('error: supabase library failed to load (timeout)', 'error');
                resolve();
            }, 5000);
        });
    } else {
        // Supabase is already loaded, initialize immediately
        console.log('Supabase library already loaded, initializing client...');
        updateAppStatus('initializing supabase client...', 'info');
        if (!initializeSupabase()) {
            console.error('Failed to initialize Supabase client');
            updateAppStatus('error: failed to initialize supabase client', 'error');
            return;
        }
        console.log('Supabase client initialized successfully');
        updateAppStatus('supabase connected', 'info');
    }
    
    if (!supabaseClient) {
        console.error('Supabase client not initialized. App may not work correctly.');
        updateAppStatus('error: supabase client not initialized. app may not work correctly.', 'error');
        // Show error to user if possible
        if (elements.postsContainer) {
            elements.postsContainer.innerHTML = '<p style="color: var(--text-muted); font-family: var(--font-mono);">Error: Failed to load. Please refresh the page.</p>';
        }
        return;
    }
    
    console.log('Setting up event listeners...');
    updateAppStatus('setting up event listeners...', 'info');
    setupEventListeners();
    
    // Setup zoom prevention for inputs
    setupZoomPrevention();
    
    // Load tag suggestions
    updateTagSuggestions();
    
    // Check authentication state
    console.log('Checking authentication state...');
    updateAppStatus('checking authentication...', 'info');
    try {
    await checkAuthState();
    console.log('Initialization complete');
        // Hide status after successful initialization (with a small delay)
        setTimeout(() => {
            hideAppStatus();
        }, 1000);
    } catch (error) {
        console.error('Error during initialization:', error);
        updateAppStatus(`error: ${error.message || 'initialization failed'}`, 'error');
    }
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then((registration) => {
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
}

// Start
init();
