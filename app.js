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
    postContent: document.getElementById('post-content'),
    postSubmit: document.getElementById('post-submit'),
    suggestPanel: document.getElementById('suggest-panel'),
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
    playlistTypeSelect: document.getElementById('playlist-type-select'),
    playlistUrlInput: document.getElementById('playlist-url-input'),
    playlistSaveButton: document.getElementById('playlist-save')
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

        if (postsError) console.error('Error fetching posts:', postsError);
        if (suggestionsError) console.error('Error fetching suggestions:', suggestionsError);

        return {
            posts: postsData || [],
            suggestions: suggestionsData || []
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        return { posts: [], suggestions: [] };
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
                console.log('Playlist settings: No playlist configured yet');
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
    if (!url) {
        elements.playlistSection.classList.add('hidden');
        return;
    }

    elements.playlistSection.classList.remove('hidden');
    
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
}

function renderYouTubeEmbed(url) {
    // YouTube URL formats:
    // - Playlist: https://www.youtube.com/playlist?list=PLxxxxx
    // - Video: https://www.youtube.com/watch?v=xxxxx
    // - Short: https://youtu.be/xxxxx
    
    let playlistId = null;
    let videoId = null;
    
    // Check for playlist
    const playlistMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (playlistMatch) {
        playlistId = playlistMatch[1];
    }
    
    // Check for video ID
    const videoMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (videoMatch) {
        videoId = videoMatch[1];
    }
    
    if (playlistId) {
        // Embed playlist
        return `
            <iframe 
                width="100%" 
                height="450" 
                src="https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=0&rel=0" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen
                style="max-width: 100%; border-radius: 8px;">
            </iframe>
        `;
    } else if (videoId) {
        // Embed single video
        return `
            <iframe 
                width="100%" 
                height="450" 
                src="https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen
                style="max-width: 100%; border-radius: 8px;">
            </iframe>
        `;
    } else {
        return '<p class="playlist-error">invalid youtube url</p>';
    }
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
    
    return `
        <iframe 
            style="border-radius:12px; max-width: 100%;" 
            src="https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0" 
            width="100%" 
            height="450" 
            frameborder="0" 
            allowfullscreen="" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="lazy">
        </iframe>
    `;
}

function renderSoundCloudEmbed(url) {
    // SoundCloud URL: https://soundcloud.com/user/set/playlist-name
    // For SoundCloud, you'd typically use their oEmbed API or widget
    // This is a simplified version - you may need to use their API
    
    return `
        <iframe 
            width="100%" 
            height="450" 
            scrolling="no" 
            frameborder="no" 
            allow="autoplay" 
            src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff69b4&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true"
            style="max-width: 100%; border-radius: 8px;">
        </iframe>
    `;
}

async function handleSavePlaylist() {
    const url = elements.playlistUrlInput.value.trim();
    const type = elements.playlistTypeSelect.value;
    
    elements.playlistSaveButton.textContent = '...';
    elements.playlistSaveButton.disabled = true;
    
    const success = await savePlaylistUrl(url, type);
    
    if (success) {
        playlistUrl = url || null;
        playlistType = type;
        renderPlaylist(playlistUrl, playlistType);
        elements.playlistSaveButton.textContent = 'saved';
        setTimeout(() => {
            elements.playlistSaveButton.textContent = 'save playlist';
        }, 1500);
    }
    
    elements.playlistSaveButton.disabled = false;
}

