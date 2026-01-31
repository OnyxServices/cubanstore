import * as api from './api.js';

/**
 * ==========================================
 *   VARIABLES DE ESTADO
 * ==========================================
 */
let state = {
    allCategories: [],
    allProducts: [],
    allPayments: [],
    currentCategoryId: null,
    ordersInterval: null,
    confirmResolver: null
};

/**
 * ==========================================
 *   SISTEMA DE AUTENTICACIÓN
 * ==========================================
 */

window.handleLogin = async () => {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const btn = document.querySelector('#modal-login .btn-add');
    const errorMsg = document.getElementById('login-error');

    if (!user || !pass) {
        showToast("Por favor, completa todos los campos", "error");
        return;
    }

    try {
        btn.innerText = "Verificando...";
        btn.disabled = true;
        
        const userData = await api.loginAdmin(user, pass);
        
        localStorage.setItem('admin_token', 'active_session');
        localStorage.setItem('admin_role', userData.role); 
        localStorage.setItem('admin_username', userData.username);
        
        showDashboard();
        showToast(`¡Bienvenido ${userData.username}!`, "success");
    } catch (e) {
        errorMsg.style.display = 'block';
        showToast("Credenciales inválidas", "error");
    } finally {
        btn.innerText = "Entrar al Sistema";
        btn.disabled = false;
    }
};

window.handleLogout = () => {
    localStorage.clear();
    location.reload();
};

/**
 * ==========================================
 *   CONTROL DE UI Y MODALES
 * ==========================================
 */

function showDashboard() {
    const role = localStorage.getItem('admin_role');
    const isAdmin = (role === 'admin');

    document.getElementById('modal-login').classList.remove('active');
    document.getElementById('admin-content').style.display = 'block';
    
    // Control de permisos
    const cardReports = document.getElementById('card-reports');
    const cardInvestment = document.getElementById('card-investment');
    
    if (cardReports) cardReports.style.display = isAdmin ? 'block' : 'none';
    if (cardInvestment) cardInvestment.style.display = isAdmin ? 'block' : 'none';
    
    refreshData();
}

window.openModal = async (modalId) => {
    const role = localStorage.getItem('admin_role');

    // Restricción de acceso
    const restricted = ['modal-orders', 'modal-investment'];
    if (restricted.includes(modalId) && role !== 'admin') {
        showToast("Acceso denegado: Solo Administradores", "error");
        return;
    }

    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Lógica de carga según el modal
    switch (modalId) {
        case 'modal-store':
            await refreshData();
            showMainPanel();
            break;
        case 'modal-payments':
            await refreshData();
            break;
        case 'modal-orders':
            await loadOrdersSummary();
            if (state.ordersInterval) clearInterval(state.ordersInterval);
            state.ordersInterval = setInterval(loadOrdersSummary, 15000);
            break;
        case 'modal-investment':
            await renderInvestmentAnalysis();
            break;
    }
};

window.closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    
    if (modalId === 'modal-orders' && state.ordersInterval) {
        clearInterval(state.ordersInterval);
        state.ordersInterval = null;
    }
};

/**
 * ==========================================
 *   GESTIÓN DE DATOS (REFRESH)
 * ==========================================
 */

async function refreshData() {
    try {
        const [categories, products, payments] = await Promise.all([
            api.getCategories(), 
            api.getAllProducts(),
            api.getPaymentMethods()
        ]);

        state.allCategories = categories || [];
        state.allProducts = products || [];
        state.allPayments = payments || [];

        renderCategories();
        renderPaymentMethods();
        if (state.currentCategoryId) renderProducts();
    } catch (e) { 
        console.error("Error al sincronizar:", e);
        showToast("Error al sincronizar datos", "error"); 
    }
}

/**
 * ==========================================
 *   MÓDULO: CATEGORÍAS Y PRODUCTOS
 * ==========================================
 */

