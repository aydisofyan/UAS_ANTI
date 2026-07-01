/* ==========================================================================
   SaltChain Frontend Engine (Pure SPA Javascript)
   Slogan: "Transparansi Distribusi Garam dari Petani hingga Industri"
   ========================================================================== */

const API_BASE = window.location.origin;

// Stability: Offline Reconnection System
let isOffline = false;
let reconnectInterval = null;

function setOfflineState(state) {
  if (state === isOffline) return;
  isOffline = state;

  let banner = document.getElementById('offlineBanner');

  if (state) {
    showToast('⚠️ Koneksi ke server terputus! Mencoba menghubungkan kembali...', 'danger');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'offlineBanner';
      banner.className = 'offline-banner';
      banner.innerHTML = `
        <div class="offline-banner-content">
          <i class="fa-solid fa-triangle-exclamation pulse"></i>
          <span>Koneksi ke Server Terputus! Mencoba Menghubungkan Kembali...</span>
        </div>
      `;
      document.body.prepend(banner);
    }

    // Start reconnection poller
    if (!reconnectInterval) {
      reconnectInterval = setInterval(async () => {
        try {
          // Use originalFetch to avoid recursive interception loops
          const ping = await originalFetch(`${API_BASE}/api/products`, { headers: getHeaders() });
          if (ping.ok) {
            setOfflineState(false);
          }
        } catch (e) {
          console.log('Reconnection ping failed...');
        }
      }, 3000);
    }
  } else {
    showToast('🟢 Jaringan terhubung kembali!', 'success');
    if (banner) {
      banner.remove();
    }
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }

    // Reload active tab data to refresh views
    switchTab(activeTab);
  }
}

// Global fetch Interception for resilient connections
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  try {
    const response = await originalFetch(...args);
    setOfflineState(false);
    return response;
  } catch (error) {
    if (error instanceof TypeError) {
      setOfflineState(true);
    }
    throw error;
  }
};

// State management
let authToken = localStorage.getItem('saltchain_token') || null;
let currentUser = null;
let productsList = [];
let cart = [];
let activeTab = 'overview';
let activeAuditingShippingId = null; // For tracking modal

// Elements
const sidebarUserNama = document.getElementById('sidebarUserNama');
const sidebarUserRole = document.getElementById('sidebarUserRole');
const logoutBtn = document.getElementById('logoutBtn');
const generalBlockchainStatus = document.getElementById('generalBlockchainStatus');

// Register headers wrapper
function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

// Check session on load
document.addEventListener('DOMContentLoaded', () => {
  if (authToken) {
    checkSession();
  } else {
    updateUIForRole(null);
    loadOverviewData();
  }
});

// Toast Notifications
function showToast(message, type = 'success') {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  const icon = toast.querySelector('.toast-icon');
  const msgText = toast.querySelector('.toast-message');

  if (msgText) {
    msgText.innerText = message;
  }
  toast.className = 'toast active';

  if (icon) {
    if (type === 'danger') {
      toast.classList.add('danger');
      icon.className = 'fa-solid fa-circle-exclamation toast-icon';
    } else if (type === 'info') {
      toast.classList.add('info');
      icon.className = 'fa-solid fa-circle-info toast-icon';
    } else {
      icon.className = 'fa-solid fa-circle-check toast-icon';
    }
  }

  setTimeout(() => {
    toast.classList.remove('active');
  }, 4000);
}

// --------------------------------------------------------------------------
// AUTHENTICATION & PERSONA QUICK SWITCH
// --------------------------------------------------------------------------
async function checkSession() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const result = await res.json();
    if (result.success) {
      currentUser = result.data;
      updateUIForRole(currentUser.Peran);
      showToast(`Sesi aktif dipulihkan: ${currentUser.Nama}`, 'info');
      // Redirect to overview by default on reload
      switchTab('overview');
    } else {
      logout();
    }
  } catch (err) {
    console.error('Session restore failed:', err);
    logout();
  }
}

async function quickLogin(email, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Email: email, Password: password }),
    });
    const result = await res.json();

    if (result.success) {
      authToken = result.token;
      localStorage.setItem('saltchain_token', authToken);
      currentUser = result.user;

      updateUIForRole(currentUser.Peran);
      showToast(`Berhasil masuk sebagai ${currentUser.Nama} (${currentUser.Peran})`, 'success');

      // Auto switch tabs depending on role for smooth UX
      if (currentUser.Peran === 'Petani') {
        switchTab('farmer-panel');
      } else if (currentUser.Peran === 'Pengepul' || currentUser.Peran === 'Pabrik') {
        switchTab('buyer-panel');
      } else if (currentUser.Peran === 'Kurir') {
        switchTab('courier-panel');
      } else {
        switchTab('overview');
      }
    } else {
      showToast(result.message, 'danger');
    }
  } catch (err) {
    showToast('Koneksi server gagal.', 'danger');
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPassword').value;
  await quickLogin(email, pass);
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const Nama = document.getElementById('regNama').value;
  const Email = document.getElementById('regEmail').value;
  const Password = document.getElementById('regPassword').value;
  const Peran = document.getElementById('regPeran').value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Nama, Email, Password, Peran }),
    });
    const result = await res.json();

    if (result.success) {
      showToast('Pendaftaran akun berhasil! Silakan masuk.', 'success');
      // Auto fill and transition
      document.getElementById('loginEmail').value = Email;
      document.getElementById('loginPassword').value = Password;
      switchAuthForm('login');
    } else {
      showToast(result.message, 'danger');
    }
  } catch (err) {
    showToast('Koneksi server gagal.', 'danger');
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  cart = [];
  localStorage.removeItem('saltchain_token');
  updateUIForRole(null);
  showToast('Anda telah keluar dari aplikasi.', 'info');
  switchTab('overview');
}

