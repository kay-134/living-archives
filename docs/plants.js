// =====================================================================
// plants.js — Plant Gallery with Google Authentication & Firebase
// =====================================================================
//
// FIRST-TIME SETUP (do this once before using the site):
//
// 1. Go to https://console.firebase.google.com and create a project.
//
// 2. Inside the project, click "Add app" (web icon </>), register the app,
//    and copy the firebaseConfig object into FIREBASE_CONFIG below.
//
// 3. In the Firebase console → Authentication → Sign-in method,
//    enable "Google" as a provider.
//
// 4. In Authentication → Settings → Authorized domains, add your
//    GitHub Pages domain (e.g. your-username.github.io).
//
// 5. In Firestore Database → Create database (Production mode).
//    Then go to Rules and paste:
//
//      rules_version = '2';
//      service cloud.firestore {
//        match /databases/{database}/documents {
//          match /plants/{plantId} {
//            allow read: if true;
//            allow create, delete: if request.auth != null
//              && request.auth.token.email.matches('.*@nyu\\.edu');
//          }
//        }
//      }
//
// =====================================================================

const FIREBASE_CONFIG = {
    apiKey:            "YOUR_API_KEY",
    authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
    projectId:         "YOUR_PROJECT_ID",
    storageBucket:     "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId:             "YOUR_APP_ID"
};

// Only @nyu.edu addresses may post or delete plants.
const NYU_DOMAIN = 'nyu.edu';

// Images are resized client-side to fit within this square (px) before upload.
const MAX_IMG_PX = 600;

// ─── Firebase bootstrap ───────────────────────────────────────────

let auth, db, currentUser = null, lastSnapshot = null;

(function initFirebase() {
    if (FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
        showGalleryMessage(
            'The plant gallery is not yet connected to a database. ' +
            'See plants.js for setup instructions.',
            'error-msg'
        );
        return;
    }

    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db   = firebase.firestore();

        auth.onAuthStateChanged(handleAuthChange);
        subscribeToPlants();
    } catch (e) {
        console.error('Firebase init error:', e);
        showGalleryMessage('Could not connect to the database. Please refresh.', 'error-msg');
    }
})();

// ─── Authentication ───────────────────────────────────────────────

function handleAuthChange(user) {
    if (user && user.email && user.email.endsWith('@' + NYU_DOMAIN)) {
        currentUser = user;
    } else {
        currentUser = null;
        if (user) {
            // Signed in but not an NYU address — boot them out
            auth.signOut();
            alert('Only @nyu.edu email addresses can post to the plant gallery.');
        }
    }
    updateAuthUI();
    renderGallery(lastSnapshot);   // re-render to show/hide delete buttons
}

function signInWithGoogle() {
    if (!auth) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    // Hint Google's account-picker to surface NYU accounts first
    provider.setCustomParameters({ hd: NYU_DOMAIN });
    auth.signInWithPopup(provider).catch(err => {
        if (err.code !== 'auth/popup-closed-by-user') {
            alert('Sign-in error: ' + err.message);
        }
    });
}

function signOut() {
    if (auth) auth.signOut();
}

function updateAuthUI() {
    const signinArea = document.getElementById('signin-area');
    const userArea   = document.getElementById('user-area');
    const addArea    = document.getElementById('add-plant-area');
    const nameEl     = document.getElementById('signed-in-name');

    if (currentUser) {
        signinArea.style.display = 'none';
        userArea.style.display   = 'flex';
        nameEl.textContent = currentUser.displayName || currentUser.email;
        addArea.style.display = 'block';
    } else {
        signinArea.style.display = 'block';
        userArea.style.display   = 'none';
        addArea.style.display    = 'none';
        closeModal();
    }
}

// ─── Firestore / Gallery ──────────────────────────────────────────

function subscribeToPlants() {
    db.collection('plants')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            lastSnapshot = snapshot;
            renderGallery(snapshot);
        }, err => {
            console.error('Firestore error:', err);
            showGalleryMessage('Could not load plants. Please refresh.', 'error-msg');
        });
}

function renderGallery(snapshot) {
    const gallery = document.getElementById('plant-gallery');
    if (!snapshot || snapshot.empty) {
        showGalleryMessage(
            'No plants yet — log in with your NYU email to add the first one!',
            'gallery-status-msg'
        );
        return;
    }
    gallery.innerHTML = '';
    snapshot.forEach(doc => gallery.appendChild(buildCard({ id: doc.id, ...doc.data() })));
}

function buildCard(post) {
    const card = document.createElement('div');
    card.className = 'plant-card';

    const date = post.createdAt
        ? new Date(post.createdAt.toMillis()).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
          })
        : '';

    card.innerHTML = `
        ${post.imageData
            ? `<img src="${post.imageData}" alt="${esc(post.name)}" class="plant-card-img">`
            : '<div class="plant-card-placeholder">No photo</div>'
        }
        <div class="plant-card-body">
            <h3 class="plant-card-name">${esc(post.name)}</h3>
            ${post.desc ? `<p class="plant-card-desc">${esc(post.desc)}</p>` : ''}
            <p class="plant-card-meta">
                Added by ${esc(post.author)}${date ? ' &middot; ' + date : ''}
            </p>
            ${currentUser
                ? `<button class="delete-btn" onclick="deletePost('${post.id}')">Remove</button>`
                : ''
            }
        </div>
    `;
    return card;
}

function deletePost(id) {
    if (!currentUser || !db) return;
    if (!confirm('Remove this plant from the gallery?')) return;
    db.collection('plants').doc(id).delete()
        .catch(err => alert('Could not remove plant: ' + err.message));
}

// ─── Modal ────────────────────────────────────────────────────────

function showModal() {
    document.getElementById('plant-modal').style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('plant-modal');
    if (!modal) return;
    modal.style.display = 'none';
    document.getElementById('plant-form').reset();
    const preview = document.getElementById('image-preview');
    if (preview) preview.style.display = 'none';
}

function closeModalOnOverlay(e) {
    if (e.target === document.getElementById('plant-modal')) closeModal();
}

function previewImage(input) {
    const preview = document.getElementById('image-preview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
    }
}

function submitPlant(e) {
    e.preventDefault();
    if (!currentUser || !db) return;

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
    const btn = document.querySelector('#plant-form .submit-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    db.collection('plants').add({
        name,
        desc,
        imageData,
        author:      currentUser.displayName || currentUser.email,
        authorEmail: currentUser.email,
        createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => closeModal())
    .catch(err => alert('Could not save plant: ' + err.message))
    .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Add Plant';
    });
}

// ─── Helpers ─────────────────────────────────────────────────────

// Resize an image file to fit within maxPx × maxPx, return JPEG base64
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

// Replace special HTML characters to prevent XSS
function esc(str) {
    if (!str) return '';
    return str
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;');
}

// Clear the gallery and show a single status/error message
function showGalleryMessage(msg, cssClass) {
    const gallery = document.getElementById('plant-gallery');
    gallery.innerHTML = `<p class="${cssClass}">${msg}</p>`;
}
