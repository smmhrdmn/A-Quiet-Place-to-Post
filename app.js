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

const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ============================================
// State
// ============================================

let isAuthenticated = false;
let posts = [];
let suggestions = [];
let playlistUrl = null;
let playlistType = 'youtube';
let playlistMuted = true; // Start muted to allow autoplay
let youtubePlayer = null;
let playerReady = false;
let realtimeChannels = [];
let letterboxdReviews = [];
let letterboxdUrl = null;

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
    tabsNav: document.getElementById('tabs-nav'),
    tabFeed: document.getElementById('tab-feed'),
    tabSuggestions: document.getElementById('tab-suggestions'),
    tabAdmin: document.getElementById('tab-admin'),
    letterboxdUrlInput: document.getElementById('letterboxd-url-input'),
    letterboxdFetch: document.getElementById('letterboxd-fetch'),
    letterboxdReviewsContainer: document.getElementById('letterboxd-reviews-container'),
    letterboxdReviewsList: document.getElementById('letterboxd-reviews-list'),
    letterboxdSaveSelection: document.getElementById('letterboxd-save-selection')
};

// ============================================
// Supabase Data Functions
// ============================================

async function fetchData() {
    try {
        // Fetch posts (public read)
        const { data: postsData, error: postsError } = await supabase
            .from('posts')
            .select('*')
            .order('timestamp', { ascending: false });

        // Fetch suggestions (public read)
        const { data: suggestionsData, error: suggestionsError } = await supabase
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
        
        let reviewsQuery = supabase
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
        const { data, error } = await supabase
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
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
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
                // Check if it's actually XML (RSS feeds start with <?xml or <rss)
                const trimmed = result.contents.trim();
                if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rss') || trimmed.startsWith('<feed')) {
                    data = result.contents;
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
            const { data } = await supabase
                .from('letterboxd_reviews')
                .select('review_url, is_selected')
                .eq('letterboxd_username', username);
            existingReviews = data || [];
        } else {
            // Fallback: get all existing reviews (for backward compatibility)
            const { data } = await supabase
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
            const { error: deleteError } = await supabase
                .from('letterboxd_reviews')
                .delete()
                .neq('letterboxd_username', username);
            
            if (deleteError) {
                console.error('Error deleting old reviews:', deleteError);
                // Don't throw - continue with saving new reviews
            }
        }
        
        // Upsert reviews (insert or update if review_url exists)
        const { error } = await supabase
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
        let query = supabase
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
        const { error } = await supabase
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
        const { data, error } = await supabase
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
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
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
        // Clean up YouTube player if it exists
        if (youtubePlayer && playerReady) {
            try {
                youtubePlayer.destroy();
            } catch (e) {
                // Ignore errors
            }
            youtubePlayer = null;
            playerReady = false;
        }
        return;
    }

    // Check if YouTube player already exists and is playing the same URL
    // If so, don't reinitialize (prevents music from restarting on page reload)
    if (type === 'youtube' && youtubePlayer && playerReady) {
        const playerDiv = document.getElementById('youtube-player');
        if (playerDiv && playlistUrl === url) {
            // Player already exists and URL matches - just update UI, don't reinitialize
            elements.playlistSection.classList.remove('hidden');
            if (elements.playlistVolumeToggle) {
                elements.playlistVolumeToggle.style.display = 'block';
                elements.playlistVolumeToggle.style.visibility = 'visible';
            }
            updateVolumeState();
            return;
        } else {
            // URL changed or player div missing - destroy old player
            try {
                youtubePlayer.destroy();
            } catch (e) {
                // Ignore errors
            }
            youtubePlayer = null;
            playerReady = false;
        }
    }

    // Show volume toggle when playlist exists
    elements.playlistSection.classList.remove('hidden');
    
    if (elements.playlistVolumeToggle) {
        elements.playlistVolumeToggle.style.display = 'block';
        elements.playlistVolumeToggle.style.visibility = 'visible';
    }
    
    let embedHtml = '';
    
    switch (type) {
        case 'youtube':
            embedHtml = renderYouTubeEmbed(url);
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
    
    // Initialize YouTube player if needed
    if (type === 'youtube') {
        initializeYouTubePlayer(url);
        // Don't call updateVolumeState() here - it will be called from onReady callback
        // Just update the icon for now
        if (elements.playlistVolumeIcon) {
            if (playlistMuted) {
                elements.playlistVolumeIcon.textContent = '🔇';
            } else {
                elements.playlistVolumeIcon.textContent = '🔈';
            }
        }
    } else {
        // For non-YouTube playlists, update volume state immediately
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
    
    // Create hidden div for YouTube IFrame API (will be replaced by API)
    // The API needs a div element, not an iframe
    return '<div id="youtube-player"></div>';
}

function initializeYouTubePlayer(url) {
    // Parse URL to get video/playlist IDs
    let playlistId = null;
    let videoId = null;
    
    url = url.trim();
    
    const playlistMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (playlistMatch) {
        playlistId = playlistMatch[1];
    }
    
    let videoMatch = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/);
    if (videoMatch) {
        videoId = videoMatch[1];
    }
    
    if (!videoId) {
        videoMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (videoMatch) {
            videoId = videoMatch[1];
        }
    }
    
    if (!videoId) {
        videoMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
        if (videoMatch) {
            videoId = videoMatch[1];
        }
    }
    
    if (!videoId && !playlistId) {
        console.error('Could not parse YouTube URL for player:', url);
        return;
    }
    
    // Load YouTube IFrame API if not already loaded
    if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        window.onYouTubeIframeAPIReady = () => {
            setupYouTubePlayer(videoId, playlistId);
        };
    } else if (window.YT && window.YT.Player) {
        setupYouTubePlayer(videoId, playlistId);
    }
}

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
            // Try again in a bit
            setTimeout(() => setupYouTubePlayer(videoId, playlistId), 1000);
            return;
        }
        
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
                                    
                                    // Update volume state now that player is ready
                                    updateVolumeState();
                                    
                                    // Load playlist after first video
                                    setTimeout(() => {
                                        event.target.loadPlaylist({ list: playlistId });
                                    }, 1000);
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
                                console.error('YouTube player error:', event.data);
                            }
                        }
                    });
                } else {
                    // Pure playlist URL
                    playerVars.listType = 'playlist';
                    playerVars.list = playlistId;
                    youtubePlayer = new YT.Player('youtube-player', {
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
                                    console.error('Error starting playlist:', e);
                                }
                            },
                            onStateChange: (event) => {
                            },
                            onError: (event) => {
                                console.error('YouTube playlist error:', event.data);
                                handleYouTubeError(event.data);
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
    
    // Hidden iframe for Spotify
    return `
        <iframe 
            id="spotify-player"
            style="display: none;" 
            src="https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0&autoplay=true" 
            width="0" 
            height="0" 
            frameborder="0" 
            allowfullscreen="" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="lazy">
        </iframe>
    `;
}

function renderSoundCloudEmbed(url) {
    // SoundCloud URL: https://soundcloud.com/user/set/playlist-name
    // Hidden iframe for SoundCloud
    
    return `
        <iframe 
            id="soundcloud-player"
            width="0" 
            height="0" 
            scrolling="no" 
            frameborder="no" 
            allow="autoplay" 
            src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff69b4&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false"
            style="display: none;">
        </iframe>
    `;
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
            errorMessage = 'This video does not allow embedding. Please try a different video or playlist.';
            break;
        default:
            errorMessage = 'Error playing video (code: ' + errorCode + ')';
    }
    
    console.error('YouTube Error:', errorMessage);
    
    // Show error message in the playlist container
    if (elements.playlistContainer) {
        elements.playlistContainer.innerHTML = `
            <div class="playlist-error-message">
                <p>${errorMessage}</p>
                <p style="font-size: 0.7rem; margin-top: 0.5rem; opacity: 0.7;">
                    Try a different video or check that embedding is enabled.
                </p>
            </div>
        `;
    }
}