function updateUIForRole(role) {
  // Elements toggle based on roles
  const navProducts = document.getElementById('navProducts');
  const navFarmerPanel = document.getElementById('navFarmerPanel');
  const navBuyerPanel = document.getElementById('navBuyerPanel');
  const navCourierPanel = document.getElementById('navCourierPanel');
  const navOverview = document.getElementById('navOverview');
  const guestCallout = document.getElementById('guestCallout');

  // Clear cart on switch
  cart = [];
  updateCartUI();

  if (!role) {
    sidebarUserNama.innerText = 'Guest User';
    sidebarUserRole.className = 'role-badge guest';
    sidebarUserRole.innerText = 'GUEST';
    logoutBtn.style.display = 'none';
    guestCallout.style.display = 'flex';

    // Disable role specific tabs
    navFarmerPanel.style.display = 'none';
    navBuyerPanel.style.display = 'none';
    navCourierPanel.style.display = 'none';
  } else {
    sidebarUserNama.innerText = currentUser.Nama;
    sidebarUserRole.className = `role-badge ${role.toLowerCase()}`;
    sidebarUserRole.innerText = role;
    logoutBtn.style.display = 'block';
    guestCallout.style.display = 'none';

    // Show dynamic navigation elements
    navFarmerPanel.style.display = (role === 'Petani' || role === 'Admin') ? 'flex' : 'none';
    navBuyerPanel.style.display = (role === 'Pengepul' || role === 'Pabrik' || role === 'Admin') ? 'flex' : 'none';
    navCourierPanel.style.display = (role === 'Kurir' || role === 'Admin') ? 'flex' : 'none';
  }
}

function switchAuthForm(type) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const btns = document.querySelectorAll('.auth-tab-btn');

  if (type === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    btns[0].classList.add('active');
    btns[1].classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    btns[0].classList.remove('active');
    btns[1].classList.add('active');
  }
}

// --------------------------------------------------------------------------
// SPA ROUTING / TAB SWITCHER
// --------------------------------------------------------------------------
function switchTab(tabId) {
  // Auto-close sidebar on mobile when tab changes
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && sidebar.classList.contains('mobile-active')) {
    sidebar.classList.remove('mobile-active');
  }
  if (overlay && overlay.classList.contains('active')) {
    overlay.classList.remove('active');
  }

  // If role specific tab is clicked but no user, redirect to login tab
  const roleProtectedTabs = ['farmer-panel', 'buyer-panel', 'courier-panel'];
  if (roleProtectedTabs.includes(tabId) && !currentUser) {
    tabId = 'auth';
    showToast('Silakan masuk terlebih dahulu untuk mengakses menu tersebut.', 'info');
  }

  activeTab = tabId;

  // Toggle active class in navigation
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.tab-content > section').forEach(sec => sec.style.display = 'none');

  // Handle active class bindings
  const selectedSection = document.getElementById(`tab-${tabId}`);
  if (selectedSection) selectedSection.style.display = 'block';

  // Specific header title definitions
  const title = document.getElementById('currentTabTitle');
  const subtitle = document.getElementById('currentTabSubtitle');

  switch (tabId) {
    case 'overview':
      title.innerText = 'Dashboard Ringkasan';
      subtitle.innerText = 'Alur distribusi garam nasional termonitor secara real-time.';
      document.getElementById('navOverview').classList.add('active');
      loadOverviewData();
      break;
    case 'auth':
      title.innerText = 'Akses Masuk & Registrasi';
      subtitle.innerText = 'Daftar atau masuk ke portal transparan SaltChain.';
      break;
    case 'products':
      title.innerText = 'Daftar Garam Nasional';
      subtitle.innerText = 'Lihat seluruh komoditas garam yang diproduksi oleh petani terverifikasi.';
      document.getElementById('navProducts').classList.add('active');
      loadPublicProducts();
      break;
    case 'farmer-panel':
      title.innerText = 'Panel Petani Garam';
      subtitle.innerText = 'Inventori produksi, catat panen baru, dan kendalikan harga jual.';
      document.getElementById('navFarmerPanel').classList.add('active');
      loadFarmerProducts();
      break;
    case 'buyer-panel':
      title.innerText = 'Panel Pengepul & Pabrik Industri';
      subtitle.innerText = 'Beli komoditas garam langsung dari petani dan pantau alur logistik.';
      document.getElementById('navBuyerPanel').classList.add('active');
      loadBuyerDashboard();
      break;
    case 'courier-panel':
      title.innerText = 'Panel Distribusi Logistik Kurir';
      subtitle.innerText = 'Kirim pasokan garam, input resi, dan tandatangani serah terima.';
      document.getElementById('navCourierPanel').classList.add('active');
      loadCourierDashboard();
      break;
    case 'ledger':
      title.innerText = 'Ledger Explorer Blockchain';
      subtitle.innerText = 'Investigasi rantai data SHA-256 untuk memverifikasi transparansi distribusi.';
      document.getElementById('navLedger').classList.add('active');
      loadLedgerBlocks();
      break;
  }
}

