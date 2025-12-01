// Admin Panel JavaScript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let authToken = null;
let plansCache = [];

// Auth
onAuthStateChanged(auth, async (user) => {
    if (user) {
        authToken = await user.getIdToken();
        document.getElementById('adminName').textContent = user.displayName || user.email;
        const res = await api('/api/admin/stats');
        if (!res.success) { alert('Acesso negado'); window.location.href = '/'; return; }
        loadAll();
    } else { window.location.href = '/login.html'; }
});

window.handleLogout = async () => { await signOut(auth); window.location.href = '/login.html'; };

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// API Helper
async function api(url, options = {}) {
    try {
        const res = await fetch(url, { ...options, headers: { ...options.headers, 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } });
        return res.json();
    } catch (e) { return { success: false, error: e.message }; }
}

function loadAll() { loadStats(); loadUsers(); loadPlans(); loadNotices(); loadSettings(); loadBlacklist(); loadLogs(); }

// Stats
async function loadStats() {
    const data = await api('/api/admin/stats');
    if (data.success) {
        document.getElementById('statUsers').textContent = data.stats.users?.total || 0;
        document.getElementById('statActive').textContent = data.stats.users?.active || 0;
        document.getElementById('statLogins').textContent = data.stats.loginsLast24h || 0;
        document.getElementById('statBlack').textContent = data.stats.blacklistCount || 0;
    }
    const logs = await api('/api/admin/logs/activity?limit=10');
    document.getElementById('activities').innerHTML = logs.logs?.length ? logs.logs.map(l => 
        `<div class="flex justify-between py-1 border-b border-slate-800"><span class="text-slate-300">${l.action}</span><span class="text-slate-500">${l.user_email || ''} - ${new Date(l.created_at).toLocaleString('pt-BR')}</span></div>`
    ).join('') : '<p class="text-slate-500">Nenhuma atividade</p>';
}

// Users
async function loadUsers() {
    const data = await api('/api/admin/users');
    plansCache = (await api('/api/admin/plans')).plans || [];
    document.getElementById('usersTable').innerHTML = data.users?.map(u => `
        <tr class="hover:bg-slate-800/50">
            <td class="px-4 py-3"><div class="flex items-center gap-2"><div class="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm">${(u.name||u.email)[0].toUpperCase()}</div><div><p class="text-white">${u.name||'-'}</p><p class="text-xs text-slate-400">${u.email}</p></div></div></td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-xs ${u.role==='admin'?'bg-amber-500/20 text-amber-400':'bg-slate-700'}">${u.role}</span></td>
            <td class="px-4 py-3 text-purple-400">${u.max_instances||3}</td>
            <td class="px-4 py-3"><span class="h-2 w-2 rounded-full inline-block ${u.is_active?'bg-emerald-400':'bg-red-400'}"></span> ${u.is_active?'Ativo':'Inativo'}</td>
            <td class="px-4 py-3 text-right"><button onclick='editUser(${JSON.stringify(u).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs">Editar</button> <button onclick="deleteUser(${u.id})" class="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">×</button></td>
        </tr>
    `).join('') || '<tr><td colspan="5" class="p-8 text-center text-slate-500">Nenhum usuário</td></tr>';
}
window.loadUsers = loadUsers;

window.editUser = (u) => {
    showModal(`<div class="p-4 border-b border-slate-800"><h3 class="font-semibold">Editar Usuário</h3></div>
        <form onsubmit="saveUser(event,${u.id})" class="p-4 space-y-3">
            <div><label class="text-sm text-slate-400">Nome</label><input id="eName" value="${u.name||''}" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
            <div><label class="text-sm text-slate-400">Função</label><select id="eRole" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"><option value="user" ${u.role!=='admin'?'selected':''}>user</option><option value="admin" ${u.role==='admin'?'selected':''}>admin</option></select></div>
            <div><label class="text-sm text-slate-400">Máx Instâncias</label><input type="number" id="eInst" value="${u.max_instances||3}" min="1" max="100" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
            <div><label class="text-sm text-slate-400">Plano</label><select id="ePlan" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"><option value="">Nenhum</option>${plansCache.map(p=>`<option value="${p.id}" ${u.plan_id==p.id?'selected':''}>${p.name}</option>`).join('')}</select></div>
            <div class="flex items-center gap-2"><input type="checkbox" id="eActive" ${u.is_active?'checked':''}><label class="text-sm">Ativo</label></div>
            <div class="flex items-center gap-2"><input type="checkbox" id="eBypass" ${u.subscription_bypass?'checked':''}><label class="text-sm">Liberar acesso mesmo sem assinatura</label></div>
            <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 px-3 py-2 bg-slate-700 rounded">Cancelar</button><button class="flex-1 px-3 py-2 bg-indigo-500 rounded">Salvar</button></div>
        </form>`);
};

