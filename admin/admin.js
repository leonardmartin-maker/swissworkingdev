// ============================================
// SWD Super Admin — Data & Logic
// ============================================

// --- Auth ---
const PWD_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'; // "password"

async function hashPwd(pwd) {
    const enc = new TextEncoder().encode(pwd);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function doLogin() {
    const pwd = document.getElementById('pwd').value;
    const hash = await hashPwd(pwd);
    if (hash === PWD_HASH) {
        sessionStorage.setItem('swd_admin', '1');
        showDashboard();
    } else {
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('pwd').value = '';
        document.getElementById('pwd').focus();
    }
}

function doLogout() {
    sessionStorage.removeItem('swd_admin');
    location.reload();
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    init();
}

if (sessionStorage.getItem('swd_admin') === '1') {
    showDashboard();
}

// --- Data Store (localStorage) ---
const STORAGE_KEY = 'swd_admin_data';

const defaultData = {
    apps: [
        { id: 'walkpos', name: 'WalkPOS', icon: 'bi-display', color: '#E63946', url: 'https://walkpos.swissworkingdev.ch', status: 'live', version: '1.0.0', description: 'Logiciel de caisse tout-en-un' },
        { id: 'gestmat', name: 'GestMat', icon: 'bi-geo-alt-fill', color: '#2a9d8f', url: 'https://gestmat.swissworkingdev.ch', status: 'dev', version: '0.5.0', description: 'Gestion de flotte et materiel SaaS' },
        { id: 'slp', name: 'Swiss Livraison Pro', icon: 'bi-truck', color: '#e76f51', url: 'https://swisslivraisonpro.ch', status: 'live', version: '2.1.0', description: 'Plateforme de gestion de livraison' },
        { id: 'pointeo', name: 'Pointeo', icon: 'bi-clock-fill', color: '#457b9d', url: 'https://pointeo.swissworkingdev.ch', status: 'dev', version: '0.2.0', description: 'Gestion du temps de travail' },
        { id: 'pilotage', name: 'Pilotage Quotidien', icon: 'bi-clipboard2-check-fill', color: '#4f46e5', url: 'https://pilotage.swissworktogether.ch', status: 'live', version: '1.0.0', description: 'Pilotage quotidien des taches d\'equipe' }
    ],
    subscriptions: [],
    servers: [
        { name: 'VPS HubPro / SLP', ip: '83.228.223.123', provider: 'Infomaniak', os: 'Ubuntu 22.04', cpu: 45, ram: 62, disk: 38, status: 'online' },
        { name: 'Infomaniak Web', ip: 'de5ap.ftp.infomaniak.com', provider: 'Infomaniak', os: 'Shared Hosting', cpu: 12, ram: 25, disk: 15, status: 'online' },
        { name: 'PostgreSQL (HubPro)', ip: '127.0.0.1:5432', provider: 'VPS Local', os: 'PostgreSQL 15', cpu: 30, ram: 48, disk: 22, status: 'online' }
    ],
    activity: [],
    revenueHistory: [],
    clientsHistory: []
};

const DATA_VERSION = 3; // Increment to force reset

function loadData() {
    const storedVersion = localStorage.getItem(STORAGE_KEY + '_v');
    if (storedVersion && parseInt(storedVersion) === DATA_VERSION) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                return JSON.parse(JSON.stringify(defaultData));
            }
        }
    }
    localStorage.setItem(STORAGE_KEY + '_v', DATA_VERSION);
    return JSON.parse(JSON.stringify(defaultData));
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let DATA = loadData();

// --- Init ---
function init() {
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('fr-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    setupNav();
    renderOverview();
    renderApps();
    renderSubscriptions();
    renderStats();
    renderServers();
    populateFilters();
}

// --- Navigation ---
function setupNav() {
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;

            document.querySelectorAll('.nav-item[data-section]').forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById('sec-' + section).classList.add('active');

            document.getElementById('pageTitle').textContent = item.textContent.trim();
            document.getElementById('sidebar').classList.remove('open');
        });
    });
}

