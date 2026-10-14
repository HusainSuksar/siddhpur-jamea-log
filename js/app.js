// --- 1. Supabase Initialization ---
// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://ugrashpfqjumdvvdoecz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncmFzaHBmcWp1bWR2dmRvZWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTE4MDMsImV4cCI6MjEwNzQ4NzgwM30.TsP36LDPyRC_fJAA2wQsrXFwTs8-ezZBtYM4lQsGoTc';

const _supabase = (typeof supabase !== 'undefined') 
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

// File queue state for multi-file upload
let selectedFilesQueue = [];

// --- 2. Proper RTL Hijri Date Formatter ---
// Format starts from the right: [Date] [Month] [Year] H
function formatHijriRTL(dateObj) {
  if (typeof HijriDate === 'undefined') return '';
  const hijri = HijriDate.fromGregorian(dateObj); //[cite: 1]
  const d = hijri.getDate(); //[cite: 1]
  const m = HijriDate.getMonthName(hijri.getMonth()); //[cite: 1]
  const y = hijri.getYear(); //[cite: 1]
  
  // Right-to-left numeral/month sequence: e.g. "٢٤ Rabi al-Awwal 1448 H"
  return `${d} ${m} ${y} H`;
}

// Live preview listener for admin Gregorian date picker
const datePicker = document.getElementById('gregorianDate');
const hijriPreview = document.getElementById('hijriPreview');

if (datePicker && hijriPreview) {
  datePicker.addEventListener('change', (e) => {
    if (!e.target.value) return;
    const gDate = new Date(e.target.value);
    hijriPreview.textContent = formatHijriRTL(gDate);
  });
}

// --- 3. Authentication & Session Handling ---
async function checkAuthState() {
  if (!_supabase) return;
  const { data: { session } } = await _supabase.auth.getSession();
  
  const loginCard = document.getElementById('loginCard');
  const dashboard = document.getElementById('dashboardSection');
  const authNav = document.getElementById('authNavControls');
  const userBadge = document.getElementById('userEmailBadge');

  if (session) {
    if (loginCard) loginCard.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';
    if (authNav) authNav.style.display = 'flex';
    if (userBadge) userBadge.textContent = session.user.email;
    
    // Load admin initializers
    loadSectorsDropdown();
    loadSectorsManager();
    loadAdminLogs();
  } else {
    if (loginCard) loginCard.style.display = 'block';
    if (dashboard) dashboard.style.display = 'none';
    if (authNav) authNav.style.display = 'none';
  }
}

const loginForm = document.getElementById('adminLoginForm');
if (loginForm && _supabase) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const btn = document.getElementById('btnLogin');

    btn.textContent = 'Signing in...';
    btn.disabled = true;

    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert('Authentication Failed: ' + error.message);
      btn.textContent = 'Sign In';
      btn.disabled = false;
    } else {
      checkAuthState();
    }
  });
}

const btnLogout = document.getElementById('btnLogout');
if (btnLogout && _supabase) {
  btnLogout.addEventListener('click', async () => {
    await _supabase.auth.signOut();
    checkAuthState();
  });
}

// --- 4. Admin Tab Switching ---
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add('active');

  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
  if (activeBtn) activeBtn.classList.add('active');

  if (tabId === 'manage-logs') loadAdminLogs();
  if (tabId === 'manage-sectors') loadSectorsManager();
}

// --- 5. Multiple File Queue Handling ---
const mediaUploadInput = document.getElementById('mediaUpload');
const uploadQueueEl = document.getElementById('uploadQueue');

if (mediaUploadInput) {
  mediaUploadInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      // Prevent duplicates in queue
      if (!selectedFilesQueue.some(f => f.name === file.name && f.size === file.size)) {
        selectedFilesQueue.push(file);
      }
    });
    renderUploadQueue();
    mediaUploadInput.value = ''; // Reset input to allow selecting more
  });
}