function renderCategories() {
    const list = document.getElementById('categories-list');
    if (!list) return;

    list.innerHTML = state.allCategories.map(cat => `
        <li class="list-item">
            <div class="item-info">
                <img class="item-img" src="${cat.image_url || 'https://via.placeholder.com/50'}" alt="${cat.name}">
                <p style="font-weight:700;">${cat.name}</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-primary-glass" 
                        onclick="showCategoryProducts('${cat.id}', '${cat.name}')">Ver Productos</button>
                <button class="btn btn-delete" onclick="handleDeleteCategory('${cat.id}')">🗑️</button>
            </div>
        </li>
    `).join('');
}

function renderProducts() {
    const list = document.getElementById('products-list');
    if (!list) return;

    const filtered = state.allProducts.filter(p => String(p.category_id) === String(state.currentCategoryId));
    
    list.innerHTML = filtered.map(p => `
        <li class="list-item ${!p.active ? 'is-inactive' : ''}">
            <div class="item-info">
                <img class="item-img" src="${p.image_url || 'https://via.placeholder.com/50'}" onerror="this.src='https://via.placeholder.com/50'">
                <div>
                    <p style="font-weight:700;">${p.name}</p>
                    <p style="color:var(--success); font-weight:700;">$${parseFloat(p.price).toFixed(2)}</p>
                    <span style="color:${p.stock <= 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-size:0.8rem;">
                        📦 Stock: ${p.stock || 0}
                    </span>
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn ${p.active ? 'btn-toggle-on' : 'btn-toggle-off'}" 
                        onclick="handleToggleProductStatus('${p.id}', ${p.active})">
                    ${p.active ? 'Visible' : 'Oculto'}
                </button>
                <button class="btn btn-edit" onclick="openEditProduct('${p.id}')">✏️</button>
                <button class="btn btn-delete" onclick="handleDeleteProduct('${p.id}')">🗑️</button>
            </div>
        </li>
    `).join('');
}

window.handleAddProduct = async () => {
    const nameInp = document.getElementById('new-prod-name');
    const priceInp = document.getElementById('new-prod-price');
    const stockInp = document.getElementById('new-prod-stock');
    const costInp = document.getElementById('new-prod-cost');
    const file = document.getElementById('new-prod-img').files[0];
    
    if (!nameInp.value || !priceInp.value) {
        showToast("Nombre y precio son obligatorios", "error");
        return;
    }

    try {
        let url = file ? await api.uploadImage('products', file) : null;
        await api.createProduct({ 
            name: nameInp.value, 
            price: parseFloat(priceInp.value), 
            stock: parseInt(stockInp.value) || 0, 
            cost: parseFloat(costInp.value) || 0,
            image_url: url, 
            category_id: state.currentCategoryId 
        });

        refreshData();
        showToast("Producto añadido", "success");
        nameInp.value = ""; priceInp.value = ""; stockInp.value = "0"; costInp.value = "";
    } catch (e) { showToast("Error al añadir producto", "error"); }
};

/**
 * ==========================================
 *   GESTIÓN DE PRODUCTOS (CORRECCIONES)
 * ==========================================
 */

window.handleToggleProductStatus = async (id, currentStatus) => {
    try {
        await api.updateProduct(id, { active: !currentStatus });
        await refreshData();
        showToast("Estado actualizado", "success");
    } catch (e) { 
        showToast("Error al cambiar estado", "error"); 
    }
};

window.openEditProduct = (id) => {
    const prod = state.allProducts.find(p => String(p.id) === String(id));
    if (!prod) return;

    document.getElementById('edit-prod-id').value = prod.id;
    document.getElementById('edit-prod-name').value = prod.name;
    document.getElementById('edit-prod-price').value = prod.price;
    document.getElementById('edit-prod-stock').value = prod.stock || 0;
    document.getElementById('edit-prod-cost').value = prod.cost || 0;

    openModal('modal-edit-product');
};

window.handleUpdateProduct = async () => {
    const id = document.getElementById('edit-prod-id').value;
    const name = document.getElementById('edit-prod-name').value;
    const price = parseFloat(document.getElementById('edit-prod-price').value);
    const stock = parseInt(document.getElementById('edit-prod-stock').value);
    const cost = parseFloat(document.getElementById('edit-prod-cost').value);
    const file = document.getElementById('edit-prod-img').files[0];

    try {
        let fields = { name, price, stock, cost };
        if (file) {
            fields.image_url = await api.uploadImage('products', file);
        }
        await api.updateProduct(id, fields);
        closeModal('modal-edit-product');
        await refreshData();
        showToast("Producto actualizado", "success");
    } catch (e) {
        showToast("Error al actualizar", "error");
    }
};

