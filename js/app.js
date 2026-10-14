// --- 1. Supabase Initialization ---
// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://ugrashpfqjumdvvdoecz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncmFzaHBmcWp1bWR2dmRvZWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTE4MDMsImV4cCI6MjEwNzQ4NzgwM30.TsP36LDPyRC_fJAA2wQsrXFwTs8-ezZBtYM4lQsGoTc';

// Initialize the client only if the script is loaded via CDN
const supabaseClient = (typeof supabase !== 'undefined') ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// --- 2. Live Hijri Date Conversion Preview ---
const dateInput = document.getElementById('gregorianDate');
const hijriPreview = document.getElementById('hijriPreview');

if (dateInput && typeof HijriDate !== 'undefined') {
  dateInput.addEventListener('change', function(e) {
    const selectedDate = new Date(e.target.value);
    const hijri = HijriDate.fromGregorian(selectedDate);
    const hYear = hijri.getYear();
    const hMonthIndex = hijri.getMonth();
    const hDay = hijri.getDate();
    const hMonthName = HijriDate.getMonthName(hMonthIndex);
    
    hijriPreview.textContent = `الموافق: ${hDay} ${hMonthName} ${hYear} هـ`;
  });
}

// --- 3. Authentication Logic (Admin Panel) ---
const loginBtn = document.getElementById('btnLogin');
if (loginBtn && supabaseClient) {
  loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    loginBtn.textContent = 'جاري التحقق...';
    loginBtn.disabled = true;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
      alert('فشل تسجيل الدخول: ' + error.message);
      loginBtn.textContent = 'دخول (Login)';
      loginBtn.disabled = false;
    } else {
      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('dailyLogForm').style.display = 'block';
    }
  });
}

// --- 4. Form Submission & File Upload ---
const form = document.getElementById('dailyLogForm');
if (form && supabaseClient) {
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = form.querySelector('.btn-submit');
    submitBtn.textContent = 'جاري الرفع والحفظ... (Saving...)';
    submitBtn.disabled = true;

    const gDate = document.getElementById('gregorianDate').value;
    const sector = document.getElementById('sectorTag').value;
    const text = document.getElementById('bodyText').value;
    const fileInput = document.getElementById('mediaUpload').files[0];
    
    let mediaUrl = null;
    let mediaType = null;

    // Handle Storage Upload if file exists
    if (fileInput) {
      const fileExt = fileInput.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      mediaType = (fileExt.toLowerCase() === 'pdf') ? 'pdf' : 'image';

      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('log_attachments')
        .upload(fileName, fileInput);

      if (uploadError) {
        alert('Upload Error: ' + uploadError.message);
        submitBtn.textContent = 'حفظ التقرير (Submit Log)';
        submitBtn.disabled = false;
        return;
      }
      
      const { data: publicUrlData } = supabaseClient.storage
        .from('log_attachments')
        .getPublicUrl(fileName);
      
      mediaUrl = publicUrlData.publicUrl;
    }

    // Insert into Database
    const { data, error } = await supabaseClient
      .from('daily_logs')
      .insert([
        { 
          gregorian_date: gDate, 
          sector: sector, 
          body_text: text, 
          media_url: mediaUrl,
          media_type: mediaType 
        }
      ]);

    if (error) {
      alert('Database Error: ' + error.message);
    } else {
      alert('تم حفظ التقرير بنجاح (Log Saved Successfully)');
      form.reset();
      hijriPreview.textContent = '';
    }

    submitBtn.textContent = 'حفظ التقرير (Submit Log)';
    submitBtn.disabled = false;
  });
}

// --- 5. Fetching Logs (Index Page) ---
async function loadLogs() {
  const container = document.getElementById('chronicle-feed');
  if (!container || !supabaseClient) return;

  const { data: logs, error } = await supabaseClient
    .from('daily_logs')
    .select('*')
    .order('gregorian_date', { ascending: false });

  if (error) {
    container.innerHTML = `<div style="text-align:center; padding: 40px; color: red;">فشل تحميل البيانات (Error loading logs)</div>`;
    console.error(error);
    return;
  }

  container.innerHTML = ''; // Clear loading text

  if (logs.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 40px;">لا توجد تقارير بعد (No logs available yet)</div>`;
    return;
  }

  logs.forEach(log => {
    // Convert date string for display
    const dateObj = new Date(log.gregorian_date);
    let hString = '';
    
    if (typeof HijriDate !== 'undefined') {
      const hijri = HijriDate.fromGregorian(dateObj);
      hString = `${hijri.getDate()} ${HijriDate.getMonthName(hijri.getMonth())} ${hijri.getYear()} هـ`;
    }

    // Build Media HTML
    let mediaHtml = '';
    if (log.media_url) {
      if (log.media_type === 'pdf') {
        mediaHtml = `
          <div class="page-gallery">
            <button class="btn-milestone" onclick="openMediaModal('${log.media_url}', 'pdf')" type="button">
              📄 عرض المرفق (View PDF)
            </button>
          </div>`;
      } else {
        mediaHtml = `
          <div class="page-gallery">
            <img class="gallery-thumb" src="${log.media_url}" alt="Site Photo" onclick="openMediaModal('${log.media_url}', 'image')">
          </div>`;
      }
    }

    // Inject the book page layout
    const article = `
      <article class="book-page">
        <header class="page-header">
          <span class="page-date-hijri">${hString}</span>
          <span class="page-date-gregorian">${dateObj.toDateString()}</span>
        </header>
        <div class="page-content">${log.body_text}</div>
        ${mediaHtml}
        <footer class="page-footer">
          <span class="badge-tag">القطاع: ${log.sector}</span>
        </footer>
      </article>
    `;
    container.innerHTML += article;
  });
}

// Run the loader when the public page opens
document.addEventListener('DOMContentLoaded', loadLogs);

// --- 6. Media Modal Logic ---
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
  
  modal.addEventListener('click', function(e) {
    if (e.target === modal) document.body.removeChild(modal);
  });

  document.body.appendChild(modal);
}