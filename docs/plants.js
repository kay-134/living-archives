// =====================================================================
// plants.js — Plant Gallery with email/password login + JSONbin storage
// Posts are visible to ALL visitors via JSONbin.io (free).
// =====================================================================
//
// SETUP (one-time, ~5 minutes):
//
// ── Step 1: Set your login credentials ───────────────────────────
//   Fill in ALLOWED_EMAIL with your NYU email.
//   Then generate your password hash by opening DevTools console (F12)
//   and running (replace "yourpassword" with your actual password):
//
//     crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
//       .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
//
//   Copy the printed string into PASSWORD_HASH below.
//
// ── Step 2: Create a JSONbin ──────────────────────────────────────
//   a. Go to https://jsonbin.io and create a free account.
//   b. Click "+ Create Bin", paste this as the content, then save:
//        { "plants": [] }
//   c. Copy the Bin ID from the URL (looks like: 6650a1234abc...)
//      and paste it into JSONBIN_BIN_ID below.
//   d. Go to API Keys (top-right menu) → click "+ Create Access Key".
//      Give it Read + Update permissions. Copy the key into
//      JSONBIN_API_KEY below.
//
// =====================================================================

const ALLOWED_EMAIL   = 'your.email@nyu.edu';   // ← your NYU email
const PASSWORD_HASH   = 'PASTE_YOUR_HASH_HERE';  // ← SHA-256 hash of your password

const JSONBIN_BIN_ID  = 'YOUR_BIN_ID';           // ← from jsonbin.io
const JSONBIN_API_KEY = 'YOUR_API_KEY';           // ← from jsonbin.io

// Session lasts 8 hours
const SESSION_TTL_MS  = 8 * 60 * 60 * 1000;

// ─── JSONbin API ──────────────────────────────────────────────────

const BIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
const HEADERS  = {
    'Content-Type':  'application/json',
    'X-Access-Key':  JSONBIN_API_KEY
};

async function fetchPosts() {
    const res = await fetch(BIN_URL + '/latest', { headers: HEADERS });
    if (!res.ok) throw new Error(`JSONbin fetch failed: ${res.status}`);
    const data = await res.json();
    return data.record.plants || [];
}

async function writePosts(posts) {
    const res = await fetch(BIN_URL, {
        method:  'PUT',
        headers: HEADERS,
        body:    JSON.stringify({ plants: posts })
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
    } catch (err) {
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
    // Re-render so delete buttons appear/disappear correctly
    loadAndRender();
}

// ─── Gallery ──────────────────────────────────────────────────────

async function loadAndRender() {
    const gallery = document.getElementById('plant-gallery');

    if (JSONBIN_BIN_ID === 'YOUR_BIN_ID') {
        gallery.innerHTML = '<p class="gallery-status-msg">Gallery not connected yet — see plants.js setup instructions.</p>';
        return;
    }

    gallery.innerHTML = '<p class="gallery-status-msg">Loading plants...</p>';

    try {
        const posts = await fetchPosts();
        renderGallery(posts);
    } catch (err) {
        console.error(err);
        gallery.innerHTML = '<p class="error-msg">Could not load plants. Please refresh and try again.</p>';
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
            ${post.desc ? `<p class="plant-card-desc">${esc(post.desc)}</p>` : ''}
            <p class="plant-card-meta">${esc(post.date)}</p>
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
    } catch (err) {
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

// Live-preview the image URL as the user types
document.addEventListener('DOMContentLoaded', function () {
    const urlInput = document.getElementById('plant-image-url');
    const preview  = document.getElementById('image-preview');
    if (urlInput) {
        urlInput.addEventListener('input', function () {
            const val = this.value.trim();
            if (val) {
                preview.src = val;
                preview.style.display = 'block';
                preview.onerror = () => { preview.style.display = 'none'; };
            } else {
                preview.style.display = 'none';
            }
        });
    }
});

async function submitPlant(e) {
    e.preventDefault();
    if (!currentUser) return;

    const name     = document.getElementById('plant-name').value.trim();
    const desc     = document.getElementById('plant-desc').value.trim();
    const imageUrl = document.getElementById('plant-image-url').value.trim();

    if (!name) return;

    const btn = document.getElementById('plant-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const posts = await fetchPosts();
        posts.unshift({
            id:       Date.now(),
            name,
            desc,
            imageUrl: imageUrl || null,
            date:     new Date().toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric'
                      })
        });
        await writePosts(posts);
        closeAddModal();
        renderGallery(posts);
    } catch (err) {
        alert('Could not save plant. Please try again.');
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
