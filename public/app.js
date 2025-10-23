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
    instanceCounter: 0
};

// ==== UTILITIES ====

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
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

// Socket events
socket.on('qr-code', (data) => {
    const qrContainer = document.getElementById('qrCode');
    qrContainer.innerHTML = `<img src="${data.qrCode}" alt="QR Code">`;
    showToast('QR Code gerado! Escaneie com seu WhatsApp', 'success');
});

socket.on('session-connected', (data) => {
    showToast(`Sessão ${data.sessionId} conectada com sucesso!`, 'success');
    document.getElementById('qrCodeContainer').style.display = 'none';
    document.getElementById('sessionId').value = '';
    
    // Update status
    document.querySelector('#sessionStatus .status-dot').classList.remove('status-offline');
    document.querySelector('#sessionStatus .status-dot').classList.add('status-online');
    document.querySelector('#sessionStatus span:last-child').textContent = 'Conectado';
    
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
        await apiCall('/api/campaign/create', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        
        showToast('Campanha criada com sucesso!', 'success');
        document.getElementById('campaignName').value = '';
        loadCampaigns();
    } catch (error) {
        console.error(error);
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
                <h4>${campaign.stats.failed}</h4>
                <p>Falhas</p>
            </div>
            <div class="stat-item">
                <h4>${campaign.stats.pending}</h4>
                <p>Pendentes</p>
            </div>
        `;
        
        // Numbers
        const numbersContainer = document.getElementById('numbersList');
        if (campaign.numbers.length === 0) {
            numbersContainer.innerHTML = '<p class="empty-state">Nenhum número adicionado</p>';
        } else {
            numbersContainer.innerHTML = campaign.numbers.map((num, idx) => {
                const sent = idx < campaign.currentIndex;
                return `
                    <div class="number-item">
                        <span>${sent ? '✅' : '⏳'} ${num}</span>
                        <button class="btn btn-danger btn-sm" onclick="removeNumber('${num}')">Remover</button>
                    </div>
                `;
            }).join('');
        }
        
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

async function uploadMessages() {
    const file = document.getElementById('messagesFile').files[0];
    const campaignName = document.getElementById('selectedCampaign').value;
    
    if (!file || !campaignName) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_URL}/api/campaign/${campaignName}/upload-messages`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error);
        }
        
        // Mostra modal com detalhes
        showMessagesResult(data);
        
        showToast(`${data.messagesCount} mensagens adicionadas!`, 'success');
        document.getElementById('messagesFile').value = '';
        loadCampaignDetails();
        
    } catch (error) {
        showToast(error.message, 'error');
    }
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

async function removeNumber(phoneNumber) {
    const campaignName = document.getElementById('selectedCampaign').value;
    
    if (!confirm(`Remover número ${phoneNumber}?`)) return;
    
    try {
        await apiCall(`/api/campaign/${campaignName}/number/${encodeURIComponent(phoneNumber)}`, {
            method: 'DELETE'
        });
        
        showToast('Número removido', 'success');
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
    
    if (!campaignName) {
        showToast('Selecione uma campanha', 'warning');
        return;
    }
    
    if (!confirm('Iniciar disparo da campanha?')) return;
    
    try {
        await apiCall(`/api/dispatch/start/${campaignName}`, { method: 'POST' });
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
        
        stats.innerHTML = `
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
    }
});

socket.on('dispatch-complete', (data) => {
    showToast(`Campanha ${data.campaignName} concluída!`, 'success');
    loadCampaigns();
});

socket.on('dispatch-error', (data) => {
    showToast(`Erro na campanha: ${data.error}`, 'error');
});

// ==== INSTANCES ====

async function loadInstances() {
    try {
        const { instances } = await apiCall('/api/instances');
        state.instances = instances;
        
        // Atualiza contador
        if (instances.length > 0) {
            const maxId = Math.max(...instances.map(i => {
                const match = i.id.match(/instance-(\d+)/);
                return match ? parseInt(match[1]) : 0;
            }));
            state.instanceCounter = maxId;
        }
        
        renderInstances();
    } catch (error) {
        console.error('Erro ao carregar instâncias:', error);
    }
}

async function addInstanceSlot() {
    state.instanceCounter++;
    const instanceId = `instance-${state.instanceCounter}`;
    
    const instanceData = {
        id: instanceId,
        name: `Instância ${state.instanceCounter}`,
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
    }
}

function renderInstances() {
    const grid = document.getElementById('instancesGrid');
    
    if (state.instances.length === 0) {
        grid.innerHTML = '<p class="empty-state">Nenhuma instância criada. Clique em "Adicionar Nova Instância" para começar.</p>';
        return;
    }
    
    grid.innerHTML = state.instances.map(inst => `
        <div class="instance-slot ${inst.status}" id="${inst.id}">
            <div class="instance-header">
                <span class="instance-name">${inst.name}</span>
                <span class="instance-status ${inst.status}">
                    ${inst.status === 'connected' ? '✅ Conectado' : 
                      inst.status === 'connecting' ? '🔄 Conectando' : '⚪ Desconectado'}
                </span>
            </div>
            
            ${inst.phone ? `<div class="instance-phone">📱 ${inst.phone}</div>` : ''}
            
            ${inst.qrCode ? `
                <div class="instance-qr">
                    <img src="${inst.qrCode}" alt="QR Code">
                    <p>Escaneie com WhatsApp</p>
                </div>
            ` : ''}
            
            <div class="instance-actions">
                ${inst.status === 'disconnected' ? `
                    <button class="btn btn-primary" onclick="connectInstance('${inst.id}')">
                        Conectar
                    </button>
                ` : ''}
                ${inst.status === 'connected' ? `
                    <button class="btn btn-danger" onclick="disconnectInstance('${inst.id}')">
                        Desconectar
                    </button>
                ` : ''}
                <button class="btn btn-secondary" onclick="removeInstance('${inst.id}')">
                    Remover
                </button>
            </div>
        </div>
    `).join('');
}

async function connectInstance(instanceId) {
    const instance = state.instances.find(i => i.id === instanceId);
    if (!instance) return;
    
    const sessionId = prompt('Digite um ID para esta sessão:', instance.id);
    if (!sessionId) return;
    
    try {
        // Atualiza instância no backend
        await apiCall(`/api/instances/${instanceId}`, {
            method: 'PATCH',
            body: JSON.stringify({ sessionId, status: 'connecting' })
        });
        
        instance.sessionId = sessionId;
        instance.status = 'connecting';
        renderInstances();
        
        // Cria sessão WhatsApp
        await apiCall('/api/session/create', {
            method: 'POST',
            body: JSON.stringify({ sessionId })
        });
        
        showToast('Aguarde o QR Code...', 'success');
        
    } catch (error) {
        instance.status = 'disconnected';
        renderInstances();
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
    if (!confirm('Remover esta instância?')) return;
    
    try {
        await apiCall(`/api/instances/${instanceId}`, { method: 'DELETE' });
        state.instances = state.instances.filter(i => i.id !== instanceId);
        renderInstances();
        showToast('Instância removida', 'success');
    } catch (error) {
        console.error('Erro ao remover instância:', error);
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
