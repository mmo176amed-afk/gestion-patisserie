/**
 * نظام إدارة ورشة الحلويات والمخزن
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
    statusMsg.innerHTML = `<i class="fa-solid fa-circle-info"></i> هذا المنتج مسجل مسبقاً (المتوفر: ${found.currentStock}).`;
    wholesaleInput.value = found.wholesalePrice;
    retailInput.value = found.retailPrice;
    btnSave.innerHTML = '<i class="fa-solid fa-sync"></i> تعديل بيانات المنتج';
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

// ----------------------------------------------------
// واجهة الوصل والعمليات على المنتجات
// ----------------------------------------------------

async function openInvoiceView() {
  await preloadData();

  // تعيين تاريخ اليوم كقيمة افتراضية
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('inv-date').value = today;
  document.getElementById('inv-num').value = '';
  document.getElementById('inv-credit').value = '0';

  // تعبئة قائمة الزبائن
  const custSelect = document.getElementById('inv-customer');
  custSelect.innerHTML = '<option value="">-- اختر الزبون --</option>';
  customersCache.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.innerText = c.name;
    custSelect.appendChild(opt);
  });

  // تفريغ أسطر المنتجات والبدء بـ 3 أسطر افتراضية
  const container = document.getElementById('invoice-items-container');
  container.innerHTML = '';
  addInvoiceItemRow();
  addInvoiceItemRow();
  addInvoiceItemRow();

  showView('view-invoice-ops');
}

function onCustomerSelect(customerName) {
  const found = customersCache.find(c => c.name === customerName);
  document.getElementById('inv-credit').value = found ? Number(found.oldCredit).toLocaleString() + ' دج' : '0 دج';
}

function addInvoiceItemRow() {
  const container = document.getElementById('invoice-items-container');
  const rowId = 'item-row-' + Date.now() + '-' + Math.floor(Math.random() * 100);

  let optionsHtml = '<option value="">-- اختر الحلوى --</option>';
  productsCache.forEach(p => {
    optionsHtml += `<option value="${p.name}" data-price="${p.wholesalePrice}" data-stock="${p.currentStock}">${p.name}</option>`;
  });

  const rowDiv = document.createElement('div');
  rowDiv.id = rowId;
  rowDiv.style = "display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 40px; gap: 10px; align-items: center; margin-bottom: 10px; background: #fdfefe; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;";

  rowDiv.innerHTML = `
    <div>
      <select class="form-control item-select" onchange="onItemRowSelect('${rowId}', this)">
        ${optionsHtml}
      </select>
    </div>
    <div>
      <span class="item-stock-badge" style="color: #e74c3c; font-size: 13px; font-weight: bold;">مخزن: 0</span>
    </div>
    <div>
      <input type="number" class="form-control item-price" placeholder="السعر" style="font-weight: bold;">
    </div>
    <div>
      <input type="number" class="form-control item-qty" placeholder="الكمية" style="font-weight: bold;">
    </div>
    <div>
      <button class="btn-action btn-secondary" style="padding: 6px 10px; background: #e74c3c;" onclick="removeInvoiceItemRow('${rowId}')">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;

  container.appendChild(rowDiv);
}

function onItemRowSelect(rowId, selectEl) {
  const row = document.getElementById(rowId);
  const selectedOpt = selectEl.options[selectEl.selectedIndex];
  const stock = selectedOpt.getAttribute('data-stock') || 0;
  const price = selectedOpt.getAttribute('data-price') || 0;

  row.querySelector('.item-stock-badge').innerText = `مخزن: ${stock}`;
  row.querySelector('.item-price').value = price > 0 ? price : '';
}

function removeInvoiceItemRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
}

async function submitInvoiceOp(type) {
  const date = document.getElementById('inv-date').value;
  const receipt = document.getElementById('inv-num').value.trim();
  const customer = document.getElementById('inv-customer').value;

  if (type === 'distribution' && !customer) {
    showAlert("يرجى اختيار الزبون أولاً لعملية التوزيع!");
    return;
  }

  const items = [];
  document.querySelectorAll('#invoice-items-container > div').forEach(row => {
    const select = row.querySelector('.item-select');
    const pName = select.value;
    const qty = Number(row.querySelector('.item-qty').value) || 0;
    const price = Number(row.querySelector('.item-price').value) || 0;

    if (pName && qty > 0) {
      items.push({ name: pName, qty: qty, price: price });
    }
  });

  if (items.length === 0) {
    showAlert("يرجى تحديد منتج واحد على الأقل مع كتابة الكمية!");
    return;
  }

  const payload = {
    type: type,
    date: date,
    customer: customer,
    receipt: receipt,
    items: items
  };

  const res = await apiCall('saveInvoiceOperation', { data: payload });
  if (res && res.success) {
    showAlert(res.message);
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
    if (products) productsCache = products;
    if (customers) customersCache = customers;
  } catch (e) {
    console.error("Error preloading:", e);
  }
}
