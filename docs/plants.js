// =====================================================================
// plants.js — Plant Gallery with email/password login and JSONbin storage
// Photos are linked by URL — paste a Google Drive share link, an Imgur
// link, or any direct image URL and it will be auto-converted & previewed.
// =====================================================================
//
// HOW TO SHARE A GOOGLE DRIVE PHOTO:
//   1. Upload the photo to Google Drive.
//   2. Right-click it → "Share" → set access to "Anyone with the link".
//   3. Click "Copy link" and paste it into the Photo URL field.
//      The link will be converted automatically.
//
// =====================================================================

const ALLOWED_EMAIL   = 'kac7748@nyu.edu';
const PASSWORD_HASH   = '2b0461ebc5da244009d1237372cb04da8af87ba29f3124d906d49efc3b1668e5';

const JSONBIN_BIN_ID  = '69b247d8c3097a1dd51ad1d6';
const JSONBIN_API_KEY = '$2a$10$IbtBG2jQyTMCGfy6W4XLuu/ET6LVsKKw2XR3sdWMZb816rGXpDkZW';

const SESSION_TTL_MS  = 8 * 60 * 60 * 1000;

// ─── URL normalizer ───────────────────────────────────────────────
// Converts share-page links into embeddable direct image URLs.

function normalizeImageUrl(raw) {
    if (!raw) return null;
    const url = raw.trim();
    if (!url) return null;

    // Google Drive share link → thumbnail CDN (more reliable than uc?export=view)
    // Matches: drive.google.com/file/d/FILE_ID/...
    //      or: drive.google.com/open?id=FILE_ID
    const driveFile = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
    if (driveFile) {
        return `https://drive.google.com/thumbnail?id=${driveFile[1]}&sz=w1000`;
    }
    const driveOpen = url.match(/drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/);
    if (driveOpen) {
        return `https://drive.google.com/thumbnail?id=${driveOpen[1]}&sz=w1000`;
    }

    // Imgur page link → direct image
    // Matches: imgur.com/XXXXX  (not i.imgur.com which is already direct)
    const imgurPage = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]+)(?:\.[a-z]+)?$/);
    if (imgurPage) {
        return `https://i.imgur.com/${imgurPage[1]}.jpg`;
    }

    // Anything else (direct image URL, i.imgur.com, lh3.googleusercontent.com, etc.) — use as-is
    return url;
}

// ─── JSONbin API ──────────────────────────────────────────────────

const BIN_URL     = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
const BIN_HEADERS = {
    'Content-Type': 'application/json',
    'X-Access-Key': JSONBIN_API_KEY
};

async function fetchPosts() {
    const res = await fetch(BIN_URL + '/latest', { headers: BIN_HEADERS });
    if (!res.ok) throw new Error(`JSONbin fetch failed: ${res.status}`);
    const data = await res.json();
    return data.record.plants || [];
}

async function writePosts(posts) {
    const res = await fetch(BIN_URL, {
        method: 'PUT',
        headers: BIN_HEADERS,
        body: JSON.stringify({ plants: posts })
    });
    if (!res.ok) throw new Error(`JSONbin write failed: ${res.status}`);
}

// ─── Session management ───────────────────────────────────────────

let currentUser = null;

function saveSession(email) {
    sessionStorage.setItem('plant_session', JSON.stringify({
        email, expires: Date.now() + SESSION_TTL_MS
    }));
}

function loadSession() {
    const raw = sessionStorage.getItem('plant_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() > s.expires) { sessionStorage.removeItem('plant_session'); return null; }
    return s;
}

// ─── Auth ─────────────────────────────────────────────────────────

function showLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('login-form').reset();
    setTimeout(() => document.getElementById('login-email').focus(), 50);
}

function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('login-form').reset();
    document.getElementById('login-error').style.display = 'none';
}

function closeLoginOnOverlay(e) {
    if (e.target === document.getElementById('login-modal')) closeLoginModal();
}

async function handleLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const btn      = document.getElementById('login-submit-btn');
    const errEl    = document.getElementById('login-error');

    btn.disabled = true;
    btn.textContent = 'Checking...';
    errEl.style.display = 'none';

    try {
        const hash = await sha256(password);
        if (email === ALLOWED_EMAIL.toLowerCase() && hash === PASSWORD_HASH.toLowerCase()) {
            currentUser = email;
            saveSession(email);
            closeLoginModal();
            updateAuthUI();
        } else {
            errEl.style.display = 'block';
        }
    } catch {
        errEl.textContent = 'An error occurred. Please try again.';
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Log In';
    }
}

function signOut() {
    currentUser = null;
    sessionStorage.removeItem('plant_session');
    updateAuthUI();
}

function updateAuthUI() {
    const signinArea = document.getElementById('signin-area');
    const userArea   = document.getElementById('user-area');
    const addArea    = document.getElementById('add-plant-area');

    if (currentUser) {
        signinArea.style.display = 'none';
        userArea.style.display   = 'flex';
        document.getElementById('signed-in-name').textContent = currentUser;
        addArea.style.display = 'block';
    } else {
        signinArea.style.display = 'block';
        userArea.style.display   = 'none';
        addArea.style.display    = 'none';
        closeAddModal();
    }
    loadAndRender();
}