function togglePlaylistVolume() {
    playlistMuted = !playlistMuted;
    updateVolumeState();
    
    // Control YouTube player if available and ready
    if (youtubePlayer && playerReady) {
        try {
            // Check if player methods are available
            if (typeof youtubePlayer.mute === 'function' && typeof youtubePlayer.unMute === 'function') {
                if (playlistMuted) {
                    youtubePlayer.mute();
                    // Player muted
                } else {
                    youtubePlayer.unMute();
                    
                    // If player wasn't playing, start it now (user interaction allows sound)
                    try {
                        const state = youtubePlayer.getPlayerState();
                        if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.CUED) {
                            youtubePlayer.playVideo();
                        }
                    } catch (stateError) {
                        // Player state might not be available yet
                    }
                }
            }
        } catch (e) {
            console.error('Could not control YouTube volume:', e);
        }
    }
    
    // For Spotify/SoundCloud, we can't control volume directly
    // The iframes are hidden anyway, so just update the icon
}

function updateVolumeState() {
    if (elements.playlistVolumeIcon) {
        if (playlistMuted) {
            elements.playlistVolumeIcon.textContent = '🔇';
        } else {
            elements.playlistVolumeIcon.textContent = '🔈';
        }
    }
    
    // Apply mute to YouTube player if available and ready
    if (youtubePlayer && playerReady) {
        try {
            // Additional check: ensure player is actually attached to DOM
            // The YouTube API requires the player to be in the DOM before calling methods
            const playerDiv = document.getElementById('youtube-player');
            if (!playerDiv) {
                // Player div not found, skip API calls
                return;
            }
            
            // Check if player methods are available and player state is valid
            if (typeof youtubePlayer.mute === 'function' && typeof youtubePlayer.unMute === 'function') {
                // Try to get player state to verify it's ready
                try {
                    const state = youtubePlayer.getPlayerState();
                    // If we can get the state, player is ready
                    if (playlistMuted) {
                        youtubePlayer.mute();
                    } else {
                        youtubePlayer.unMute();
                    }
                } catch (stateError) {
                    // Player state not available yet, skip mute/unmute
                    // This prevents the "player not attached to DOM" warning
                }
            }
        } catch (e) {
            // Player not ready yet or methods not available
            // Silently ignore - this is expected during initialization
        }
    }
}