async function createPost(content) {
    if (!isAuthenticated) {
        alert('You must be signed in to post.');
        return null;
    }

    try {
        const { data, error } = await supabase
            .from('posts')
            .insert({
                content: content,
                timestamp: Date.now(),
                likes: 0
            })
            .select();

        if (error) throw error;
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
        const { error } = await supabase
            .from('posts')
            .update({ likes: (currentLikes || 0) + 1 })
            .eq('id', postId);

        if (error) throw error;
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
        // Create post from suggestion
        const { data: postData, error: postError } = await supabase
            .from('posts')
            .insert({
                content: content,
                timestamp: Date.now(),
                from_suggestion: true,
                likes: 0
            })
            .select();

        if (postError) throw postError;

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
        return `
        <article class="post" style="animation-delay: ${index * 0.1}s">
            <div class="post-header">
                <time class="post-date">${formatDate(post.timestamp)}</time>
                ${post.from_suggestion ? '<span class="post-badge">from suggestion</span>' : ''}
            </div>
            <div class="post-content">${escapeHtml(post.content)}</div>
            <div class="post-footer">
                <button class="post-like" data-id="${post.id}" data-likes="${likes}">
                    <span class="like-hearts">${hearts}</span>
                </button>
                ${isAuthenticated ? `<button class="post-delete" data-id="${post.id}">delete</button>` : ''}
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
        
        // Load playlist settings into inputs for admin
        if (playlistUrl) {
            elements.playlistUrlInput.value = playlistUrl;
        }
        if (playlistType) {
            elements.playlistTypeSelect.value = playlistType;
        }
    } else {
        // Load public data
        const data = await fetchData();
        posts = data.posts;
        suggestions = data.suggestions;
        renderPosts();
    }
}

function updateUIForAuth() {
    if (isAuthenticated) {
        elements.authPanel.classList.add('hidden');
        elements.statusWord.textContent = 'online';
        elements.statusDot.classList.remove('status-dot-offline');
        elements.statusDot.classList.add('status-dot-online');
        elements.statusToggle.classList.add('online');
        elements.writePanel.classList.remove('hidden');
        elements.suggestPanel.classList.add('hidden');
        elements.inboxPanel.classList.remove('hidden');
    } else {
        elements.statusWord.textContent = 'offline';
        elements.statusDot.classList.remove('status-dot-online');
        elements.statusDot.classList.add('status-dot-offline');
        elements.statusToggle.classList.remove('online');
        elements.writePanel.classList.add('hidden');
        elements.inboxPanel.classList.add('hidden');
        elements.suggestPanel.classList.remove('hidden');
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
            elements.postContent.focus();
            
            // Reload data
            const data = await fetchData();
            posts = data.posts;
            suggestions = data.suggestions;
            renderPosts();
            renderInbox();
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
    updateUIForAuth();
    
    // Reload public data
    const data = await fetchData();
    posts = data.posts;
    suggestions = data.suggestions;
    renderPosts();
}

// ============================================
// Post Actions
// ============================================

async function handleCreatePost() {
    const content = elements.postContent.value.trim();
    
    if (!content) return;
    
    elements.postSubmit.textContent = '...';
    elements.postSubmit.disabled = true;
    
    const newPost = await createPost(content);
    
    if (newPost) {
        posts.unshift(newPost);
        elements.postContent.value = '';
        renderPosts();
    }
    
    elements.postSubmit.textContent = 'post';
    elements.postSubmit.disabled = false;
}

async function handleDelete(e) {
    const postId = e.target.dataset.id;
    
    if (!confirm('delete this post?')) return;
    
    const success = await deletePost(postId);
    
    if (success) {
        posts = posts.filter(p => p.id !== postId);
        renderPosts();
    }
}

async function handleLike(e) {
    const postId = e.target.closest('.post-like').dataset.id;
    const currentLikes = parseInt(e.target.closest('.post-like').dataset.likes, 10);
    const post = posts.find(p => p.id === postId);
    
    if (!post) return;
    
    // Optimistically update UI
    post.likes = (post.likes || 0) + 1;
    renderPosts();
    
    // Save to database
    const success = await likePost(postId, currentLikes);
    
    if (!success) {
        // Revert on failure
        post.likes = Math.max(0, (post.likes || 0) - 1);
        renderPosts();
    }
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
    
    const newSuggestion = await createSuggestion(content);
    
    if (newSuggestion) {
        suggestions.push(newSuggestion);
        elements.suggestContent.value = '';
        elements.suggestSubmit.textContent = 'suggested';
        setTimeout(() => {
            elements.suggestSubmit.textContent = 'suggest';
        }, 1500);
        
        if (isAuthenticated) {
            renderInbox();
        }
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
        posts.unshift(newPost);
        suggestions = suggestions.filter(s => s.id !== suggestionId);
        renderPosts();
        renderInbox();
    }
}

async function handleDeleteSuggestion(e) {
    const suggestionId = e.target.dataset.id;
    
    if (!confirm('delete this suggestion?')) return;
    
    const success = await deleteSuggestion(suggestionId);
    
    if (success) {
        suggestions = suggestions.filter(s => s.id !== suggestionId);
        renderInbox();
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
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
            signOut();
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
    
    // Suggest submit
    elements.suggestSubmit.addEventListener('click', handleCreateSuggestion);
    elements.suggestContent.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.metaKey) handleCreateSuggestion();
    });
    
    // Random word
    elements.randomWordButton.addEventListener('click', () => {
        const word = getRandomWord();
        const currentText = elements.suggestContent.value.trim();
        elements.suggestContent.value = currentText ? `${currentText} ${word}` : word;
        elements.suggestContent.focus();
    });
    
    // Playlist save
    elements.playlistSaveButton.addEventListener('click', handleSavePlaylist);
    elements.playlistUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSavePlaylist();
    });
    
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

async function init() {
    setupEventListeners();
    
    // Check authentication state
    await checkAuthState();
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration);
                })
                .catch((error) => {
                    console.log('Service Worker registration failed:', error);
                });
        });
    }
}

// Start
init();