// --------------------------------------------------------------------------
// 1. OVERVIEW / DASHBOARD TAB DATA
// --------------------------------------------------------------------------
async function loadOverviewData() {
  try {
    // 1. Fetch public products
    const prodRes = await fetch(`${API_BASE}/api/products`, { headers: getHeaders() });
    const prodData = await prodRes.json();
    const totalProdCount = prodData.success ? prodData.data.length : 0;
    document.getElementById('statTotalProducts').innerText = `${totalProdCount} Item`;

    // 2. Fetch orders if logged in, else 0
    let totalOrders = 0;
    if (authToken) {
      const orderRes = await fetch(`${API_BASE}/api/orders`, { headers: getHeaders() });
      const orderData = await orderRes.json();
      totalOrders = orderData.success ? orderData.data.length : 0;
    }
    document.getElementById('statTotalOrders').innerText = `${totalOrders} Transaksi`;

    // 3. Fetch blockchain blocks
    const ledgerRes = await fetch(`${API_BASE}/api/ledger/blocks`, { headers: getHeaders() });
    const ledgerData = await ledgerRes.json();
    const blocks = ledgerData.success ? ledgerData.data : [];
    document.getElementById('statTotalBlocks').innerText = `${blocks.length} Blok`;

    // Render mini ledger blocks logs inside sidebar/right cards
    const miniBlockList = document.getElementById('miniBlockList');
    if (blocks.length === 0) {
      miniBlockList.innerHTML = `<div class="text-center text-muted py-4">Belum ada blok ledger tercatat.</div>`;
    } else {
      miniBlockList.innerHTML = '';
      // Show up to 5 latest blocks
      blocks.slice(0, 5).forEach(block => {
        let eventLabel = block.Data;
        try {
          const parsed = JSON.parse(block.Data);
          eventLabel = parsed.eventName.replace('_', ' ');
        } catch (e) { }

        const isTampered = block.Data.includes('"TAMPERED":true');

        const div = document.createElement('div');
        div.className = `mini-block-card ${isTampered ? 'tampered' : ''}`;
        div.innerHTML = `
          <div class="mini-block-info">
            <h5>${eventLabel}</h5>
            <p>Blok #${block.Index} • ${new Date(block.Tanggal).toLocaleString('id-ID')}</p>
          </div>
          <span class="mini-block-hash">${block.Hash.substring(0, 8)}...</span>
        `;
        miniBlockList.appendChild(div);
      });
    }

    // Check general database health check status
    // If any block in database is tampered (violates current validation)
    let isChainTampered = false;
    for (const b of blocks) {
      if (b.Data.includes('"TAMPERED":true')) {
        isChainTampered = true;
        break;
      }
    }

    const indicator = generalBlockchainStatus.querySelector('.status-indicator');
    const label = generalBlockchainStatus.querySelector('.status-label');
    const statLedger = document.getElementById('statLedgerStatus');

    if (isChainTampered) {
      indicator.className = 'status-indicator danger active';
      label.className = 'status-label text-danger';
      label.innerText = 'WARNING: LEDGER RUSAK!';
      statLedger.innerText = '🚨 Ada Tamper';
      statLedger.style.color = 'var(--color-danger)';
    } else {
      indicator.className = 'status-indicator active';
      label.className = 'status-label';
      label.innerText = 'Ledger: Aman & Valid';
      statLedger.innerText = 'Terverifikasi';
      statLedger.style.color = 'var(--color-success)';
    }

  } catch (err) {
    console.error('Error loading overview info:', err);
  }
}