function renderUploadQueue() {
  if (!uploadQueueEl) return;
  uploadQueueEl.innerHTML = '';
  selectedFilesQueue.forEach((file, index) => {
    const typeLabel = file.type === 'application/pdf' ? '📄 PDF' : '🖼️ IMG';
    const row = document.createElement('div');
    row.className = 'queue-item';
    row.innerHTML = `
      <span><strong>${typeLabel}</strong> ${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
      <button type="button" class="btn-remove-queue" onclick="removeQueuedFile(${index})">&times;</button>
    `;
    uploadQueueEl.appendChild(row);
  });
}

function removeQueuedFile(index) {
  selectedFilesQueue.splice(index, 1);
  renderUploadQueue();
}

// --- 6. Sector / Block (القطاع) Management ---
async function loadSectorsDropdown() {
  const select = document.getElementById('sectorSelect');
  if (!select || !_supabase) return;

  const { data: sectors, error } = await _supabase.from('sectors').select('*').order('name');
  if (error) return;

  select.innerHTML = '<option value="" disabled selected>Select a sector / block...</option>';
  sectors.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    select.appendChild(opt);
  });
}

async function loadSectorsManager() {
  const list = document.getElementById('sectorsList');
  if (!list || !_supabase) return;

  const { data: sectors, error } = await _supabase.from('sectors').select('*').order('name');
  if (error) {
    list.innerHTML = 'Failed to load sectors.';
    return;
  }

  list.innerHTML = '';
  sectors.forEach(s => {
    const item = document.createElement('div');
    item.className = 'sector-chip-row';
    item.innerHTML = `
      <span>${s.name}</span>
      <button class="btn-delete-sector" onclick="deleteSector(${s.id}, '${s.name}')">Delete Block</button>
    `;
    list.appendChild(item);
  });
}

const addSectorForm = document.getElementById('addSectorForm');
if (addSectorForm && _supabase) {
  addSectorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('newSectorName');
    const name = input.value.trim();
    if (!name) return;

    const { error } = await _supabase.from('sectors').insert([{ name }]);
    if (error) {
      alert('Error adding sector: ' + error.message);
    } else {
      input.value = '';
      loadSectorsManager();
      loadSectorsDropdown();
    }
  });
}

async function deleteSector(id, name) {
  if (!confirm(`Are you sure you want to delete sector block: "${name}"?`)) return;
  const { error } = await _supabase.from('sectors').delete().eq('id', id);
  if (error) {
    alert('Failed to delete sector: ' + error.message);
  } else {
    loadSectorsManager();
    loadSectorsDropdown();
  }
}

// --- 7. Log Creation with Multiple Attachments ---
const dailyLogForm = document.getElementById('dailyLogForm');
if (dailyLogForm && _supabase) {
  dailyLogForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('btnSubmitLog');
    btn.disabled = true;
    btn.textContent = 'Uploading files & publishing...';

    const gDate = document.getElementById('gregorianDate').value;
    const sector = document.getElementById('sectorSelect').value;
    const text = document.getElementById('bodyText').value;

    const uploadedMediaList = [];

    // Upload files sequentially to Supabase Storage
    for (const file of selectedFilesQueue) {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const isPdf = file.type === 'application/pdf' || ext.toLowerCase() === 'pdf';

      const { data, error } = await _supabase.storage.from('log_attachments').upload(fileName, file);
      if (!error) {
        const { data: pubData } = _supabase.storage.from('log_attachments').getPublicUrl(fileName);
        uploadedMediaList.push({
          url: pubData.publicUrl,
          type: isPdf ? 'pdf' : 'image',
          name: file.name
        });
      }
    }

    // Insert record with media_files JSONB array
    const { error: dbError } = await _supabase.from('daily_logs').insert([{
      gregorian_date: gDate,
      sector: sector,
      body_text: text,
      media_files: uploadedMediaList
    }]);

    if (dbError) {
      alert('Error saving log: ' + dbError.message);
    } else {
      alert('Daily log published successfully!');
      dailyLogForm.reset();
      selectedFilesQueue = [];
      renderUploadQueue();
      hijriPreview.textContent = 'Select date...';
    }

    btn.disabled = false;
    btn.textContent = 'Publish Daily Log';
  });
}