// --- Overview ---
function renderOverview() {
    const activeSubs = DATA.subscriptions.filter(s => s.status === 'active' || s.status === 'trial');
    const mrr = DATA.subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + s.price, 0);

    document.getElementById('kpiApps').textContent = DATA.apps.length;
    document.getElementById('kpiClients').textContent = activeSubs.length;
    document.getElementById('kpiMRR').textContent = 'CHF ' + mrr.toLocaleString('fr-CH');

    renderRevenueChart();
    renderClientsChart();
    renderActivity();
}

function renderRevenueChart() {
    const ctx = document.getElementById('chartRevenue');
    if (ctx._chart) ctx._chart.destroy();
    ctx._chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: DATA.revenueHistory.map(r => r.month),
            datasets: [{
                label: 'MRR (CHF)',
                data: DATA.revenueHistory.map(r => r.value),
                borderColor: '#818cf8',
                backgroundColor: 'rgba(129, 140, 248, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#818cf8',
                pointRadius: 4
            }]
        },
        options: chartOptions('CHF')
    });
}

function renderClientsChart() {
    const ctx = document.getElementById('chartClients');
    if (ctx._chart) ctx._chart.destroy();

    const appCounts = {};
    DATA.apps.forEach(a => { appCounts[a.id] = { name: a.name, color: a.color, count: 0 }; });
    DATA.subscriptions.filter(s => s.status === 'active' || s.status === 'trial').forEach(s => {
        if (appCounts[s.app]) appCounts[s.app].count++;
    });

    const entries = Object.values(appCounts).filter(a => a.count > 0);
    ctx._chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: entries.map(a => a.name),
            datasets: [{
                data: entries.map(a => a.count),
                backgroundColor: entries.map(a => a.color),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16, font: { size: 12 } } }
            }
        }
    });
}

function renderActivity() {
    const list = document.getElementById('activityList');
    list.innerHTML = DATA.activity.map(a => `
        <div class="activity-item">
            <div class="activity-dot" style="background:${a.color}"></div>
            <span class="activity-text">${a.text}</span>
            <span class="activity-time">${a.time}</span>
        </div>
    `).join('');
}