// --------------------------------------------------------------------------
// 2. PUBLIC PRODUCTS CATALOG
// --------------------------------------------------------------------------
async function loadPublicProducts() {
  const tableBody = document.getElementById('publicProductsTableBody');
  const countSpan = document.getElementById('productCount');

  try {
    const res = await fetch(`${API_BASE}/api/products`, { headers: getHeaders() });
    const result = await res.json();

    if (result.success) {
      productsList = result.data;
      countSpan.innerText = `${productsList.length} Garam Terdaftar`;

      if (productsList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Belum ada garam terdaftar di supply chain.</td></tr>`;
        return;
      }

      tableBody.innerHTML = '';
      productsList.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${p.Nama_Produk}</strong></td>
          <td><span class="badge">${p.Kategori}</span></td>
          <td><i class="fa-solid fa-tractor text-muted mr-1"></i> ${p.Petani.Nama}</td>
          <td>${p.Stok} Kg</td>
          <td>Rp ${p.Harga.toLocaleString('id-ID')}</td>
          <td>
            ${(currentUser && (currentUser.Peran === 'Pengepul' || currentUser.Peran === 'Pabrik'))
            ? `<button class="btn btn-xs btn-accent" onclick="addToCart('${p.ID_Produk}')"><i class="fa-solid fa-cart-plus"></i> Tambah</button>`
            : `<span class="text-muted text-xs">Login Pembeli untuk membeli</span>`
          }
          </td>
        `;
        tableBody.appendChild(tr);
      });
    }
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Gagal memuat produk. Hubungi admin.</td></tr>`;
  }
}

// --------------------------------------------------------------------------
// 3. FARMER PORTAL CRUD
// --------------------------------------------------------------------------
async function loadFarmerProducts() {
  const tableBody = document.getElementById('farmerProductsTableBody');
  try {
    const res = await fetch(`${API_BASE}/api/products/farmer`, { headers: getHeaders() });
    const result = await res.json();

    if (result.success) {
      if (result.data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Anda belum memiliki produk terdaftar. Mulai tambahkan di formulir sebelah kiri!</td></tr>`;
        return;
      }

      tableBody.innerHTML = '';
      result.data.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${p.Nama_Produk}</strong></td>
          <td><span class="badge">${p.Kategori}</span></td>
          <td>${p.Stok} Kg</td>
          <td>Rp ${p.Harga.toLocaleString('id-ID')}</td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-xs btn-primary" onclick="editProduct('${p.ID_Produk}', '${p.Nama_Produk}', '${p.Kategori}', ${p.Stok}, ${p.Harga})"><i class="fa-solid fa-edit"></i> Edit</button>
              <button class="btn btn-xs btn-danger" onclick="deleteProduct('${p.ID_Produk}')"><i class="fa-solid fa-trash-can"></i> Hapus</button>
            </div>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    }
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Gagal memuat inventori Anda.</td></tr>`;
  }
}

async function handleProductSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('formProductId').value;
  const Nama_Produk = document.getElementById('formProductName').value;
  const Kategori = document.getElementById('formProductCategory').value;
  const Stok = parseInt(document.getElementById('formProductStock').value);
  const Harga = parseFloat(document.getElementById('formProductPrice').value);

  const payload = { Nama_Produk, Kategori, Stok, Harga };

  let url = `${API_BASE}/api/products`;
  let method = 'POST';

  if (id) {
    url = `${API_BASE}/api/products/${id}`;
    method = 'PUT';
  }

  try {
    const res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (result.success) {
      showToast(result.message, 'success');
      resetProductForm();
      loadFarmerProducts();
    } else {
      showToast(result.message, 'danger');
    }
  } catch (err) {
    showToast('Gagal memproses simpan produk.', 'danger');
  }
}

function editProduct(id, nama, kategori, stok, harga) {
  document.getElementById('formProductId').value = id;
  document.getElementById('formProductName').value = nama;
  document.getElementById('formProductCategory').value = kategori;
  document.getElementById('formProductStock').value = stok;
  document.getElementById('formProductPrice').value = harga;

  document.getElementById('productFormSubmitBtn').innerText = 'Perbarui Produk';
  document.getElementById('cancelEditProductBtn').style.display = 'inline-flex';
}

function resetProductForm() {
  document.getElementById('formProductId').value = '';
  document.getElementById('farmerProductForm').reset();

  document.getElementById('productFormSubmitBtn').innerText = 'Simpan Produk';
  document.getElementById('cancelEditProductBtn').style.display = 'none';
}

async function deleteProduct(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus produk ini dari supply chain?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/products/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const result = await res.json();

    if (result.success) {
      showToast(result.message, 'success');
      loadFarmerProducts();
    } else {
      showToast(result.message, 'danger');
    }
  } catch (err) {
    showToast('Gagal menghapus produk.', 'danger');
  }
}

// --------------------------------------------------------------------------
// 4. BUYER PANEL (Pengepul / Pabrik)
// --------------------------------------------------------------------------
async function loadBuyerDashboard() {
  const storefrontGrid = document.getElementById('storefrontGrid');
  const tableBody = document.getElementById('buyerOrdersTableBody');

  // 1. Fetch Storefront
  try {
    const res = await fetch(`${API_BASE}/api/products`, { headers: getHeaders() });
    const result = await res.json();

    if (result.success) {
      if (result.data.length === 0) {
        storefrontGrid.innerHTML = `<div class="text-center text-muted py-4 w-full">Garam pasar sedang kosong.</div>`;
      } else {
        storefrontGrid.innerHTML = '';
        result.data.forEach(p => {
          const card = document.createElement('div');
          card.className = 'store-card';
          card.innerHTML = `
            <div class="store-card-header">
              <h4>${p.Nama_Produk}</h4>
              <span>Petani: ${p.Petani.Nama}</span>
            </div>
            <div class="store-card-body">
              <div>Kategori: <span class="badge">${p.Kategori}</span></div>
              <div>Stok: <strong>${p.Stok} Kg</strong></div>
              <div class="store-card-price">Rp ${p.Harga.toLocaleString('id-ID')}/Kg</div>
            </div>
            <div class="store-card-footer">
              <button class="btn btn-accent btn-block" onclick="addToCart('${p.ID_Produk}')" ${p.Stok <= 0 ? 'disabled' : ''}>
                <i class="fa-solid fa-cart-plus"></i> ${p.Stok <= 0 ? 'Habis' : 'Masukkan Keranjang'}
              </button>
            </div>
          `;
          storefrontGrid.appendChild(card);
        });
      }
    }
  } catch (err) {
    storefrontGrid.innerHTML = `<div class="text-center text-danger py-4 w-full">Gagal memuat pasar garam.</div>`;
  }

  // 2. Fetch Purchase History
  try {
    const res = await fetch(`${API_BASE}/api/orders`, { headers: getHeaders() });
    const result = await res.json();

    if (result.success) {
      if (result.data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Anda belum memiliki riwayat pembelian garam.</td></tr>`;
        return;
      }

      tableBody.innerHTML = '';
      result.data.forEach(order => {
        const orderDate = new Date(order.Tanggal_Pesan).toLocaleDateString('id-ID');

        // Construct string of products
        const productsSummary = order.Detail_Pesanan.map(det =>
          `${det.Produk.Nama_Produk} (${det.Jumlah_Beli} Kg)`
        ).join('<br>');

        const isShipped = order.Pengiriman.length > 0;
        const resi = isShipped ? order.Pengiriman[0].Resi : null;
        const shippingId = isShipped ? order.Pengiriman[0].ID_Pengiriman : null;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code class="text-accent">${order.ID_Pesanan.substring(0, 8)}...</code></td>
          <td>${orderDate}</td>
          <td class="text-sm">${productsSummary}</td>
          <td><strong>Rp ${order.Total_Harga.toLocaleString('id-ID')}</strong></td>
          <td>
            <span class="role-badge ${order.Status_Pesanan === 'Selesai' ? 'admin' : (order.Status_Pesanan === 'Dikirim' ? 'kurir' : 'petani')}">
              ${order.Status_Pesanan}
            </span>
          </td>
          <td>
            ${isShipped
            ? `<button class="btn btn-xs btn-primary" onclick="openTrackingModal('${shippingId}')"><i class="fa-solid fa-route"></i> Lacak (${resi.substring(0, 10)}...)</button>`
            : `<span class="text-muted text-xs">Menunggu Logistik</span>`
          }
          </td>
        `;
        tableBody.appendChild(tr);
      });
    }
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Gagal memuat transaksi.</td></tr>`;
  }
}

