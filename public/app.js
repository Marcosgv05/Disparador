// API Base URL
const API_URL = window.location.origin;

// Socket.IO connection
const socket = io();

// Estado global
let state = {
    currentCampaign: null,
    campaigns: [],
    sessions: [],
    instances: [],
    instanceCounter: 0,
    user: null
};

// ==== AUTENTICAÇÃO ====

// Verifica se está logado ao carregar a página
(function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = '/login.html';
        return;
    }
    
    state.user = JSON.parse(user);
    document.getElementById('userName').textContent = state.user.name;
})();

async function handleLogout() {
    if (!confirm('Deseja realmente sair?')) return;
    
    try {
        await fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// ==== UTILITIES ====

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function deleteCampaign() {
    const select = document.getElementById('selectedCampaign');
    if (!select || !select.value) {
        showToast('Selecione uma campanha para excluir', 'warning');
        return;
    }

    const campaignName = select.value;

    if (!confirm(`Tem certeza que deseja excluir a campanha "${campaignName}"? Esta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        await apiCall(`/api/campaign/${encodeURIComponent(campaignName)}`, {
            method: 'DELETE'
        });

        showToast(`Campanha "${campaignName}" excluída`, 'success');

        // Atualiza selects
        await loadCampaigns();

        // Limpa seleção em todos os selects relacionados
        const selects = [
            document.getElementById('selectedCampaign'),
            document.getElementById('dispatchCampaign'),
            document.getElementById('scheduleCampaign')
        ];

        selects.forEach(sel => {
            if (sel) sel.value = '';
        });

        state.currentCampaign = null;
        document.getElementById('campaignDetails').style.display = 'none';
        document.getElementById('dispatchProgress').style.display = 'none';
        renderMessages({ messages: [] });
        document.getElementById('contactsTableBody').innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum contato adicionado</td></tr>';

        updateDispatchStatusUI({ status: 'idle' });

    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao excluir campanha', 'error');
    }
}

async function apiCall(endpoint, options = {}) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
                ...options.headers
            }
        });
        
        // Verifica se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Resposta inválida do servidor. Verifique se o servidor está rodando corretamente.');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro na requisição');
        }
        
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

// ==== NAVIGATION ====

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = item.dataset.section;
        
        // Update nav
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        // Update section
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(sectionId).classList.add('active');
    });
});

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        const parent = btn.closest('.section');
        
        // Update tabs
        parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        parent.querySelector(`#${tabName}`).classList.add('active');
    });
});

// ==== WHATSAPP CONNECTION ====

async function connectWhatsApp() {
    const sessionId = document.getElementById('sessionId').value;
    
    if (!sessionId) {
        showToast('Digite um ID para a sessão', 'warning');
        return;
    }
    
    try {
        const result = await apiCall('/api/session/create', {
            method: 'POST',
            body: JSON.stringify({ sessionId })
        });
        
        showToast('Aguarde o QR Code...', 'success');
        document.getElementById('qrCodeContainer').style.display = 'block';
    } catch (error) {
        console.error(error);
    }
}

// Socket events for instances
socket.on('qr-code', async (data) => {
    const instance = state.instances.find(i => i.sessionId === data.sessionId);
    if (instance) {
        instance.qrCode = data.qrCode;
        renderInstances();
    }
    showToast('QR Code gerado!', 'success');
});

socket.on('session-connected', async (data) => {
    const instance = state.instances.find(i => i.sessionId === data.sessionId);
    if (instance) {
        // Atualiza instância no backend
        try {
            await apiCall(`/api/instances/${instance.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ 
                    status: 'connected',
                    phone: data.phone || 'Conectado'
                })
            });
        } catch (error) {
            console.error('Erro ao atualizar instância:', error);
        }
        
        instance.status = 'connected';
        instance.phone = data.phone || 'Conectado';
        instance.qrCode = null;
        renderInstances();
    }
    showToast(`Sessão ${data.sessionId} conectada!`, 'success');
    loadSessions();
});

async function loadSessions() {
    try {
        const { sessions } = await apiCall('/api/session/list');
        state.sessions = sessions;
        
        const container = document.getElementById('sessionsItems');
        if (sessions.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhuma sessão ativa</p>';
        } else {
            container.innerHTML = sessions.map(s => `
                <div class="number-item">
                    <span>${s.id} - ${s.phone || 'Conectando...'}</span>
                    <button class="btn btn-danger btn-sm" onclick="removeSession('${s.id}')">Remover</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error(error);
    }
}

async function removeSession(sessionId) {
    if (!confirm('Deseja realmente remover esta sessão?')) return;
    
    try {
        await apiCall(`/api/session/${sessionId}`, { method: 'DELETE' });
        showToast('Sessão removida', 'success');
        loadSessions();
    } catch (error) {
        console.error(error);
    }
}

// ==== CAMPAIGNS ====

async function createCampaign() {
    const name = document.getElementById('campaignName').value;
    
    if (!name) {
        showToast('Digite um nome para a campanha', 'warning');
        return;
    }
    
    try {
        const { campaign } = await apiCall('/api/campaign/create', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        
        if (!campaign || !campaign.name) {
            throw new Error('Erro ao criar campanha: resposta inválida');
        }
        
        const statusBox = document.getElementById('campaignCreationStatus');
        if (statusBox) {
            statusBox.innerHTML = `
                <span class="status-icon">✅</span>
                <div>
                    <strong>Campanha criada!</strong>
                    <p>"${campaign.name}" já está disponível no painel ao lado.</p>
                </div>
            `;
            statusBox.style.display = 'flex';
        }
        
        showToast(`Campanha "${campaign.name}" criada com sucesso!`, 'success');
        document.getElementById('campaignName').value = '';
        await loadCampaigns();
        
        // Seleciona automaticamente a nova campanha para gerenciamento
        const select = document.getElementById('selectedCampaign');
        if (select) {
            select.value = campaign.name;
            // Dispara evento change para garantir que o painel seja atualizado
            select.dispatchEvent(new Event('change'));
            await loadCampaignDetails();
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao criar campanha', 'error');
    }
}

async function loadCampaigns() {
    try {
        const { campaigns } = await apiCall('/api/campaign/list');
        state.campaigns = campaigns;
        
        // Update dashboard
        updateDashboard(campaigns);
        
        // Update selects
        updateCampaignSelects(campaigns);
        
    } catch (error) {
        console.error(error);
    }
}

function updateDashboard(campaigns) {
    document.getElementById('dashCampaigns').textContent = campaigns.length;
    
    let totalSent = 0;
    let totalNumbers = 0;
    
    campaigns.forEach(c => {
        totalSent += c.stats.sent;
        totalNumbers += c.numbers.length;
    });
    
    document.getElementById('dashSent').textContent = totalSent;
    document.getElementById('dashNumbers').textContent = totalNumbers;
    
    const recentContainer = document.getElementById('recentCampaigns');
    if (campaigns.length === 0) {
        recentContainer.innerHTML = '<p class="empty-state">Nenhuma campanha criada ainda</p>';
    } else {
        recentContainer.innerHTML = campaigns.slice(0, 5).map(c => `
            <div class="campaign-item">
                <div class="campaign-info">
                    <h4>${c.name}</h4>
                    <p>${c.numbers.length} números • ${c.messages.length} mensagens • ${c.stats.sent} enviadas</p>
                </div>
                <span class="campaign-status status-${c.status}">${c.status}</span>
            </div>
        `).join('');
    }
}

function updateCampaignSelects(campaigns) {
    const selects = [
        document.getElementById('selectedCampaign'),
        document.getElementById('dispatchCampaign')
    ];
    
    selects.forEach(select => {
        const current = select.value;
        select.innerHTML = '<option value="">-- Selecione --</option>' +
            campaigns.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        select.value = current;
    });
}

async function loadCampaignDetails() {
    const name = document.getElementById('selectedCampaign').value;
    
    if (!name) {
        document.getElementById('campaignDetails').style.display = 'none';
        return;
    }
    
    try {
        const { campaign } = await apiCall(`/api/campaign/${name}`);
        state.currentCampaign = campaign;
        
        document.getElementById('campaignDetails').style.display = 'block';
        
        // Stats
        const statsContainer = document.getElementById('campaignStats');
        statsContainer.innerHTML = `
            <div class="stat-item">
                <h4>${campaign.stats.total}</h4>
                <p>Total</p>
            </div>
            <div class="stat-item">
                <h4>${campaign.stats.sent}</h4>
                <p>Enviadas</p>
            </div>
            <div class="stat-item">
                <h4>${campaign.stats.received || 0}</h4>
                <p>Recebidas</p>
            </div>
            <div class="stat-item">
                <h4>${campaign.stats.read || 0}</h4>
                <p>Lidas</p>
            </div>
            <div class="stat-item">
                <h4>${campaign.stats.replied || 0}</h4>
                <p>Respondidas</p>
            </div>
            <div class="stat-item">
                <h4>${campaign.stats.failed}</h4>
                <p>Falhas</p>
            </div>
            <div class="stat-item">
                <h4>${campaign.stats.pending}</h4>
                <p>Pendentes</p>
            </div>
        `;
        
        // Render Contacts Table
        renderContactsTable(campaign);
        
        // Render Messages List
        renderMessages(campaign);
        
    } catch (error) {
        console.error(error);
    }
}

async function uploadNumbers() {
    const file = document.getElementById('numbersFile').files[0];
    const campaignName = document.getElementById('selectedCampaign').value;
    
    if (!file || !campaignName) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_URL}/api/campaign/${campaignName}/upload-numbers`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error);
        }
        
        // Mostra modal com detalhes
        showNumbersResult(data);
        
        showToast(`${data.validation.valid} números adicionados!`, 'success');
        
        document.getElementById('numbersFile').value = '';
        loadCampaignDetails();
        
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showNumbersResult(data) {
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    title.textContent = '📊 Números Carregados';
    
    let html = `
        <div class="upload-result">
            <div class="upload-result-header">
                <div class="result-stat">
                    <h3>${data.validation.total}</h3>
                    <p>Total</p>
                </div>
                <div class="result-stat">
                    <h3 style="color: var(--success);">${data.validation.valid}</h3>
                    <p>Válidos</p>
                </div>
                <div class="result-stat">
                    <h3 style="color: var(--danger);">${data.validation.invalid}</h3>
                    <p>Inválidos</p>
                </div>
            </div>
    `;
    
    if (data.validation.invalid > 0) {
        html += `
            <div class="alert alert-warning">
                <strong>Atenção:</strong> ${data.validation.invalid} números foram ignorados por estarem em formato inválido.
            </div>
        `;
    }
    
    if (data.validation.validNumbers && data.validation.validNumbers.length > 0) {
        html += `
            <h4>Números Válidos (primeiros ${Math.min(20, data.validation.validNumbers.length)}):</h4>
            <div class="result-list">
        `;
        
        data.validation.validNumbers.forEach(num => {
            html += `<div class="result-item valid">✅ ${num}</div>`;
        });
        
        html += `</div>`;
        
        if (data.validation.valid > 20) {
            html += `<p style="color: var(--text-light); margin-top: 0.5rem; text-align: center;">+ ${data.validation.valid - 20} números adicionais</p>`;
        }
    }
    
    if (data.validation.invalidNumbers && data.validation.invalidNumbers.length > 0) {
        html += `
            <h4 style="margin-top: 1rem;">Números Inválidos:</h4>
            <div class="result-list">
        `;
        
        data.validation.invalidNumbers.forEach(num => {
            html += `<div class="result-item invalid">❌ ${num}</div>`;
        });
        
        html += `</div>`;
    }
    
    html += `</div>`;
    
    body.innerHTML = html;
    modal.classList.add('show');
}

function closeModal() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('show');
}

async function addMessage() {
    const textarea = document.getElementById('newMessageText');
    const message = textarea.value.trim();
    const campaignName = document.getElementById('selectedCampaign').value;
    
    if (!message) {
        showToast('Digite uma mensagem', 'warning');
        return;
    }
    
    if (!campaignName) {
        showToast('Selecione uma campanha', 'warning');
        return;
    }
    
    try {
        await apiCall(`/api/campaign/${campaignName}/message`, {
            method: 'POST',
            body: JSON.stringify({ message })
        });
        
        showToast('Mensagem adicionada!', 'success');
        textarea.value = '';
        loadCampaignDetails();
        
    } catch (error) {
        console.error(error);
    }
}

async function addBulkMessages() {
    const textarea = document.getElementById('bulkMessagesText');
    const text = textarea.value.trim();
    const campaignName = document.getElementById('selectedCampaign').value;
    
    if (!text) {
        showToast('Cole as mensagens no campo', 'warning');
        return;
    }
    
    if (!campaignName) {
        showToast('Selecione uma campanha', 'warning');
        return;
    }
    
    // Separa por linha e remove linhas vazias
    const messages = text.split('\n')
        .map(msg => msg.trim())
        .filter(msg => msg.length > 0);
    
    if (messages.length === 0) {
        showToast('Nenhuma mensagem válida encontrada', 'warning');
        return;
    }
    
    try {
        let added = 0;
        let failed = 0;
        
        for (const message of messages) {
            try {
                await apiCall(`/api/campaign/${campaignName}/message`, {
                    method: 'POST',
                    body: JSON.stringify({ message })
                });
                added++;
            } catch (error) {
                console.error('Erro ao adicionar mensagem:', message, error);
                failed++;
            }
        }
        
        showToast(`✅ ${added} mensagens adicionadas! ${failed > 0 ? `(${failed} falharam)` : ''}`, 'success');
        textarea.value = '';
        loadCampaignDetails();
        
    } catch (error) {
        console.error(error);
        showToast('Erro ao adicionar mensagens', 'error');
    }
}

async function removeMessage(campaignName, index) {
    if (!confirm('Remover esta mensagem?')) return;
    
    try {
        await apiCall(`/api/campaign/${campaignName}/message/${index}`, {
            method: 'DELETE'
        });
        
        showToast('Mensagem removida', 'success');
        loadCampaignDetails();
        
    } catch (error) {
        console.error(error);
    }
}

function renderMessages(campaign) {
    const container = document.getElementById('messagesList');
    
    if (!campaign.messages || campaign.messages.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma mensagem adicionada</p>';
        return;
    }
    
    container.innerHTML = campaign.messages.map((msg, idx) => `
        <div class="message-item">
            <div class="message-number">${idx + 1}</div>
            <div class="message-content">
                <div class="message-text">${msg}</div>
                <div class="message-actions">
                    <button class="btn btn-danger btn-sm" onclick="removeMessage('${campaign.name}', ${idx})">❌ Remover</button>
                </div>
            </div>
        </div>
    `).join('');
}

function showMessagesResult(data) {
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    title.textContent = '📝 Mensagens Carregadas';
    
    let html = `
        <div class="upload-result">
            <div class="upload-result-header">
                <div class="result-stat">
                    <h3 style="color: var(--primary);">${data.messagesCount}</h3>
                    <p>Mensagens</p>
                </div>
            </div>
            
            <div class="alert alert-info">
                <strong>✅ Sucesso!</strong> ${data.messagesCount} mensagens foram carregadas e serão alternadas durante o disparo.
            </div>
    `;
    
    if (data.messages && data.messages.length > 0) {
        html += `
            <h4>Preview das Mensagens (primeiras ${Math.min(10, data.messages.length)}):</h4>
            <div class="result-list">
        `;
        
        data.messages.forEach((msg, index) => {
            html += `
                <div class="result-message">
                    <strong>Mensagem ${index + 1}:</strong><br>
                    ${msg}
                </div>
            `;
        });
        
        html += `</div>`;
        
        if (data.messagesCount > 10) {
            html += `<p style="color: var(--text-light); margin-top: 0.5rem; text-align: center;">+ ${data.messagesCount - 10} mensagens adicionais</p>`;
        }
    }
    
    html += `</div>`;
    
    body.innerHTML = html;
    modal.classList.add('show');
}

// ==== CONTACTS TABLE ====

function renderContactsTable(campaign) {
    const tbody = document.getElementById('contactsTableBody');
    
    if (!campaign.contacts || campaign.contacts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum contato adicionado</td></tr>';
        return;
    }
    
    tbody.innerHTML = campaign.contacts.map((contact, idx) => {
        const statusIcons = {
            'pending': '⏳',
            'sending': '📤',
            'sent': '✅',
            'received': '📨',
            'read': '👁️',
            'replied': '💬',
            'failed': '❌'
        };
        
        const statusLabels = {
            'pending': 'Pendente',
            'sending': 'Enviando',
            'sent': 'Enviado',
            'received': 'Recebido',
            'read': 'Lido',
            'replied': 'Respondido',
            'failed': 'Falhou'
        };
        
        const icon = statusIcons[contact.status] || '⏳';
        const label = statusLabels[contact.status] || 'Pendente';
        
        let details = '';
        if (contact.sentAt) {
            const sentDate = new Date(contact.sentAt);
            details = `Enviado: ${sentDate.toLocaleString('pt-BR')}`;
        }
        if (contact.error) {
            details = `Erro: ${contact.error}`;
        }
        
        const canRemove = contact.status === 'pending' || contact.status === 'failed';
        
        return `
            <tr>
                <td>${idx + 1}</td>
                <td class="contact-name">${contact.name}</td>
                <td class="contact-phone">${contact.phone}</td>
                <td>
                    <span class="contact-status ${contact.status}">
                        <span class="contact-status-icon">${icon}</span>
                        ${label}
                    </span>
                </td>
                <td class="contact-details">${details}</td>
                <td>
                    <button class="btn btn-danger btn-sm" 
                            onclick="removeContact('${campaign.name}', '${contact.phone}')"
                            ${!canRemove ? 'disabled' : ''}>
                        🗑️ Remover
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function removeContact(campaignName, phoneNumber) {
    if (!confirm(`Remover contato ${phoneNumber}?`)) return;
    
    try {
        await apiCall(`/api/campaign/${campaignName}/number/${encodeURIComponent(phoneNumber)}`, {
            method: 'DELETE'
        });
        
        showToast('Contato removido', 'success');
        loadCampaignDetails();
        
    } catch (error) {
        console.error(error);
    }
}

function downloadTemplate(type) {
    window.open(`${API_URL}/api/template/${type}`, '_blank');
}

// ==== DISPATCH ====

async function startDispatch() {
    const campaignName = document.getElementById('dispatchCampaign').value;
    const messageDelay = parseInt(document.getElementById('messageDelay').value) || 3;
    const numberDelay = parseInt(document.getElementById('numberDelay').value) || 5;
    
    if (!campaignName) {
        showToast('Selecione uma campanha', 'warning');
        return;
    }
    
    // Validação dos delays
    if (messageDelay < 1 || messageDelay > 360) {
        showToast('Delay entre mensagens deve estar entre 1 e 360 segundos', 'warning');
        return;
    }
    
    if (numberDelay < 1 || numberDelay > 120) {
        showToast('Delay entre números deve estar entre 1 e 120 segundos', 'warning');
        return;
    }
    
    if (!confirm(`Iniciar disparo da campanha?\n\n⏱️ Configurações:\n• Delay entre mensagens: ${messageDelay}s\n• Delay entre números: ${numberDelay}s`)) return;
    
    try {
        await apiCall(`/api/dispatch/start/${campaignName}`, { 
            method: 'POST',
            body: JSON.stringify({ 
                messageDelay: messageDelay * 1000, // Converte para milissegundos
                numberDelay: numberDelay * 1000
            })
        });
        showToast('Disparo iniciado!', 'success');
        document.getElementById('dispatchProgress').style.display = 'block';
    } catch (error) {
        console.error(error);
    }
}

async function pauseDispatch() {
    try {
        await apiCall('/api/dispatch/pause', { method: 'POST' });
        showToast('Disparo pausado', 'warning');
    } catch (error) {
        console.error(error);
    }
}

async function resumeDispatch() {
    try {
        await apiCall('/api/dispatch/resume', { method: 'POST' });
        showToast('Disparo retomado', 'success');
    } catch (error) {
        console.error(error);
    }
}

async function stopDispatch() {
    if (!confirm('Parar disparo completamente?')) return;
    
    try {
        await apiCall('/api/dispatch/stop', { method: 'POST' });
        showToast('Disparo parado', 'info');
    } catch (error) {
        console.error(error);
    }
}

// Socket events for dispatch
socket.on('progress', (data) => {
    // Update progress bar and stats
    const progress = document.getElementById('progressBar');
    const stats = document.getElementById('progressStats');
    
    if (data.campaign) {
        const percent = (data.campaign.currentIndex / data.campaign.stats.total) * 100;
        progress.style.width = `${percent}%`;
        progress.textContent = `${percent.toFixed(0)}%`;
        
        // Estatísticas gerais
        let statsHTML = `
            <div class="stat-item">
                <h4>${data.campaign.stats.sent}</h4>
                <p>Enviadas</p>
            </div>
            <div class="stat-item">
                <h4>${data.campaign.stats.failed}</h4>
                <p>Falhas</p>
            </div>
            <div class="stat-item">
                <h4>${data.campaign.stats.pending}</h4>
                <p>Pendentes</p>
            </div>
        `;
        
        // Estatísticas por instância
        if (data.campaign.instanceStats && Object.keys(data.campaign.instanceStats).length > 0) {
            statsHTML += '<div style="width: 100%; margin-top: 20px; padding-top: 20px; border-top: 2px solid #e0e0e0;"><h4 style="margin-bottom: 15px;">📊 Estatísticas por Instância</h4><div class="instance-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">';
            
            Object.entries(data.campaign.instanceStats).forEach(([sessionId, stats]) => {
                const instanceNumber = sessionId.replace('instance-', '').replace(/^0+/, '');
                const total = stats.sent + stats.failed;
                const successRate = total > 0 ? ((stats.sent / total) * 100).toFixed(1) : 0;
                
                statsHTML += `
                    <div class="instance-stat-card" style="background: #f5f5f5; padding: 15px; border-radius: 8px; border: 2px solid #ddd;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px;">
                                ${instanceNumber}
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 600; color: #333;">Instância ${instanceNumber}</p>
                                <p style="margin: 0; font-size: 0.85em; color: #666;">${total} envios</p>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                            <div>
                                <p style="margin: 0; font-size: 0.9em; color: #666;">✅ Enviadas</p>
                                <p style="margin: 0; font-weight: bold; color: #10b981; font-size: 1.1em;">${stats.sent}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-size: 0.9em; color: #666;">❌ Falhas</p>
                                <p style="margin: 0; font-weight: bold; color: #ef4444; font-size: 1.1em;">${stats.failed}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-size: 0.9em; color: #666;">Taxa</p>
                                <p style="margin: 0; font-weight: bold; color: #3b82f6; font-size: 1.1em;">${successRate}%</p>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            statsHTML += '</div></div>';
        }
        
        stats.innerHTML = statsHTML;
    }
});

socket.on('dispatch-complete', (data) => {
    showToast(`Campanha ${data.campaignName} concluída!`, 'success');
    loadCampaigns();
});

socket.on('dispatch-error', (data) => {
    showToast(`Erro na campanha: ${data.error}`, 'error');
});

// Atualização de contatos em tempo real
socket.on('contacts-updated', (data) => {
    // Atualiza a tabela se estiver visualizando esta campanha
    if (state.currentCampaign && state.currentCampaign.name === data.campaignName) {
        state.currentCampaign.contacts = data.contacts;
        renderContactsTable(state.currentCampaign);
    }
});

// Atualização de status de contato individual
socket.on('contact-status-updated', (data) => {
    if (state.currentCampaign && state.currentCampaign.name === data.campaignName) {
        const contact = state.currentCampaign.contacts.find(c => c.phone === data.phone);
        if (contact) {
            contact.status = data.status;
            contact.statusDetails = data.details;
            if (data.sentAt) contact.sentAt = data.sentAt;
            if (data.receivedAt) contact.receivedAt = data.receivedAt;
            if (data.readAt) contact.readAt = data.readAt;
            if (data.repliedAt) contact.repliedAt = data.repliedAt;
            if (data.error) contact.error = data.error;
            
            // Recarrega detalhes da campanha para atualizar estatísticas
            loadCampaignDetails();
        }
    }
});

// ==== INSTANCES ====

async function loadInstances() {
    try {
        const { instances } = await apiCall('/api/instances');
        state.instances = instances || [];
        
        // Atualiza contador
        if (instances && instances.length > 0) {
            const maxId = Math.max(...instances.map(i => {
                const match = i.id.match(/instance-(\d+)/);
                return match ? parseInt(match[1]) : 0;
            }));
            state.instanceCounter = maxId;
        }
        
        renderInstances();
    } catch (error) {
        console.error('Erro ao carregar instâncias:', error);
        state.instances = []; // Garante array vazio em caso de erro
        renderInstances();
    }
}

async function addInstanceSlot() {
    // Calcula o próximo número sequencial baseado apenas nas instâncias do usuário atual
    let nextNumber = 1;
    
    if (state.instances && state.instances.length > 0) {
        // Pega todos os números existentes das instâncias do usuário
        const existingNumbers = state.instances.map(i => {
            const match = i.id.match(/instance-(\d+)/);
            return match ? parseInt(match[1]) : 0;
        }).filter(n => n > 0);
        
        // Encontra o próximo número disponível sequencialmente
        while (existingNumbers.includes(nextNumber)) {
            nextNumber++;
        }
    }
    
    const instanceId = `instance-${String(nextNumber).padStart(2, '0')}`;
    
    const instanceData = {
        id: instanceId,
        name: `Instância ${nextNumber}`,
        sessionId: null,
        status: 'disconnected',
        phone: null
    };
    
    try {
        const { instance } = await apiCall('/api/instances', {
            method: 'POST',
            body: JSON.stringify(instanceData)
        });
        
        state.instances.push(instance);
        renderInstances();
        showToast('Instância adicionada', 'success');
    } catch (error) {
        console.error('Erro ao adicionar instância:', error);
        showToast('Erro ao adicionar instância: ' + error.message, 'error');
    }
}

function renderInstances() {
    const grid = document.getElementById('instancesGrid');
    
    if (!state.instances || state.instances.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <p>📱 Nenhuma instância encontrada</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    Clique em "+ Adicionar Instância" para começar
                </p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = state.instances.map(inst => {
        // Extrai apenas o número do ID (remove zeros à esquerda)
        const numberMatch = inst.id.match(/instance-0*(\d+)/);
        const number = numberMatch ? numberMatch[1] : inst.id.replace('instance-', '');
        
        const statusInfo = {
            'connected': { icon: '✓', text: 'Conectado', color: 'success' },
            'connecting': { icon: '⟳', text: 'Aguardando conexão', color: 'warning' },
            'disconnected': { icon: '○', text: 'Desconectado', color: 'default' }
        };
        const status = statusInfo[inst.status] || statusInfo.disconnected;
        
        return `
        <div class="instance-card ${inst.status}" id="${inst.id}">
            <div class="instance-number">${number}</div>
            <div class="instance-title">${inst.name}</div>
            <div class="instance-subtitle">Nome da ${inst.name}</div>
            
            ${inst.qrCode ? `
                <div class="instance-qr">
                    <img src="${inst.qrCode}" alt="QR Code">
                </div>
            ` : ''}
            
            <div class="instance-buttons">
                ${inst.status === 'disconnected' || !inst.status ? `
                    <button class="btn btn-success btn-block" onclick="connectInstance('${inst.id}')">
                        📱 Gerar QR Code
                    </button>
                ` : ''}
                ${inst.status === 'connected' ? `
                    <button class="btn btn-success btn-block" disabled>
                        📱 Gerar QR Code
                    </button>
                ` : ''}
                ${inst.status === 'connecting' ? `
                    <button class="btn btn-warning btn-block" onclick="resetInstance('${inst.id}')">
                        🔄 Resetar & Gerar Novo QR
                    </button>
                ` : ''}
                <button class="btn btn-danger btn-block" onclick="disconnectInstance('${inst.id}')" ${inst.status !== 'connected' ? 'disabled' : ''}>
                    📵 Desconectar
                </button>
                <button class="btn btn-danger btn-block" onclick="removeInstance('${inst.id}')" ${inst.status === 'connected' ? 'disabled' : ''}>
                    🗑️ Remover Instância
                </button>
            </div>
            
            <div class="instance-status-box status-${status.color}">
                <span class="status-icon">${status.icon}</span>
                <span>Status da Conexão:</span>
                <strong>${status.text}</strong>
            </div>
        </div>
    `;
    }).join('');
}

async function connectInstance(instanceId) {
    const instance = state.instances.find(i => i.id === instanceId);
    if (!instance) return;
    
    const sessionId = instance.id;
    
    try {
        // Remove QR code antigo
        instance.qrCode = null;
        
        // Atualiza instância no backend
        await apiCall(`/api/instances/${instanceId}`, {
            method: 'PATCH',
            body: JSON.stringify({ sessionId, status: 'connecting' })
        });
        
        instance.sessionId = sessionId;
        instance.status = 'connecting';
        renderInstances();
        
        // Cria sessão WhatsApp com forceNew para garantir novo QR
        await apiCall('/api/session/create', {
            method: 'POST',
            body: JSON.stringify({ sessionId, forceNew: true })
        });
        
        showToast('Aguarde o QR Code...', 'success');
        
        // Timeout de 2 minutos para resetar se não conectar
        setTimeout(async () => {
            const currentInstance = state.instances.find(i => i.id === instanceId);
            if (currentInstance && currentInstance.status === 'connecting') {
                showToast('Timeout de conexão. Resetando instância...', 'warning');
                await resetInstance(instanceId);
            }
        }, 120000);
        
    } catch (error) {
        instance.status = 'disconnected';
        instance.sessionId = null;
        renderInstances();
        showToast('Erro ao conectar: ' + error.message, 'error');
    }
}

async function resetInstance(instanceId) {
    const instance = state.instances.find(i => i.id === instanceId);
    if (!instance) return;
    
    try {
        // Remove sessão existente se houver
        if (instance.sessionId) {
            try {
                await apiCall(`/api/session/${instance.sessionId}`, { method: 'DELETE' });
            } catch (err) {
                // Ignora erro se sessão já foi removida
            }
        }
        
        // Reseta instância
        await apiCall(`/api/instances/${instanceId}`, {
            method: 'PATCH',
            body: JSON.stringify({ 
                status: 'disconnected',
                phone: null,
                sessionId: null
            })
        });
        
        instance.status = 'disconnected';
        instance.phone = null;
        instance.qrCode = null;
        instance.sessionId = null;
        renderInstances();
        
        showToast('Instância resetada. Você pode gerar um novo QR Code agora.', 'success');
    } catch (error) {
        console.error('Erro ao resetar instância:', error);
        showToast('Erro ao resetar: ' + error.message, 'error');
    }
}

async function disconnectInstance(instanceId) {
    const instance = state.instances.find(i => i.id === instanceId);
    if (!instance || !instance.sessionId) return;
    
    if (!confirm('Desconectar esta instância?')) return;
    
    try {
        // Remove sessão WhatsApp
        await apiCall(`/api/session/${instance.sessionId}`, { method: 'DELETE' });
        
        // Atualiza instância no backend
        await apiCall(`/api/instances/${instanceId}`, {
            method: 'PATCH',
            body: JSON.stringify({ 
                status: 'disconnected',
                phone: null,
                sessionId: null
            })
        });
        
        instance.status = 'disconnected';
        instance.phone = null;
        instance.qrCode = null;
        instance.sessionId = null;
        renderInstances();
        showToast('Instância desconectada', 'success');
    } catch (error) {
        console.error(error);
    }
}

async function removeInstance(instanceId) {
    const instance = state.instances.find(i => i.id === instanceId);
    
    if (!instance) {
        showToast('Instância não encontrada', 'error');
        return;
    }
    
    // Não permite remover se estiver conectada
    if (instance.status === 'connected') {
        showToast('Desconecte a instância antes de removê-la', 'warning');
        return;
    }
    
    if (!confirm(`Tem certeza que deseja remover a ${instance.name}?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        // Remove sessão se existir
        if (instance.sessionId) {
            try {
                await apiCall(`/api/session/${instance.sessionId}`, { method: 'DELETE' });
            } catch (err) {
                console.warn('Erro ao remover sessão:', err);
            }
        }
        
        // Remove instância
        await apiCall(`/api/instances/${instanceId}`, { method: 'DELETE' });
        
        // Remove do estado local
        state.instances = state.instances.filter(i => i.id !== instanceId);
        renderInstances();
        
        showToast('Instância removida com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao remover instância:', error);
        showToast('Erro ao remover instância: ' + error.message, 'error');
    }
}

// Socket events for instances
socket.on('qr-code', async (data) => {
    console.log('QR Code recebido:', data);
    const instance = state.instances.find(i => i.sessionId === data.sessionId);
    if (instance) {
        instance.qrCode = data.qrCode;
        instance.status = 'connecting'; // Garante que está em connecting
        renderInstances();
        showToast('QR Code gerado! Escaneie com seu WhatsApp', 'success');
    } else {
        console.warn('Instância não encontrada para sessionId:', data.sessionId);
    }
});

socket.on('session-connected', async (data) => {
    console.log('Sessão conectada:', data);
    const instance = state.instances.find(i => i.sessionId === data.sessionId);
    if (instance) {
        // Atualiza instância no backend
        try {
            await apiCall(`/api/instances/${instance.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ 
                    status: 'connected',
                    phone: data.phone || 'Conectado'
                })
            });
            
            instance.status = 'connected';
            instance.phone = data.phone || 'Conectado';
            instance.qrCode = null;
            renderInstances();
            
            showToast(`✅ Sessão ${data.sessionId} conectada com sucesso!`, 'success');
            loadSessions();
        } catch (error) {
            console.error('Erro ao atualizar instância:', error);
            showToast('Conexão estabelecida, mas erro ao salvar. Atualize a página.', 'warning');
        }
    } else {
        console.warn('Instância não encontrada para sessionId conectado:', data.sessionId);
    }
});

socket.on('session-error', async (data) => {
    console.error('Erro na sessão:', data);
    const instance = state.instances.find(i => i.sessionId === data.sessionId);
    if (instance) {
        instance.status = 'disconnected';
        instance.sessionId = null;
        instance.qrCode = null;
        renderInstances();
        showToast(`Erro na sessão: ${data.error}`, 'error');
    }
});

// ==== SCHEDULE ====

async function loadSchedule() {
    const campaignName = document.getElementById('scheduleCampaign').value;
    
    if (!campaignName) {
        document.getElementById('scheduleForm').style.display = 'none';
        return;
    }
    
    document.getElementById('scheduleForm').style.display = 'block';
    
    try {
        const { schedule, nextRun } = await apiCall(`/api/schedule/${campaignName}`);
        
        // Preenche formulário
        document.getElementById('scheduleEnabled').checked = schedule.enabled;
        document.getElementById('startTime').value = schedule.startTime;
        document.getElementById('pauseTime').value = schedule.pauseTime || '';
        document.getElementById('stopTime').value = schedule.stopTime || '';
        document.getElementById('autoResume').checked = schedule.autoResume;
        
        // Marca dias
        document.querySelectorAll('.day-input').forEach(input => {
            input.checked = schedule.days.includes(parseInt(input.value));
        });
        
        updateSchedulePreview();
        
    } catch (error) {
        // Sem agendamento, limpa formulário
        document.getElementById('scheduleEnabled').checked = false;
        document.getElementById('startTime').value = '09:00';
        document.getElementById('pauseTime').value = '12:00';
        document.getElementById('stopTime').value = '18:00';
        document.getElementById('autoResume').checked = true;
        
        updateSchedulePreview();
    }
}

async function saveSchedule() {
    const campaignName = document.getElementById('scheduleCampaign').value;
    if (!campaignName) {
        showToast('Selecione uma campanha', 'warning');
        return;
    }
    
    const startTime = document.getElementById('startTime').value;
    const pauseTime = document.getElementById('pauseTime').value;
    const stopTime = document.getElementById('stopTime').value;
    
    if (!startTime) {
        showToast('Horário de início é obrigatório', 'warning');
        return;
    }
    
    const days = Array.from(document.querySelectorAll('.day-input:checked'))
        .map(input => parseInt(input.value));
    
    if (days.length === 0) {
        showToast('Selecione pelo menos um dia', 'warning');
        return;
    }
    
    const schedule = {
        enabled: document.getElementById('scheduleEnabled').checked,
        startTime,
        pauseTime: pauseTime || null,
        stopTime: stopTime || null,
        autoResume: document.getElementById('autoResume').checked,
        days
    };
    
    try {
        await apiCall(`/api/schedule/${campaignName}`, {
            method: 'POST',
            body: JSON.stringify(schedule)
        });
        
        showToast('Agendamento salvo com sucesso!', 'success');
        loadSchedulesList();
        
    } catch (error) {
        console.error(error);
    }
}

async function removeSchedule() {
    const campaignName = document.getElementById('scheduleCampaign').value;
    if (!campaignName) return;
    
    if (!confirm('Remover agendamento desta campanha?')) return;
    
    try {
        await apiCall(`/api/schedule/${campaignName}`, { method: 'DELETE' });
        showToast('Agendamento removido', 'success');
        document.getElementById('scheduleForm').style.display = 'none';
        loadSchedulesList();
    } catch (error) {
        console.error(error);
    }
}

async function loadSchedulesList() {
    try {
        const { schedules } = await apiCall('/api/schedule');
        
        const container = document.getElementById('schedulesList');
        
        if (schedules.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum agendamento configurado</p>';
            return;
        }
        
        container.innerHTML = schedules.map(s => {
            const daysNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            const daysText = s.days.map(d => daysNames[d]).join(', ');
            
            return `
                <div class="schedule-item">
                    <div class="schedule-item-header">
                        <h4>${s.campaignName}</h4>
                        <span class="campaign-status status-${s.enabled ? 'running' : 'idle'}">
                            ${s.enabled ? '✅ Ativo' : '⏸️ Pausado'}
                        </span>
                    </div>
                    <div class="schedule-item-times">
                        <div class="time-badge">
                            <span>🕐</span>
                            <span>Início: ${s.startTime}</span>
                        </div>
                        ${s.pauseTime ? `
                            <div class="time-badge">
                                <span>⏸️</span>
                                <span>Pausa: ${s.pauseTime}</span>
                            </div>
                        ` : ''}
                        ${s.stopTime ? `
                            <div class="time-badge">
                                <span>⏹️</span>
                                <span>Parada: ${s.stopTime}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="schedule-item-days">
                        📅 Dias: ${daysText}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error(error);
    }
}

function updateSchedulePreview() {
    const startTime = document.getElementById('startTime').value;
    const pauseTime = document.getElementById('pauseTime').value;
    const stopTime = document.getElementById('stopTime').value;
    const preview = document.getElementById('schedulePreview');
    
    if (!startTime) {
        preview.innerHTML = '';
        return;
    }
    
    let html = `
        <h4>📋 Resumo do Agendamento</h4>
        <div class="schedule-timeline">
            <div class="timeline-item">
                <div class="timeline-icon start">🕐</div>
                <div class="timeline-content">
                    <h5>Início Automático</h5>
                    <p>Campanha inicia às ${startTime}</p>
                </div>
            </div>
    `;
    
    if (pauseTime) {
        html += `
            <div class="timeline-item">
                <div class="timeline-icon pause">⏸️</div>
                <div class="timeline-content">
                    <h5>Pausa Automática</h5>
                    <p>Pausa às ${pauseTime}</p>
                </div>
            </div>
        `;
    }
    
    if (stopTime) {
        html += `
            <div class="timeline-item">
                <div class="timeline-icon stop">⏹️</div>
                <div class="timeline-content">
                    <h5>Parada Automática</h5>
                    <p>Para completamente às ${stopTime}</p>
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    preview.innerHTML = html;
}

// Atualiza preview em tempo real
document.addEventListener('DOMContentLoaded', () => {
    const timeInputs = ['startTime', 'pauseTime', 'stopTime'];
    timeInputs.forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', updateSchedulePreview);
        }
    });
});

// ==== INITIALIZATION ====

document.addEventListener('DOMContentLoaded', () => {
    loadCampaigns();
    loadSessions();
    loadInstances();
    loadSchedulesList();
    
    // Update campaign selects to include schedule
    const originalUpdateSelects = updateCampaignSelects;
    window.updateCampaignSelects = function(campaigns) {
        originalUpdateSelects(campaigns);
        const scheduleSelect = document.getElementById('scheduleCampaign');
        if (scheduleSelect) {
            const current = scheduleSelect.value;
            scheduleSelect.innerHTML = '<option value="">-- Selecione --</option>' +
                campaigns.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            scheduleSelect.value = current;
        }
    };
});