async function handleSavePlaylist() {
    const url = elements.playlistUrlInput.value.trim();
    const type = 'youtube'; // Always YouTube
    
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
        
        const { data, error } = await supabase
            .from('posts')
            .insert(insertData)
            .select();

        if (error) {
            // If tag column doesn't exist, try without it
            if (error.message && error.message.includes("Could not find the 'tag' column")) {
                delete insertData.tag;
                const { data: fallbackData, error: fallbackError } = await supabase
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
        const { error } = await supabase
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
        
        const { data, error } = await supabase.rpc('increment_post_likes', {
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
        const { data, error } = await supabase
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
        const { error } = await supabase
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
        const { data: postData, error: postError } = await supabase
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
                const { data: fallbackData, error: fallbackError } = await supabase
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
        const { error: deleteError } = await supabase
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
        month: 'long', 
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
    const { data: { session } } = await supabase.auth.getSession();
    isAuthenticated = !!session;
    updateUIForAuth();
    
    // Load playlist settings (public)
    const playlistData = await fetchPlaylistSettings();
    playlistUrl = playlistData.url;
    playlistType = playlistData.type;
    
    renderPlaylist(playlistUrl, playlistType);
    
    if (isAuthenticated) {
        // Load data when authenticated
        const data = await fetchData();
        posts = data.posts;
        suggestions = data.suggestions;
        renderPosts();
        renderInbox();
        updateTagSuggestions();
        
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
    } else {
        // Load public data
        const data = await fetchData();
        posts = data.posts;
        suggestions = data.suggestions;
        renderPosts();
        updateTagSuggestions();
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
        const { data, error } = await supabase.auth.signInWithPassword({
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
    await supabase.auth.signOut();
    isAuthenticated = false;
    
    // Clean up real-time subscriptions
    cleanupRealtimeSubscriptions();
    
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
    const postsChannel = supabase
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
    const suggestionsChannel = supabase
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
        supabase.removeChannel(channel);
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
    
    elements.postSubmit.textContent = '...';
    elements.postSubmit.disabled = true;
    
    // Remove fullscreen mode when submitting
    if (elements.writePanel) {
        const scrollY = elements.writePanel._savedScrollY || 0;
        elements.writePanel.classList.remove('write-panel-fullscreen');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
        elements.writePanel._savedScrollY = null;
    }
    
    const newPost = await createPost(content, tag);
    
    if (newPost) {
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
    
    elements.suggestSubmit.textContent = '...';
    elements.suggestSubmit.disabled = true;
    
    // Remove fullscreen mode when submitting
    if (elements.suggestPanel) {
        const scrollY = elements.suggestPanel._savedScrollY || 0;
        elements.suggestPanel.classList.remove('suggest-panel-fullscreen');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
        elements.suggestPanel._savedScrollY = null;
    }
    
    const newSuggestion = await createSuggestion(content);
    
    if (newSuggestion) {
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
    
    elements.letterboxdReviewsList.innerHTML = letterboxdReviews.map(review => {
        const reviewTitle = `${review.film_title}${review.film_year ? ` (${review.film_year})` : ''}`;
        const reviewPreview = review.review_text ? 
            (review.review_text.length > 100 ? review.review_text.substring(0, 100) + '...' : review.review_text) : 
            '';
        
        return `
            <div class="letterboxd-review-item">
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
    elements.authSubmit.addEventListener('click', authenticate);
    elements.passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') authenticate();
    });
    elements.emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') authenticate();
    });
    
    // Post submit
    elements.postSubmit.addEventListener('click', handleCreatePost);
    elements.postContent.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.metaKey) handleCreatePost();
    });
    elements.postTag.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreatePost();
        }
    });
    
    // Close button handler for write panel
    if (elements.writePanelClose) {
        elements.writePanelClose.addEventListener('click', () => {
            elements.writePanel.classList.remove('write-panel-fullscreen');
            // Restore sticky class
            if (isAuthenticated) {
                elements.writePanel.classList.add('write-panel-sticky');
            }
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            if (elements.writePanel.style.height) {
                elements.writePanel.style.height = '';
            }
            if (elements.writePanel.style.top) {
                elements.writePanel.style.top = '';
            }
            // Blur any focused inputs
            if (document.activeElement === elements.postContent) {
                elements.postContent.blur();
            }
            if (document.activeElement === elements.postTag) {
                elements.postTag.blur();
            }
        });
    }
    
    // Fullscreen panel on mobile when input is focused
    if (elements.postContent && elements.writePanel) {
        let heightUpdateHandler = null;
        
        const enterFullscreen = () => {
            if (window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/9c27437d-89e3-443e-a630-d9c29e767acb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2613',message:'enterFullscreen called',data:{wasFullscreen:elements.writePanel.classList.contains('write-panel-fullscreen')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                // Remove sticky positioning first to avoid glitchy transition
                elements.writePanel.classList.remove('write-panel-sticky');
                elements.writePanel.classList.add('write-panel-fullscreen');
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/9c27437d-89e3-443e-a630-d9c29e767acb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2619',message:'After adding fullscreen class',data:{hasFullscreenClass:elements.writePanel.classList.contains('write-panel-fullscreen')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                // Prevent background scrolling - simple approach
                const scrollY = window.scrollY;
                elements.writePanel._savedScrollY = scrollY;
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                
                // Use visual viewport height to account for keyboard
                const updateHeight = () => {
                    if (elements.writePanel.classList.contains('write-panel-fullscreen')) {
                        if (window.visualViewport) {
                            // Use visual viewport height (space above keyboard)
                            // Account for safe area at top
                            const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)') || '0', 10) || 0;
                            elements.writePanel.style.height = `${window.visualViewport.height + safeAreaTop}px`;
                            elements.writePanel.style.top = `${window.visualViewport.offsetTop - safeAreaTop}px`;
                        } else {
                            // Fallback to window inner height
                            elements.writePanel.style.height = `${window.innerHeight}px`;
                            elements.writePanel.style.top = '0px';
                        }
                    }
                };
                
                updateHeight();
                
                // Listen for viewport changes (keyboard appearing/disappearing)
                if (window.visualViewport) {
                    heightUpdateHandler = updateHeight;
                    window.visualViewport.addEventListener('resize', heightUpdateHandler);
                    window.visualViewport.addEventListener('scroll', heightUpdateHandler);
                } else {
                    window.addEventListener('resize', updateHeight);
                }
                
                // Clean up listener when panel exits fullscreen
                const observer = new MutationObserver(() => {
                    if (!elements.writePanel.classList.contains('write-panel-fullscreen')) {
                        if (window.visualViewport && heightUpdateHandler) {
                            window.visualViewport.removeEventListener('resize', heightUpdateHandler);
                            window.visualViewport.removeEventListener('scroll', heightUpdateHandler);
                        } else {
                            window.removeEventListener('resize', updateHeight);
                        }
                        // Restore scroll position
                        const scrollY = elements.writePanel._savedScrollY || 0;
                        document.documentElement.style.overflow = '';
                        document.body.style.overflow = '';
                        elements.writePanel.style.removeProperty('height');
                        elements.writePanel.style.removeProperty('top');
                        // Restore scroll position
                        window.scrollTo(0, scrollY);
                        elements.writePanel._savedScrollY = null;
                        // Restore sticky class when exiting fullscreen
                        if (isAuthenticated) {
                            elements.writePanel.classList.add('write-panel-sticky');
                        }
                        heightUpdateHandler = null;
                        observer.disconnect();
                    }
                });
                observer.observe(elements.writePanel, { attributes: true, attributeFilter: ['class'] });
                
                // Scroll to top to ensure panel is visible
                window.scrollTo(0, 0);
                
                // Track scroll events to debug scrolling issue
                const scrollHandler = () => {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/9c27437d-89e3-443e-a630-d9c29e767acb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2678',message:'Scroll detected in fullscreen write',data:{scrollY:window.scrollY,bodyPosition:document.body.style.position,bodyOverflow:document.body.style.overflow,isFullscreen:elements.writePanel.classList.contains('write-panel-fullscreen')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                    // #endregion
                };
                window.addEventListener('scroll', scrollHandler, { passive: true });
                
                // Store handler for cleanup
                if (!elements.writePanel._scrollHandler) {
                    elements.writePanel._scrollHandler = scrollHandler;
                }
            }
        };
        
        // Use click/touchstart to enter fullscreen, then focus
        const handleInputInteraction = (e) => {
            enterFullscreen();
            // Call focus() synchronously to maintain user interaction chain for mobile keyboard
            elements.postContent.focus();
        };
        
        elements.postContent.addEventListener('focus', (e) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/9c27437d-89e3-443e-a630-d9c29e767acb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2697',message:'Focus event fired',data:{isFullscreen:elements.writePanel.classList.contains('write-panel-fullscreen')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            enterFullscreen();
        });
        elements.postContent.addEventListener('click', handleInputInteraction);
        elements.postContent.addEventListener('touchstart', handleInputInteraction);
        
        elements.postContent.addEventListener('blur', () => {
            // Delay to allow submit button clicks to work
            setTimeout(() => {
                if (document.activeElement !== elements.postTag) {
                    // Restore scroll position
                    const scrollY = elements.writePanel._savedScrollY || 0;
                    elements.writePanel.classList.remove('write-panel-fullscreen');
                    document.documentElement.style.overflow = '';
                    document.body.style.overflow = '';
                    elements.writePanel.style.removeProperty('height');
                    elements.writePanel.style.removeProperty('top');
                    // Restore scroll position
                    window.scrollTo(0, scrollY);
                    elements.writePanel._savedScrollY = null;
                }
            }, 200);
        });
    }
    
    if (elements.postTag && elements.writePanel) {
        const enterFullscreen = () => {
            if (window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                    if (!elements.writePanel.classList.contains('write-panel-fullscreen')) {
                        elements.writePanel.classList.add('write-panel-fullscreen');
                        // Prevent background scrolling - simple approach
                        const scrollY = window.scrollY;
                        elements.writePanel._savedScrollY = scrollY;
                        document.documentElement.style.overflow = 'hidden';
                        document.body.style.overflow = 'hidden';
                    
                    // Use visual viewport height to account for keyboard
                    const updateHeight = () => {
                        if (elements.writePanel.classList.contains('write-panel-fullscreen')) {
                            if (window.visualViewport) {
                                // Use visual viewport height (space above keyboard)
                                // Account for safe area at top
                                const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)') || '0', 10) || 0;
                                elements.writePanel.style.height = `${window.visualViewport.height + safeAreaTop}px`;
                                elements.writePanel.style.top = `${window.visualViewport.offsetTop - safeAreaTop}px`;
                            } else {
                                // Fallback to window inner height
                                elements.writePanel.style.height = `${window.innerHeight}px`;
                                elements.writePanel.style.top = '0px';
                            }
                        }
                    };
                    
                    updateHeight();
                    
                    // Listen for viewport changes (keyboard appearing/disappearing)
                    if (window.visualViewport) {
                        window.visualViewport.addEventListener('resize', updateHeight);
                        window.visualViewport.addEventListener('scroll', updateHeight);
                    } else {
                        window.addEventListener('resize', updateHeight);
                    }
                    
                    // Scroll to top to ensure panel is visible
                    window.scrollTo(0, 0);
                }
            }
        };
        
        // Use click/touchstart to enter fullscreen, then focus
        const handleTagInteraction = (e) => {
            enterFullscreen();
            // Call focus() synchronously to maintain user interaction chain for mobile keyboard
            elements.postTag.focus();
        };
        
        elements.postTag.addEventListener('focus', enterFullscreen);
        elements.postTag.addEventListener('click', handleTagInteraction);
        elements.postTag.addEventListener('touchstart', handleTagInteraction);
        
        elements.postTag.addEventListener('blur', () => {
            // Only remove if postContent is also not focused
            setTimeout(() => {
                if (document.activeElement !== elements.postContent) {
                    elements.writePanel.classList.remove('write-panel-fullscreen');
                    document.body.style.overflow = '';
                    document.body.style.position = '';
                    document.body.style.width = '';
                    elements.writePanel.style.height = '';
                    elements.writePanel.style.top = '';
                }
            }, 200);
        });
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
    elements.suggestSubmit.addEventListener('click', handleCreateSuggestion);
    elements.suggestContent.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.metaKey) handleCreateSuggestion();
    });
    
    // Close button handler for suggest panel
    if (elements.suggestPanelClose) {
        elements.suggestPanelClose.addEventListener('click', () => {
            const scrollY = elements.suggestPanel._savedScrollY || 0;
            elements.suggestPanel.classList.remove('suggest-panel-fullscreen');
            elements.suggestPanel.classList.add('suggest-panel-sticky');
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            elements.suggestPanel.style.removeProperty('height');
            elements.suggestPanel.style.removeProperty('top');
            window.scrollTo(0, scrollY);
            elements.suggestPanel._savedScrollY = null;
            elements.suggestContent.value = '';
            if (document.activeElement === elements.suggestContent) {
                elements.suggestContent.blur();
            }
        });
    }
    
    // Fullscreen panel on mobile when input is focused
    if (elements.suggestContent && elements.suggestPanel) {
        let heightUpdateHandler = null;
        
        const enterFullscreen = () => {
            if (window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/9c27437d-89e3-443e-a630-d9c29e767acb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2880',message:'enterFullscreen called for suggest',data:{wasFullscreen:elements.suggestPanel.classList.contains('suggest-panel-fullscreen')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                // Remove sticky positioning first to avoid glitchy transition
                elements.suggestPanel.classList.remove('suggest-panel-sticky');
                elements.suggestPanel.classList.add('suggest-panel-fullscreen');
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/9c27437d-89e3-443e-a630-d9c29e767acb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2886',message:'After adding fullscreen class for suggest',data:{hasFullscreenClass:elements.suggestPanel.classList.contains('suggest-panel-fullscreen')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                // Prevent background scrolling - simple approach
                const scrollY = window.scrollY;
                elements.suggestPanel._savedScrollY = scrollY;
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                
                // Use visual viewport height to account for keyboard
                const updateHeight = () => {
                    if (elements.suggestPanel.classList.contains('suggest-panel-fullscreen')) {
                        if (window.visualViewport) {
                            // Use visual viewport height (space above keyboard)
                            // Account for safe area at top
                            const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)') || '0', 10) || 0;
                            elements.suggestPanel.style.height = `${window.visualViewport.height + safeAreaTop}px`;
                            elements.suggestPanel.style.top = `${window.visualViewport.offsetTop - safeAreaTop}px`;
                        } else {
                            // Fallback to window inner height
                            elements.suggestPanel.style.height = `${window.innerHeight}px`;
                            elements.suggestPanel.style.top = '0px';
                        }
                    }
                };
                
                updateHeight();
                
                // Listen for viewport changes (keyboard appearing/disappearing)
                if (window.visualViewport) {
                    heightUpdateHandler = updateHeight;
                    window.visualViewport.addEventListener('resize', heightUpdateHandler);
                    window.visualViewport.addEventListener('scroll', heightUpdateHandler);
                } else {
                    window.addEventListener('resize', updateHeight);
                }
                
                // Clean up listener when panel exits fullscreen
                const observer = new MutationObserver(() => {
                    if (!elements.suggestPanel.classList.contains('suggest-panel-fullscreen')) {
                        if (window.visualViewport && heightUpdateHandler) {
                            window.visualViewport.removeEventListener('resize', heightUpdateHandler);
                            window.visualViewport.removeEventListener('scroll', heightUpdateHandler);
                        } else {
                            window.removeEventListener('resize', updateHeight);
                        }
                        // Restore scroll position
                        const scrollY = elements.suggestPanel._savedScrollY || 0;
                        document.documentElement.style.overflow = '';
                        document.body.style.overflow = '';
                        elements.suggestPanel.style.removeProperty('height');
                        elements.suggestPanel.style.removeProperty('top');
                        window.scrollTo(0, scrollY);
                        elements.suggestPanel._savedScrollY = null;
                        heightUpdateHandler = null;
                        observer.disconnect();
                    }
                });
                observer.observe(elements.suggestPanel, { attributes: true, attributeFilter: ['class'] });
                
                // Scroll to top to ensure panel is visible
                window.scrollTo(0, 0);
                
                // Track scroll events to debug scrolling issue
                const scrollHandler = () => {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/9c27437d-89e3-443e-a630-d9c29e767acb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2950',message:'Scroll detected in fullscreen suggest',data:{scrollY:window.scrollY,bodyPosition:document.body.style.position,bodyOverflow:document.body.style.overflow,isFullscreen:elements.suggestPanel.classList.contains('suggest-panel-fullscreen')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                    // #endregion
                };
                window.addEventListener('scroll', scrollHandler, { passive: true });
                
                // Store handler for cleanup
                if (!elements.suggestPanel._scrollHandler) {
                    elements.suggestPanel._scrollHandler = scrollHandler;
                }
            }
        };
        
        // Use click/touchstart to enter fullscreen, then focus
        const handleSuggestInteraction = (e) => {
            enterFullscreen();
            // Call focus() synchronously to maintain user interaction chain for mobile keyboard
            elements.suggestContent.focus();
        };
        
        elements.suggestContent.addEventListener('focus', enterFullscreen);
        elements.suggestContent.addEventListener('click', handleSuggestInteraction);
        elements.suggestContent.addEventListener('touchstart', handleSuggestInteraction);
        
        elements.suggestContent.addEventListener('blur', () => {
            // Delay to allow submit button clicks to work
            setTimeout(() => {
                // Only exit fullscreen if the active element is not within the suggest panel
                const activeElement = document.activeElement;
                const isWithinPanel = activeElement && elements.suggestPanel.contains(activeElement);
                
                // Don't exit fullscreen if user clicked a button within the panel
                if (!isWithinPanel && elements.suggestPanel.classList.contains('suggest-panel-fullscreen')) {
                    // Restore scroll position
                    const scrollY = elements.suggestPanel._savedScrollY || 0;
                    elements.suggestPanel.classList.remove('suggest-panel-fullscreen');
                    document.documentElement.style.overflow = '';
                    document.body.style.overflow = '';
                    elements.suggestPanel.style.removeProperty('height');
                    elements.suggestPanel.style.removeProperty('top');
                    window.scrollTo(0, scrollY);
                    elements.suggestPanel._savedScrollY = null;
                }
            }, 200);
        });
    }
    
    // Random word
    elements.randomWordButton.addEventListener('click', (e) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9c27437d-89e3-443e-a630-d9c29e767acb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:2930',message:'Random word button clicked',data:{isFullscreen:elements.suggestPanel.classList.contains('suggest-panel-fullscreen')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        e.preventDefault();
        const word = getRandomWord();
        const currentText = elements.suggestContent.value.trim();
        const newText = currentText ? `${currentText} ${word}` : word;
        elements.suggestContent.value = newText;
        
        // Enter fullscreen if on mobile and not already in fullscreen
        if (window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            if (!elements.suggestPanel.classList.contains('suggest-panel-fullscreen')) {
                // Remove sticky positioning first to avoid glitchy transition
                elements.suggestPanel.classList.remove('suggest-panel-sticky');
                elements.suggestPanel.classList.add('suggest-panel-fullscreen');
                // Prevent background scrolling - simple approach
                const scrollY = window.scrollY;
                elements.suggestPanel._savedScrollY = scrollY;
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                
                // Use visual viewport height to account for keyboard
                const updateHeight = () => {
                    if (elements.suggestPanel.classList.contains('suggest-panel-fullscreen')) {
                        if (window.visualViewport) {
                            // Use visual viewport height (space above keyboard)
                            elements.suggestPanel.style.height = `${window.visualViewport.height}px`;
                            elements.suggestPanel.style.top = `${window.visualViewport.offsetTop}px`;
                        } else {
                            // Fallback to window inner height
                            elements.suggestPanel.style.height = `${window.innerHeight}px`;
                        }
                    }
                };
                
                updateHeight();
                
                // Listen for viewport changes (keyboard appearing/disappearing)
                if (window.visualViewport) {
                    window.visualViewport.addEventListener('resize', updateHeight);
                    window.visualViewport.addEventListener('scroll', updateHeight);
                } else {
                    window.addEventListener('resize', updateHeight);
                }
                
                // Scroll to top to ensure panel is visible
                window.scrollTo(0, 0);
            }
        }
        
        // Focus immediately to open keyboard - call synchronously to maintain user interaction chain
        elements.suggestContent.focus();
        // Set cursor position to the end of the text
        const textLength = elements.suggestContent.value.length;
        elements.suggestContent.setSelectionRange(textLength, textLength);
    });
    
    // Playlist save
    elements.playlistSaveButton.addEventListener('click', handleSavePlaylist);
    elements.playlistUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSavePlaylist();
    });
    
    // Playlist volume toggle
    if (elements.playlistVolumeToggle) {
        elements.playlistVolumeToggle.addEventListener('click', togglePlaylistVolume);
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
    
    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            checkAuthState();
        }
    });
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
    setupEventListeners();
    
    // Setup zoom prevention for inputs
    setupZoomPrevention();
    
    // Load tag suggestions
    updateTagSuggestions();
    
    // Check authentication state
    await checkAuthState();
    
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