window.handleDeleteProduct = async (id) => {
    const confirm = await customConfirm("¿Eliminar producto?", "Esta acción borrará el producto permanentemente.");
    if (!confirm) return;

    try {
        const prod = state.allProducts.find(p => String(p.id) === String(id));
        await api.deleteProduct(id, prod?.image_url);
        await refreshData();
        showToast("Producto eliminado", "success");
    } catch (e) {
        showToast("Error al eliminar", "error");
    }
};

/**
 * ==========================================
 *   MÓDULO: PAGOS
 * ==========================================
 */

function renderPaymentMethods() {
    const list = document.getElementById('payments-list');
    if (!list) return;

    list.innerHTML = state.allPayments.map(pay => `
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
                <button class="btn ${pay.active ? 'btn-toggle-on' : 'btn-toggle-off'}" 
                        onclick="handleTogglePaymentStatus('${pay.id}', ${pay.active})">
                    ${pay.active ? 'Activo' : 'Inactivo'}
                </button>
                <button class="btn btn-delete" onclick="handleDeletePayment('${pay.id}')">🗑️</button>
            </div>
        </li>
    `).join('');
}

/** 
 * ==========================================
 *   MODIFICACIÓN 1: Mostrar Moneda en Card
 * ==========================================
 */
window.loadOrdersSummary = async () => {
    const container = document.getElementById('orders-detailed-list');
    const deductionInput = document.getElementById('setting-deduction');
    
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:var(--text-muted);">⌛ Sincronizando transacciones...</div>`;

    try {
        const [orders, deductionValue] = await Promise.all([
            api.getOrders(),
            api.getDeductionPercent()
        ]);

        const percentage = parseFloat(deductionValue) || 0;
        if (deductionInput) deductionInput.value = percentage;
        
        let stats = { totalRev: 0, totalProfit: 0, totalTra: 0, totalZelle: 0, totalUsd: 0, flagged: 0 };
        
        if (!orders || orders.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px;"><h3>Sin actividad comercial</h3></div>`;
            updateStatsUI(stats, 0); 
            return;
        }

        orders.sort((a, b) => (b.ocr_fraud_flag ? 1 : 0) - (a.ocr_fraud_flag ? 1 : 0));

        container.innerHTML = orders.map(order => {
            const rawPrice = order.total_amount || String(order.total_text || "0").replace(/[^0-9.]/g, "");
            const price = Math.round(parseFloat(rawPrice) * 100) / 100 || 0;
            const myProfit = Math.round((price * (percentage / 100)) * 100) / 100;
            
            // Identificación de moneda/método
            const method = (order.payment_method || "No especificado");
            const methodLower = method.toLowerCase();
            
            stats.totalRev = Math.round((stats.totalRev + price) * 100) / 100; 
            stats.totalProfit = Math.round((stats.totalProfit + myProfit) * 100) / 100; 

            if (methodLower.includes("zelle")) stats.totalZelle += price;
            else if (methodLower.includes("tra") || methodLower.includes("cup") || methodLower.includes("mlc")) stats.totalTra += price;
            else stats.totalUsd += price;

            if (order.ocr_fraud_flag) stats.flagged++;

            const isFraud = order.ocr_fraud_flag;
            const isVerified = order.ocr_verified;
            
            return `
                <div class="order-card ${isFraud ? 'is-fraud' : (isVerified ? 'is-verified' : '')}">
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                        <span style="font-size:0.65rem; color:var(--text-muted);">#${String(order.id).slice(-6).toUpperCase()}</span>
                        ${isFraud ? '<span class="status-badge bg-off">⚠️ FRAUDE</span>' : (isVerified ? '<span class="status-badge bg-on">✅ OK</span>' : '<span class="status-badge">⏳ PENDIENTE</span>')}
                    </div>
                    <h4 style="margin-bottom:2px;">${order.customer_name || 'Anónimo'}</h4>
                    <!-- CAMBIO: Mostrar Tipo de Moneda -->
                    <div style="margin-bottom:10px;">
                        <span style="font-size:0.7rem; padding:2px 8px; border-radius:10px; background:rgba(255,255,255,0.1); color:var(--accent);">
                            💰 ${method}
                        </span>
                    </div>

                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:12px; display:flex; justify-content:space-between; margin-top:10px;">
                        <span>$${price.toFixed(2)}</span>
                        <span style="color:var(--accent);">+$${myProfit.toFixed(2)}</span>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-top:10px;">
                        <button class="btn btn-primary-glass" onclick="window.viewReceipt('${order.receipt_url}')">👁️</button>
                        <button class="btn btn-primary-glass" onclick="window.downloadReceipt('${order.receipt_url}', '${order.id}')">📥</button>
                        <button class="btn btn-add" onclick="window.runOCR('${order.receipt_url}', '${order.id}')">🔍</button>
                    </div>
                </div>`;
        }).join('');

        updateStatsUI(stats, orders.length);

    } catch (e) {
        console.error("Error financiero:", e);
    }
};