window.saveUser = async (e, id) => {
    e.preventDefault();

    const payload = {
        name: document.getElementById('eName').value,
        role: document.getElementById('eRole').value,
        max_instances: +document.getElementById('eInst').value,
        is_active: document.getElementById('eActive').checked,
        subscription_bypass: document.getElementById('eBypass').checked
    };

    console.log('Salvando usuário', id, payload);
    const res = await api(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    console.log('Resposta atualização usuário', res);

    if (!res || res.success === false || res.error) {
        toast((res && res.error) || 'Erro ao atualizar usuário', 'error');
        return;
    }

    const plan = document.getElementById('ePlan').value;
    if (plan) {
        const resPlan = await api(`/api/admin/users/${id}/plan`, { method: 'POST', body: JSON.stringify({ plan_id: +plan }) });
        console.log('Resposta atribuição de plano', resPlan);
        if (!resPlan || resPlan.success === false || resPlan.error) {
            toast((resPlan && resPlan.error) || 'Erro ao atualizar plano do usuário', 'error');
            return;
        }
    }

    closeModal();
    loadUsers();
    loadStats();
    toast('Usuário atualizado!');
};

window.deleteUser = async (id) => { if (confirm('Excluir?')) { await api(`/api/admin/users/${id}`, { method: 'DELETE' }); loadUsers(); loadStats(); toast('Excluído!'); } };

// Plans
async function loadPlans() {
    const data = await api('/api/admin/plans');
    plansCache = data.plans || [];
    document.getElementById('plansGrid').innerHTML = data.plans?.map(p => `
        <div class="glass border border-slate-700 rounded-lg p-4">
            <div class="flex justify-between mb-2"><span class="font-semibold">${p.name}</span><span class="text-emerald-400">R$ ${(p.price||0).toFixed(2)}</span></div>
            <p class="text-xs text-slate-400 mb-2">${p.description||''}</p>
            <p class="text-sm">📱 ${p.max_instances} inst. | 💬 ${p.max_messages_day} msg/dia</p>
            <div class="flex gap-2 mt-3"><button onclick='editPlan(${JSON.stringify(p).replace(/'/g,"&#39;")})' class="flex-1 px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs">Editar</button><button onclick="deletePlan(${p.id})" class="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">×</button></div>
        </div>
    `).join('') || '<p class="text-slate-500">Nenhum plano</p>';
}

window.showPlanModal = () => showModal(`<div class="p-4 border-b border-slate-800"><h3 class="font-semibold">Novo Plano</h3></div>
    <form onsubmit="createPlan(event)" class="p-4 space-y-3">
        <div><label class="text-sm text-slate-400">Nome</label><input id="pName" required class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
        <div><label class="text-sm text-slate-400">Descrição</label><input id="pDesc" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
        <div class="grid grid-cols-2 gap-2"><div><label class="text-sm text-slate-400">Instâncias</label><input type="number" id="pInst" value="3" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div><div><label class="text-sm text-slate-400">Msgs/dia</label><input type="number" id="pMsgs" value="1000" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div></div>
        <div><label class="text-sm text-slate-400">Preço R$</label><input type="number" id="pPrice" value="0" step="0.01" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
        <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 px-3 py-2 bg-slate-700 rounded">Cancelar</button><button class="flex-1 px-3 py-2 bg-indigo-500 rounded">Criar</button></div>
    </form>`);

window.createPlan = async (e) => { e.preventDefault(); await api('/api/admin/plans', { method: 'POST', body: JSON.stringify({ name: document.getElementById('pName').value, description: document.getElementById('pDesc').value, max_instances: +document.getElementById('pInst').value, max_messages_day: +document.getElementById('pMsgs').value, price: +document.getElementById('pPrice').value }) }); closeModal(); loadPlans(); toast('Plano criado!'); };

window.editPlan = (p) => showModal(`<div class="p-4 border-b border-slate-800"><h3 class="font-semibold">Editar Plano</h3></div>
    <form onsubmit="updatePlan(event,${p.id})" class="p-4 space-y-3">
        <div><label class="text-sm text-slate-400">Nome</label><input id="pName" value="${p.name}" required class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
        <div><label class="text-sm text-slate-400">Descrição</label><input id="pDesc" value="${p.description||''}" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
        <div class="grid grid-cols-2 gap-2"><div><label class="text-sm text-slate-400">Instâncias</label><input type="number" id="pInst" value="${p.max_instances}" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div><div><label class="text-sm text-slate-400">Msgs/dia</label><input type="number" id="pMsgs" value="${p.max_messages_day}" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div></div>
        <div><label class="text-sm text-slate-400">Preço R$</label><input type="number" id="pPrice" value="${p.price}" step="0.01" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
        <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 px-3 py-2 bg-slate-700 rounded">Cancelar</button><button class="flex-1 px-3 py-2 bg-indigo-500 rounded">Salvar</button></div>
    </form>`);

window.updatePlan = async (e, id) => { e.preventDefault(); await api(`/api/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify({ name: document.getElementById('pName').value, description: document.getElementById('pDesc').value, max_instances: +document.getElementById('pInst').value, max_messages_day: +document.getElementById('pMsgs').value, price: +document.getElementById('pPrice').value }) }); closeModal(); loadPlans(); toast('Plano atualizado!'); };

window.deletePlan = async (id) => { if (confirm('Excluir plano?')) { await api(`/api/admin/plans/${id}`, { method: 'DELETE' }); loadPlans(); toast('Excluído!'); } };

// Notices
async function loadNotices() {
    const data = await api('/api/admin/notices');
    document.getElementById('noticesList').innerHTML = data.notices?.map(n => `
        <div class="glass border border-slate-700 rounded-lg p-3 flex justify-between items-center">
            <div><span class="px-2 py-0.5 rounded text-xs ${n.type==='warning'?'bg-amber-500/20 text-amber-400':n.type==='error'?'bg-red-500/20 text-red-400':'bg-blue-500/20 text-blue-400'}">${n.type}</span> <span class="font-medium ml-2">${n.title}</span><p class="text-sm text-slate-400 mt-1">${n.message}</p></div>
            <div class="flex gap-2"><button onclick='editNotice(${JSON.stringify(n).replace(/'/g,"&#39;")})' class="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs">Editar</button><button onclick="deleteNotice(${n.id})" class="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">×</button></div>
        </div>
    `).join('') || '<p class="text-slate-500">Nenhum aviso</p>';
}

window.showNoticeModal = () => showModal(`<div class="p-4 border-b border-slate-800"><h3 class="font-semibold">Novo Aviso</h3></div>
    <form onsubmit="createNotice(event)" class="p-4 space-y-3">
        <div><label class="text-sm text-slate-400">Título</label><input id="nTitle" required class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
        <div><label class="text-sm text-slate-400">Mensagem</label><textarea id="nMsg" rows="3" required class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></textarea></div>
        <div><label class="text-sm text-slate-400">Tipo</label><select id="nType" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"><option value="info">Info</option><option value="warning">Aviso</option><option value="error">Erro</option></select></div>
        <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 px-3 py-2 bg-slate-700 rounded">Cancelar</button><button class="flex-1 px-3 py-2 bg-indigo-500 rounded">Criar</button></div>
    </form>`);

window.createNotice = async (e) => { e.preventDefault(); await api('/api/admin/notices', { method: 'POST', body: JSON.stringify({ title: document.getElementById('nTitle').value, message: document.getElementById('nMsg').value, type: document.getElementById('nType').value }) }); closeModal(); loadNotices(); toast('Aviso criado!'); };

window.editNotice = (n) => showModal(`<div class="p-4 border-b border-slate-800"><h3 class="font-semibold">Editar Aviso</h3></div>
    <form onsubmit="updateNotice(event,${n.id})" class="p-4 space-y-3">
        <div><label class="text-sm text-slate-400">Título</label><input id="nTitle" value="${n.title}" required class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
        <div><label class="text-sm text-slate-400">Mensagem</label><textarea id="nMsg" rows="3" required class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white">${n.message}</textarea></div>
        <div><label class="text-sm text-slate-400">Tipo</label><select id="nType" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"><option value="info" ${n.type==='info'?'selected':''}>Info</option><option value="warning" ${n.type==='warning'?'selected':''}>Aviso</option><option value="error" ${n.type==='error'?'selected':''}>Erro</option></select></div>
        <div class="flex items-center gap-2"><input type="checkbox" id="nActive" ${n.is_active?'checked':''}><label class="text-sm">Ativo</label></div>
        <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 px-3 py-2 bg-slate-700 rounded">Cancelar</button><button class="flex-1 px-3 py-2 bg-indigo-500 rounded">Salvar</button></div>
    </form>`);

window.updateNotice = async (e, id) => { e.preventDefault(); await api(`/api/admin/notices/${id}`, { method: 'PUT', body: JSON.stringify({ title: document.getElementById('nTitle').value, message: document.getElementById('nMsg').value, type: document.getElementById('nType').value, is_active: document.getElementById('nActive').checked }) }); closeModal(); loadNotices(); toast('Aviso atualizado!'); };

window.deleteNotice = async (id) => { if (confirm('Excluir aviso?')) { await api(`/api/admin/notices/${id}`, { method: 'DELETE' }); loadNotices(); toast('Excluído!'); } };

// Settings
async function loadSettings() {
    const data = await api('/api/admin/settings');
    document.getElementById('settingsList').innerHTML = data.settings?.map(s => `
        <div class="flex items-center justify-between py-2 border-b border-slate-800">
            <div><p class="font-medium">${s.key}</p><p class="text-xs text-slate-400">${s.description||''}</p></div>
            <div class="flex items-center gap-2"><input id="set_${s.key}" value="${s.value}" class="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-white w-40"><button onclick="saveSetting('${s.key}')" class="px-2 py-1 bg-indigo-500 rounded text-xs">Salvar</button></div>
        </div>
    `).join('') || '<p class="text-slate-500">Nenhuma configuração</p>';
}

window.saveSetting = async (key) => { await api(`/api/admin/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value: document.getElementById(`set_${key}`).value }) }); toast('Configuração salva!'); };