// --- Apps ---
function renderApps() {
    const tbody = document.getElementById('appsBody');
    tbody.innerHTML = DATA.apps.map(app => {
        const clients = DATA.subscriptions.filter(s => s.app === app.id && (s.status === 'active' || s.status === 'trial')).length;
        const mrr = DATA.subscriptions.filter(s => s.app === app.id && s.status === 'active').reduce((sum, s) => sum + s.price, 0);
        const statusBadge = app.status === 'live'
            ? '<span class="badge badge-green">Live</span>'
            : '<span class="badge badge-yellow">Dev</span>';

        return `<tr>
            <td>
                <div style="display:flex;align-items:center;gap:0.5rem">
                    <i class="bi ${app.icon}" style="color:${app.color};font-size:1.2rem"></i>
                    <div>
                        <div style="font-weight:600">${app.name}</div>
                        <div style="font-size:0.7rem;color:var(--text-muted)">${app.description}</div>
                    </div>
                </div>
            </td>
            <td>${statusBadge}</td>
            <td>${clients}</td>
            <td>CHF ${mrr}</td>
            <td><span style="font-size:0.8rem;color:var(--text-muted)">${app.version}</span></td>
            <td>
                <a href="${app.url}" target="_blank" class="btn-outline-sm"><i class="bi bi-box-arrow-up-right"></i> Ouvrir</a>
                <button class="btn-outline-sm" onclick="editApp('${app.id}')"><i class="bi bi-pencil"></i></button>
                <button class="btn-outline-sm" onclick="deleteApp('${app.id}')" style="color:#f87171"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

// --- Subscriptions ---
function populateFilters() {
    const sel = document.getElementById('subFilterApp');
    sel.innerHTML = '<option value="all">Toutes les apps</option>';
    DATA.apps.forEach(a => {
        sel.innerHTML += `<option value="${a.id}">${a.name}</option>`;
    });
}

function renderSubscriptions() {
    const filterApp = document.getElementById('subFilterApp').value;
    const filterStatus = document.getElementById('subFilterStatus').value;

    let subs = [...DATA.subscriptions];
    if (filterApp !== 'all') subs = subs.filter(s => s.app === filterApp);
    if (filterStatus !== 'all') subs = subs.filter(s => s.status === filterStatus);

    const tbody = document.getElementById('subsBody');
    tbody.innerHTML = subs.map(sub => {
        const app = DATA.apps.find(a => a.id === sub.app);
        const statusMap = {
            active: '<span class="badge badge-green">Actif</span>',
            trial: '<span class="badge badge-blue">Essai</span>',
            expired: '<span class="badge badge-yellow">Expire</span>',
            cancelled: '<span class="badge badge-red">Annule</span>'
        };

        return `<tr>
            <td>
                <div style="font-weight:600">${sub.client}</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">${sub.email}</div>
            </td>
            <td><span style="color:${app ? app.color : '#fff'}">${app ? app.name : sub.app}</span></td>
            <td>${sub.plan}</td>
            <td>CHF ${sub.price}</td>
            <td>${statusMap[sub.status] || sub.status}</td>
            <td style="font-size:0.8rem">${sub.start}</td>
            <td style="font-size:0.8rem">${sub.nextPayment}</td>
            <td>
                <button class="btn-outline-sm" onclick="editSubscription(${sub.id})"><i class="bi bi-pencil"></i></button>
                <button class="btn-outline-sm" onclick="deleteSubscription(${sub.id})" style="color:#f87171"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`;
    }).join('');

    if (subs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">Aucun abonnement trouve</td></tr>';
    }
}

// --- Stats ---
function renderStats() {
    const activeSubs = DATA.subscriptions.filter(s => s.status === 'active');
    const mrr = activeSubs.reduce((sum, s) => sum + s.price, 0);
    const arr = mrr * 12;
    const arpu = activeSubs.length > 0 ? Math.round(mrr / activeSubs.length) : 0;

    document.getElementById('kpiARR').textContent = 'CHF ' + arr.toLocaleString('fr-CH');
    document.getElementById('kpiChurn').textContent = '0%';
    document.getElementById('kpiARPU').textContent = 'CHF ' + arpu;
    document.getElementById('kpiNewClients').textContent = DATA.subscriptions.filter(s => {
        const d = new Date(s.start);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    renderGrowthChart();
    renderRevenueByAppChart();
}

function renderGrowthChart() {
    const ctx = document.getElementById('chartGrowth');
    if (ctx._chart) ctx._chart.destroy();
    ctx._chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: DATA.clientsHistory.map(r => r.month),
            datasets: [{
                label: 'Clients',
                data: DATA.clientsHistory.map(r => r.value),
                backgroundColor: 'rgba(129, 140, 248, 0.6)',
                borderColor: '#818cf8',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: chartOptions()
    });
}

function renderRevenueByAppChart() {
    const ctx = document.getElementById('chartRevenueByApp');
    if (ctx._chart) ctx._chart.destroy();

    const appRevenue = {};
    DATA.apps.forEach(a => { appRevenue[a.id] = { name: a.name, color: a.color, revenue: 0 }; });
    DATA.subscriptions.filter(s => s.status === 'active').forEach(s => {
        if (appRevenue[s.app]) appRevenue[s.app].revenue += s.price;
    });

    const entries = Object.values(appRevenue);
    ctx._chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: entries.map(a => a.name),
            datasets: [{
                label: 'MRR (CHF)',
                data: entries.map(a => a.revenue),
                backgroundColor: entries.map(a => a.color + 'aa'),
                borderColor: entries.map(a => a.color),
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: { ...chartOptions('CHF'), indexAxis: 'y' }
    });
}

function chartOptions(prefix) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: { grid: { color: 'rgba(99,102,241,0.06)' }, ticks: { color: '#64748b', font: { size: 11 } } },
            y: {
                grid: { color: 'rgba(99,102,241,0.06)' },
                ticks: {
                    color: '#64748b',
                    font: { size: 11 },
                    callback: function(v) { return prefix ? prefix + ' ' + v : v; }
                }
            }
        }
    };
}

// --- Servers ---
function renderServers() {
    const grid = document.getElementById('serverGrid');
    grid.innerHTML = DATA.servers.map(s => {
        const dotColor = s.status === 'online' ? '#4ade80' : '#f87171';
        const cpuColor = s.cpu > 80 ? '#f87171' : s.cpu > 50 ? '#fbbf24' : '#4ade80';
        const ramColor = s.ram > 80 ? '#f87171' : s.ram > 50 ? '#fbbf24' : '#4ade80';
        const diskColor = s.disk > 80 ? '#f87171' : s.disk > 50 ? '#fbbf24' : '#4ade80';

        return `<div class="server-card">
            <h4><span class="status-dot" style="background:${dotColor}"></span> ${s.name}</h4>
            <div class="server-info">
                <div class="server-info-row"><span class="label">IP</span><span class="value">${s.ip}</span></div>
                <div class="server-info-row"><span class="label">Provider</span><span class="value">${s.provider}</span></div>
                <div class="server-info-row"><span class="label">OS</span><span class="value">${s.os}</span></div>
                <div class="server-info-row">
                    <span class="label">CPU</span><span class="value">${s.cpu}%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${s.cpu}%;background:${cpuColor}"></div></div>
                <div class="server-info-row">
                    <span class="label">RAM</span><span class="value">${s.ram}%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${s.ram}%;background:${ramColor}"></div></div>
                <div class="server-info-row">
                    <span class="label">Disque</span><span class="value">${s.disk}%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${s.disk}%;background:${diskColor}"></div></div>
            </div>
        </div>`;
    }).join('');
}

// --- Modals ---
function openModal(type, data) {
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    if (type === 'addApp') {
        title.textContent = 'Ajouter une application';
        body.innerHTML = `
            <div class="form-group"><label>Nom</label><input type="text" id="mAppName"></div>
            <div class="form-group"><label>Description</label><input type="text" id="mAppDesc"></div>
            <div class="form-group"><label>URL</label><input type="text" id="mAppUrl" placeholder="https://"></div>
            <div class="form-group"><label>Version</label><input type="text" id="mAppVersion" value="0.1.0"></div>
            <div class="form-group"><label>Icone Bootstrap (ex: bi-display)</label><input type="text" id="mAppIcon" value="bi-app"></div>
            <div class="form-group"><label>Couleur</label><input type="text" id="mAppColor" value="#6366f1"></div>
            <div class="form-group">
                <label>Status</label>
                <select id="mAppStatus"><option value="dev">Dev</option><option value="live">Live</option></select>
            </div>
            <button class="btn" onclick="saveNewApp()" style="margin-top:0.5rem;width:100%">Ajouter</button>
        `;
    } else if (type === 'editApp') {
        title.textContent = 'Modifier ' + data.name;
        body.innerHTML = `
            <div class="form-group"><label>Nom</label><input type="text" id="mAppName" value="${data.name}"></div>
            <div class="form-group"><label>Description</label><input type="text" id="mAppDesc" value="${data.description}"></div>
            <div class="form-group"><label>URL</label><input type="text" id="mAppUrl" value="${data.url}"></div>
            <div class="form-group"><label>Version</label><input type="text" id="mAppVersion" value="${data.version}"></div>
            <div class="form-group"><label>Icone Bootstrap</label><input type="text" id="mAppIcon" value="${data.icon}"></div>
            <div class="form-group"><label>Couleur</label><input type="text" id="mAppColor" value="${data.color}"></div>
            <div class="form-group">
                <label>Status</label>
                <select id="mAppStatus">
                    <option value="dev" ${data.status === 'dev' ? 'selected' : ''}>Dev</option>
                    <option value="live" ${data.status === 'live' ? 'selected' : ''}>Live</option>
                </select>
            </div>
            <button class="btn" onclick="saveEditApp('${data.id}')" style="margin-top:0.5rem;width:100%">Sauvegarder</button>
        `;
    } else if (type === 'editSub') {
        title.textContent = 'Modifier abonnement';
        const appOptions = DATA.apps.map(a => `<option value="${a.id}" ${data.app === a.id ? 'selected' : ''}>${a.name}</option>`).join('');
        body.innerHTML = `
            <div class="form-group"><label>Client</label><input type="text" id="mSubClient" value="${data.client}"></div>
            <div class="form-group"><label>Email</label><input type="email" id="mSubEmail" value="${data.email}"></div>
            <div class="form-group"><label>Application</label><select id="mSubApp">${appOptions}</select></div>
            <div class="form-group"><label>Plan</label><input type="text" id="mSubPlan" value="${data.plan}"></div>
            <div class="form-group"><label>Prix/mois (CHF)</label><input type="number" id="mSubPrice" value="${data.price}"></div>
            <div class="form-group">
                <label>Status</label>
                <select id="mSubStatus">
                    <option value="active" ${data.status === 'active' ? 'selected' : ''}>Actif</option>
                    <option value="trial" ${data.status === 'trial' ? 'selected' : ''}>Essai</option>
                    <option value="expired" ${data.status === 'expired' ? 'selected' : ''}>Expire</option>
                    <option value="cancelled" ${data.status === 'cancelled' ? 'selected' : ''}>Annule</option>
                </select>
            </div>
            <button class="btn" onclick="saveEditSubscription(${data.id})" style="margin-top:0.5rem;width:100%">Sauvegarder</button>
        `;
    }

    overlay.classList.add('open');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

// --- CRUD: Apps ---
function saveNewApp() {
    const app = {
        id: document.getElementById('mAppName').value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        name: document.getElementById('mAppName').value,
        description: document.getElementById('mAppDesc').value,
        url: document.getElementById('mAppUrl').value,
        version: document.getElementById('mAppVersion').value,
        icon: document.getElementById('mAppIcon').value,
        color: document.getElementById('mAppColor').value,
        status: document.getElementById('mAppStatus').value
    };
    if (!app.name) return;
    DATA.apps.push(app);
    saveData(DATA);
    closeModal();
    renderAll();
}

function editApp(id) {
    const app = DATA.apps.find(a => a.id === id);
    if (app) openModal('editApp', app);
}

function saveEditApp(id) {
    const app = DATA.apps.find(a => a.id === id);
    if (!app) return;
    app.name = document.getElementById('mAppName').value;
    app.description = document.getElementById('mAppDesc').value;
    app.url = document.getElementById('mAppUrl').value;
    app.version = document.getElementById('mAppVersion').value;
    app.icon = document.getElementById('mAppIcon').value;
    app.color = document.getElementById('mAppColor').value;
    app.status = document.getElementById('mAppStatus').value;
    saveData(DATA);
    closeModal();
    renderAll();
}

function deleteApp(id) {
    if (!confirm('Supprimer cette application ?')) return;
    DATA.apps = DATA.apps.filter(a => a.id !== id);
    DATA.subscriptions = DATA.subscriptions.filter(s => s.app !== id);
    saveData(DATA);
    renderAll();
}

// --- CRUD: Subscriptions ---
function editSubscription(id) {
    const sub = DATA.subscriptions.find(s => s.id === id);
    if (sub) openModal('editSub', sub);
}

function saveEditSubscription(id) {
    const sub = DATA.subscriptions.find(s => s.id === id);
    if (!sub) return;
    sub.client = document.getElementById('mSubClient').value;
    sub.email = document.getElementById('mSubEmail').value;
    sub.app = document.getElementById('mSubApp').value;
    sub.plan = document.getElementById('mSubPlan').value;
    sub.price = parseInt(document.getElementById('mSubPrice').value) || 0;
    sub.status = document.getElementById('mSubStatus').value;
    saveData(DATA);
    closeModal();
    renderAll();
}

function deleteSubscription(id) {
    if (!confirm('Supprimer cet abonnement ?')) return;
    DATA.subscriptions = DATA.subscriptions.filter(s => s.id !== id);
    saveData(DATA);
    renderAll();
}

// --- Export / Import ---
function exportData() {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'swd-admin-data-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            DATA = imported;
            saveData(DATA);
            renderAll();
            alert('Donnees importees avec succes');
        } catch (err) {
            alert('Fichier invalide');
        }
    };
    reader.readAsText(file);
}

// --- Password ---
async function changePassword() {
    const newPwd = document.getElementById('settingsPassword').value;
    if (!newPwd || newPwd.length < 4) {
        alert('Le mot de passe doit faire au moins 4 caracteres');
        return;
    }
    const hash = await hashPwd(newPwd);
    alert('Nouveau hash SHA-256 (a mettre dans admin.js):\n\n' + hash);
    document.getElementById('settingsPassword').value = '';
}

// --- Render all ---
function renderAll() {
    renderOverview();
    renderApps();
    renderSubscriptions();
    renderStats();
    renderServers();
    populateFilters();
}