// Helper para actualizar los contadores superiores
function updateStatsUI(stats, count) {
    const animateValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = `$${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    };

    animateValue('total-revenue', stats.totalRev);
    animateValue('total-tra', stats.totalTra);
    animateValue('total-zelle', stats.totalZelle);
    animateValue('total-usd', stats.totalUsd);
    animateValue('total-net', stats.totalProfit);

    const countEl = document.getElementById('total-orders-count');
    if (countEl) countEl.innerHTML = `${count} <small style="font-size:0.7rem; display:block; color:${stats.flagged > 0 ? 'var(--danger)' : 'var(--success)'}">${stats.flagged} Alertas</small>`;
}

/**
 * ==========================================
 *   MÓDULO: INVERSIÓN (ANÁLISIS REAL)
 * ==========================================
 */
async function renderInvestmentAnalysis() {
    try {
        const [products, orders, deductionValue] = await Promise.all([
            api.getAllProducts(),
            api.getOrders(),
            api.getDeductionPercent()
        ]);

        const tableBody = document.getElementById('investment-products-list');
        const percentage = parseFloat(deductionValue) || 0;
        
        // Inicializar contadores
        let globalInvTotal = 0;        // Lo que pagaste por el stock actual
        let globalGananciaPotencial = 0; // Lo que ganarás al vender ese stock
        let globalRealRevenue = 0;     // Total bruto vendido (dinero que entró)
        let globalRealProfit = 0;      // Tu ganancia neta real (comisiones acumuladas)

        // 1. Calcular lo que ya se ha vendido (Ganancia Real y Retorno Bruto)
        const completedOrders = orders.filter(o => !o.ocr_fraud_flag); // Excluir fraudes
        completedOrders.forEach(order => {
            const price = parseFloat(order.total_amount || String(order.total_text || "0").replace(/[^0-9.]/g, "")) || 0;
            globalRealRevenue += price;
            globalRealProfit += (price * (percentage / 100));
        });

        tableBody.innerHTML = '';

        // 2. Calcular sobre el Inventario Actual
        products.forEach(p => {
            const costo = parseFloat(p.cost || 0);
            const precioVenta = parseFloat(p.price || 0);
            const stock = parseInt(p.stock || 0);

            // Cálculos por producto
            const invTotalProducto = costo * stock; 
            const gananciaUnitaria = precioVenta - costo;
            const gananciaTotalProducto = gananciaUnitaria * stock;
            const margenProducto = costo > 0 ? (gananciaUnitaria / costo) * 100 : 0;

            // Acumuladores globales
            globalInvTotal += invTotalProducto;
            globalGananciaPotencial += gananciaTotalProducto;

            tableBody.innerHTML += `
                <tr style="border-bottom: 1px solid var(--glass-border); font-size: 0.85rem;">
                    <td style="padding:12px; font-weight:500;">${p.name}</td>
                    <td style="padding:12px;">$${costo.toFixed(2)}</td>
                    <td style="padding:12px;">$${precioVenta.toFixed(2)}</td>
                    <td style="padding:12px; text-align:center;">${stock}</td>
                    <td style="padding:12px; color:#ef4444;">$${invTotalProducto.toFixed(2)}</td>
                    <td style="padding:12px; color:#10b981;">$${gananciaTotalProducto.toFixed(2)}</td>
                    <td style="padding:12px; color:var(--accent);">${margenProducto.toFixed(2)}%</td>
                </tr>
            `;
        });

        // 3. Lógica de Punto de Equilibrio (Break Even)
        // El punto de equilibrio se alcanza cuando el Ingreso Bruto (Revenue) cubre la Inversión.
        const deficit = globalInvTotal - globalRealRevenue;
        const breakEvenStatusEl = document.getElementById('break-even-status');
        const progressEl = document.getElementById('recovery-progress');
        
        if (globalInvTotal === 0) {
            breakEvenStatusEl.innerHTML = `<span style="color:var(--text-muted);">Sin inversión activa</span>`;
            progressEl.value = 0;
        } else if (deficit <= 0) {
            const superavit = Math.abs(deficit);
            breakEvenStatusEl.innerHTML = `
                <span style="color:#10b981;">✅ INVERSIÓN RECUPERADA</span>
                <div style="font-size:0.7rem; color:#34d399;">Retorno: +$${superavit.toFixed(2)}</div>
            `;
            progressEl.value = 100;
        } else {
            const porcentajeRecuperado = (globalRealRevenue / globalInvTotal) * 100;
            breakEvenStatusEl.innerHTML = `
                <span style="color:#ef4444;">Faltan $${deficit.toFixed(2)} para recuperar</span>
                <div style="font-size:0.7rem; color:var(--text-muted); font-weight:400;">
                    Recuperado: ${porcentajeRecuperado.toFixed(1)}% de la inversión
                </div>
            `;
            progressEl.value = porcentajeRecuperado;
        }

        // 4. Actualizar etiquetas superiores
        const format = (val) => `$${val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        document.getElementById('total-investment').innerText = format(globalInvTotal);
        document.getElementById('total-profit').innerText = format(globalGananciaPotencial);
        document.getElementById('total-real-profit').innerText = format(globalRealProfit);

    } catch (error) {
        console.error("Error en análisis financiero:", error);
        showToast('Error al calcular finanzas', 'error');
    }
}