// Blacklist
async function loadBlacklist() {
    const data = await api('/api/admin/blacklist');
    document.getElementById('blacklistList').innerHTML = data.blacklist?.length ? `<table class="w-full"><thead><tr><th class="text-left text-xs text-slate-400 pb-2">NÚMERO</th><th class="text-left text-xs text-slate-400 pb-2">MOTIVO</th><th class="text-left text-xs text-slate-400 pb-2">DATA</th><th></th></tr></thead><tbody>${data.blacklist.map(b => `<tr class="border-t border-slate-800"><td class="py-2">${b.phone}</td><td class="py-2 text-slate-400">${b.reason||'-'}</td><td class="py-2 text-slate-500 text-sm">${new Date(b.created_at).toLocaleDateString('pt-BR')}</td><td class="py-2 text-right"><button onclick="removeBlacklist('${b.phone}')" class="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">Remover</button></td></tr>`).join('')}</tbody></table>` : '<p class="text-slate-500">Nenhum número na blacklist</p>';
}

window.showBlacklistModal = () => showModal(`<div class="p-4 border-b border-slate-800"><h3 class="font-semibold">Adicionar à Blacklist</h3></div>
    <form onsubmit="addBlacklist(event)" class="p-4 space-y-3">
        <div><label class="text-sm text-slate-400">Número</label><input id="bPhone" placeholder="5511999999999" required class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
        <div><label class="text-sm text-slate-400">Motivo</label><input id="bReason" class="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"></div>
        <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 px-3 py-2 bg-slate-700 rounded">Cancelar</button><button class="flex-1 px-3 py-2 bg-red-500 rounded">Adicionar</button></div>
    </form>`);

