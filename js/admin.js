import * as api from './api.js';

// --- VARIABLES DE ESTADO GLOBAL ---
let allCategories = [];
let allProducts = [];
let allPayments = [];
let currentCategoryId = null;
let ordersInterval = null;
let confirmResolver = null;

// --- LOGICA DE LOGIN ---
window.handleLogin = async () => {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('login-error');
    const btn = document.querySelector('#modal-login .btn-add');

    if (!user || !pass) return;

    try {
        btn.innerText = "Verificando...";
        btn.disabled = true;
        
        // El loginAdmin de tu api.js ya devuelve el objeto completo del usuario
        const userData = await api.loginAdmin(user, pass);
        
        localStorage.setItem('admin_token', 'active_session');
        localStorage.setItem('admin_role', userData.role); // Guardamos el rol (admin/vendedor)
        localStorage.setItem('admin_username', userData.username);
        
        showDashboard();
        showToast(`¡Bienvenido ${userData.username}!`, "success");
    } catch (e) {
        errorMsg.style.display = 'block';
        btn.innerText = "Entrar al Sistema";
        btn.disabled = false;
    }
};

window.handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_role');
    localStorage.removeItem('admin_username');
    location.reload();
};

function showDashboard() {
  const role = localStorage.getItem('admin_role');
  const cardReports = document.getElementById('card-reports');
  const cardInvestment = document.getElementById('card-investment'); // NUEVA
  
  document.getElementById('modal-login').classList.remove('active');
  document.getElementById('admin-content').style.display = 'block';
  
  // RESTRICCIÓN DE ROLES
  if (role === 'vendedor') {
    // Ocultar tarjetas de admin
    if (cardReports) cardReports.style.display = 'none';
    if (cardInvestment) cardInvestment.style.display = 'none'; // NUEVA
    console.log("Acceso limitado: Rol Vendedor");
  } else {
    // Mostrar todo si es admin
    if (cardReports) cardReports.style.display = 'block';
    if (cardInvestment) cardInvestment.style.display = 'block'; // NUEVA
    console.log("Acceso total: Rol Admin");
  }
  
  refreshData();
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('admin_token') === 'active_session') {
        showDashboard();
    }
});

