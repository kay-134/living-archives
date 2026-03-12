// =====================================================================
// plants.js — Plant Gallery with email/password login, Imgur upload,
//             EXIF date extraction, and JSONbin storage
// =====================================================================
//
// SETUP (one-time):
//
// ── Step 1: Login credentials ────────────────────────────────────
//   Set ALLOWED_EMAIL to your NYU email.
//   Generate your password hash in DevTools console (F12):
//
//     crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
//       .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
//
//   Paste the result into PASSWORD_HASH.
//
// ── Step 2: Imgur Client ID (for photo uploads) ──────────────────
//   a. Create a free account at https://imgur.com
//   b. Go to https://api.imgur.com/oauth2/addclient
//   c. Choose "Anonymous usage without user authorization"
//   d. Fill in any name/email, submit, and copy the Client ID
//   e. Paste it into IMGUR_CLIENT_ID below.
//
// ── Step 3: JSONbin (for storing post data) ───────────────────────
//   a. Create a free account at https://jsonbin.io
//   b. Click "+ Create Bin", paste { "plants": [] }, save
//   c. Copy the Bin ID from the URL
//   d. Go to API Keys → "+ Create Access Key" (Read + Update)
//   e. Paste both into JSONBIN_BIN_ID and JSONBIN_API_KEY below.
//
// =====================================================================

const ALLOWED_EMAIL    = 'kac7748@nyu.edu';
const PASSWORD_HASH    = 'PASTE_YOUR_HASH_HERE';  // ← still needed: generate in DevTools console

const IMGUR_CLIENT_ID  = 'YOUR_IMGUR_CLIENT_ID';  // ← still needed: from api.imgur.com
const JSONBIN_BIN_ID   = '69b247d8c3097a1dd51ad1d6';
const JSONBIN_API_KEY  = '$2a$10$IbtBG2jQyTMCGfy6W4XLuu/ET6LVsKKw2XR3sdWMZb816rGXpDkZW';

const SESSION_TTL_MS   = 8 * 60 * 60 * 1000;

// ─── JSONbin API ──────────────────────────────────────────────────

const BIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
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

// ─── Imgur upload ─────────────────────────────────────────────────

async function uploadToImgur(file) {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
        body: formData
    });

    if (!res.ok) throw new Error(`Imgur upload failed: ${res.status}`);
    const data = await res.json();
    return data.data.link; // direct image URL
}

// ─── EXIF extraction ──────────────────────────────────────────────

// Stored by onPhotoSelected so submitPlant can access it
let pendingExifDate = null;

async function onPhotoSelected(input) {
    const preview      = document.getElementById('image-preview');
    const exifRow      = document.getElementById('exif-date-row');
    const exifValue    = document.getElementById('exif-date-value');
    pendingExifDate    = null;

    if (!input.files || !input.files[0]) {
        preview.style.display = 'none';
        exifRow.style.display = 'none';
        return;
    }

    const file = input.files[0];

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = e => { preview.src = e.target.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);

    // Try to read EXIF date
    try {
        if (typeof exifr !== 'undefined') {
            const exif = await exifr.parse(file, ['DateTimeOriginal', 'DateTime']);
            const raw  = exif && (exif.DateTimeOriginal || exif.DateTime);
            if (raw) {
                pendingExifDate = raw instanceof Date ? raw : new Date(raw);
                exifValue.textContent = pendingExifDate.toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                exifRow.style.display = 'flex';
                return;
            }
        }
    } catch (e) {
        // EXIF read failed — just skip it silently
    }

    // No EXIF date found
    exifRow.style.display = 'none';
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

    if (JSONBIN_BIN_ID === 'YOUR_BIN_ID') {
        gallery.innerHTML = '<p class="gallery-status-msg">Gallery not connected yet — see plants.js for setup instructions.</p>';
        return;
    }

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

function buildCard(post) {
    const card = document.createElement('div');
    card.className = 'plant-card';
    card.innerHTML = `
        ${post.imageUrl
            ? `<img src="${esc(post.imageUrl)}" alt="${esc(post.name)}" class="plant-card-img" onerror="this.style.display='none'">`
            : '<div class="plant-card-placeholder">No photo</div>'
        }
        <div class="plant-card-body">
            <h3 class="plant-card-name">${esc(post.name)}</h3>
            ${post.comment ? `<p class="plant-card-desc">${esc(post.comment)}</p>` : ''}
            <div class="plant-card-meta-block">
                ${post.photoDate
                    ? `<p class="plant-card-meta">&#128247; Taken ${esc(post.photoDate)}</p>`
                    : ''
                }
                <p class="plant-card-meta">Posted ${esc(post.datePosted)}</p>
            </div>
            ${currentUser
                ? `<button class="delete-btn" onclick="deletePost(${post.id})">Remove</button>`
                : ''
            }
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
    pendingExifDate = null;
    setTimeout(() => document.getElementById('plant-name').focus(), 50);
}

function closeAddModal() {
    const modal = document.getElementById('plant-modal');
    if (!modal) return;
    modal.style.display = 'none';
    document.getElementById('plant-form').reset();
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('exif-date-row').style.display = 'none';
    pendingExifDate = null;
}

function closeAddOnOverlay(e) {
    if (e.target === document.getElementById('plant-modal')) closeAddModal();
}

async function submitPlant(e) {
    e.preventDefault();
    if (!currentUser) return;

    const name    = document.getElementById('plant-name').value.trim();
    const comment = document.getElementById('plant-comment').value.trim();
    const file    = document.getElementById('plant-image').files[0];

    if (!name) return;

    const btn = document.getElementById('plant-submit-btn');
    btn.disabled = true;

    try {
        let imageUrl = null;

        if (file) {
            if (IMGUR_CLIENT_ID === 'YOUR_IMGUR_CLIENT_ID') {
                alert('Imgur Client ID not set up yet — see plants.js setup instructions. Your post will be saved without a photo.');
            } else {
                btn.textContent = 'Uploading photo...';
                imageUrl = await uploadToImgur(file);
            }
        }

        btn.textContent = 'Saving...';

        const photoDate = pendingExifDate
            ? pendingExifDate.toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              })
            : null;

        const posts = await fetchPosts();
        posts.unshift({
            id:         Date.now(),
            name,
            comment,
            imageUrl,
            photoDate,
            datePosted: new Date().toLocaleDateString('en-US', {
                            year: 'numeric', month: 'long', day: 'numeric'
                        })
        });
        await writePosts(posts);
        closeAddModal();
        renderGallery(posts);
    } catch (err) {
        console.error(err);
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
    updateAuthUI();
});