// --- 8. Admin Logs Table & Deletion ---
async function loadAdminLogs() {
  const tbody = document.getElementById('adminLogsTableBody');
  if (!tbody || !_supabase) return;

  const { data: logs, error } = await _supabase.from('daily_logs').select('*').order('gregorian_date', { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Error loading logs.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No log entries logged yet.</td></tr>`;
    return;
  }

  logs.forEach(log => {
    const dateObj = new Date(log.gregorian_date);
    const hFormatted = formatHijriRTL(dateObj);
    const mediaCount = (log.media_files || []).length + (log.media_url ? 1 : 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${log.gregorian_date}</td>
      <td style="font-family: var(--font-kanz); direction: rtl; font-size: 1.1rem;">${hFormatted}</td>
      <td><strong>${log.sector}</strong></td>
      <td>${mediaCount} item(s)</td>
      <td>
        <button class="btn-delete-log" onclick="deleteLogEntry(${log.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteLogEntry(id) {
  if (!confirm('Are you sure you want to delete this log entry permanently?')) return;
  const { error } = await _supabase.from('daily_logs').delete().eq('id', id);
  if (error) {
    alert('Failed to delete log: ' + error.message);
  } else {
    loadAdminLogs();
  }
}

// --- 9. Public Chronicle Feed Loader (index.html) ---
async function loadChronicleFeed() {
  const container = document.getElementById('chronicle-feed');
  if (!container || !_supabase) return;

  const { data: logs, error } = await _supabase
    .from('daily_logs')
    .select('*')
    .order('gregorian_date', { ascending: false });

  if (error) {
    container.innerHTML = `<div style="text-align:center; padding: 40px; color: red;">Failed to load chronicle records.</div>`;
    return;
  }

  container.innerHTML = '';
  if (logs.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 40px;">No chronicle entries recorded yet.</div>`;
    return;
  }

  logs.forEach(log => {
    const dateObj = new Date(log.gregorian_date);
    const hijriString = formatHijriRTL(dateObj);

    // Normalize media attachments across both formats
    let mediaItems = log.media_files || [];
    if (log.media_url && mediaItems.length === 0) {
      mediaItems = [{ url: log.media_url, type: log.media_type || 'image', name: 'Attachment' }];
    }

    let mediaHtml = '';
    if (mediaItems.length > 0) {
      let attachmentsHtml = '';
      mediaItems.forEach(item => {
        if (item.type === 'pdf') {
          attachmentsHtml += `
            <button class="pdf-attachment-btn" onclick="openMediaModal('${item.url}', 'pdf')">
              <span>📄</span> View PDF Document
            </button>
          `;
        } else {
          attachmentsHtml += `
            <img class="gallery-thumb" src="${item.url}" alt="Site Photo" onclick="openMediaModal('${item.url}', 'image')">
          `;
        }
      });
      mediaHtml = `<div class="page-gallery">${attachmentsHtml}</div>`;
    }

    const article = `
      <article class="book-page">
        <header class="page-header">
          <span class="page-date-hijri" dir="rtl">${hijriString}</span>
          <span class="page-date-gregorian">${dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </header>
        <div class="page-content">${log.body_text}</div>
        ${mediaHtml}
        <footer class="page-footer">
          <span class="badge-tag">${log.sector}</span>
        </footer>
      </article>
    `;
    container.innerHTML += article;
  });
}

// Media Modal Logic
function openMediaModal(fileUrl, fileType) {
  const modal = document.createElement('div');
  modal.className = 'media-modal active';
  
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-content-wrapper';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-modal';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => document.body.removeChild(modal);

  if (fileType === 'pdf') {
    const iframe = document.createElement('iframe');
    iframe.src = fileUrl;
    wrapper.appendChild(iframe);
  } else {
    const img = document.createElement('img');
    img.src = fileUrl;
    wrapper.appendChild(img);
  }

  wrapper.appendChild(closeBtn);
  modal.appendChild(wrapper);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) document.body.removeChild(modal);
  });

  document.body.appendChild(modal);
}

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('chronicle-feed')) {
    loadChronicleFeed();
  }
  if (document.getElementById('loginCard') || document.getElementById('dashboardSection')) {
    checkAuthState();
  }
});