/**
 * ==========================================
 *   UTILIDADES Y NAVEGACIÓN
 * ==========================================
 */

window.showToast = (msg, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

window.customConfirm = (title, text) => {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;
    document.getElementById('modal-confirm').classList.add('active');
    return new Promise(resolve => { state.confirmResolver = resolve; });
};

window.closeConfirm = (val) => {
    document.getElementById('modal-confirm').classList.remove('active');
    if (state.confirmResolver) state.confirmResolver(val);
};

window.showCategoryProducts = (id, name) => {
    state.currentCategoryId = id;
    document.getElementById('section-categories').classList.add('hidden');
    document.getElementById('section-products').classList.remove('hidden');
    document.getElementById('current-cat-title').innerText = `📦 ${name}`;
    renderProducts();
};

window.showMainPanel = () => {
    state.currentCategoryId = null;
    document.getElementById('section-products').classList.add('hidden');
    document.getElementById('section-categories').classList.remove('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('admin_token') === 'active_session') {
        showDashboard();
    }
});

window.handleAddCategory = async () => {
    const name = document.getElementById('new-cat-name').value;
    const file = document.getElementById('new-cat-img').files[0];
    if (!name) return showToast("Nombre requerido", "error");

    try {
        const url = file ? await api.uploadImage('categories', file) : null;
        await api.createCategory(name, url);
        document.getElementById('new-cat-name').value = "";
        refreshData();
        showToast("Categoría creada", "success");
    } catch (e) { showToast("Error al crear categoría", "error"); }
};

window.handleDeleteCategory = async (id) => {
    const confirm = await customConfirm("¿Eliminar categoría?", "Se borrarán también los productos asociados.");
    if (!confirm) return;
    try {
        const cat = state.allCategories.find(c => String(c.id) === String(id));
        await api.deleteCategory(id, cat?.image_url);
        refreshData();
        showToast("Categoría eliminada", "success");
    } catch (e) { showToast("Error al eliminar", "error"); }
};