// Storefront Cart Logic
function addToCart(productId) {
  const product = productsList.find(p => p.ID_Produk === productId);
  if (!product) return;

  const existing = cart.find(item => item.product.ID_Produk === productId);
  if (existing) {
    if (existing.quantity >= product.Stok) {
      showToast(`Stok ${product.Nama_Produk} tidak mencukupi untuk ditambah lagi.`, 'danger');
      return;
    }
    existing.quantity++;
  } else {
    cart.push({ product, quantity: 1 });
  }

  showToast(`Ditambahkan ke keranjang: ${product.Nama_Produk}`);
  updateCartUI();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.product.ID_Produk !== productId);
  updateCartUI();
}

function updateCartUI() {
  const container = document.getElementById('cartItemsList');
  const totalLabel = document.getElementById('cartTotalPrice');
  const btnCheckout = document.getElementById('btnCheckout');

  if (cart.length === 0) {
    container.innerHTML = `<div class="text-center text-muted py-4">Keranjang belanja Anda kosong.</div>`;
    totalLabel.innerText = 'Rp 0';
    btnCheckout.disabled = true;
    return;
  }

  container.innerHTML = '';
  let total = 0;

  cart.forEach(item => {
    const subtotal = item.product.Harga * item.quantity;
    total += subtotal;

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div>
        <div class="cart-item-name" title="${item.product.Nama_Produk}">${item.product.Nama_Produk}</div>
        <small class="text-muted">${item.quantity} Kg x Rp ${item.product.Harga.toLocaleString('id-ID')}</small>
      </div>
      <div class="flex gap-2 align-center">
        <strong>Rp ${subtotal.toLocaleString('id-ID')}</strong>
        <button class="btn-remove-cart" onclick="removeFromCart('${item.product.ID_Produk}')"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;
    container.appendChild(div);
  });

  totalLabel.innerText = `Rp ${total.toLocaleString('id-ID')}`;
  btnCheckout.disabled = false;
}

async function checkoutCart() {
  if (cart.length === 0) return;

  const items = cart.map(item => ({
    ID_Produk: item.product.ID_Produk,
    Jumlah_Beli: item.quantity,
  }));

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ items }),
    });
    const result = await res.json();

    if (result.success) {
      showToast('Transaksi berhasil dibuat! Silakan lacak pengiriman logistik.', 'success');
      cart = [];
      updateCartUI();
      loadBuyerDashboard();
    } else {
      showToast(result.message, 'danger');
    }
  } catch (err) {
    showToast('Checkout gagal.', 'danger');
  }
}

