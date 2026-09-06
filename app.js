/**
 * نظام إدارة ورشة الحلويات والمخزن - النسخة المحسنة
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzpODYGke1q7kT0ddetFt3nVBLQwbQyKehzOjk6JykK4m5PttecHpl3bn6hBqbn3bI/exec";

let currentUser = null;
let productsCache = [];
let customersCache = [];

function showLoader(show) {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = show ? 'flex' : 'none';
}

function showView(viewId) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('view-active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('view-active');

  // إذا فتحنا واجهة المنتجات، نحدث قائمة الاقتراحات التلقائية
  if (viewId === 'view-add-product') {
    populateProductDatalist();
  }
}

function showAlert(message) {
  alert(message);
}

async function apiCall(action, params = {}) {
  showLoader(true);
  try {
    const url = new URL(SCRIPT_URL);
    url.searchParams.append('action', action);
    Object.keys(params).forEach(key => {
      const val = typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key];
      url.searchParams.append(key, val);
    });

    const response = await fetch(url);
    const data = await response.json();
    showLoader(false);
    return data;
  } catch (err) {
    showLoader(false);
    console.error("API Error:", err);
    showAlert("خطأ أثناء الاتصال بقاعدة البيانات!");
    return null;
  }
}

async function handleLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();

  if (!user || !pass) {
    showAlert("يرجى إدخال اسم المستخدم وكلمة المرور!");
    return;
  }

  const res = await apiCall('login', { user: user, pass: pass });
  if (res && res.success) {
    currentUser = res;
    const badge = document.getElementById('user-badge');
    if (badge) badge.innerText = `${res.user} (${res.role})`;
    showView('view-dashboard');
    preloadData();
  } else {
    showAlert(res ? res.message : "فشل تسجيل الدخول!");
  }
}

function logout() {
  currentUser = null;
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  showView('view-login');
}

/**
 * تغذية قائمة البحث التلقائي بالمنتجات
 */
function populateProductDatalist() {
  const datalist = document.getElementById('products-datalist');
  if (!datalist) return;
  datalist.innerHTML = '';
  productsCache.forEach(p => {
    const option = document.createElement('option');
    option.value = p.name;
    datalist.appendChild(option);
  });
}

/**
 * فحص الإكمال التلقائي والتنبيه في حال كان المنتج مسجلاً مسبقاً
 */
function checkProductExists(val) {
  const name = val.trim();
  const statusMsg = document.getElementById('product-status-msg');
  const btnSave = document.getElementById('btn-save-prod');
  const wholesaleInput = document.getElementById('p-wholesale');
  const retailInput = document.getElementById('p-retail');

  if (!name) {
    statusMsg.innerText = '';
    return;
  }

  const found = productsCache.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (found) {
    statusMsg.style.color = '#e67e22';
    statusMsg.innerHTML = `<i class="fa-solid fa-circle-info"></i> هذا المنتج مسجل مسبقاً (المتوفر: ${found.currentStock}). سيتم تحديث الكمية أو الأسعار له.`;
    if (!wholesaleInput.value) wholesaleInput.value = found.wholesalePrice;
    if (!retailInput.value) retailInput.value = found.retailPrice;
    btnSave.innerHTML = '<i class="fa-solid fa-sync"></i> تحديث / إضافة كمية للمنتج';
  } else {
    statusMsg.style.color = '#27ae60';
    statusMsg.innerHTML = `<i class="fa-solid fa-check"></i> منتج جديد سيتم إنشاؤه في كافة الجداول`;
    btnSave.innerHTML = '<i class="fa-solid fa-save"></i> حفظ كمنتج جديد';
  }
}

async function submitProduct() {
  const name = document.getElementById('p-name').value.trim();
  const qty = Number(document.getElementById('p-qty').value) || 0;
  const wholesale = Number(document.getElementById('p-wholesale').value) || 0;
  const retail = Number(document.getElementById('p-retail').value) || 0;

  if (!name) {
    showAlert("يرجى كتابة اسم المنتج!");
    return;
  }

  const res = await apiCall('addProduct', {
    name: name,
    quantity: qty,
    wholesalePrice: wholesale,
    retailPrice: retail
  });

  if (res && res.success) {
    showAlert(res.message);
    document.getElementById('p-name').value = '';
    document.getElementById('p-qty').value = '';
    document.getElementById('p-wholesale').value = '';
    document.getElementById('p-retail').value = '';
    document.getElementById('product-status-msg').innerText = '';
    
    await preloadData();
    showView('view-dashboard');
  }
}

async function submitCustomer() {
  const name = document.getElementById('c-name').value.trim();
  const credit = Number(document.getElementById('c-credit').value) || 0;

  if (!name) {
    showAlert("يرجى كتابة اسم الزبون!");
    return;
  }

  const res = await apiCall('addCustomer', { name: name, credit: credit });
  if (res && res.success) {
    showAlert(res.message);
    document.getElementById('c-name').value = '';
    document.getElementById('c-credit').value = '';
    await preloadData();
    showView('view-dashboard');
  }
}

async function loadStockTable() {
  const data = await apiCall('getProducts');
  if (!data) return;

  productsCache = data;
  const tbody = document.getElementById('stock-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">لا توجد منتجات مسجلة</td></tr>';
  } else {
    data.forEach(p => {
      tbody.innerHTML += `
        <tr>
          <td>${p.id}</td>
          <td style="font-weight: bold;">${p.name}</td>
          <td>${Number(p.wholesalePrice).toLocaleString()} دج</td>
          <td>${Number(p.retailPrice).toLocaleString()} دج</td>
          <td><strong style="color: var(--success); font-size: 16px;">${p.currentStock}</strong></td>
        </tr>
      `;
    });
  }
  showView('view-stock-table');
}

async function preloadData() {
  try {
    const [products, customers] = await Promise.all([
      apiCall('getProducts'),
      apiCall('getCustomers')
    ]);
    if (products) {
      productsCache = products;
      populateProductDatalist();
    }
    if (customers) customersCache = customers;
  } catch (e) {
    console.error("Error preloading:", e);
  }
}