window.openModal = async (modalId) => {
  const role = localStorage.getItem('admin_role');

  // Si intenta entrar a reportes y no es admin, bloqueamos
  if (modalId === 'modal-orders' && role !== 'admin') {
      showToast("Acceso denegado: Solo Administradores", "error");
      return;
  }

  const modal = document.getElementById(modalId);
  if(!modal) return;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // ... resto del código original de openModal ...
  if (modalId === 'modal-store' || modalId === 'modal-payments') { 
      await refreshData(); 
      if (modalId === 'modal-store') showMainPanel(); 
  }
  
  if (modalId === 'modal-orders') { 
    await loadOrdersSummary(); 
    if (ordersInterval) clearInterval(ordersInterval);
    ordersInterval = setInterval(() => loadOrdersSummary(), 15000); 

// NUEVO: Cargar datos de inversión
  if (modalId === 'modal-investment') { 
    await loadInvestmentData(); 
  }
};

window.closeModal = (modalId) => {
  document.getElementById(modalId).classList.remove('active');
  document.body.style.overflow = 'auto';
  if (modalId === 'modal-orders' && ordersInterval) {
      clearInterval(ordersInterval);
      ordersInterval = null;
  }
};

// --- UTILIDADES ---
window.showToast = (msg, type = 'info') => {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast`;
  if(type === 'error') toast.style.borderLeftColor = 'var(--danger)';
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

window.customConfirm = (title, text) => {
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-text').innerText = text;
  document.getElementById('modal-confirm').classList.add('active');
  return new Promise(resolve => { confirmResolver = resolve; });
};

window.closeConfirm = (val) => {
  document.getElementById('modal-confirm').classList.remove('active');
  if(confirmResolver) confirmResolver(val);
};

// --- REFRESH DATA ---
async function refreshData() {
  try {
    const [categories, products, payments] = await Promise.all([
        api.getCategories(), 
        api.getAllProducts(),
        api.getPaymentMethods()
    ]);
    allCategories = categories || [];
    allProducts = products || [];
    allPayments = payments || [];
    renderCategories();
    renderPaymentMethods();
    if (currentCategoryId) renderProducts();
  } catch (e) { 
    console.error(e);
    showToast("Error al sincronizar datos", "error"); 
  }
}

function renderPaymentMethods() {
  const list = document.getElementById('payments-list');
  list.innerHTML = allPayments.map(pay => `
    <li class="list-item ${!pay.active ? 'is-inactive' : ''}">
      <div class="item-info">
        <div>
          <p style="font-weight:700;">${pay.name}</p>
          <small style="color:var(--text-muted)">
            ${pay.mode === 'none' ? 'Precio directo' : pay.mode === 'percent' ? `Recargo: ${pay.value}%` : `Tasa: ${pay.value}`}
          </small>
        </div>
      </div>
      <div style="display:flex; gap:10px;">
         <button class="btn ${pay.active ? 'btn-toggle-on' : 'btn-toggle-off'}" onclick="handleTogglePaymentStatus('${pay.id}', ${pay.active})">
           ${pay.active ? 'Activo' : 'Inactivo'}
         </button>
         <button class="btn btn-edit" style="padding:5px 10px" onclick="openEditPayment('${pay.id}')">✏️</button>
         <button class="btn btn-delete" style="padding:5px 10px" onclick="handleDeletePayment('${pay.id}')">🗑️</button>
      </div>
    </li>
  `).join('');
}

function renderCategories() {
  const list = document.getElementById('categories-list');
  list.innerHTML = allCategories.map(cat => `
    <li class="list-item">
      <div class="item-info">
        <img class="item-img" src="${cat.image_url || 'https://via.placeholder.com/50'}">
        <p style="font-weight:700;">${cat.name}</p>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn" style="background:var(--primary); color:white; font-size:12px;" onclick="showCategoryProducts('${cat.id}', '${cat.name}')">Ver Productos</button>
        <button class="btn btn-delete" onclick="handleDeleteCategory('${cat.id}')">🗑️</button>
      </div>
    </li>
  `).join('');
}

function renderProducts() {
  const list = document.getElementById('products-list');
  const filtered = allProducts.filter(p => String(p.category_id) === String(currentCategoryId));
  list.innerHTML = filtered.map(p => `
    <li class="list-item ${!p.active ? 'is-inactive' : ''}">
      <div class="item-info">
        <img class="item-img" src="${p.image_url || 'https://via.placeholder.com/50'}" onerror="this.src='https://via.placeholder.com/50'">
        <div>
          <p style="font-weight:700;">${p.name}</p>
          <p style="color:var(--success); font-weight:700;">$${p.price}</p>
          <span style="margin-left:10px; color:${p.stock <= 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-size:0.8rem;">📦 Stock: ${p.stock || 0}</span>
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn ${p.active ? 'btn-toggle-on' : 'btn-toggle-off'}" onclick="handleToggleProductStatus('${p.id}', ${p.active})">
          ${p.active ? 'Visible' : 'Oculto'}
        </button>
        <button class="btn btn-edit" onclick="openEditProduct('${p.id}')">✏️</button>
        <button class="btn btn-delete" onclick="handleDeleteProduct('${p.id}')">🗑️</button>
      </div>
    </li>
  `).join('');
}

// --- LÓGICA DE PRODUCTOS Y MÉTODOS ---
window.handleToggleProductStatus = async (id, currentStatus) => {
    try {
        await api.updateProduct(id, { active: !currentStatus });
        refreshData();
    } catch (e) { showToast("Error", "error"); }
};

window.handleTogglePaymentStatus = async (id, currentStatus) => {
    try {
        await api.updatePaymentMethod(id, { active: !currentStatus });
        refreshData();
    } catch (e) { showToast("Error", "error"); }
};

window.openEditPayment = (id) => {
    const pay = allPayments.find(p => String(p.id) === String(id));
    if (!pay) return;
    document.getElementById('edit-pay-id').value = pay.id;
    document.getElementById('edit-pay-name').value = pay.name;
    document.getElementById('edit-pay-mode').value = pay.mode;
    document.getElementById('edit-pay-value').value = pay.value;
    openModal('modal-edit-payment');
};

window.handleUpdatePayment = async () => {
    const id = document.getElementById('edit-pay-id').value;
    const name = document.getElementById('edit-pay-name').value;
    const mode = document.getElementById('edit-pay-mode').value;
    const value = document.getElementById('edit-pay-value').value;
    try {
        await api.updatePaymentMethod(id, { name, mode, value: parseFloat(value) });
        closeModal('modal-edit-payment');
        refreshData();
    } catch (e) { showToast("Error", "error"); }
};

window.handleDeletePayment = async (id) => {
    if (await customConfirm("¿Eliminar moneda?", "Afectará precios.")) {
        try { await api.deletePaymentMethod(id); refreshData(); } catch (e) { showToast("Error", "error"); }
    }
};

window.openEditProduct = (id) => {
    const prod = allProducts.find(p => String(p.id) === String(id));
    if (!prod) return;
    document.getElementById('edit-prod-id').value = prod.id;
    document.getElementById('edit-prod-name').value = prod.name;
    document.getElementById('edit-prod-price').value = prod.price;
    document.getElementById('edit-prod-stock').value = prod.stock || 0;
    openModal('modal-edit-product');
};

window.handleUpdateProduct = async () => {
    const id = document.getElementById('edit-prod-id').value;
    const name = document.getElementById('edit-prod-name').value;
    const price = document.getElementById('edit-prod-price').value;
    const stock = document.getElementById('edit-prod-stock').value;
    const file = document.getElementById('edit-prod-img').files[0];
    try {
        let updateData = { name, price: parseFloat(price), stock: parseInt(stock) || 0 };
        if (file) updateData.image_url = await api.uploadImage('products', file);
        await api.updateProduct(id, updateData);
        closeModal('modal-edit-product');
        refreshData();
    } catch (e) { showToast("Error", "error"); }
};

window.handleAddPayment = async () => {
    const name = document.getElementById('pay-name').value;
    const mode = document.getElementById('pay-mode').value;
    const value = document.getElementById('pay-value').value;
    if(!name) return;
    await api.createPaymentMethod({ name, code: name.toLowerCase().replace(" ", ""), mode, value: parseFloat(value), active: true });
    refreshData();
};

window.handleAddCategory = async () => {
    const input = document.getElementById('new-cat-name');
    const file = document.getElementById('new-cat-img').files[0];
    if(!input.value) return;
    let url = file ? await api.uploadImage('categories', file) : null;
    await api.createCategory(input.value, url);
    refreshData();
    input.value = "";
};

window.handleAddProduct = async () => {
    const nameInp = document.getElementById('new-prod-name');
    const priceInp = document.getElementById('new-prod-price');
    const stockInp = document.getElementById('new-prod-stock');
    const file = document.getElementById('new-prod-img').files[0];
    if(!nameInp.value) return;
    try {
        let url = file ? await api.uploadImage('products', file) : null;
        await api.createProduct({ name: nameInp.value, price: parseFloat(priceInp.value), stock: parseInt(stockInp.value) || 0, image_url: url, category_id: currentCategoryId });
        refreshData();
        nameInp.value = ""; priceInp.value = ""; stockInp.value = "0";
    } catch (e) { showToast("Error", "error"); }
};

window.handleDeleteCategory = async (id) => {
    if(await customConfirm("¿Eliminar?", "Borrará productos.")) {
        await api.deleteCategory(id);
        refreshData();
    }
};

window.handleDeleteProduct = async (id) => {
    if(await customConfirm("¿Borrar?", "")) {
        await api.deleteProduct(id);
        refreshData();
    }
};

window.showCategoryProducts = (id, name) => {
    currentCategoryId = id;
    document.getElementById('section-categories').classList.add('hidden');
    document.getElementById('section-products').classList.remove('hidden');
    document.getElementById('current-cat-title').innerText = `📦 ${name}`;
    renderProducts();
};

window.showMainPanel = () => {
    document.getElementById('section-products').classList.add('hidden');
    document.getElementById('section-categories').classList.remove('hidden');
};

// --- LÓGICA DE REPORTES (SOLUCIÓN PEDIDA) ---
window.saveDeductionSetting = async (val) => {
    try {
        await api.updateDeductionPercent(val);
        showToast("Comisión actualizada");
        await loadOrdersSummary(); 
    } catch (e) { showToast("Error", "error"); }
}

window.loadOrdersSummary = async () => {
    const container = document.getElementById('orders-detailed-list');
    const deductionInput = document.getElementById('setting-deduction');
    
    try {
        const [orders, deductionValue] = await Promise.all([
            api.getOrders(),
            api.getDeductionPercent()
        ]);

        const percentage = parseFloat(deductionValue) || 0;
        if (deductionInput) deductionInput.value = percentage;
        
        let totalRev = 0;     
        let totalProfit = 0;  
        let totalTra = 0;
        let totalZelle = 0;
        let totalUsd = 0;
        
        if (!orders || orders.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No hay pedidos.</p>`;
            updateStatsUI(0, 0, 0, 0, 0); 
            return;
        }

        container.innerHTML = orders.map(order => {
            const rawPrice = String(order.total_text || "0")
                .replace(/\./g, '')     
                .replace(',', '.')      
                .replace(/[^0-9.]/g, ""); 
            
            const price = parseFloat(rawPrice) || 0;
            const method = (order.payment_method || "").toLowerCase();
            const myProfit = price * (percentage / 100);

            totalRev += price; 
            totalProfit += myProfit; 

            if (method.includes("zelle") || method.includes("mlc")) {
                totalZelle += price;
            } else if (method.includes("tra") || method.includes("cup") || method.includes("móvil")) {
                totalTra += price;
            } else {
                totalUsd += price;
            }

            return `
                <div class="order-card">
                    <div class="order-header">
                        <span style="font-size: 0.7rem; color: var(--text-muted);">#${String(order.id).slice(-5)}</span>
                        <span class="order-total">$${price.toLocaleString(undefined, {minimumFractionDigits: 3, maximumFractionDigits: 3})}</span>
                    </div>
                    <p style="font-size: 0.9rem; margin: 5px 0;">👤 ${order.customer_name}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                        <span style="font-size: 0.7rem; background: rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 5px;">💳 ${order.payment_method}</span>
                        <span style="font-size: 0.75rem; color: var(--accent); font-weight: bold;">
                           Ganancia: $${myProfit.toLocaleString(undefined, {minimumFractionDigits: 3, maximumFractionDigits: 3})}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        // Actualización de la Interfaz con 3 decimales
        document.getElementById('total-revenue').innerText = `$${totalRev.toLocaleString(undefined, {minimumFractionDigits: 3, maximumFractionDigits: 3})}`;
        if(document.getElementById('total-net')) {
            document.getElementById('total-net').innerText = `$${totalProfit.toLocaleString(undefined, {minimumFractionDigits: 3, maximumFractionDigits: 3})}`;
        }
        document.getElementById('total-tra').innerText = `$${totalTra.toLocaleString(undefined, {minimumFractionDigits: 3, maximumFractionDigits: 3})}`;
        document.getElementById('total-zelle').innerText = `$${totalZelle.toLocaleString(undefined, {minimumFractionDigits: 3, maximumFractionDigits: 3})}`;
        document.getElementById('total-usd').innerText = `$${totalUsd.toLocaleString(undefined, {minimumFractionDigits: 3, maximumFractionDigits: 3})}`;
        document.getElementById('total-orders-count').innerText = orders.length;

    } catch (e) {
        console.error("Error en reporte:", e);
        showToast("Error en reporte", "error");
    }
};

function updateStatsUI(rev, tra, zelle, usd, count) {
    if(document.getElementById('total-revenue')) document.getElementById('total-revenue').innerText = `$${rev.toFixed(3)}`;
    if(document.getElementById('total-tra')) document.getElementById('total-tra').innerText = `$${tra.toFixed(3)}`;
    if(document.getElementById('total-zelle')) document.getElementById('total-zelle').innerText = `$${zelle.toFixed(3)}`;
    if(document.getElementById('total-usd')) document.getElementById('total-usd').innerText = `$${usd.toFixed(3)}`;
    if(document.getElementById('total-orders-count')) document.getElementById('total-orders-count').innerText = count;
}

window.handleClearAllOrders = async () => {
    if (await customConfirm("¿VACIAR TODO?", "Borrará pedidos y comprobantes.")) {
        try {
            await api.deleteAllOrdersData();
            showToast("Datos borrados", "success");
            refreshData();
        } catch (e) {
            console.error(e);
            showToast("Error al borrar datos", "error");
        }
    }
};


// --- FUNCIÓN PARA CARGAR DATOS DE INVERSIÓN ---
window.loadInvestmentData = async () => {
  try {
    // 1. Obtener productos con precio_compra (si no existe, agregar campo en BD)
    const products = allProducts || [];
    
    // Variables para cálculos totales
    let totalInvestment = 0;
    let totalSaleValue = 0;
    let totalProfit = 0;
    let productCountWithCost = 0;
    
    // Limpiar tabla
    const tableBody = document.getElementById('investment-products-list');
    tableBody.innerHTML = '';
    
    // Procesar cada producto
    products.forEach(product => {
      // Si no tiene precio_compra, usar 0 como costo
      const costoCompra = parseFloat(product.precio_compra) || 0;
      const precioVenta = parseFloat(product.price) || 0;
      const stock = parseFloat(product.stock) || 0;
      
      // Cálculos individuales
      const inversionProducto = costoCompra * stock;
      const valorVentaProducto = precioVenta * stock;
      const gananciaProducto = valorVentaProducto - inversionProducto;
      const margenProducto = costoCompra > 0 ? 
        ((precioVenta - costoCompra) / costoCompra * 100).toFixed(1) : 
        'N/A';
      
      // Acumular totales (solo productos con costo > 0)
      if (costoCompra > 0) {
        totalInvestment += inversionProducto;
        totalSaleValue += valorVentaProducto;
        totalProfit += gananciaProducto;
        productCountWithCost++;
      }
      
      // Crear fila de tabla
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid var(--glass-border)';
      row.innerHTML = `
        <td style="padding: 12px;">${product.name}</td>
        <td style="padding: 12px;">$${costoCompra.toFixed(3)}</td>
        <td style="padding: 12px;">$${precioVenta.toFixed(3)}</td>
        <td style="padding: 12px;">${stock}</td>
        <td style="padding: 12px; color: ${inversionProducto > 0 ? '#ef4444' : 'var(--text-muted)'};">$${inversionProducto.toFixed(3)}</td>
        <td style="padding: 12px; color: var(--primary);">$${valorVentaProducto.toFixed(3)}</td>
        <td style="padding: 12px; color: ${gananciaProducto >= 0 ? '#10b981' : '#ef4444'};">$${gananciaProducto.toFixed(3)}</td>
        <td style="padding: 12px; color: ${margenProducto > 0 ? '#10b981' : (margenProducto < 0 ? '#ef4444' : 'var(--text-muted)')};">
          ${typeof margenProducto === 'string' ? margenProducto : margenProducto + '%'}
        </td>
      `;
      tableBody.appendChild(row);
    });
    
    // Calcular métricas generales
    const avgMargin = productCountWithCost > 0 ? 
      ((totalSaleValue - totalInvestment) / totalInvestment * 100).toFixed(1) : 0;
    
    const roi = totalInvestment > 0 ? 
      (totalProfit / totalInvestment * 100).toFixed(1) : 0;
    
    // Actualizar UI
    document.getElementById('total-investment').innerText = `$${totalInvestment.toFixed(3)}`;
    document.getElementById('total-profit').innerText = `$${totalProfit.toFixed(3)}`;
    document.getElementById('avg-margin').innerText = `${avgMargin}%`;
    document.getElementById('roi-estimated').innerText = `${roi}%`;
    
  } catch (error) {
    console.error('Error cargando datos de inversión:', error);
    showToast('Error al calcular inversión', 'error');
  }
};
refreshData();