// --------------------------------------------------------------------------
// 5. COURIER LOGISTICS PANEL
// --------------------------------------------------------------------------
async function loadCourierDashboard() {
  const tableBody = document.getElementById('courierOrdersTableBody');
  try {
    const res = await fetch(`${API_BASE}/api/orders`, { headers: getHeaders() });
    const result = await res.json();

    if (result.success) {
      if (result.data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Belum ada pesanan terdaftar di sistem logistik.</td></tr>`;
        return;
      }

      tableBody.innerHTML = '';
      result.data.forEach(order => {
        const isShipped = order.Pengiriman.length > 0;
        const shipping = isShipped ? order.Pengiriman[0] : null;

        // Products details string
        const productsSummary = order.Detail_Pesanan.map(det =>
          `${det.Produk.Nama_Produk} (${det.Jumlah_Beli} Kg)`
        ).join(', ');

        const dateStr = new Date(order.Tanggal_Pesan).toLocaleString('id-ID');

        let shippingInfo = '<span class="text-muted text-xs">Belum Diproses</span>';
        let actionBtn = '';

        if (!isShipped) {
          actionBtn = `<button class="btn btn-xs btn-accent" onclick="dispatchShipment('${order.ID_Pesanan}')"><i class="fa-solid fa-truck-ramp-box"></i> Proses Kirim</button>`;
        } else {
          shippingInfo = `
            <div><strong>Resi:</strong> <code>${shipping.Resi}</code></div>
            <div><strong>Kurir:</strong> ${shipping.Kurir}</div>
            <div><strong>Status Kirim:</strong> <span class="role-badge ${shipping.Status_Kirim === 'Sampai' ? 'admin' : 'kurir'}">${shipping.Status_Kirim}</span></div>
          `;

          if (shipping.Status_Kirim === 'Diproses') {
            actionBtn = `<button class="btn btn-xs btn-primary" onclick="updateShipping('${shipping.ID_Pengiriman}', 'Dikirim')"><i class="fa-solid fa-truck"></i> Kirim (Transit)</button>`;
          } else if (shipping.Status_Kirim === 'Dikirim') {
            actionBtn = `<button class="btn btn-xs btn-success" onclick="updateShipping('${shipping.ID_Pengiriman}', 'Sampai')"><i class="fa-solid fa-clipboard-check"></i> Selesai (Sampai)</button>`;
          } else {
            actionBtn = `<span class="text-success text-xs"><i class="fa-solid fa-circle-check"></i> Paket Diterima</span>`;
          }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code class="text-accent">${order.ID_Pesanan.substring(0, 8)}...</code></td>
          <td>${order.Pembeli.Nama} (${order.Pembeli.Peran})</td>
          <td class="text-xs">${dateStr}</td>
          <td>Rp ${order.Total_Harga.toLocaleString('id-ID')}</td>
          <td><span class="role-badge guest">${order.Status_Pesanan}</span></td>
          <td class="text-xs">${shippingInfo}</td>
          <td>${actionBtn}</td>
        `;
        tableBody.appendChild(tr);
      });
    }
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Gagal memuat logistik.</td></tr>`;
  }
}

async function dispatchShipment(orderId) {
  try {
    const res = await fetch(`${API_BASE}/api/shippings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        ID_Pesanan: orderId,
        Kurir_Nama: currentUser ? currentUser.Nama : 'Agus Logistik'
      }),
    });
    const result = await res.json();

    if (result.success) {
      showToast('Distribusi barang dikonfirmasi dan diamankan di Blockchain Ledger!', 'success');
      loadCourierDashboard();
    } else {
      showToast(result.message, 'danger');
    }
  } catch (err) {
    showToast('Gagal memproses logistik.', 'danger');
  }
}