window.addBlacklist = async (e) => { e.preventDefault(); await api('/api/admin/blacklist', { method: 'POST', body: JSON.stringify({ phone: document.getElementById('bPhone').value, reason: document.getElementById('bReason').value }) }); closeModal(); loadBlacklist(); loadStats(); toast('Adicionado!'); };

window.removeBlacklist = async (phone) => { if (confirm('Remover da blacklist?')) { await api(`/api/admin/blacklist/${phone}`, { method: 'DELETE' }); loadBlacklist(); loadStats(); toast('Removido!'); } };

// Logs
async function loadLogs() {
    const login = await api('/api/admin/logs/login?limit=50');
    document.getElementById('loginLogs').innerHTML = login.logs?.map(l => `<div class="py-1 border-b border-slate-800 flex justify-between"><span>${l.user_email} <span class="${l.success?'text-emerald-400':'text-red-400'}">${l.success?'✓':'✗'}</span></span><span class="text-slate-500">${new Date(l.created_at).toLocaleString('pt-BR')}</span></div>`).join('') || '<p class="text-slate-500">Nenhum log</p>';
    
    const activity = await api('/api/admin/logs/activity?limit=50');
    document.getElementById('activityLogs').innerHTML = activity.logs?.map(l => `<div class="py-1 border-b border-slate-800 flex justify-between"><span>${l.action} <span class="text-slate-400">${l.user_email||''}</span></span><span class="text-slate-500">${new Date(l.created_at).toLocaleString('pt-BR')}</span></div>`).join('') || '<p class="text-slate-500">Nenhum log</p>';
}

// Modal helpers
function showModal(html) { document.getElementById('modalContent').innerHTML = html; document.getElementById('modal').classList.remove('hidden'); }
window.closeModal = () => document.getElementById('modal').classList.add('hidden');
document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

// Toast
function toast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg ${type==='error'?'bg-red-500':'bg-emerald-500'} text-white`;
    setTimeout(() => t.classList.add('hidden'), 3000);
}
