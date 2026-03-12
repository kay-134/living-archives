// =====================================================================
// plants.js — Plant Gallery with simple email + password login
// No external services required — everything runs in the browser.
// =====================================================================
//
// SETUP: Set your email and password below.
//
// Step 1 — paste your email into ALLOWED_EMAIL.
//
// Step 2 — generate your password hash:
//   Open your browser's DevTools console (F12) and run this line,
//   replacing "yourpassword" with the password you want to use:
//
//     crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
//       .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
//
//   Copy the long string it prints and paste it into PASSWORD_HASH below.
//
// =====================================================================

const ALLOWED_EMAIL   = 'your.email@nyu.edu';   // ← change this
const PASSWORD_HASH   = 'PASTE_YOUR_HASH_HERE';  // ← change this

// How long (ms) to stay logged in without activity (default: 8 hours)
const SESSION_TTL_MS  = 8 * 60 * 60 * 1000;

// Max image dimension (px) before resizing
const MAX_IMG_PX      = 600;

// ─── Session management ───────────────────────────────────────────

let currentUser = null;

function saveSession(email) {
    sessionStorage.setItem('plant_session', JSON.stringify({
        email,
        expires: Date.now() + SESSION_TTL_MS
    }));
}

function loadSession() {
    const raw = sessionStorage.getItem('plant_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expires) {
        sessionStorage.removeItem('plant_session');
        return null;
    }
    return session;
}

function clearSession() {
    sessionStorage.removeItem('plant_session');
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

    btn.disabled    = true;
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
        console.error('Login error:', err);
        errEl.textContent = 'An error occurred. Please try again.';
        errEl.style.display = 'block';
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Log In';
    }
}

function signOut() {
    currentUser = null;
    clearSession();
    updateAuthUI();
}

function updateAuthUI() {
    const signinArea = document.getElementById('signin-area');
    const userArea   = document.getElementById('user-area');
    const addArea    = document.getElementById('add-plant-area');
    const nameEl     = document.getElementById('signed-in-name');

    if (currentUser) {
        signinArea.style.display = 'none';
        userArea.style.display   = 'flex';
        nameEl.textContent = currentUser;
        addArea.style.display = 'block';
    } else {
        signinArea.style.display = 'block';
        userArea.style.display   = 'none';
        addArea.style.display    = 'none';
        closeAddModal();
    }
    renderGallery();
}

// ─── Plant posts (localStorage) ───────────────────────────────────

function getPosts() {
    return JSON.parse(localStorage.getItem('plant_posts') || '[]');
}

function savePosts(posts) {
    localStorage.setItem('plant_posts', JSON.stringify(posts));
}

function renderGallery() {
    const gallery = document.getElementById('plant-gallery');
    const posts   = getPosts();

    if (posts.length === 0) {
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
        ${post.imageData
            ? `<img src="${post.imageData}" alt="${esc(post.name)}" class="plant-card-img">`
            : '<div class="plant-card-placeholder">No photo</div>'
        }
        <div class="plant-card-body">
            <h3 class="plant-card-name">${esc(post.name)}</h3>
            ${post.desc ? `<p class="plant-card-desc">${esc(post.desc)}</p>` : ''}
            <p class="plant-card-meta">${post.date}</p>
            ${currentUser
                ? `<button class="delete-btn" onclick="deletePost(${post.id})">Remove</button>`
                : ''
            }
        </div>
    `;
    return card;
}

function deletePost(id) {
    if (!currentUser) return;
    if (!confirm('Remove this plant from the gallery?')) return;
    savePosts(getPosts().filter(p => p.id !== id));
    renderGallery();
}

// ─── Add plant modal ──────────────────────────────────────────────

function showAddModal() {
    document.getElementById('plant-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('plant-name').focus(), 50);
}

function closeAddModal() {
    const modal = document.getElementById('plant-modal');
    if (!modal) return;
    modal.style.display = 'none';
    document.getElementById('plant-form').reset();
    const preview = document.getElementById('image-preview');
    if (preview) preview.style.display = 'none';
}

function closeAddOnOverlay(e) {
    if (e.target === document.getElementById('plant-modal')) closeAddModal();
}

function previewImage(input) {
    const preview = document.getElementById('image-preview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => { preview.src = e.target.result; preview.style.display = 'block'; };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
    }
}

function submitPlant(e) {
    e.preventDefault();
    if (!currentUser) return;

    const name = document.getElementById('plant-name').value.trim();
    const desc = document.getElementById('plant-desc').value.trim();
    const file = document.getElementById('plant-image').files[0];

    if (!name) return;

    if (file) {
        resizeImage(file, MAX_IMG_PX, imageData => savePost(name, desc, imageData));
    } else {
        savePost(name, desc, null);
    }
}

function savePost(name, desc, imageData) {
    const btn = document.getElementById('plant-submit-btn');
    btn.disabled    = true;
    btn.textContent = 'Saving...';

    const posts = getPosts();
    posts.unshift({
        id:        Date.now(),
        name,
        desc,
        imageData,
        date: new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        })
    });
    savePosts(posts);
    closeAddModal();
    renderGallery();

    btn.disabled    = false;
    btn.textContent = 'Add Plant';
}

// ─── Helpers ─────────────────────────────────────────────────────

async function sha256(message) {
    const buffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(message)
    );
    return [...new Uint8Array(buffer)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function resizeImage(file, maxPx, callback) {
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > maxPx || h > maxPx) {
                const ratio = Math.min(maxPx / w, maxPx / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width  = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function esc(str) {
    if (!str) return '';
    return str
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    const session = loadSession();
    if (session) currentUser = session.email;
    updateAuthUI();
});