async function updateShipping(shippingId, statusKirim) {
  try {
    const res = await fetch(`${API_BASE}/api/shippings/${shippingId}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ Status_Kirim: statusKirim }),
    });
    const result = await res.json();

    if (result.success) {
      showToast(`Paket berhasil diupdate menjadi '${statusKirim}' dan diverifikasi di Blockchain!`, 'success');
      loadCourierDashboard();
    } else {
      showToast(result.message, 'danger');
    }
  } catch (err) {
    showToast('Gagal memperbarui status logistik.', 'danger');
  }
}

// --------------------------------------------------------------------------
// 6. BLOCKCHAIN LEDGER EXPLORER
// --------------------------------------------------------------------------
async function loadLedgerBlocks() {
  const chainContainer = document.getElementById('blockchainVisualChain');
  const verifierBox = document.getElementById('ledgerVerifierBox');
  const verifierIcon = document.getElementById('verifierStatusIcon');
  const verifierTitle = document.getElementById('verifierStatusTitle');
  const verifierText = document.getElementById('verifierStatusText');

  try {
    const res = await fetch(`${API_BASE}/api/ledger/blocks`, { headers: getHeaders() });
    const result = await res.json();

    if (result.success) {
      const blocks = result.data;

      if (blocks.length === 0) {
        chainContainer.innerHTML = `<div class="text-center text-muted py-4">Belum ada blok yang tercatat di jaringan. Jalankan pembelian garam dan pengiriman kurir untuk memicu blok baru!</div>`;
        verifierBox.style.display = 'none';
        return;
      }

      verifierBox.style.display = 'flex';
      chainContainer.innerHTML = '';

      let tamperedDetected = false;
      let tamperedBlocks = [];

      // Detect tampered blocks first (any containing the tamper tag in DB)
      blocks.forEach(block => {
        if (block.Data.includes('"TAMPERED":true')) {
          tamperedDetected = true;
          tamperedBlocks.push(block.Index);
        }
      });

      // Update Audit UI
      if (tamperedDetected) {
        chainContainer.classList.add('tampered');
        verifierBox.className = 'blockchain-verifier-box tampered-alert';
        verifierIcon.className = 'fa-solid fa-triangle-exclamation text-danger';
        verifierTitle.innerText = '🚨 ALARM: INTEGRITAS LEDGER RUSAK!';
        verifierTitle.style.color = 'var(--color-danger)';
        verifierText.innerHTML = `Audit digital mendeteksi modifikasi paksa pada database (tampering) pada <strong>Blok #${tamperedBlocks.join(', #')}</strong>! Blockchain SaltChain mendeteksi ketidaksesuaian Hash SHA-256 dan segera memutuskan rantai validitas pasokan.`;
      } else {
        chainContainer.classList.remove('tampered');
        verifierBox.className = 'blockchain-verifier-box';
        verifierIcon.className = 'fa-solid fa-shield-check text-success';
        verifierTitle.innerText = 'Audit Kriptografi: Integritas Jaringan Sukses';
        verifierTitle.style.color = 'var(--color-success)';
        verifierText.innerText = 'Seluruh blok rantai pasok logistik terverifikasi aman menggunakan algoritma SHA-256. Tidak ada perubahan liar atau data palsu yang disisipkan.';
      }

      // Render all blocks dynamically
      blocks.forEach(block => {
        let parsedData = { eventName: 'UNKNOWN', payload: {} };
        try {
          parsedData = JSON.parse(block.Data);
        } catch (e) { }

        const isBlockTampered = block.Data.includes('"TAMPERED":true');

        const blockDiv = document.createElement('div');
        blockDiv.className = 'ledger-block-node';

        // Build payload key-values
        let payloadItemsHtml = '';
        for (const [key, val] of Object.entries(parsedData.payload)) {
          // Format specific dates or strings
          let displayVal = val;
          if (key === 'Estimasi_Tiba' || key === 'Waktu_Perubahan') {
            displayVal = new Date(val).toLocaleString('id-ID');
          }
          if (typeof val === 'object') {
            displayVal = JSON.stringify(val);
          }

          payloadItemsHtml += `
            <div class="payload-item">
              <span class="payload-label">${key}</span>
              <span class="payload-val">${displayVal}</span>
            </div>
          `;
        }

        blockDiv.innerHTML = `
          <div class="block-index-badge">
            <span>Blok</span>
            #${block.Index}
          </div>
          <div class="ledger-block-card ${isBlockTampered ? 'tampered' : ''}">
            <div class="block-header">
              <div class="block-title">
                <i class="fa-solid fa-cube text-accent"></i>
                <h4>${parsedData.eventName}</h4>
              </div>
              <span class="block-timestamp">${new Date(block.Tanggal).toLocaleString('id-ID')}</span>
            </div>
            
            <div class="block-hashes-row">
              <div class="hash-box">
                <span class="hash-label">Prev Hash</span>
                <span class="hash-value ${block.Prev_Hash === '0' ? 'genesis' : ''}">${block.Prev_Hash}</span>
              </div>
              <div class="hash-box">
                <span class="hash-label">Block Hash (SHA-256 Signature)</span>
                <span class="hash-value ${isBlockTampered ? 'broken' : 'verified'}">${block.Hash}</span>
              </div>
            </div>

            <div class="block-payload">
              <h5>Snapshot Data Logistik</h5>
              <div class="payload-grid">
                ${payloadItemsHtml}
              </div>
            </div>

            <div class="block-actions">
              ${!isBlockTampered
            ? `<button class="btn btn-xs btn-danger" onclick="triggerTamper('${block.ID_Block}', ${block.Index})"><i class="fa-solid fa-bolt"></i> Simulasikan Manipulasi (Tamper)</button>`
            : `<span class="text-danger text-xs font-bold"><i class="fa-solid fa-triangle-exclamation"></i> Blok Telah Dimanipulasi!</span>`
          }
            </div>
          </div>
        `;
        chainContainer.appendChild(blockDiv);
      });
    }
  } catch (err) {
    chainContainer.innerHTML = `<div class="text-center text-danger py-4">Gagal memuat blockchain explorer.</div>`;
  }
}

// Tamper simulation trigger
async function triggerTamper(blockId, index) {
  const tamperedText = prompt('Masukkan teks manipulasi untuk mengubah isi record database secara ilegal:', 'Garam Madura ditukar dengan Garam Murahan');
  if (!tamperedText) return;

  try {
    const res = await fetch(`${API_BASE}/api/ledger/tamper`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        ID_Block: blockId,
        TamperedDataText: tamperedText
      }),
    });
    const result = await res.json();

    if (result.success) {
      showToast(`DATABASE DIRETAK! Blok #${index} telah dimanipulasi secara ilegal di DB SQLite.`, 'danger');

      // Auto switch tabs to visual explorer to show the damage
      switchTab('ledger');
    } else {
      showToast(result.message, 'danger');
    }
  } catch (err) {
    showToast('Gagal merusak database.', 'danger');
  }
}