window.saveDeductionSetting = async (val) => {
    try {
        await api.updateDeductionPercent(parseFloat(val));
        loadOrdersSummary();
        showToast("Comisión actualizada", "success");
    } catch (e) { showToast("Error al guardar configuración", "error"); }
};

window.handleClearAllOrders = async () => {
    const ok = await customConfirm("¿Vaciar historial?", "Se borrarán todos los pedidos y fotos de comprobantes.");
    if (!ok) return;
    try {
        await api.deleteAllOrdersData();
        loadOrdersSummary();
        showToast("Historial vaciado", "success");
    } catch (e) { showToast("Error al vaciar", "error"); }
};

/**
 * ==========================================
 *   UTILIDADES DE COMPROBANTES
 * ==========================================
 */

window.viewReceipt = (url) => {
    window.open(url, '_blank');
};

window.downloadReceipt = async (url, orderId) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `comprobante_orden_${String(orderId).slice(-5)}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
        showToast("Error al descargar la imagen", "error");
    }
};

window.runOCR = async (imageUrl, orderId) => {
    if (typeof Tesseract === 'undefined') {
        showToast("Error: Librería OCR no cargada", "error");
        return;
    }

    showToast("🔍 Comparando con historial de recibos...", "info");

    try {
        const orders = await api.getOrders();
        const order = orders.find(o => String(o.id) === String(orderId));
        const targetAmount = parseFloat(order.total_amount || 0);

        const worker = await Tesseract.createWorker('spa');
        const ret = await worker.recognize(imageUrl);
        const text = ret.data.text;
        await worker.terminate();

        // 1. Extraer Referencia (números de 6 a 16 dígitos)
        const refMatch = text.match(/\b\d{6,16}\b/); 
        const detectedRef = refMatch ? refMatch[0] : null;

        // 2. Extraer Montos
        const amountMatch = text.match(/[\d]{1,10}[.,][\d]{2}/g);
        let detectedAmount = 0;
        if (amountMatch) {
            const cleanAmounts = amountMatch.map(a => parseFloat(a.replace('.', '').replace(',', '.')));
            detectedAmount = Math.max(...cleanAmounts);
        }

        let fraudReason = "";
        let isFraud = false;

        // --- LÓGICA DE COMPARACIÓN CON ANTIGUOS ---
        if (detectedRef) {
            // Llamada al API que busca en TODAS las órdenes previas
            const duplicate = await api.checkReferenceDuplicate(detectedRef);
            
            if (duplicate && String(duplicate.order_id) !== String(orderId)) {
                isFraud = true;
                fraudReason = `RECIBO YA USADO: La referencia ${detectedRef} coincide con la orden #${String(duplicate.order_id).slice(-5)}`;
            }
        } else {
            fraudReason = "No se detectó número de referencia legible";
        }

        // Validación de monto
        const amountDiff = Math.abs(detectedAmount - targetAmount);
        if (detectedAmount > 0 && amountDiff > 0.01) {
            fraudReason += (fraudReason ? " | " : "") + "Discrepancia de monto";
            // Si la diferencia es mucha, también marcar como sospechoso
            if (amountDiff > (targetAmount * 0.1)) isFraud = true; 
        }

        // 3. Guardar resultado de seguridad en la BD
        await api.saveOCRResults(orderId, {
            detectedRef,
            detectedAmount,
            isFraud: isFraud,
            notes: fraudReason
        });

        // 4. Renderizar UI del resultado
        renderOCRUI(isFraud, detectedRef, detectedAmount, targetAmount, fraudReason, text);
        
        // Refrescar lista para mostrar el borde rojo si es fraude
        await loadOrdersSummary(); 

    } catch (error) {
        console.error("Error OCR:", error);
        showToast("Error al procesar", "error");
    }
};