// ─── Gallery ──────────────────────────────────────────────────────

async function loadAndRender() {
    const gallery = document.getElementById('plant-gallery');
    gallery.innerHTML = '<p class="gallery-status-msg">Loading plants...</p>';
    try {
        const posts = await fetchPosts();
        renderGallery(posts);
    } catch (err) {
        console.error(err);
        gallery.innerHTML = '<p class="error-msg">Could not load plants. Please refresh.</p>';
    }
}

function renderGallery(posts) {
    const gallery = document.getElementById('plant-gallery');
    if (!posts || posts.length === 0) {
        gallery.innerHTML = currentUser
            ? '<p class="gallery-status-msg">No plants yet — add your first one!</p>'
            : '<p class="gallery-status-msg">No plants yet — check back soon!</p>';
        return;
    }
    gallery.innerHTML = '';
    posts.forEach(post => gallery.appendChild(buildCard(post)));
}

function openPhotoZoom(imageUrl, altText) {
    const overlay = document.getElementById('photo-zoom-overlay');
    const img     = document.getElementById('photo-zoom-img');
    img.src = imageUrl;
    img.alt = altText;
    overlay.style.display = 'flex';
}

function closePhotoZoom(e) {
    const box = document.querySelector('.photo-zoom-box');
    if (!box || !box.contains(e.target)) {
        document.getElementById('photo-zoom-overlay').style.display = 'none';
    }
}

function buildCard(post) {
    const card = document.createElement('div');
    card.className = 'plant-card';
    card.innerHTML = `
        ${post.imageUrl
            ? `<img src="${esc(post.imageUrl)}" alt="${esc(post.name)}" class="plant-card-img" onerror="this.style.display='none'" onclick="openPhotoZoom('${esc(post.imageUrl)}', '${esc(post.name)}')">`
            : '<div class="plant-card-placeholder">No photo</div>'
        }
        <div class="plant-card-body">
            <h3 class="plant-card-name">${esc(post.name)}</h3>
            ${post.comment ? `<p class="plant-card-desc">${esc(post.comment)}</p>` : ''}
            <div class="plant-card-meta-block">
                ${post.photoDate ? `<p class="plant-card-meta">&#128247; Taken ${esc(post.photoDate)}</p>` : ''}
                <p class="plant-card-meta">Posted ${esc(post.datePosted)}</p>
            </div>
            ${currentUser ? `<button class="delete-btn" onclick="deletePost(${post.id})">Remove</button>` : ''}
        </div>
    `;
    return card;
}

async function deletePost(id) {
    if (!currentUser) return;
    if (!confirm('Remove this plant from the gallery?')) return;
    try {
        const posts = await fetchPosts();
        await writePosts(posts.filter(p => p.id !== id));
        loadAndRender();
    } catch {
        alert('Could not remove plant. Please try again.');
    }
}

// ─── Add plant modal ──────────────────────────────────────────────

function showAddModal() {
    document.getElementById('plant-modal').style.display = 'flex';
    document.getElementById('image-preview').style.display = 'none';
    setTimeout(() => document.getElementById('plant-name').focus(), 50);
}

function closeAddModal() {
    const modal = document.getElementById('plant-modal');
    if (!modal) return;
    modal.style.display = 'none';
    document.getElementById('plant-form').reset();
    document.getElementById('image-preview').style.display = 'none';
}

function closeAddOnOverlay(e) {
    if (e.target === document.getElementById('plant-modal')) closeAddModal();
}

// Live-preview the URL as it is typed or pasted
function setupUrlPreview() {
    const input   = document.getElementById('plant-image-url');
    const preview = document.getElementById('image-preview');
    if (!input) return;

    input.addEventListener('input', function () {
        const normalized = normalizeImageUrl(this.value);
        if (normalized) {
            preview.src     = normalized;
            preview.style.display = 'block';
            preview.onerror = () => { preview.style.display = 'none'; };
            preview.onload  = () => { preview.style.display = 'block'; };
        } else {
            preview.style.display = 'none';
        }
    });
}

async function submitPlant(e) {
    e.preventDefault();
    if (!currentUser) return;

    const name      = document.getElementById('plant-name').value.trim();
    const rawUrl    = document.getElementById('plant-image-url').value.trim();
    const photoDate = document.getElementById('plant-photo-date').value.trim();
    const comment   = document.getElementById('plant-comment').value.trim();

    if (!name) return;

    const imageUrl = normalizeImageUrl(rawUrl);

    const btn = document.getElementById('plant-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const posts = await fetchPosts();
        posts.unshift({
            id:         Date.now(),
            name,
            comment,
            imageUrl,
            photoDate:  photoDate || null,
            datePosted: new Date().toLocaleDateString('en-US', {
                            year: 'numeric', month: 'long', day: 'numeric'
                        })
        });
        await writePosts(posts);
        closeAddModal();
        renderGallery(posts);
    } catch (err) {
        alert('Could not save plant: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Add Plant';
    }
}

// ─── Helpers ─────────────────────────────────────────────────────

async function sha256(message) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
    return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    const session = loadSession();
    if (session) currentUser = session.email;
    setupUrlPreview();
    updateAuthUI();
});