// --------------------------------------------------------------------------
// 7. INTERACTIVE TRACKING MODAL & SINGLE CHAIN AUDITING
// --------------------------------------------------------------------------
async function openTrackingModal(shippingId) {
  activeAuditingShippingId = shippingId;
  const modal = document.getElementById('trackingModal');
  const metadataDiv = document.getElementById('trackingModalMetadata');
  const timelineDiv = document.getElementById('trackingModalTimeline');
  const auditResultMini = document.getElementById('auditResultMini');

  auditResultMini.style.display = 'none';
  modal.classList.add('active');

  metadataDiv.innerHTML = '<div class="text-center text-muted">Memuat data logistik...</div>';
  timelineDiv.innerHTML = '';

  try {
    // 1. Fetch Shipping records to find Resi
    const shipRes = await fetch(`${API_BASE}/api/shippings`, { headers: getHeaders() });
    const shipData = await shipRes.json();
    const currentShipping = shipData.data.find(s => s.ID_Pengiriman === shippingId);

    if (currentShipping) {
      const estimasiStr = new Date(currentShipping.Estimasi_Tiba).toLocaleDateString('id-ID');

      metadataDiv.innerHTML = `
        <div class="glass-card" style="padding: 16px; margin-bottom: 0;">
          <div class="flex justify-between flex-wrap gap-2">
            <div><strong>Nomor Resi:</strong> <code class="text-accent">${currentShipping.Resi}</code></div>
            <div><strong>Kurir Penanggungjawab:</strong> ${currentShipping.Kurir}</div>
          </div>
          <div class="flex justify-between flex-wrap gap-2 mt-2 text-sm text-secondary">
            <div>Estimasi Tiba: ${estimasiStr}</div>
            <div>Status Distribusi: <span class="role-badge kurir">${currentShipping.Status_Kirim}</span></div>
          </div>
        </div>
      `;
    }

    // 2. Fetch specific blockchain ledger blocks
    const ledgerRes = await fetch(`${API_BASE}/api/ledger/shipping/${shippingId}`, { headers: getHeaders() });
    const ledgerData = await ledgerRes.json();

    if (ledgerData.success) {
      if (ledgerData.data.length === 0) {
        timelineDiv.innerHTML = '<div class="text-center text-muted">Belum ada blok ledger tercatat untuk pengiriman ini.</div>';
        return;
      }

      timelineDiv.innerHTML = '';
      ledgerData.data.forEach(block => {
        let parsed = { eventName: 'UNKNOWN', payload: {} };
        try {
          parsed = JSON.parse(block.Data);
        } catch (e) { }

        const isTampered = block.Data.includes('"TAMPERED":true');
        const node = document.createElement('div');
        node.className = 'timeline-node';
        node.innerHTML = `
          <div class="timeline-dot ${isTampered ? 'tampered' : ''}">
            <i class="fa-solid ${isTampered ? 'fa-triangle-exclamation' : 'fa-cube'}"></i>
          </div>
          <div class="timeline-card">
            <div class="flex justify-between items-center mb-1">
              <h5>${parsed.eventName}</h5>
              <span class="text-xs text-muted">Blok #${block.Index}</span>
            </div>
            <p class="text-xs text-secondary mb-2">${new Date(block.Tanggal).toLocaleString('id-ID')}</p>
            <div class="text-xs text-muted mb-2" style="font-family: monospace; word-break: break-all;">
              <div><strong>Prev:</strong> ${block.Prev_Hash}</div>
              <div><strong>Hash:</strong> <span class="${isTampered ? 'text-danger' : 'text-success'}">${block.Hash}</span></div>
            </div>
            <div class="text-xs text-secondary">
              <strong>Penanggungjawab:</strong> ${parsed.payload.Operator || 'Kurir System'}
            </div>
          </div>
        `;
        timelineDiv.appendChild(node);
      });
    }
  } catch (err) {
    metadataDiv.innerHTML = '<div class="text-center text-danger">Gagal memuat logistik.</div>';
  }
}

async function runChainAudit() {
  if (!activeAuditingShippingId) return;

  const auditResultMini = document.getElementById('auditResultMini');
  auditResultMini.style.display = 'block';
  auditResultMini.innerHTML = '<div class="text-xs text-muted"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Melakukan perhitungan kriptografi hash chain...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/ledger/verify/${activeAuditingShippingId}`, { headers: getHeaders() });
    const result = await res.json();

    if (result.success) {
      if (result.valid) {
        auditResultMini.innerHTML = `
          <div class="text-xs text-success" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 8px; border-radius: 6px;">
            <i class="fa-solid fa-circle-check mr-1"></i> ${result.message}
          </div>
        `;
      } else {
        const errorDetails = result.errors.map(e => `Blok #${e.index}: ${e.reason}`).join('<br>');
        auditResultMini.innerHTML = `
          <div class="text-xs text-danger" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 8px; border-radius: 6px;">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i> ${result.message}</div>
            <div class="mt-1" style="font-family: monospace; white-space: pre-line;">${errorDetails}</div>
          </div>
        `;
      }
    }
  } catch (err) {
    auditResultMini.innerHTML = '<div class="text-xs text-danger">Gagal menjalankan audit rantai.</div>';
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  activeAuditingShippingId = null;
}

// Mobile Sidebar Toggle
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('mobile-active');
  if (overlay) overlay.classList.toggle('active');
}