function renderOCRUI(isFraud, detectedRef, detectedAmount, targetAmount, reason, fullText) {
    const contentEl = document.getElementById('ocr-content');
    const isAmountOk = Math.abs(detectedAmount - targetAmount) < 0.01;

    contentEl.innerHTML = `
        <div style="background: ${isFraud ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}; 
                    border: 1px solid ${isFraud ? '#f43f5e' : '#10b981'}; 
                    padding: 15px; border-radius: 12px; margin-bottom: 20px;">
            <h3 style="color: ${isFraud ? '#fb7185' : '#34d399'}; margin:0;">
                ${isFraud ? '⚠️ ALERTA: Posible Fraude' : '✅ Comprobante Válido'}
            </h3>
            ${reason ? `<p style="margin:5px 0 0; font-size:0.8rem;">Causa: ${reason}</p>` : ''}
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
            <div class="stat-card" style="padding:10px; background:rgba(255,255,255,0.05)">
                <small>Ref. Detectada</small>
                <div style="font-weight:bold; color:${detectedRef ? '#fff' : '#f43f5e'}">${detectedRef || 'No hallada'}</div>
            </div>
            <div class="stat-card" style="padding:10px; background:rgba(255,255,255,0.05)">
                <small>Monto Detectado</small>
                <div style="font-weight:bold; color:${isAmountOk ? '#34d399' : '#fb7185'}">$${detectedAmount.toFixed(2)}</div>
            </div>
        </div>

        <details>
            <summary style="font-size:0.7rem; color:var(--text-muted); cursor:pointer;">Ver texto bruto del OCR</summary>
            <pre style="font-size:0.6rem; background:#000; padding:10px; margin-top:10px; border-radius:8px; overflow-x:auto;">${fullText}</pre>
        </details>
    `;
    document.getElementById('ocr-modal').classList.remove('hidden');
}

// Función auxiliar para mostrar el resultado en el modal
window.showOCRResultModal = (htmlContent) => {
    const modal = document.getElementById('ocr-modal');
    const contentEl = document.getElementById('ocr-content');
    
    // Limpiamos el pre y añadimos el HTML
    contentEl.innerHTML = htmlContent;
    modal.classList.remove('hidden');
};

window.handleApplyMassPriceUpdate = async () => {
    const type = document.getElementById('mass-adj-type').value;
    const percentInput = document.getElementById('mass-adj-percent').value;
    const percentage = parseFloat(percentInput);

    if (!percentage || percentage <= 0) {
        showToast("Ingresa un porcentaje válido", "error");
        return;
    }

    // Si es disminución, el porcentaje debe ser negativo para la fórmula
    const finalPercentage = type === 'decrease' ? (percentage * -1) : percentage;

    // Confirmación de seguridad
    const confirmText = type === 'increase' ? `aumentar un ${percentage}%` : `disminuir un ${percentage}%`;
    const ok = await customConfirm(
        "¿Confirmar cambio masivo?", 
        `Se va a ${confirmText} el precio de TODOS los productos en esta categoría. Esta acción es irreversible.`
    );

    if (!ok) return;

    try {
        const btn = document.querySelector('#modal-mass-prices .btn-add');
        const originalText = btn.innerText;
        btn.innerText = "Procesando...";
        btn.disabled = true;

        await api.updatePricesByCategory(state.currentCategoryId, finalPercentage);

        showToast("Precios actualizados correctamente", "success");
        closeModal('modal-mass-prices');
        
        // Limpiar input y recargar datos
        document.getElementById('mass-adj-percent').value = "";
        await refreshData(); 
        
    } catch (e) {
        console.error(e);
        showToast("Error al actualizar precios", "error");
    } finally {
        const btn = document.querySelector('#modal-mass-prices .btn-add');
        btn.innerText = "Aplicar Cambio Masivo";
        btn.disabled = false;
    }
};

// Esta función ahora mostrará la notificación en la esquina
window.showOCRModal = (content) => {
    const modal = document.getElementById('ocr-modal');
    const contentEl = document.getElementById('ocr-content');
    
    contentEl.innerText = content;
    modal.classList.remove('hidden');

    // Opcional: Auto-cerrar después de 30 segundos si es muy largo, 
    // pero como tiene botón de cerrar, lo dejamos manual.
    showToast("🔍 Resultado OCR listo en el panel lateral", "success");
};

window.closeOCRModal = () => {
    const modal = document.getElementById('ocr-modal');
    // Añadimos una pequeña clase de salida si quisieras, 
    // pero ocultarlo directamente es más rápido:
    modal.classList.add('hidden');
};