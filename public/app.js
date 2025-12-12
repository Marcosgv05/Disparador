// API Base URL
const API_URL = window.location.origin;

// Socket.IO connection (autenticado com token do Firebase)
const socket = io({
    auth: {
        // Mesmo token usado nas chamadas de API (requireAuth / requireAuth Socket.IO)
        token: localStorage.getItem('firebaseToken') || ''
    }
});

// Logs de debug do WebSocket
socket.on('connect', () => {
    console.log('✅ WebSocket conectado! Socket ID:', socket.id);
});

socket.on('connect_error', (err) => {
    console.error('❌ Erro na conexão WebSocket:', err.message);
});

socket.on('disconnect', (reason) => {
    console.warn('⚠️ WebSocket desconectado:', reason);
});

// Seleciona uma variação individual ao clicar
function selectAiVariation(index) {
    selectedVariationIndex = index;
    const list = document.getElementById('aiVariationsList');
    if (!list) return;

    const items = list.querySelectorAll('.ai-variation-item');
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('ai-variation-item-selected');
        } else {
            item.classList.remove('ai-variation-item-selected');
        }
    });

    // Atualiza o preview WhatsApp com a variação selecionada
    const previewElement = document.getElementById('whatsappPreviewMessage');
    if (previewElement && generatedVariations[index]) {
        const previewText = generatedVariations[index].replace(/\{\{(\w+)\}\}/g, '[$1]');
        previewElement.querySelector('.whatsapp-message-text').textContent = previewText;
    }
}

// Aplica apenas a variação selecionada como mensagem da campanha
async function applySelectedVariation() {
    const campaignName = document.getElementById('selectedCampaign').value;

    if (!campaignName) {
        showToast('Selecione uma campanha primeiro', 'warning');
        return;
    }

    if (selectedVariationIndex === null || !generatedVariations[selectedVariationIndex]) {
        showToast('Selecione uma variação clicando sobre ela', 'warning');
        return;
    }

    const message = generatedVariations[selectedVariationIndex];

    try {
        await apiCall(`/api/campaign/${campaignName}/message`, {
            method: 'POST',
            body: JSON.stringify({ message })
        });

        showToast('Mensagem selecionada adicionada à campanha!', 'success');
        loadCampaignDetails({ preserveTab: true });
    } catch (error) {
        console.error('Erro ao aplicar variação selecionada:', error);
        showToast('Erro ao aplicar variação selecionada', 'error');
    }
}

// Estado global
let state = {
    currentCampaign: null,
    campaigns: [],
    sessions: [],
    instances: [],
    instanceCounter: 0,
    user: null
};

// ==== MODAIS CUSTOMIZADOS ====

// Resolve do modal de input atual
let inputModalResolve = null;
let confirmModalResolve = null;

/**
 * Exibe um modal de input customizado (substitui prompt())
 * @param {string} title - Título do modal
 * @param {string} message - Mensagem/descrição
 * @param {string} defaultValue - Valor padrão do input
 * @param {string} placeholder - Placeholder do input
 * @returns {Promise<string|null>} - Valor digitado ou null se cancelado
 */
function showInputModal(title, message = '', defaultValue = '', placeholder = '') {
    return new Promise((resolve) => {
        inputModalResolve = resolve;

        const modal = document.getElementById('customInputModal');
        const titleEl = document.getElementById('customInputTitle');
        const messageEl = document.getElementById('customInputMessage');
        const inputEl = document.getElementById('customInputField');
        const confirmBtn = document.getElementById('customInputConfirmBtn');

        titleEl.textContent = title;
        messageEl.textContent = message;
        messageEl.style.display = message ? 'block' : 'none';
        inputEl.value = defaultValue;
        inputEl.placeholder = placeholder;

        modal.style.display = 'flex';
        setTimeout(() => inputEl.focus(), 100);

        // Handler para confirmar
        const handleConfirm = () => {
            const value = inputEl.value.trim();
            modal.style.display = 'none';
            if (inputModalResolve) {
                const resolver = inputModalResolve;
                inputModalResolve = null;
                resolver(value || null);
            }
        };

        // Handler para Enter
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            } else if (e.key === 'Escape') {
                closeCustomInputModal();
            }
        };

        // Remove listeners antigos e adiciona novos
        confirmBtn.onclick = handleConfirm;
        inputEl.onkeydown = handleKeydown;
    });
}

function closeCustomInputModal() {
    const modal = document.getElementById('customInputModal');
    modal.style.display = 'none';

    if (inputModalResolve) {
        const resolver = inputModalResolve;
        inputModalResolve = null;
        resolver(null);
    }
}

/**
 * Exibe um modal de confirmação customizado (substitui confirm())
 * @param {string} title - Título do modal
 * @param {string} message - Mensagem de confirmação
 * @param {string} confirmText - Texto do botão de confirmar
 * @param {string} confirmClass - Classe CSS do botão (btn-danger, btn-primary, etc)
 * @returns {Promise<boolean>} - true se confirmado, false se cancelado
 */
function showConfirmModal(title, message, confirmText = 'Confirmar', confirmClass = 'btn-danger') {
    return new Promise((resolve) => {
        confirmModalResolve = resolve;

        const modal = document.getElementById('customConfirmModal');
        const titleEl = document.getElementById('customConfirmTitle');
        const messageEl = document.getElementById('customConfirmMessage');
        const confirmBtn = document.getElementById('customConfirmBtn');

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmText;
        confirmBtn.className = `btn ${confirmClass}`;

        modal.style.display = 'flex';

        // Handler para confirmar
        confirmBtn.onclick = () => {
            modal.style.display = 'none';
            if (confirmModalResolve) {
                const resolver = confirmModalResolve;
                confirmModalResolve = null;
                resolver(true);
            }
        };

        // Handler para Escape
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeCustomConfirmModal();
            }
        };
        document.addEventListener('keydown', handleKeydown, { once: true });
    });
}

function closeCustomConfirmModal() {
    const modal = document.getElementById('customConfirmModal');
    modal.style.display = 'none';

    if (confirmModalResolve) {
        const resolver = confirmModalResolve;
        confirmModalResolve = null;
        resolver(false);
    }
}

// Expõe funções de modal no escopo global para uso em módulos ES6
window.showInputModal = showInputModal;
window.showConfirmModal = showConfirmModal;
window.closeCustomInputModal = closeCustomInputModal;
window.closeCustomConfirmModal = closeCustomConfirmModal;

// Função para fechar o modal genérico
function closeModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
window.closeModal = closeModal;

// Atualiza o status de conexão no cabeçalho (canto superior direito)
function updateHeaderConnectionStatus() {
    const statusEl = document.getElementById('sessionStatus');
    if (!statusEl) return;

    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('span:last-child');

    const hasConnectedInstance =
        (state.instances && state.instances.some(i => i.status === 'connected')) ||
        (state.sessions && state.sessions.length > 0);

    if (hasConnectedInstance) {
        if (dot) {
            dot.classList.remove('status-offline');
            dot.classList.add('status-online');
        }
        if (text) {
            text.textContent = 'Conectado';
        }
    } else {
        if (dot) {
            dot.classList.remove('status-online');
            dot.classList.add('status-offline');
        }
        if (text) {
            text.textContent = 'Desconectado';
        }
    }
}

// ==== AUTENTICAÇÃO ====

// Autenticação agora é gerenciada pelo Firebase
// Ver firebase-auth.js para detalhes

// Carrega dados do usuário do localStorage (já validado pelo Firebase)
const userData = localStorage.getItem('user');
if (userData) {
    state.user = JSON.parse(userData);
}

// ================================
// FUNÇÕES DA ABA CONTEÚDO
// ================================

// Insere variável no textarea de mensagem
function insertVariable(variable) {
    const textarea = document.getElementById('newMessageText');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    textarea.value = text.substring(0, start) + variable + text.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + variable.length, start + variable.length);

    updateWhatsAppPreview();
}

// Atualiza preview do WhatsApp em tempo real
function updateWhatsAppPreview() {
    const textarea = document.getElementById('newMessageText');
    const preview = document.getElementById('whatsappPreviewMessage');
    if (!textarea || !preview) return;

    let message = textarea.value.trim();

    // Verifica se há mídia anexada na campanha atual
    const hasMedia = state.currentCampaign && state.currentCampaign.media;
    let mediaHtml = '';

    if (hasMedia) {
        const media = state.currentCampaign.media;
        const mediaUrl = `/media/${media.mediaFilename}`;

        if (media.type === 'image') {
            mediaHtml = `
                <div class="whatsapp-preview-media">
                    <img src="${mediaUrl}" alt="Mídia anexada" class="whatsapp-preview-image">
                </div>
            `;
        } else if (media.type === 'video') {
            mediaHtml = `
                <div class="whatsapp-preview-media whatsapp-preview-video">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
            `;
        }
    }

    if (!message && !hasMedia) {
        preview.innerHTML = `
            <p class="whatsapp-message-text" style="opacity: 0.5; font-style: italic;">Pré-visualização da mensagem</p>
        `;
        return;
    }

    // Substitui variáveis por exemplos
    if (message) {
        message = message
            .replace(/\{\{nome\}\}/g, 'João Silva')
            .replace(/\{\{telefone\}\}/g, '+55 11 99999-9999')
            .replace(/\{\{custom1\}\}/g, 'valor personalizado');
    }

    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    preview.innerHTML = `
        ${mediaHtml}
        ${message ? `<p class="whatsapp-message-text">${escapeHtml(message)}</p>` : ''}
        <p class="whatsapp-message-time">${time} <span class="whatsapp-check">✓✓</span></p>
    `;
}

// Escapa HTML para prevenir XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// Expõe funções globalmente para uso no HTML
window.updateWhatsAppPreview = updateWhatsAppPreview;
window.insertVariable = insertVariable;

// ================================
// FUNÇÕES DA ABA DISPARO (Console)
// ================================

// Adiciona log no console de execução
function addConsoleLog(message, type = 'success') {
    const console = document.getElementById('dispatchConsole');
    if (!console) return;

    const line = document.createElement('p');
    line.className = `console-line console-${type}`;

    const time = new Date().toLocaleTimeString('pt-BR');
    line.innerHTML = `<span style="color: #64748b; margin-right: 0.5rem;">$</span>[${time}] ${message}`;

    console.appendChild(line);
    console.scrollTop = console.scrollHeight;
}

// Limpa o console
function clearConsole() {
    const console = document.getElementById('dispatchConsole');
    if (!console) return;

    console.innerHTML = `
        <p class="console-line console-muted">Inicializando sistema de disparos v2.4...</p>
        <p class="console-line console-muted">Aguardando comando...</p>
    `;
}

// Atualiza visibilidade dos controles de disparo
function updateDispatchControls(status) {
    const mainControl = document.getElementById('dispatchMainControl');
    const runningControls = document.getElementById('dispatchRunningControls');
    const pausedControls = document.getElementById('dispatchPausedControls');
    const cursor = document.getElementById('consoleCursor');

    if (mainControl) mainControl.style.display = status === 'idle' ? 'block' : 'none';
    if (runningControls) runningControls.style.display = status === 'running' ? 'block' : 'none';
    if (pausedControls) pausedControls.style.display = status === 'paused' ? 'block' : 'none';
    if (cursor) cursor.style.display = status === 'running' ? 'block' : 'none';
}

// Atualiza exibição do último disparo realizado
function updateLastDispatchDisplay() {
    const displayElement = document.getElementById('lastDispatchTime');
    if (!displayElement) return;

    const savedData = localStorage.getItem('lastDispatch');
    if (!savedData) {
        displayElement.textContent = 'Nenhum disparo registrado';
        return;
    }

    try {
        const { campaignName, timestamp } = JSON.parse(savedData);
        const date = new Date(timestamp);

        // Formata a data: "12/12/2025 às 10:30"
        const formattedDate = date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        displayElement.textContent = `${formattedDate} às ${formattedTime} - Campanha: ${campaignName}`;
    } catch (e) {
        displayElement.textContent = 'Nenhum disparo registrado';
    }
}

// Carrega o último disparo ao iniciar a página
document.addEventListener('DOMContentLoaded', () => {
    updateLastDispatchDisplay();
});

// Alterna abas internas da página de campanha (Visão Geral / Audiência / Conteúdo / Disparo)
function setCampaignInnerTab(tabKey) {
    const tabs = document.querySelectorAll('.campaign-inner-tab');
    const panels = document.querySelectorAll('.campaign-tab-panel');

    tabs.forEach(t => {
        if (t.dataset.campaignTab === tabKey) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    panels.forEach(p => {
        if (p.dataset.campaignTabPanel === tabKey) {
            p.style.display = '';
        } else {
            p.style.display = 'none';
        }
    });
}

// Volta para a aba de lista de campanhas
function backToCampaignList() {
    const panel = document.getElementById('dispatch-panel');
    if (!panel) return;

    const listTabName = 'tab-campaigns';
    const listContent = panel.querySelector('#' + listTabName);

    if (listContent) {
        // Desativa qualquer conteúdo atualmente ativo
        panel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        // Ativa a lista de campanhas
        listContent.classList.add('active');
    }
}

function openNumbersFileDialog() {
    const input = document.getElementById('numbersFile');
    if (input) {
        input.click();
    }
}

function focusManualContactForm() {
    openManualContactModal();
}

function openManualContactModal() {
    const modal = document.getElementById('manualContactModal');
    if (!modal) {
        showToast('Área de contatos ainda não está disponível.', 'warning');
        return;
    }

    const nameInput = document.getElementById('manualContactName');
    const phoneInput = document.getElementById('manualContactPhone');
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';

    modal.classList.add('show');

    // Foca o campo de nome após o modal abrir
    setTimeout(() => {
        if (nameInput) {
            nameInput.focus();
        }
    }, 0);
}

function closeManualContactModal() {
    const modal = document.getElementById('manualContactModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// handleLogout é definido no index.html após verificação do Firebase

// ==== UTILITIES ====

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function deleteCampaign(name) {
    let internalName = name;

    // Compatibilidade: se não vier nome, usa o select oculto
    if (!internalName) {
        const select = document.getElementById('selectedCampaign');
        if (!select || !select.value) {
            showToast('Selecione uma campanha para excluir', 'warning');
            return;
        }
        internalName = select.value;
    }

    const campaign = state.campaigns.find(c => c.name === internalName);
    const displayName = campaign?.displayName || internalName;

    const confirmed = await showConfirmModal('Excluir Campanha', `Tem certeza que deseja excluir a campanha "${displayName}"? Esta ação não pode ser desfeita.`, 'Excluir', 'btn-danger');
    if (!confirmed) return;

    try {
        await apiCall(`/api/campaign/${encodeURIComponent(internalName)}`, {
            method: 'DELETE'
        });

        showToast(`Campanha "${displayName}" excluída`, 'success');

        // Atualiza lista de campanhas
        await loadCampaigns();

        // Limpa seleção apenas dos selects que apontarem para essa campanha
        const selects = [
            document.getElementById('selectedCampaign'),
            document.getElementById('dispatchCampaign'),
            document.getElementById('scheduleCampaign')
        ];

        selects.forEach(sel => {
            if (sel && sel.value === internalName) {
                sel.value = '';
            }
        });

        // Reseta estado da campanha atual
        if (state.currentCampaign && state.currentCampaign.name === internalName) {
            state.currentCampaign = null;
        }

        const detailsEl = document.getElementById('campaignDetails');
        if (detailsEl) detailsEl.style.display = 'none';

        const progressEl = document.getElementById('dispatchProgress');
        if (progressEl) progressEl.style.display = 'none';

        renderMessages({ messages: [] });
        const contactsBody = document.getElementById('contactsTableBody');
        if (contactsBody) {
            contactsBody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum contato adicionado</td></tr>';
        }

        updateDispatchStatusUI({ status: 'idle' });

    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao excluir campanha', 'error');
    }
}

async function apiCall(endpoint, options = {}, retryCount = 0) {
    try {
        const token = localStorage.getItem('firebaseToken');
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        });

        // Se token expirou (401), tenta renovar e retentar
        if (response.status === 401 && retryCount === 0) {
            console.log('🔄 Token expirado, renovando...');
            try {
                // Importa dinamicamente o módulo de auth
                const { refreshToken } = await import('./firebase-auth.js');
                await refreshToken();
                // Retenta a requisição com token novo
                return apiCall(endpoint, options, retryCount + 1);
            } catch (refreshError) {
                console.error('❌ Falha ao renovar token:', refreshError);
                showToast('Sessão expirada. Faça login novamente.', 'error');
                setTimeout(() => window.location.href = '/login.html', 2000);
                throw new Error('Token expirado');
            }
        }

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
        // Se o link tem href para outra página, deixa navegar normalmente
        const href = item.getAttribute('href');
        if (href && href !== '#' && !href.startsWith('#')) {
            return; // Não previne o comportamento padrão
        }

        e.preventDefault();
        const sectionId = item.dataset.section;

        if (!sectionId) return; // Se não tem data-section, ignora

        // Update nav
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // Update section
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        const sectionEl = document.getElementById(sectionId);
        sectionEl?.classList.add('active');

        // Se houver uma aba alvo dentro da seção (ex.: Painel de Disparos), ativa essa aba
        const targetTab = item.dataset.tab;
        if (targetTab && sectionEl) {
            const tabBtn = sectionEl.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
            if (tabBtn) {
                tabBtn.click();
            }
        }

        // Se houver alvo de scroll interno (ex.: área de analytics no dashboard), rola até ele
        const scrollTarget = item.dataset.scroll;
        if (scrollTarget) {
            const targetEl = document.querySelector(scrollTarget);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });
});

// Tabs (painéis principais do painel de disparos)
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
    console.log('🔔 Evento session-connected recebido:', data);
    const instance = state.instances.find(i => i.sessionId === data.sessionId);
    console.log('🔍 Instância encontrada:', instance);

    if (instance) {
        // Atualiza instância no backend
        try {
            console.log('📡 Atualizando instância no backend...', instance.id);
            await apiCall(`/api/instances/${instance.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'connected',
                    phone: data.phone || 'Conectado'
                })
            });
            console.log('Instância atualizada no backend com sucesso');
        } catch (error) {
            console.error('❌ Erro ao atualizar instância:', error);
            showToast('Conexão estabelecida, mas erro ao salvar. Atualize a página.', 'warning');
        }

        instance.status = 'connected';
        instance.phone = data.phone || 'Conectado';
        instance.qrCode = null;
        console.log('🎨 Renderizando instâncias...');
        renderInstances();
        updateHeaderConnectionStatus();
        showToast(`Sessão ${data.sessionId} conectada com sucesso.`, 'success');
    } else {
        console.warn('Instância não encontrada para sessionId:', data.sessionId);
        console.log('Instâncias disponíveis:', state.instances.map(i => i.sessionId));
    }
    loadSessions();
});

async function loadSessions() {
    try {
        const { sessions } = await apiCall('/api/session/list');
        state.sessions = sessions;

        const container = document.getElementById('sessionsItems');
        // Em algumas telas o container de sessões pode não existir.
        // Nesse caso, apenas atualizamos o estado e o cabeçalho sem tentar
        // escrever no DOM para não quebrar o restante do script.
        if (container) {
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
        }
        updateHeaderConnectionStatus();
    } catch (error) {
        console.error(error);
    }
}

async function removeSession(sessionId) {
    const confirmed = await showConfirmModal('Remover Sessão', 'Deseja realmente remover esta sessão?', 'Remover', 'btn-danger');
    if (!confirmed) return;

    try {
        await apiCall(`/api/session/${sessionId}`, { method: 'DELETE' });
        showToast('Sessão removida', 'success');
        await loadSessions();
        updateHeaderConnectionStatus();
    } catch (error) {
        console.error(error);
    }
}

// ==== CAMPAIGNS ====

// Abre modal bonito para criar campanha
function openCreateCampaignModal() {
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = 'Criar nova campanha';
    body.innerHTML = `
        <form id="createCampaignForm" style="display: flex; flex-direction: column; gap: 14px;">
            <div>
                <label>Nome da Campanha</label>
                <input type="text" id="newCampaignName" class="form-control" placeholder="Ex: Black Friday VIP" required>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-light); margin: 0;">
                O nome é usado apenas internamente para identificar esta campanha.
            </p>
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary">Criar</button>
            </div>
        </form>
    `;
    // Aplica estilo compacto para este modal específico
    modal.classList.add('show', 'modal-small');
    const footer = modal.querySelector('.modal-footer');
    if (footer) footer.style.display = 'none';

    const form = document.getElementById('createCampaignForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('newCampaignName').value.trim();
        if (!name) {
            showToast('Digite um nome para a campanha', 'warning');
            return;
        }
        await createCampaign(name);
        closeModal();
    };
}

// Cria campanha a partir de um nome já validado
async function createCampaign(name) {
    if (!name) {
        // Se nenhum nome foi passado, abre o modal para o usuário informar
        openCreateCampaignModal();
        return;
    }

    const nameInput = document.getElementById('campaignName');

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
                <div>
                    <strong>Campanha criada.</strong>
                    <p>"${campaign.displayName || campaign.name}" já está disponível na lista.</p>
                </div>
            `;
            statusBox.style.display = 'flex';
        }

        showToast(`Campanha "${campaign.displayName || campaign.name}" criada com sucesso.`, 'success');

        if (nameInput) {
            nameInput.value = '';
        }
        await loadCampaigns();
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
    // Campanhas ativas: consideramos apenas as que estão em execução
    const activeCampaigns = campaigns.filter(c => c.status === 'running');
    document.getElementById('dashCampaigns').textContent = activeCampaigns.length;

    let totalSent = 0;
    let totalNumbers = 0;

    campaigns.forEach(c => {
        totalSent += c.stats.sent;
        totalNumbers += c.numbers.length;
    });

    document.getElementById('dashSent').textContent = totalSent;
    document.getElementById('dashNumbers').textContent = totalNumbers;

    // Atualiza painel de campanhas recentes com base nas campanhas do usuário
    renderRecentCampaignsFromState(campaigns);
}

// Renderiza lista de campanhas recentes no dashboard usando campanhas em memória
function renderRecentCampaignsFromState(campaigns) {
    const recentContainer = document.getElementById('recentCampaigns');
    if (!recentContainer) return;

    if (!campaigns || campaigns.length === 0) {
        recentContainer.innerHTML = '<p class="empty-state">Nenhuma campanha recente</p>';
        return;
    }

    // Ordena por data de criação (mais recente primeiro)
    const sorted = [...campaigns].sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
    });

    const statusConfig = {
        running: { label: 'Executando', pillClass: 'dashboard-status-running' },
        paused: { label: 'Pausada', pillClass: 'dashboard-status-paused' },
        completed: { label: 'Concluída', pillClass: 'dashboard-status-completed' },
        stopped: { label: 'Parada', pillClass: 'dashboard-status-idle' },
        idle: { label: 'Inativa', pillClass: 'dashboard-status-idle' }
    };

    recentContainer.innerHTML = sorted.slice(0, 5).map(c => {
        const name = c.displayName || c.name || 'Campanha';
        const createdAt = c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '';
        const statusKey = (c.status || 'idle').toLowerCase();
        const cfg = statusConfig[statusKey] || statusConfig.idle;
        return `
            <div class="dashboard-recent-item">
                <div class="dashboard-recent-main">
                    <span class="dashboard-recent-title">${name}</span>
                    <span class="dashboard-recent-meta">${createdAt}</span>
                </div>
                <span class="dashboard-status-pill ${cfg.pillClass}">${cfg.label}</span>
            </div>
        `;
    }).join('');
}

function updateCampaignSelects(campaigns) {
    const selects = [
        document.getElementById('selectedCampaign'),
        // dispatchCampaign pode não existir mais no HTML; mantemos aqui apenas por compatibilidade
        document.getElementById('dispatchCampaign')
    ];

    selects.forEach(select => {
        if (!select) return; // ignora selects inexistentes para não quebrar o carregamento

        const current = select.value;
        select.innerHTML = '<option value="">-- Selecione --</option>' +
            campaigns.map(c => `<option value="${c.name}">${c.displayName || c.name}</option>`).join('');
        select.value = current;
    });

    // Atualiza lista lateral de campanhas, se existir
    renderCampaignSidebar(campaigns);
}

// Lista lateral de campanhas no painel
function renderCampaignSidebar(campaigns) {
    const container = document.getElementById('campaignListSidebar');
    if (!container) return;

    if (!campaigns || campaigns.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma campanha criada ainda</p>';
        const details = document.getElementById('campaignDetails');
        if (details) details.style.display = 'none';
        return;
    }

    const statusConfig = {
        running: { label: 'Executando', pillClass: 'campaign-status-running' },
        paused: { label: 'Pausada', pillClass: 'campaign-status-paused' },
        completed: { label: 'Concluída', pillClass: 'campaign-status-completed' },
        stopped: { label: 'Parada', pillClass: 'campaign-status-stopped' },
        idle: { label: 'Aguardando', pillClass: 'campaign-status-idle' }
    };

    const rowsHtml = campaigns.map(c => {
        const internalName = c.name || '';
        const displayName = c.displayName || internalName || 'Campanha';
        const createdAt = c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '-';
        const total = c.stats?.total ?? 0;
        const sent = c.stats?.sent ?? 0;
        const progressPct = total > 0 ? Math.round((sent / total) * 100) : 0;

        const statusKey = (c.status || 'idle').toLowerCase();
        const cfg = statusConfig[statusKey] || statusConfig.idle;

        return `
            <div class="campaign-row" onclick="openCampaignManagement('${internalName}')">
                <div class="campaign-cell campaign-cell-name">
                    <div class="campaign-name">${displayName}</div>
                    <div class="campaign-subtitle">${internalName}</div>
                </div>
                <div class="campaign-cell campaign-cell-status">
                    <span class="campaign-status-pill ${cfg.pillClass}">${cfg.label}</span>
                </div>
                <div class="campaign-cell campaign-cell-progress">
                    <div class="campaign-progress-text">${sent}/${total}</div>
                    <div class="campaign-progress-bar">
                        <div class="campaign-progress-bar-inner" style="width: ${progressPct}%;"></div>
                    </div>
                </div>
                <div class="campaign-cell campaign-cell-date">
                    ${createdAt}
                </div>
                <div class="campaign-cell campaign-cell-actions">
                    <button class="btn btn-primary btn-sm campaign-manage-btn" onclick="event.stopPropagation(); openCampaignManagement('${internalName}')">
                        Gerenciar
                    </button>
                    <button class="btn btn-danger btn-sm campaign-delete-btn" onclick="event.stopPropagation(); deleteCampaign('${internalName}')">
                        Excluir
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="campaigns-table-header">
            <div class="campaigns-table-title">Nome</div>
            <div class="campaigns-table-title">Status</div>
            <div class="campaigns-table-title">Progresso</div>
            <div class="campaigns-table-title">Criado em</div>
            <div class="campaigns-table-title">Ações</div>
        </div>
        <div class="campaigns-table-body">
            ${rowsHtml}
        </div>
    `;
}

// Abre o gerenciamento da campanha a partir da tabela
function openCampaignManagement(name) {
    const select = document.getElementById('selectedCampaign');
    if (select) {
        select.value = name;
    }

    // Carrega detalhes e muda para aba de detalhes
    loadCampaignDetails().then(() => {
        const dispatchPanel = document.getElementById('dispatch-panel');
        if (!dispatchPanel) return;

        const tabName = 'tab-campaign-details';
        const targetContent = dispatchPanel.querySelector('#' + tabName);
        const targetBtn = dispatchPanel.querySelector('.tab-btn[data-tab="' + tabName + '"]');

        if (targetBtn) {
            targetBtn.classList.remove('tab-hidden');
        }

        if (targetContent) {
            // Atualiza estados das abas dentro do painel de disparos
            dispatchPanel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            if (targetBtn) targetBtn.classList.add('active');

            dispatchPanel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            targetContent.classList.add('active');
        }
    });
}

function selectCampaignFromSidebar(name) {
    openCampaignManagement(name);
}

// Renderiza gráfico de atividade da campanha (últimos 5 dias)
function renderCampaignActivityChart(campaign) {
    const chartContainer = document.getElementById('campaignActivityChart');
    if (!chartContainer) return;

    if (!campaign.contacts || campaign.contacts.length === 0) {
        chartContainer.innerHTML = '<p class="analytics-chart-empty">Nenhuma atividade registrada para esta campanha.</p>';
        return;
    }

    // Agrupa contatos por data (últimos 5 dias)
    const dailyDataMap = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    campaign.contacts.forEach(contact => {
        const sentDate = contact.sentAt ? new Date(contact.sentAt).toISOString().split('T')[0] : null;
        const repliedDate = contact.repliedAt ? new Date(contact.repliedAt).toISOString().split('T')[0] : null;

        if (sentDate) {
            if (!dailyDataMap.has(sentDate)) {
                dailyDataMap.set(sentDate, { messages_sent: 0, messages_replied: 0 });
            }
            dailyDataMap.get(sentDate).messages_sent++;
        }

        if (repliedDate) {
            if (!dailyDataMap.has(repliedDate)) {
                dailyDataMap.set(repliedDate, { messages_sent: 0, messages_replied: 0 });
            }
            dailyDataMap.get(repliedDate).messages_replied++;
        }
    });

    // Monta série contínua de 5 dias
    const fullSeries = [];
    for (let i = 4; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split('T')[0];
        const stats = dailyDataMap.get(key) || { messages_sent: 0, messages_replied: 0 };
        fullSeries.push({
            date: key,
            messages_sent: stats.messages_sent || 0,
            messages_replied: stats.messages_replied || 0
        });
    }

    // Renderiza gráfico com a mesma lógica do dashboard
    const limited = fullSeries.slice(-5);
    const maxValue = Math.max(...limited.map(d => Math.max(d.messages_sent || 0, d.messages_replied || 0)), 1);

    // Dimensões do gráfico - calcula baseado no tamanho real do contêiner visível
    // Busca hierarquia de elementos pais até encontrar um com largura válida
    let parentElement = chartContainer.closest('.campaign-detail-overview')
        || chartContainer.closest('.campaign-card.full')
        || chartContainer.closest('.campaign-activity-card')
        || chartContainer.parentElement;

    // Busca um pai com largura válida (> 400px)
    let containerWidth = 400;
    let el = parentElement;
    while (el && el !== document.body) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 500) {
            containerWidth = rect.width;
            break;
        }
        el = el.parentElement;
    }

    const width = Math.max(containerWidth - 48, 400); // desconta padding, mínimo 400
    const height = 180;
    const padding = { top: 20, right: 10, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const innerMarginX = 22;
    const innerWidth = chartWidth - innerMarginX * 2;

    // Pontos enviadas
    const sentPoints = limited.map((d, i) => {
        const x = padding.left + innerMarginX + (limited.length === 1 ? innerWidth / 2 : (i / (limited.length - 1)) * innerWidth);
        const y = padding.top + chartHeight - ((d.messages_sent || 0) / maxValue) * chartHeight;
        return { x, y, value: d.messages_sent || 0, date: d.date };
    });

    // Pontos respondidas
    const repliedPoints = limited.map((d, i) => {
        const x = padding.left + innerMarginX + (limited.length === 1 ? innerWidth / 2 : (i / (limited.length - 1)) * innerWidth);
        const y = padding.top + chartHeight - ((d.messages_replied || 0) / maxValue) * chartHeight;
        return { x, y, value: d.messages_replied || 0, date: d.date };
    });

    // Path suave
    const createSmoothPath = (points) => {
        if (points.length === 0) return '';
        if (points.length === 1) {
            return `M ${points[0].x} ${points[0].y}`;
        }
        return points.map((p, i) => {
            if (i === 0) return `M ${p.x} ${p.y}`;
            const prev = points[i - 1];
            const cp1x = prev.x + (p.x - prev.x) / 2;
            const cp1y = prev.y;
            const cp2x = prev.x + (p.x - prev.x) / 2;
            const cp2y = p.y;
            return `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
        }).join(' ');
    };

    const sentPath = createSmoothPath(sentPoints);
    const repliedPath = createSmoothPath(repliedPoints);
    const sentArea = `${sentPath} L ${sentPoints[sentPoints.length - 1].x} ${height - padding.bottom} L ${sentPoints[0].x} ${height - padding.bottom} Z`;

    // Grid
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = padding.top + chartHeight * (1 - pct);
        const value = Math.round(maxValue * pct);
        return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#27272a" stroke-dasharray="3 3"/>
                <text x="${padding.left - 8}" y="${y + 4}" fill="#71717a" font-size="10" text-anchor="end">${value}</text>`;
    }).join('');

    // Labels X
    const xLabels = limited.map((d, i) => {
        if (limited.length <= 7 || i === 0 || i === limited.length - 1 || i % Math.ceil(limited.length / 5) === 0) {
            const baseX = padding.left + innerMarginX + (limited.length === 1 ? innerWidth / 2 : (i / (limited.length - 1)) * innerWidth);
            const iso = d.date || '';
            let label = '';
            if (iso.length >= 10) {
                const day = iso.slice(8, 10);
                const month = iso.slice(5, 7);
                label = `${day}/${month}`;
            }

            let x = baseX;
            let anchor = 'middle';
            const margin = 8;
            if (i === 0) {
                anchor = 'start';
                x = Math.max(padding.left + margin, baseX);
            } else if (i === limited.length - 1) {
                anchor = 'end';
                x = Math.min(width - margin, baseX);
            }

            return `<text x="${x}" y="${height - 8}" fill="#71717a" font-size="10" text-anchor="${anchor}">${label}</text>`;
        }
        return '';
    }).join('');

    // Pontos
    const sentPointsHtml = sentPoints.map(p =>
        `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#6366f1" stroke="#1e1b4b" stroke-width="2" class="chart-hover-point">
            <title>${p.value} enviadas em ${p.date}</title>
        </circle>`
    ).join('');

    const repliedPointsHtml = repliedPoints.map(p =>
        `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#10b981" stroke="#047857" stroke-width="2" class="chart-hover-point">
            <title>${p.value} respondidas em ${p.date}</title>
        </circle>`
    ).join('');

    const svgHtml = `
        <div class="analytics-chart-inner">
            <svg class="analytics-area-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <defs>
                    <linearGradient id="sentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="5%" stop-color="#6366f1" stop-opacity="0.3"/>
                        <stop offset="95%" stop-color="#6366f1" stop-opacity="0"/>
                    </linearGradient>
                </defs>
                ${gridLines}
                <path d="${sentArea}" fill="url(#sentGradient)"/>
                <path d="${sentPath}" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="${repliedPath}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                ${sentPointsHtml}
                ${repliedPointsHtml}
                ${xLabels}
            </svg>
            <div class="analytics-chart-legend">
                <div class="analytics-legend-item">
                    <span class="analytics-legend-color analytics-legend-sent"></span>
                    <span class="analytics-legend-label">Enviadas</span>
                </div>
                <div class="analytics-legend-item">
                    <span class="analytics-legend-color analytics-legend-replied"></span>
                    <span class="analytics-legend-label">Respondidas</span>
                </div>
            </div>
        </div>
    `;

    chartContainer.innerHTML = svgHtml;
}

async function loadCampaignDetails(options = {}) {
    const { preserveTab = false } = options;
    const name = document.getElementById('selectedCampaign').value;

    if (!name) {
        document.getElementById('campaignDetails').style.display = 'none';
        return;
    }

    try {
        const { campaign } = await apiCall(`/api/campaign/${name}`);
        state.currentCampaign = campaign;

        document.getElementById('campaignDetails').style.display = 'block';
        // Só volta para a aba "Visão Geral" se não estiver preservando a aba atual
        if (!preserveTab && typeof setCampaignInnerTab === 'function') {
            setCampaignInnerTab('overview');
        }

        // Atualiza título/subtítulo da aba de detalhes com o nome da campanha
        const detailsTitle = document.getElementById('campaignDetailsTitle');
        const detailsSubtitle = document.getElementById('campaignDetailsSubtitle');
        const statusPill = document.getElementById('campaignDetailsStatusPill');
        const createdLabel = document.getElementById('campaignDetailsCreated');

        const displayName = campaign.displayName || campaign.name || 'Campanha selecionada';
        if (detailsTitle) {
            detailsTitle.textContent = displayName;
        }
        if (detailsSubtitle) {
            detailsSubtitle.textContent = 'Gerencie números, mensagens, status e contatos da campanha "' + displayName + '".';
        }

        // Meta (status + data de criação)
        const statusKey = (campaign.status || 'idle').toLowerCase();
        const statusConfig = {
            running: { label: 'Em execução', pillClass: 'campaign-status-running' },
            paused: { label: 'Pausada', pillClass: 'campaign-status-paused' },
            completed: { label: 'Concluída', pillClass: 'campaign-status-completed' },
            stopped: { label: 'Parada', pillClass: 'campaign-status-stopped' },
            idle: { label: 'Pronta', pillClass: 'campaign-status-idle' }
        };
        const statusInfo = statusConfig[statusKey] || statusConfig.idle;

        {
            statusPill.style.display = '';
            statusPill.textContent = statusInfo.label;
            statusPill.className = `campaign-status-pill ${statusInfo.pillClass}`;
        }

        if (createdLabel) {
            if (campaign.createdAt) {
                const createdDate = new Date(campaign.createdAt);
                if (!Number.isNaN(createdDate.getTime())) {
                    createdLabel.textContent = `Criada em ${createdDate.toLocaleDateString('pt-BR')}`;
                } else {
                    createdLabel.textContent = '';
                }
            } else {
                createdLabel.textContent = '';
            }
        }

        // Atualiza destaque da lista lateral
        renderCampaignSidebar(state.campaigns);

        // Stats (cards principais no topo)
        const statsContainer = document.getElementById('campaignStats');
        if (statsContainer) {
            const totalContacts = (campaign.stats && typeof campaign.stats.total === 'number')
                ? campaign.stats.total
                : (Array.isArray(campaign.contacts) ? campaign.contacts.length : 0);
            const delivered = (campaign.stats && typeof campaign.stats.sent === 'number')
                ? campaign.stats.sent
                : 0;
            const replies = (campaign.stats && typeof campaign.stats.replied === 'number')
                ? campaign.stats.replied
                : 0;
            const failures = (campaign.stats && typeof campaign.stats.failed === 'number')
                ? campaign.stats.failed
                : 0;

            statsContainer.innerHTML = `
                <div class="stat-item">
                    <h4>${totalContacts}</h4>
                    <p>Total contatos</p>
                </div>
                <div class="stat-item">
                    <h4>${delivered}</h4>
                    <p>Entregues</p>
                </div>
                <div class="stat-item">
                    <h4>${replies}</h4>
                    <p>Respostas</p>
                </div>
                <div class="stat-item">
                    <h4>${failures}</h4>
                    <p>Falhas</p>
                </div>
            `;
        }

        // Render Contacts Table
        renderContactsTable(campaign);

        // Render Messages List
        renderMessages(campaign);

        // Render Linked Instances
        renderLinkedInstances();

        // Render Campaign Activity Chart (últimos 5 dias)
        renderCampaignActivityChart(campaign);

        // Carrega configuração de agendamento da campanha
        loadScheduleConfig();

        // Mostra preview de mídia global se existir
        showGlobalMediaPreview(campaign.media);

        // Verifica status do dispatch para atualizar controles
        checkDispatchStatus();

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
        let token = localStorage.getItem('firebaseToken');

        let response = await fetch(`${API_URL}/api/campaign/${campaignName}/upload-numbers`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        // Se o token estiver expirado, tenta renovar uma vez
        if (response.status === 401) {
            try {
                const { refreshToken } = await import('./firebase-auth.js');
                token = await refreshToken();

                response = await fetch(`${API_URL}/api/campaign/${campaignName}/upload-numbers`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
            } catch (refreshError) {
                console.error('Erro ao renovar token para upload de números:', refreshError);
                showToast('Sessão expirada. Faça login novamente.', 'error');
                setTimeout(() => window.location.href = '/login.html', 2000);
                throw new Error('Token expirado');
            }
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao enviar planilha de números');
        }

        // Mostra modal com detalhes
        showNumbersResult(data);

        showToast(`${data.validation.valid} números adicionados!`, 'success');

        document.getElementById('numbersFile').value = '';
        loadCampaignDetails({ preserveTab: true });

    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function addManualContact() {
    const campaignName = document.getElementById('selectedCampaign').value;
    const nameInput = document.getElementById('manualContactName');
    const phoneInput = document.getElementById('manualContactPhone');

    if (!campaignName) {
        showToast('Selecione uma campanha na lista antes de adicionar contatos.', 'warning');
        return;
    }

    if (!phoneInput) {
        return;
    }

    const contactName = nameInput ? nameInput.value.trim() : '';
    const rawPhone = phoneInput.value.trim();

    if (!rawPhone) {
        showToast('Informe o telefone do contato.', 'warning');
        phoneInput.focus();
        return;
    }

    const cleanedPhone = rawPhone.replace(/\D/g, '');
    if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
        showToast('Telefone inválido. Use DDD + número (10 a 15 dígitos).', 'warning');
        phoneInput.focus();
        return;
    }

    try {
        await apiCall(`/api/campaign/${encodeURIComponent(campaignName)}/add-contact`, {
            method: 'POST',
            body: JSON.stringify({
                contactName: contactName || null,
                phone: cleanedPhone
            })
        });

        showToast('Contato adicionado à campanha!', 'success');
        if (nameInput) nameInput.value = '';
        phoneInput.value = '';
        closeManualContactModal();
        loadCampaignDetails({ preserveTab: true });
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao adicionar contato', 'error');
    }
}

function showNumbersResult(data) {
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = 'Números carregados';

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
            html += `<div class="result-item valid">${num}</div>`;
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
            html += `<div class="result-item invalid">${num}</div>`;
        });

        html += `</div>`;
    }

    html += `</div>`;

    body.innerHTML = html;
    modal.classList.add('show');
}

function closeModal() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('show', 'modal-small');
    modal.style.display = '';
    const footer = modal.querySelector('.modal-footer');
    if (footer) footer.style.display = '';
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
        loadCampaignDetails({ preserveTab: true });

    } catch (error) {
        console.error(error);
    }
}

// ==== UPLOAD DE MÍDIA GLOBAL ====

function openMediaUpload() {
    const campaignName = document.getElementById('selectedCampaign').value;

    if (!campaignName) {
        showToast('Selecione uma campanha primeiro', 'warning');
        return;
    }

    const input = document.getElementById('mediaUploadInput');
    if (input) {
        input.click();
    }
}

async function uploadMedia() {
    const input = document.getElementById('mediaUploadInput');
    const campaignName = document.getElementById('selectedCampaign').value;

    if (!input.files || !input.files[0]) return;

    const file = input.files[0];

    // Verifica tamanho do arquivo (máx 16MB)
    if (file.size > 16 * 1024 * 1024) {
        showToast('Arquivo muito grande. Máximo: 16MB', 'error');
        input.value = '';
        return;
    }

    // Verifica tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        showToast('Tipo de arquivo não suportado. Use imagens ou vídeos.', 'error');
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('media', file);

    try {
        const token = localStorage.getItem('firebaseToken');

        const response = await fetch(`${API_URL}/api/campaign/${campaignName}/media`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao fazer upload');
        }

        const mediaType = file.type.startsWith('image/') ? 'Imagem' : 'Vídeo';
        showToast(`${mediaType} anexado! Será enviado com todas as mensagens.`, 'success');

        // Atualiza o state
        if (state.currentCampaign) {
            state.currentCampaign.media = data.media;
        }

        // Mostra o preview
        showGlobalMediaPreview(data.media);

        // Adiciona log no console
        addConsoleLog(`${mediaType} "${file.name}" anexado à campanha`, 'success');

    } catch (error) {
        console.error('Erro ao fazer upload de mídia:', error);
        showToast(error.message || 'Erro ao fazer upload', 'error');
    }

    input.value = '';
}

function showGlobalMediaPreview(media) {
    const previewContainer = document.getElementById('globalMediaPreview');
    const previewContent = document.getElementById('mediaPreviewContent');

    if (!previewContainer || !previewContent) return;

    if (!media) {
        previewContainer.style.display = 'none';
        return;
    }

    const mediaUrl = `/media/${media.mediaFilename}`;

    if (media.type === 'image') {
        previewContent.innerHTML = `
            <img src="${mediaUrl}" alt="Preview" class="global-media-thumb" onclick="window.open('${mediaUrl}', '_blank')">
            <span class="media-name">${media.originalName || media.mediaFilename}</span>
        `;
    } else {
        previewContent.innerHTML = `
            <div class="global-video-thumb" onclick="window.open('${mediaUrl}', '_blank')">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </div>
            <span class="media-name">${media.originalName || media.mediaFilename}</span>
        `;
    }

    previewContainer.style.display = 'block';

    // Atualiza também o preview do WhatsApp para mostrar a mídia
    updateWhatsAppPreview();
}

async function removeGlobalMedia() {
    const campaignName = document.getElementById('selectedCampaign').value;

    if (!campaignName) return;

    const confirmed = await showConfirmModal(
        'Remover Mídia',
        'Tem certeza que deseja remover a mídia anexada? Ela não será mais enviada com as mensagens.',
        'Remover',
        'btn-danger'
    );

    if (!confirmed) return;

    try {
        await apiCall(`/api/campaign/${campaignName}/media`, {
            method: 'DELETE'
        });

        // Atualiza o state
        if (state.currentCampaign) {
            delete state.currentCampaign.media;
        }

        // Esconde o preview
        const previewContainer = document.getElementById('globalMediaPreview');
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }

        showToast('Mídia removida', 'success');
        addConsoleLog('Mídia removida da campanha', 'muted');

        // Atualiza o preview do WhatsApp para remover a mídia
        updateWhatsAppPreview();

    } catch (error) {
        console.error('Erro ao remover mídia:', error);
        showToast('Erro ao remover mídia', 'error');
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
        loadCampaignDetails({ preserveTab: true });

    } catch (error) {
        console.error(error);
        showToast('Erro ao adicionar mensagens', 'error');
    }
}

async function removeMessage(campaignName, index) {
    const confirmed = await showConfirmModal('Remover Mensagem', 'Tem certeza que deseja remover esta mensagem?', 'Remover', 'btn-danger');
    if (!confirmed) return;

    try {
        await apiCall(`/api/campaign/${campaignName}/message/${index}`, {
            method: 'DELETE'
        });

        showToast('Mensagem removida', 'success');
        loadCampaignDetails({ preserveTab: true });

    } catch (error) {
        console.error(error);
    }
}

async function clearMessages() {
    const campaignName = document.getElementById('selectedCampaign').value;

    if (!campaignName) {
        showToast('Selecione uma campanha', 'warning');
        return;
    }

    const confirmed = await showConfirmModal(
        'Remover todas as mensagens',
        'Tem certeza que deseja remover TODAS as mensagens salvas desta campanha? Esta ação não pode ser desfeita.',
        'Remover todas',
        'btn-danger'
    );
    if (!confirmed) return;

    try {
        await apiCall(`/api/campaign/${campaignName}/messages`, {
            method: 'DELETE'
        });

        showToast('Todas as mensagens foram removidas.', 'success');
        loadCampaignDetails({ preserveTab: true });
    } catch (error) {
        console.error(error);
        showToast('Erro ao remover mensagens', 'error');
    }
}

// ==== EDITAR MENSAGEM ====

async function editMessage(campaignName, index) {
    // Obtém a mensagem atual
    const campaign = state.currentCampaign;
    if (!campaign || !campaign.messages || !campaign.messages[index]) {
        showToast('Mensagem não encontrada', 'error');
        return;
    }

    const currentMessage = campaign.messages[index];

    // Se for mídia, não permite edição por enquanto
    if (typeof currentMessage === 'object' && currentMessage.type) {
        showToast('Para editar mídia, remova e adicione novamente', 'warning');
        return;
    }

    // Mostra modal de edição
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const footer = document.getElementById('modalFooter');

    title.textContent = 'Editar Mensagem';
    body.innerHTML = `
        <div class="form-group">
            <label>Mensagem</label>
            <textarea id="editMessageText" class="input message-textarea-large" rows="6">${escapeHtml(currentMessage)}</textarea>
        </div>
    `;

    footer.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveEditedMessage('${campaignName}', ${index})">Salvar</button>
    `;

    modal.style.display = 'flex';
}

async function saveEditedMessage(campaignName, index) {
    const textarea = document.getElementById('editMessageText');
    const newMessage = textarea.value.trim();

    if (!newMessage) {
        showToast('A mensagem não pode estar vazia', 'warning');
        return;
    }

    try {
        await apiCall(`/api/campaign/${campaignName}/message/${index}`, {
            method: 'PUT',
            body: JSON.stringify({ message: newMessage })
        });

        showToast('Mensagem atualizada!', 'success');
        closeModal();
        loadCampaignDetails({ preserveTab: true });

    } catch (error) {
        console.error(error);
        showToast('Erro ao atualizar mensagem', 'error');
    }
}

// Expõe funções globalmente para uso no HTML
window.editMessage = editMessage;
window.saveEditedMessage = saveEditedMessage;

function renderMessages(campaign) {
    const container = document.getElementById('messagesList');

    // Filtra apenas mensagens de texto (ignora objetos de mídia antigos)
    const textMessages = (campaign.messages || []).filter(msg => typeof msg === 'string');

    if (textMessages.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma mensagem adicionada</p>';
        return;
    }

    // Mostra indicador se tem mídia global anexada
    let mediaIndicator = '';
    if (campaign.media) {
        const mediaType = campaign.media.type === 'image' ? '🖼️ Imagem' : '🎬 Vídeo';
        mediaIndicator = `
            <div class="messages-media-indicator">
                <span>${mediaType} anexada - será enviada com todas as mensagens</span>
            </div>
        `;
    }

    container.innerHTML = mediaIndicator + textMessages.map((msg, idx) => {
        // Encontra o índice original na lista de mensagens
        const originalIdx = campaign.messages.indexOf(msg);

        return `
            <div class="message-item">
                <div class="message-number">${idx + 1}</div>
                <div class="message-content">
                    <div class="message-text">${escapeHtml(msg)}</div>
                    <div class="message-actions">
                        <button class="btn btn-secondary btn-sm" onclick="editMessage('${campaign.name}', ${originalIdx})">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="removeMessage('${campaign.name}', ${originalIdx})">Remover</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function showMessagesResult(data) {
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = 'Mensagens carregadas';

    let html = `
        <div class="upload-result">
            <div class="upload-result-header">
                <div class="result-stat">
                    <h3 style="color: var(--primary);">${data.messagesCount}</h3>
                    <p>Mensagens</p>
                </div>
            </div>
            
            <div class="alert alert-info">
                <strong>Sucesso.</strong> ${data.messagesCount} mensagens foram carregadas e serão alternadas durante o disparo.
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
            'pending': '',
            'sending': '',
            'sent': '',
            'received': '',
            'read': '',
            'replied': '',
            'failed': ''
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
                        Remover
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function removeContact(campaignName, phoneNumber) {
    const confirmed = await showConfirmModal('Remover Contato', `Tem certeza que deseja remover o contato ${phoneNumber}?`, 'Remover', 'btn-danger');
    if (!confirmed) return;

    try {
        await apiCall(`/api/campaign/${campaignName}/number/${encodeURIComponent(phoneNumber)}`, {
            method: 'DELETE'
        });

        showToast('Contato removido', 'success');
        loadCampaignDetails({ preserveTab: true });

    } catch (error) {
        console.error(error);
    }
}

function downloadTemplate(type) {
    window.open(`${API_URL}/api/template/${type}`, '_blank');
}

// ==== DISPATCH ====

async function startDispatch() {
    const select = document.getElementById('selectedCampaign');
    const campaignName = select ? select.value : '';
    const messageDelay = parseInt(document.getElementById('messageDelay').value, 10) || 15;
    const enablePauseCheckbox = document.getElementById('enablePauseAfterMessages');
    const pauseAfterInput = document.getElementById('pauseAfterMessages');
    const pauseDurationInput = document.getElementById('pauseDuration');
    const enableTypingInput = document.getElementById('enableTyping');

    // Só considera os valores de pausa se a checkbox estiver marcada
    const isPauseEnabled = enablePauseCheckbox && enablePauseCheckbox.checked;
    const rawPauseAfter = isPauseEnabled && pauseAfterInput ? parseInt(pauseAfterInput.value, 10) : NaN;
    const rawPauseDuration = isPauseEnabled && pauseDurationInput ? parseInt(pauseDurationInput.value, 10) : NaN;
    const pauseAfterMessages = isNaN(rawPauseAfter) ? null : rawPauseAfter;
    const pauseDurationMinutes = isNaN(rawPauseDuration) ? null : rawPauseDuration;
    const enableTyping = !!(enableTypingInput && enableTypingInput.checked);

    if (!campaignName) {
        showToast('Selecione uma campanha primeiro', 'warning');
        addConsoleLog('Erro: Nenhuma campanha selecionada', 'error');
        return;
    }

    if (messageDelay < 1 || messageDelay > 360) {
        showToast('Delay entre mensagens deve estar entre 1 e 360 segundos', 'warning');
        return;
    }

    if (pauseAfterMessages !== null && (pauseAfterMessages < 1 || pauseAfterMessages > 500)) {
        showToast('"Pausa após X mensagens" deve estar entre 1 e 500', 'warning');
        return;
    }

    if (pauseDurationMinutes !== null && (pauseDurationMinutes < 1 || pauseDurationMinutes > 60)) {
        showToast('"Tempo de pausa (min)" deve estar entre 1 e 60', 'warning');
        return;
    }

    try {
        clearConsole();
        addConsoleLog('Iniciando sistema de disparo...', 'success');
        addConsoleLog(`Campanha: ${campaignName}`, 'success');
        addConsoleLog(`Intervalo: ${messageDelay}s entre mensagens`, 'success');

        if (pauseAfterMessages !== null && pauseDurationMinutes !== null) {
            addConsoleLog(`Pausa configurada: a cada ${pauseAfterMessages} mensagens, aguardar ${pauseDurationMinutes} min`, 'success');
        } else if (pauseAfterMessages !== null) {
            addConsoleLog(`Pausa configurada: a cada ${pauseAfterMessages} mensagens`, 'success');
        }

        if (enableTyping) {
            addConsoleLog('Status "digitando..." habilitado', 'success');
        }

        const payload = {
            messageDelay: messageDelay * 1000,
            enableTyping
        };

        if (pauseAfterMessages !== null) {
            payload.pauseAfterMessages = pauseAfterMessages;
        }

        if (pauseDurationMinutes !== null) {
            payload.pauseDuration = pauseDurationMinutes * 60 * 1000;
        }

        await apiCall(`/api/dispatch/start/${campaignName}`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        // Salva registro do último disparo
        const lastDispatchInfo = {
            campaignName: campaignName,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('lastDispatch', JSON.stringify(lastDispatchInfo));
        updateLastDispatchDisplay();

        showToast('Disparo iniciado!', 'success');
        updateDispatchControls('running');
        document.getElementById('dispatchProgress').style.display = 'block';
        addConsoleLog('Disparo iniciado com sucesso!', 'success');
    } catch (error) {
        console.error(error);
        addConsoleLog(`Erro ao iniciar disparo: ${error.message}`, 'error');
    }
}

async function pauseDispatch() {
    try {
        await apiCall('/api/dispatch/pause', { method: 'POST' });
        showToast('Disparo pausado', 'warning');
        updateDispatchControls('paused');
        addConsoleLog('Disparo pausado pelo usuário', 'muted');
    } catch (error) {
        console.error(error);
        addConsoleLog(`Erro ao pausar: ${error.message}`, 'error');
    }
}

async function resumeDispatch() {
    try {
        await apiCall('/api/dispatch/resume', { method: 'POST' });
        showToast('Disparo retomado', 'success');
        updateDispatchControls('running');
        addConsoleLog('Disparo retomado', 'success');
    } catch (error) {
        console.error(error);
        addConsoleLog(`Erro ao retomar: ${error.message}`, 'error');
    }
}

async function stopDispatch() {
    const confirmed = await showConfirmModal('Parar Disparo', 'Tem certeza que deseja parar o disparo completamente? O progresso será perdido.', 'Parar', 'btn-danger');
    if (!confirmed) return;

    try {
        await apiCall('/api/dispatch/stop', { method: 'POST' });
        showToast('Disparo parado', 'info');
        updateDispatchControls('idle');
        addConsoleLog('Disparo interrompido pelo usuário', 'muted');
    } catch (error) {
        console.error(error);
        addConsoleLog(`Erro ao parar: ${error.message}`, 'error');
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
            statsHTML += '<div style="width: 100%; margin-top: 20px; padding-top: 20px; border-top: 2px solid #e0e0e0;"><h4 style="margin-bottom: 15px;">Estatísticas por instância</h4><div class="instance-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">';

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
                                <p style="margin: 0; font-size: 0.9em; color: #666;">Enviadas</p>
                                <p style="margin: 0; font-weight: bold; color: #10b981; font-size: 1.1em;">${stats.sent}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-size: 0.9em; color: #666;">Falhas</p>
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
    updateDispatchControls('idle');
    addConsoleLog(`Campanha ${data.campaignName} finalizada com sucesso!`, 'success');
    loadCampaigns();
});

// Verifica o status atual do dispatch e atualiza a UI
async function checkDispatchStatus() {
    try {
        const status = await apiCall('/api/dispatch/status');

        if (status.isRunning && status.campaign) {
            const campaignStatus = status.campaign.status;

            if (campaignStatus === 'running') {
                updateDispatchControls('running');
                document.getElementById('dispatchProgress').style.display = 'block';
                addConsoleLog(`Campanha "${status.campaign.name}" está em execução`, 'success');
            } else if (campaignStatus === 'paused') {
                updateDispatchControls('paused');
                document.getElementById('dispatchProgress').style.display = 'block';
                addConsoleLog(`Campanha "${status.campaign.name}" está pausada`, 'muted');
            } else {
                updateDispatchControls('idle');
            }
        } else {
            updateDispatchControls('idle');
        }
    } catch (error) {
        console.warn('Erro ao verificar status do dispatch:', error);
        updateDispatchControls('idle');
    }
}

socket.on('dispatch-error', (data) => {
    showToast(`Erro na campanha: ${data.error}`, 'error');
    updateDispatchControls('idle');
    addConsoleLog(`Erro: ${data.error}`, 'error');
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
    // Adiciona log no console de execução somente para status de envio
    if (data.status === 'sent') {
        addConsoleLog(`Enviando para ${data.phone}... OK`, 'success');
    } else if (data.status === 'failed') {
        addConsoleLog(`Enviando para ${data.phone}... FALHA`, 'error');
    } else if (data.status === 'received') {
        console.log(`📨 Mensagem recebida por ${data.phone}`);
    } else if (data.status === 'read') {
        console.log(`👁️ Mensagem lida por ${data.phone}`);
    }

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

            // Atualiza tabela de contatos sem recarregar tudo
            renderContactsTable(state.currentCampaign);
        }
    }
});

// Atualização de stats da campanha em tempo real (funciona mesmo com disparo parado)
socket.on('campaign-stats-updated', (data) => {
    console.log('📊 Stats atualizados:', data.campaignName, data.stats);

    // Atualiza stats na campanha em memória
    const campaign = state.campaigns.find(c => c.name === data.campaignName);
    if (campaign) {
        campaign.stats = { ...campaign.stats, ...data.stats };
    }

    // Se está visualizando esta campanha, atualiza a UI
    if (state.currentCampaign && state.currentCampaign.name === data.campaignName) {
        state.currentCampaign.stats = { ...state.currentCampaign.stats, ...data.stats };

        // Atualiza os cards de estatísticas
        renderCampaignStats(state.currentCampaign);
    }

    // Atualiza o dashboard também
    updateDashboard(state.campaigns);

    // Atualiza os KPIs do analytics
    updateAnalyticsKPIs();
});

// Função para atualizar os cards de stats da campanha atual
function renderCampaignStats(campaign) {
    const statsContainer = document.getElementById('campaignStats');
    if (!statsContainer || !campaign) return;

    const totalContacts = (campaign.stats && typeof campaign.stats.total === 'number')
        ? campaign.stats.total
        : (Array.isArray(campaign.contacts) ? campaign.contacts.length : 0);
    const delivered = (campaign.stats && typeof campaign.stats.sent === 'number')
        ? campaign.stats.sent
        : 0;
    const received = (campaign.stats && typeof campaign.stats.received === 'number')
        ? campaign.stats.received
        : 0;
    const read = (campaign.stats && typeof campaign.stats.read === 'number')
        ? campaign.stats.read
        : 0;
    const replies = (campaign.stats && typeof campaign.stats.replied === 'number')
        ? campaign.stats.replied
        : 0;
    const failures = (campaign.stats && typeof campaign.stats.failed === 'number')
        ? campaign.stats.failed
        : 0;

    statsContainer.innerHTML = `
        <div class="stat-item">
            <h4>${totalContacts}</h4>
            <p>Total contatos</p>
        </div>
        <div class="stat-item">
            <h4>${delivered}</h4>
            <p>Enviadas</p>
        </div>
        <div class="stat-item">
            <h4>${received}</h4>
            <p>Recebidas</p>
        </div>
        <div class="stat-item">
            <h4>${read}</h4>
            <p>Lidas</p>
        </div>
        <div class="stat-item">
            <h4>${replies}</h4>
            <p>Respostas</p>
        </div>
        <div class="stat-item">
            <h4>${failures}</h4>
            <p>Falhas</p>
        </div>
    `;
}

// Função para atualizar KPIs do analytics em tempo real
function updateAnalyticsKPIs() {
    if (!state.campaigns || state.campaigns.length === 0) return;

    let totalSent = 0, totalDelivered = 0, totalRead = 0, totalFailed = 0;

    state.campaigns.forEach(campaign => {
        if (campaign.stats) {
            totalSent += campaign.stats.sent || 0;
            totalDelivered += campaign.stats.delivered || campaign.stats.received || 0;
            totalRead += campaign.stats.read || 0;
            totalFailed += campaign.stats.failed || 0;
        }
    });

    // Atualiza os elementos do dashboard
    const sentEl = document.getElementById('analyticsSent');
    const deliveredEl = document.getElementById('analyticsDelivered');
    const readEl = document.getElementById('analyticsRead');
    const failedEl = document.getElementById('analyticsFailed');

    if (sentEl) sentEl.textContent = totalSent;
    if (deliveredEl) deliveredEl.textContent = totalDelivered;
    if (readEl) readEl.textContent = totalRead;
    if (failedEl) failedEl.textContent = totalFailed;

    // Atualiza também o card de mensagens enviadas
    const dashSentEl = document.getElementById('dashSent');
    if (dashSentEl) dashSentEl.textContent = totalSent;
}

// ==== PAUSE OPTIONS TOGGLE ====

function togglePauseOptions() {
    const checkbox = document.getElementById('enablePauseAfterMessages');
    const container = document.getElementById('pauseOptionsContainer');

    if (checkbox.checked) {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

// ==== DELAY FEEDBACK ====

function onDelayChanged() {
    const input = document.getElementById('messageDelay');
    const feedback = document.getElementById('delayFeedback');
    const value = parseInt(input.value, 10);

    if (!feedback) return;

    // Valida o valor
    if (isNaN(value) || value < 1) {
        input.value = 1;
        feedback.textContent = '⚠️ Valor mínimo: 1 segundo';
        feedback.style.display = 'block';
        feedback.style.color = '#f59e0b';
    } else if (value > 360) {
        input.value = 360;
        feedback.textContent = '⚠️ Valor máximo: 360 segundos';
        feedback.style.display = 'block';
        feedback.style.color = '#f59e0b';
    } else {
        // Calcula o intervalo humanizado (30% a 100% do valor)
        const minDelay = Math.round(value * 0.3);
        const maxDelay = value;

        feedback.textContent = `✅ Intervalo atualizado: ${minDelay}s a ${maxDelay}s entre mensagens`;
        feedback.style.display = 'block';
        feedback.style.color = '#10b981';

        // Mostra no console também
        addConsoleLog(`Intervalo alterado: ${minDelay}s a ${maxDelay}s`, 'success');
    }

    // Esconde o feedback após 3 segundos
    setTimeout(() => {
        feedback.style.display = 'none';
    }, 3000);
}

// ==== LINKED INSTANCES ====

// Abre modal para gerenciar instâncias vinculadas
function openLinkedInstancesModal() {
    if (!state.currentCampaign) {
        showToast('Selecione uma campanha primeiro', 'warning');
        return;
    }

    const modal = document.getElementById('linkedInstancesModal');
    const checkboxList = document.getElementById('instancesCheckboxList');
    const noInstancesWarning = document.getElementById('noInstancesWarning');

    // Obtém instâncias do usuário e instâncias vinculadas à campanha
    const userInstances = state.instances || [];
    const linkedInstances = state.currentCampaign.linkedInstances || [];

    if (userInstances.length === 0) {
        checkboxList.innerHTML = '';
        noInstancesWarning.style.display = 'block';
    } else {
        noInstancesWarning.style.display = 'none';

        checkboxList.innerHTML = userInstances.map(inst => {
            const isLinked = linkedInstances.includes(inst.id);
            const statusClass = inst.status === 'connected' ? 'status-connected' : 'status-disconnected';
            const statusText = inst.status === 'connected' ? 'Conectado' : 'Desconectado';
            const phone = inst.phone || '--';
            const number = inst.id.match(/instance-0*(\d+)/)?.[1] || inst.id;

            return `
                <label class="instance-checkbox-item ${isLinked ? 'selected' : ''}" for="link-${inst.id}">
                    <input type="checkbox" 
                           id="link-${inst.id}" 
                           value="${inst.id}" 
                           ${isLinked ? 'checked' : ''}
                           ${inst.status !== 'connected' ? 'disabled' : ''}
                           onchange="this.parentElement.classList.toggle('selected', this.checked)">
                    <div class="instance-checkbox-info">
                        <div class="instance-checkbox-header">
                            <span class="instance-checkbox-number">${number}</span>
                            <span class="instance-checkbox-name">${inst.name || 'Instância ' + number}</span>
                        </div>
                        <div class="instance-checkbox-details">
                            <span class="instance-checkbox-phone">${phone}</span>
                            <span class="instance-checkbox-status ${statusClass}">${statusText}</span>
                        </div>
                    </div>
                </label>
            `;
        }).join('');
    }

    modal.classList.add('show');
}

// Fecha modal de instâncias vinculadas
function closeLinkedInstancesModal() {
    const modal = document.getElementById('linkedInstancesModal');
    modal.classList.remove('show');
}

// Salva instâncias vinculadas
async function saveLinkedInstances() {
    if (!state.currentCampaign) {
        showToast('Nenhuma campanha selecionada', 'error');
        return;
    }

    const checkboxList = document.getElementById('instancesCheckboxList');
    const checkedBoxes = checkboxList.querySelectorAll('input[type="checkbox"]:checked');
    const instanceIds = Array.from(checkedBoxes).map(cb => cb.value);

    try {
        const campaignName = encodeURIComponent(state.currentCampaign.name);
        const { linkedInstances, campaign } = await apiCall(`/api/campaign/${campaignName}/linked-instances`, {
            method: 'POST',
            body: JSON.stringify({ instanceIds })
        });

        state.currentCampaign.linkedInstances = linkedInstances;

        // Atualiza a visualização
        renderLinkedInstances();

        closeLinkedInstancesModal();
        showToast(`${linkedInstances.length} instância(s) vinculada(s)`, 'success');
    } catch (error) {
        console.error('Erro ao salvar instâncias vinculadas:', error);
        showToast('Erro ao salvar instâncias vinculadas', 'error');
    }
}

// Renderiza lista de instâncias vinculadas na tela de disparo
function renderLinkedInstances() {
    const container = document.getElementById('linkedInstancesList');
    if (!container) return;

    const linkedInstances = state.currentCampaign?.linkedInstances || [];
    const userInstances = state.instances || [];

    if (linkedInstances.length === 0) {
        container.innerHTML = `
            <div class="linked-instances-empty">
                <p class="empty-state-sm">Nenhuma instância vinculada</p>
                <p class="empty-state-hint">Todas as instâncias conectadas serão utilizadas.</p>
            </div>
        `;
        return;
    }

    // Filtra apenas as instâncias vinculadas
    const linkedData = userInstances.filter(i => linkedInstances.includes(i.id));

    container.innerHTML = linkedData.map(inst => {
        const statusClass = inst.status === 'connected' ? 'connected' : 'disconnected';
        const statusIcon = inst.status === 'connected' ? '✓' : '!';
        const phone = inst.phone || '--';
        const number = inst.id.match(/instance-0*(\d+)/)?.[1] || inst.id;

        return `
            <div class="linked-instance-chip ${statusClass}">
                <span class="linked-instance-icon">${statusIcon}</span>
                <span class="linked-instance-name">${inst.name || 'Instância ' + number}</span>
                <span class="linked-instance-phone">${phone}</span>
            </div>
        `;
    }).join('');
}

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
        updateHeaderConnectionStatus();
    } catch (error) {
        console.error('Erro ao carregar instâncias:', error);
        state.instances = []; // Garante array vazio em caso de erro
        renderInstances();
        updateHeaderConnectionStatus();
    }
}

async function addInstanceSlot() {
    // Verifica limite de instâncias do usuário
    const maxInstances = window.userMaxInstances || 3;
    if (state.instances && state.instances.length >= maxInstances) {
        showToast(`Limite de ${maxInstances} instância(s) atingido. Entre em contato com o administrador.`, 'error');
        return;
    }

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
                <p> Nenhuma instância encontrada</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    Clique em "Adicionar Instância" para começar
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
            connected: { icon: '✓', text: 'Conectado', color: 'success' },
            connecting: { icon: '⟳', text: 'Conectando...', color: 'warning' },
            disconnected: { icon: '!', text: 'Desconectado', color: 'danger' }
        };
        const status = statusInfo[inst.status] || statusInfo.disconnected;

        const phone = inst.phone || '--';
        const lastActivity = inst.lastActivity || 'Nunca';
        const name = inst.name || `Instância ${number}`;

        let mainAction = '';
        if (inst.status === 'connected') {
            mainAction = `
                <button class="btn btn-danger btn-block" onclick="disconnectInstance('${inst.id}')">
                     Desconectar
                </button>
            `;
        } else if (inst.status === 'connecting') {
            mainAction = `
                <button class="btn btn-warning btn-block" onclick="resetInstance('${inst.id}')">
                     Conectando... (Resetar)
                </button>
            `;
        } else {
            mainAction = `
                <button class="btn btn-primary btn-block" onclick="connectInstance('${inst.id}')">
                     Gerar QR Code
                </button>
            `;
        }

        return `
        <div class="instance-card ${inst.status || 'disconnected'}" id="${inst.id}">
            <div class="instance-header-row">
                <div class="instance-header-left">
                    <div class="instance-number">${number}</div>
                    <div>
                        <div class="instance-title-row">
                            <span class="instance-title">${name}</span>
                            <button class="instance-edit-btn" onclick="editInstanceName('${inst.id}')" title="Editar nome">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                </svg>
                            </button>
                        </div>
                        <div class="instance-card-id">ID: ${inst.id}</div>
                    </div>
                </div>
                <button class="instance-remove-btn" onclick="removeInstance('${inst.id}')" ${inst.status === 'connected' ? 'disabled' : ''} title="Remover instância">
                    🗑️
                </button>
            </div>

            <div class="instance-info-rows">
                <div class="instance-info-row">
                    <span class="instance-info-label">Status</span>
                    <span class="instance-status-text status-${status.color}">${status.text}</span>
                </div>
                <div class="instance-info-row">
                    <span class="instance-info-label">Número</span>
                    <span class="instance-info-value">${phone}</span>
                </div>
                <div class="instance-info-row">
                    <span class="instance-info-label">Última Atividade</span>
                    <span class="instance-info-value">${lastActivity}</span>
                </div>
            </div>

            ${inst.qrCode ? `
                <div class="instance-qr">
                    <img src="${inst.qrCode}" alt="QR Code">
                </div>
            ` : ''}

            <div class="instance-buttons">
                ${mainAction}
            </div>

            <div class="instance-footer-status">
                <div class="instance-status-box status-${status.color}">
                    <span class="status-icon">${status.icon}</span>
                    <span>${status.text}</span>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

async function connectInstance(instanceId) {
    const instance = state.instances.find(i => i.id === instanceId);
    if (!instance) return;

    // Gera um sessionId único para evitar conflitos entre usuários
    const sessionId = `${instance.id}-${Date.now()}`;

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

    const confirmed = await showConfirmModal('Desconectar Instância', 'Tem certeza que deseja desconectar esta instância?', 'Desconectar', 'btn-danger');
    if (!confirmed) return;

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

    const confirmed = await showConfirmModal('Remover Instância', `Tem certeza que deseja remover ${instance.name || 'esta instância'}? Esta ação não pode ser desfeita.`, 'Remover', 'btn-danger');
    if (!confirmed) return;

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

async function editInstanceName(instanceId) {
    const instance = state.instances.find(i => i.id === instanceId);
    if (!instance) return;

    const currentName = instance.name || `Instância ${instanceId.replace('instance-', '').replace(/^0+/, '')}`;
    const newName = await showInputModal('Renomear Instância', 'Digite o novo nome para a instância:', currentName);

    if (!newName || newName === currentName) return;

    try {
        await apiCall(`/api/instances/${instanceId}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: newName })
        });

        instance.name = newName;
        renderInstances();
        showToast('Nome da instância atualizado!', 'success');
    } catch (error) {
        console.error('Erro ao atualizar nome:', error);
        showToast('Erro ao atualizar nome: ' + error.message, 'error');
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

// Código duplicado removido - mantido apenas o primeiro listener acima

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

    const confirmed = await showConfirmModal('Remover Agendamento', 'Tem certeza que deseja remover o agendamento desta campanha?', 'Remover', 'btn-danger');
    if (!confirmed) return;

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
    const startTime = document.getElementById('startTime')?.value;
    const pauseTime = document.getElementById('pauseTime')?.value;
    const stopTime = document.getElementById('stopTime')?.value;
    const preview = document.getElementById('schedulePreview');

    if (!preview) return;

    if (!startTime) {
        preview.innerHTML = '';
        return;
    }

    let html = `
        <h4>🕒 Resumo do Agendamento</h4>
        <div class="schedule-timeline">
            <div class="timeline-item">
                <div class="timeline-icon start">🕒</div>
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

    html += '</div>';
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

// ==== TEMPLATES ====

async function loadTemplates() {
    try {
        const { templates } = await apiCall('/api/templates');

        // Lista rápida de templates (na aba de campanhas)
        const quickList = document.getElementById('templatesQuickList');
        if (quickList) {
            quickList.innerHTML = templates.length ? templates.slice(0, 10).map(t => `
                <button class="btn btn-small" style="background: #2a2a4a; border: 1px solid #444;" onclick="applyTemplate(${t.id})" title="${t.content.substring(0, 100)}...">
                    ${t.name}
                </button>
            `).join('') : '<span style="color: #666; font-size: 0.9em;">Nenhum template salvo</span>';
        }

        // Lista completa (se existir container separado)
        const container = document.getElementById('templatesList');
        if (container) {
            const category = document.getElementById('templateCategory')?.value;
            const filtered = category ? templates.filter(t => t.category === category) : templates;

            container.innerHTML = filtered.length ? filtered.map(t => `
                <div class="card template-card" style="padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <h4 style="margin: 0;">${t.name}</h4>
                        <span class="badge" style="background: #25D366; padding: 2px 8px; border-radius: 10px; font-size: 0.8em;">${t.category || 'geral'}</span>
                    </div>
                    <p style="color: #888; font-size: 0.9em; margin: 10px 0; white-space: pre-wrap;">${t.content.substring(0, 150)}${t.content.length > 150 ? '...' : ''}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                        <span style="color: #666; font-size: 0.8em;">Usado ${t.usage_count || 0}x</span>
                        <div>
                            <button class="btn btn-small" onclick="applyTemplate(${t.id})">Usar</button>
                            <button class="btn btn-small btn-secondary" onclick="editTemplate(${t.id})">Editar</button>
                            <button class="btn btn-small btn-danger" onclick="deleteTemplate(${t.id})">×</button>
                        </div>
                    </div>
                </div>
            `).join('') : '<p style="color: #888;">Nenhum template encontrado.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar templates:', error);
    }
}

// Aplica template no campo de mensagem
async function applyTemplate(id) {
    try {
        const { template } = await apiCall(`/api/templates/${id}`);
        const messageField = document.getElementById('newMessageText');
        if (messageField) {
            messageField.value = template.content;
            showToast('Template aplicado!', 'success');
        }
        // Incrementa uso
        await apiCall(`/api/templates/${id}/use`, { method: 'POST', body: JSON.stringify({}) });
    } catch (error) {
        showToast('Erro ao aplicar template', 'error');
    }
}

// Salva mensagem atual como template
async function saveAsTemplate() {
    const messageField = document.getElementById('newMessageText');
    const content = messageField?.value?.trim();

    if (!content) {
        showToast('Digite uma mensagem primeiro', 'error');
        return;
    }

    const name = await showInputModal('Salvar como Template', 'Digite um nome para o template:', '', 'Nome do template');
    if (!name) return;

    try {
        await apiCall('/api/templates', {
            method: 'POST',
            body: JSON.stringify({ name, content, category: 'geral' })
        });
        loadTemplates();
        showToast('Template salvo!', 'success');
    } catch (error) {
        showToast('Erro ao salvar template', 'error');
    }
}

function showTemplateModal(template = null) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('modalTitle').textContent = template ? 'Editar Template' : 'Novo Template';
    document.getElementById('modalBody').innerHTML = `
        <form id="templateForm" style="display: flex; flex-direction: column; gap: 15px;">
            <input type="hidden" id="templateId" value="${template?.id || ''}">
            <div>
                <label>Nome do Template</label>
                <input type="text" id="templateName" class="form-control" value="${template?.name || ''}" required>
            </div>
            <div>
                <label>Categoria</label>
                <select id="templateCat" class="form-control">
                    <option value="geral" ${template?.category === 'geral' ? 'selected' : ''}>Geral</option>
                    <option value="vendas" ${template?.category === 'vendas' ? 'selected' : ''}>Vendas</option>
                    <option value="suporte" ${template?.category === 'suporte' ? 'selected' : ''}>Suporte</option>
                    <option value="marketing" ${template?.category === 'marketing' ? 'selected' : ''}>Marketing</option>
                </select>
            </div>
            <div>
                <label>Conteúdo (use {{variavel}} para variáveis dinâmicas)</label>
                <textarea id="templateContent" class="form-control" rows="6" required>${template?.content || ''}</textarea>
                <small style="color: #888;">Ex: Olá {{nome}}, sua compra {{pedido}} foi confirmada!</small>
            </div>
            <button type="submit" class="btn btn-primary">Salvar Template</button>
        </form>
    `;
    modal.style.display = 'flex';

    document.getElementById('templateForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('templateId').value;
        const data = {
            name: document.getElementById('templateName').value,
            content: document.getElementById('templateContent').value,
            category: document.getElementById('templateCat').value
        };

        try {
            if (id) {
                await apiCall(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await apiCall('/api/templates', { method: 'POST', body: JSON.stringify(data) });
            }
            closeModal();
            loadTemplates();
            showToast('Template salvo!', 'success');
        } catch (error) {
            showToast('Erro ao salvar template', 'error');
        }
    };
}

async function editTemplate(id) {
    const { template } = await apiCall(`/api/templates/${id}`);
    showTemplateModal(template);
}

async function deleteTemplate(id) {
    const confirmed = await showConfirmModal('Excluir Template', 'Tem certeza que deseja excluir este template?', 'Excluir', 'btn-danger');
    if (!confirmed) return;
    try {
        await apiCall(`/api/templates/${id}`, { method: 'DELETE' });
        loadTemplates();
        showToast('Template excluído!', 'success');
    } catch (error) {
        showToast('Erro ao excluir', 'error');
    }
}


// ==== SCHEDULED CAMPAIGNS ====

async function loadScheduledCampaigns() {
    try {
        const status = document.getElementById('schedulerStatus')?.value || '';
        const { campaigns } = await apiCall(`/api/scheduler${status ? `?status=${status}` : ''}`);
        const container = document.getElementById('scheduledList');

        container.innerHTML = campaigns.length ? campaigns.map(c => {
            const statusColors = { pending: '#FFC107', running: '#2196F3', completed: '#4CAF50', failed: '#f44336' };
            const statusLabels = { pending: 'Pendente', running: 'Executando', completed: 'Concluído', failed: 'Falhou' };
            const scheduledDate = new Date(c.scheduled_at);

            return `
            <div class="card" style="padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0;">${c.name}</h4>
                    <p style="color: #888; margin: 5px 0;">📅 ${scheduledDate.toLocaleString('pt-BR')} | 👥 ${c.contacts.length} contatos</p>
                    ${c.repeat_type && c.repeat_type !== 'none' ? `<span style="color: #2196F3; font-size: 0.8em;">🔄 Recorrente: ${c.repeat_type}</span>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: ${statusColors[c.status]}; color: white; padding: 3px 10px; border-radius: 15px; font-size: 0.8em;">${statusLabels[c.status]}</span>
                    ${c.status === 'pending' ? `
                        <button class="btn btn-small" onclick="executeScheduledCampaign(${c.id})">▶ Executar</button>
                        <button class="btn btn-small btn-secondary" onclick="editScheduledCampaign(${c.id})">Editar</button>
                    ` : ''}
                    <button class="btn btn-small btn-danger" onclick="deleteScheduledCampaign(${c.id})">×</button>
                </div>
            </div>
        `}).join('') : '<p style="color: #888;">Nenhum agendamento encontrado.</p>';
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
    }
}

function showSchedulerModal(campaign = null) {
    const modal = document.getElementById('confirmModal');
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    const defaultDate = now.toISOString().slice(0, 16);

    document.getElementById('modalTitle').textContent = campaign ? 'Editar Agendamento' : 'Novo Agendamento';
    document.getElementById('modalBody').innerHTML = `
        <form id="schedulerForm" style="display: flex; flex-direction: column; gap: 15px;">
            <input type="hidden" id="schedCampaignId" value="${campaign?.id || ''}">
            <div>
                <label>Nome da Campanha</label>
                <input type="text" id="schedName" class="form-control" value="${campaign?.name || ''}" required>
            </div>
            <div>
                <label>Mensagem</label>
                <textarea id="schedMessage" class="form-control" rows="4" required>${campaign?.message || ''}</textarea>
            </div>
            <div>
                <label>Contatos (um por linha ou separados por vírgula)</label>
                <textarea id="schedContacts" class="form-control" rows="4" required placeholder="5511999999999">${campaign?.contacts?.join('\n') || ''}</textarea>
            </div>
            <div>
                <label>Data e Hora</label>
                <input type="datetime-local" id="schedDateTime" class="form-control" value="${campaign?.scheduled_at?.slice(0, 16) || defaultDate}" required>
            </div>
            <div>
                <label>Repetir</label>
                <select id="schedRepeat" class="form-control">
                    <option value="">Não repetir</option>
                    <option value="daily" ${campaign?.repeat_type === 'daily' ? 'selected' : ''}>Diariamente</option>
                    <option value="weekly" ${campaign?.repeat_type === 'weekly' ? 'selected' : ''}>Semanalmente</option>
                    <option value="monthly" ${campaign?.repeat_type === 'monthly' ? 'selected' : ''}>Mensalmente</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary">Salvar Agendamento</button>
        </form>
    `;
    modal.style.display = 'flex';

    document.getElementById('schedulerForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('schedCampaignId').value;
        const data = {
            name: document.getElementById('schedName').value,
            message: document.getElementById('schedMessage').value,
            contacts: document.getElementById('schedContacts').value,
            scheduled_at: document.getElementById('schedDateTime').value,
            repeat_type: document.getElementById('schedRepeat').value || null
        };

        try {
            if (id) {
                await apiCall(`/api/scheduler/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await apiCall('/api/scheduler', { method: 'POST', body: JSON.stringify(data) });
            }
            closeModal();
            loadScheduledCampaigns();
            showToast('Agendamento salvo!', 'success');
        } catch (error) {
            showToast(error.message || 'Erro ao salvar', 'error');
        }
    };
}

async function editScheduledCampaign(id) {
    const { campaign } = await apiCall(`/api/scheduler/${id}`);
    showSchedulerModal(campaign);
}

async function deleteScheduledCampaign(id) {
    const confirmed = await showConfirmModal('Cancelar Agendamento', 'Tem certeza que deseja cancelar este agendamento?', 'Cancelar', 'btn-danger');
    if (!confirmed) return;
    try {
        await apiCall(`/api/scheduler/${id}`, { method: 'DELETE' });
        loadScheduledCampaigns();
        showToast('Agendamento cancelado!', 'success');
    } catch (error) {
        showToast('Erro ao cancelar', 'error');
    }
}

async function executeScheduledCampaign(id) {
    const confirmed = await showConfirmModal('Executar Campanha', 'Deseja executar esta campanha agora?', 'Executar', 'btn-primary');
    if (!confirmed) return;
    try {
        await apiCall(`/api/scheduler/${id}/execute`, { method: 'POST' });
        loadScheduledCampaigns();
        showToast('Campanha em execução!', 'success');
    } catch (error) {
        showToast('Erro ao executar', 'error');
    }
}

// ==== ANALYTICS ====

async function loadAnalytics() {
    try {
        const days = document.getElementById('analyticsPeriod')?.value || 30;
        let { summary, dailyData, recentCampaigns } = await apiCall(`/api/analytics/summary?days=${days}`);

        // Sempre calcula estatísticas a partir das campanhas em memória para consistência
        // Isso garante que os números do gráfico batem com os cards do topo
        if (state.campaigns && state.campaigns.length > 0) {
            let totalSent = 0, totalDelivered = 0, totalRead = 0, totalFailed = 0;

            state.campaigns.forEach(campaign => {
                // Usa os stats da campanha (mesma fonte que o dashboard)
                if (campaign.stats) {
                    totalSent += campaign.stats.sent || 0;
                    // "Entregues" no WhatsApp corresponde a mensagens recebidas pelo aparelho (received)
                    totalDelivered += campaign.stats.delivered || campaign.stats.received || 0;
                    totalRead += campaign.stats.read || 0;
                    totalFailed += campaign.stats.failed || 0;
                }
            });

            // Atualiza summary com os dados das campanhas
            summary = {
                total_sent: totalSent,
                total_delivered: totalDelivered,
                total_read: totalRead,
                total_failed: totalFailed
            };

            // Gera dados diários a partir das campanhas para ter enviadas e respondidas
            const dailyDataMap = new Map();

            state.campaigns.forEach(campaign => {
                if (campaign.contacts) {
                    campaign.contacts.forEach(contact => {
                        const sentDate = contact.sentAt ? new Date(contact.sentAt).toISOString().split('T')[0] : null;
                        const repliedDate = contact.repliedAt ? new Date(contact.repliedAt).toISOString().split('T')[0] : null;

                        if (sentDate) {
                            if (!dailyDataMap.has(sentDate)) {
                                dailyDataMap.set(sentDate, { messages_sent: 0, messages_replied: 0 });
                            }
                            dailyDataMap.get(sentDate).messages_sent++;
                        }

                        if (repliedDate) {
                            if (!dailyDataMap.has(repliedDate)) {
                                dailyDataMap.set(repliedDate, { messages_sent: 0, messages_replied: 0 });
                            }
                            dailyDataMap.get(repliedDate).messages_replied++;
                        }
                    });
                }
            });

            // Monta série contínua de dias no período selecionado (inclui dias com zero)
            // Usamos uma janela fixa de 5 dias para o gráfico, deslizando conforme o tempo passa
            const periodDays = parseInt(days, 10) || 30;
            const daysInt = Math.min(periodDays, 5);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const fullSeries = [];

            for (let i = daysInt - 1; i >= 0; i--) {
                const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
                const key = d.toISOString().split('T')[0];
                const stats = dailyDataMap.get(key) || { messages_sent: 0, messages_replied: 0 };
                fullSeries.push({
                    date: key,
                    messages_sent: stats.messages_sent || 0,
                    messages_replied: stats.messages_replied || 0
                });
            }

            // Garante pelo menos um ponto (hoje) caso não haja nenhum envio no período
            if (fullSeries.length === 0) {
                const key = new Date().toISOString().split('T')[0];
                fullSeries.push({ date: key, messages_sent: 0, messages_replied: 0 });
            }

            dailyData = fullSeries;
        }

        // Atualiza cards
        document.getElementById('analyticsSent').textContent = summary?.total_sent || 0;
        document.getElementById('analyticsDelivered').textContent = summary?.total_delivered || 0;
        document.getElementById('analyticsRead').textContent = summary?.total_read || 0;
        document.getElementById('analyticsFailed').textContent = summary?.total_failed || 0;

        // Renderiza gráfico com duas linhas estilo AutomIA
        const chartContainer = document.getElementById('analyticsChart');
        if (chartContainer) {
            if (dailyData && dailyData.length > 0) {
                // Janela fixa de 5 dias no gráfico
                const limited = dailyData.slice(-5);
                const maxValue = Math.max(...limited.map(d => Math.max(d.messages_sent || 0, d.messages_replied || 0)), 1);

                // Dimensões do gráfico - calcula baseado no tamanho real do contêiner
                const containerRect = chartContainer.getBoundingClientRect();
                const width = Math.max(containerRect.width - 16, 400); // desconta padding, mínimo 400
                const height = 180;
                // Margem esquerda para os números do eixo Y e uma pequena margem interna à direita
                // para evitar que os pontos encostem totalmente nas bordas.
                const padding = { top: 20, right: 10, bottom: 30, left: 40 };
                const chartWidth = width - padding.left - padding.right;
                const chartHeight = height - padding.top - padding.bottom;
                const innerMarginX = 22; // margem interna suave nas laterais
                const innerWidth = chartWidth - innerMarginX * 2;

                // Gera pontos para enviadas
                const sentPoints = limited.map((d, i) => {
                    const x = padding.left + innerMarginX + (limited.length === 1 ? innerWidth / 2 : (i / (limited.length - 1)) * innerWidth);
                    const y = padding.top + chartHeight - ((d.messages_sent || 0) / maxValue) * chartHeight;
                    return { x, y, value: d.messages_sent || 0, date: d.date };
                });

                // Gera pontos para respondidas
                const repliedPoints = limited.map((d, i) => {
                    const x = padding.left + innerMarginX + (limited.length === 1 ? innerWidth / 2 : (i / (limited.length - 1)) * innerWidth);
                    const y = padding.top + chartHeight - ((d.messages_replied || 0) / maxValue) * chartHeight;
                    return { x, y, value: d.messages_replied || 0, date: d.date };
                });

                // Função para criar path suave
                const createSmoothPath = (points) => {
                    if (points.length === 0) return '';
                    if (points.length === 1) {
                        // Com apenas um ponto, desenha apenas o segmento no próprio ponto
                        // para evitar uma linha reta constante em todo o gráfico
                        return `M ${points[0].x} ${points[0].y}`;
                    }
                    return points.map((p, i) => {
                        if (i === 0) return `M ${p.x} ${p.y}`;
                        const prev = points[i - 1];
                        const cp1x = prev.x + (p.x - prev.x) / 2;
                        const cp1y = prev.y;
                        const cp2x = prev.x + (p.x - prev.x) / 2;
                        const cp2y = p.y;
                        return `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
                    }).join(' ');
                };

                const sentPath = createSmoothPath(sentPoints);
                const repliedPath = createSmoothPath(repliedPoints);

                // Área preenchida apenas para enviadas
                const sentArea = `${sentPath} L ${sentPoints[sentPoints.length - 1].x} ${height - padding.bottom} L ${sentPoints[0].x} ${height - padding.bottom} Z`;

                // Grid horizontal
                const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
                    const y = padding.top + chartHeight * (1 - pct);
                    const value = Math.round(maxValue * pct);
                    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#27272a" stroke-dasharray="3 3"/>
                            <text x="${padding.left - 8}" y="${y + 4}" fill="#71717a" font-size="10" text-anchor="end">${value}</text>`;
                }).join('');

                // Labels do eixo X (formato dd/mm)
                const xLabels = limited.map((d, i) => {
                    if (limited.length <= 7 || i === 0 || i === limited.length - 1 || i % Math.ceil(limited.length / 5) === 0) {
                        const baseX = padding.left + innerMarginX + (limited.length === 1 ? innerWidth / 2 : (i / (limited.length - 1)) * innerWidth);
                        const iso = d.date || '';
                        let label = '';
                        if (iso.length >= 10) {
                            const day = iso.slice(8, 10);
                            const month = iso.slice(5, 7);
                            label = `${day}/${month}`;
                        }

                        // Garante que o texto do primeiro e do último dia não fique cortado nas bordas
                        let x = baseX;
                        let anchor = 'middle';
                        const margin = 8;
                        if (i === 0) {
                            anchor = 'start';
                            x = Math.max(padding.left + margin, baseX);
                        } else if (i === limited.length - 1) {
                            anchor = 'end';
                            x = Math.min(width - margin, baseX);
                        }

                        return `<text x="${x}" y="${height - 8}" fill="#71717a" font-size="10" text-anchor="${anchor}">${label}</text>`;
                    }
                    return '';
                }).join('');

                // Pontos interativos (bolinhas sobre as linhas)
                const sentPointsHtml = sentPoints.map(p =>
                    `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#6366f1" stroke="#1e1b4b" stroke-width="2" class="chart-hover-point">
                        <title>${p.value} enviadas em ${p.date}</title>
                    </circle>`
                ).join('');

                const repliedPointsHtml = repliedPoints.map(p =>
                    `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#10b981" stroke="#047857" stroke-width="2" class="chart-hover-point">
                        <title>${p.value} respondidas em ${p.date}</title>
                    </circle>`
                ).join('');

                // SVG + legenda externa abaixo, alinhada ao canto esquerdo
                const svgHtml = `
                    <div class="analytics-chart-inner">
                        <svg class="analytics-area-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                            <defs>
                                <linearGradient id="sentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="5%" stop-color="#6366f1" stop-opacity="0.3"/>
                                    <stop offset="95%" stop-color="#6366f1" stop-opacity="0"/>
                                </linearGradient>
                            </defs>
                            <!-- Grid -->
                            ${gridLines}
                            <!-- Área preenchida (enviadas) -->
                            <path d="${sentArea}" fill="url(#sentGradient)"/>
                            <!-- Linha das enviadas -->
                            <path d="${sentPath}" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <!-- Linha das respondidas -->
                            <path d="${repliedPath}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <!-- Pontos -->
                            ${sentPointsHtml}
                            ${repliedPointsHtml}
                            <!-- Labels X -->
                            ${xLabels}
                        </svg>
                        <div class="analytics-chart-legend">
                            <div class="analytics-legend-item">
                                <span class="analytics-legend-color analytics-legend-sent"></span>
                                <span class="analytics-legend-label">Enviadas</span>
                            </div>
                            <div class="analytics-legend-item">
                                <span class="analytics-legend-color analytics-legend-replied"></span>
                                <span class="analytics-legend-label">Respondidas</span>
                            </div>
                        </div>
                    </div>
                `;

                chartContainer.innerHTML = svgHtml;
            } else {
                chartContainer.innerHTML = '<p class="analytics-chart-empty">Sem dados para exibir</p>';
            }
        }

    } catch (error) {
        console.error('Erro ao carregar analytics:', error);
    }
}

async function exportAnalytics() {
    try {
        const days = document.getElementById('analyticsPeriod')?.value || 30;
        window.open(`/api/analytics/export?days=${days}&format=csv`, '_blank');
    } catch (error) {
        showToast('Erro ao exportar', 'error');
    }
}

// ==== DISPATCH SCHEDULING ====

// Estado do agendamento
let scheduleInterval = null;
let scheduleConfig = {
    enabled: false,
    startTime: '08:00',
    endTime: '18:00',
    days: [1, 2, 3, 4, 5] // Seg a Sex por padrão
};

function toggleScheduleOptions() {
    const checkbox = document.getElementById('enableSchedule');
    const container = document.getElementById('scheduleOptionsContainer');

    if (checkbox && container) {
        container.style.display = checkbox.checked ? 'block' : 'none';
        scheduleConfig.enabled = checkbox.checked;

        if (!checkbox.checked) {
            stopScheduleMonitor();
            updateScheduleStatus('inactive');
        }

        saveScheduleConfig();
    }
}

function getScheduleConfig() {
    const startTime = document.getElementById('scheduleStartTime')?.value || '08:00';
    const endTime = document.getElementById('scheduleEndTime')?.value || '18:00';
    const days = [];

    for (let i = 0; i < 7; i++) {
        const checkbox = document.getElementById(`scheduleDay${i}`);
        if (checkbox && checkbox.checked) {
            days.push(i);
        }
    }

    return { startTime, endTime, days };
}

function saveScheduleConfig() {
    const config = getScheduleConfig();
    config.enabled = document.getElementById('enableSchedule')?.checked || false;
    scheduleConfig = config;

    // Salvar no localStorage para persistência local
    const campaignName = document.getElementById('selectedCampaign')?.value;
    if (campaignName) {
        localStorage.setItem(`schedule_${campaignName}`, JSON.stringify(config));
    }
}

function loadScheduleConfig() {
    const campaignName = document.getElementById('selectedCampaign')?.value;
    if (!campaignName) return;

    const saved = localStorage.getItem(`schedule_${campaignName}`);
    if (saved) {
        try {
            const config = JSON.parse(saved);
            scheduleConfig = config;

            // Aplicar ao form
            const enableCheckbox = document.getElementById('enableSchedule');
            const startInput = document.getElementById('scheduleStartTime');
            const endInput = document.getElementById('scheduleEndTime');
            const container = document.getElementById('scheduleOptionsContainer');

            if (enableCheckbox) enableCheckbox.checked = config.enabled;
            if (startInput) startInput.value = config.startTime || '08:00';
            if (endInput) endInput.value = config.endTime || '18:00';
            if (container) container.style.display = config.enabled ? 'block' : 'none';

            for (let i = 0; i < 7; i++) {
                const dayCheckbox = document.getElementById(`scheduleDay${i}`);
                if (dayCheckbox) {
                    dayCheckbox.checked = config.days?.includes(i) || false;
                }
            }

            if (config.enabled) {
                startScheduleMonitor();
            }
        } catch (e) {
            console.error('Erro ao carregar config de agendamento:', e);
        }
    }
}

function isWithinSchedule() {
    const config = getScheduleConfig();
    const now = new Date();
    const currentDay = now.getDay();

    // Verifica se é um dia permitido
    if (!config.days.includes(currentDay)) {
        return false;
    }

    // Verifica horário
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = config.startTime.split(':').map(Number);
    const [endH, endM] = config.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentTime >= startMinutes && currentTime < endMinutes;
}

function updateScheduleStatus(status, message) {
    const statusEl = document.getElementById('scheduleStatus');
    if (!statusEl) return;

    statusEl.className = 'schedule-status';
    const dot = statusEl.querySelector('.schedule-status-dot');
    const text = statusEl.querySelector('.schedule-status-text');

    if (status === 'active') {
        statusEl.classList.add('active');
        if (text) text.textContent = message || 'Disparos ativos - dentro do horário';
    } else if (status === 'waiting') {
        statusEl.classList.add('waiting');
        if (text) text.textContent = message || 'Aguardando horário de início';
    } else {
        if (text) text.textContent = message || 'Agendamento inativo';
    }
}

function startScheduleMonitor() {
    if (scheduleInterval) {
        clearInterval(scheduleInterval);
    }

    const checkSchedule = () => {
        if (!scheduleConfig.enabled) return;

        const withinSchedule = isWithinSchedule();
        const config = getScheduleConfig();

        if (withinSchedule) {
            updateScheduleStatus('active', `Ativo: ${config.startTime} - ${config.endTime}`);

            // Auto-iniciar disparo se não estiver rodando
            if (state.currentCampaign && !state.dispatchRunning) {
                addConsoleLog('⏰ Agendamento: iniciando disparos automaticamente', 'success');
                startDispatch();
            }
        } else {
            const now = new Date();
            const [startH, startM] = config.startTime.split(':').map(Number);
            const nextStart = new Date(now);
            nextStart.setHours(startH, startM, 0, 0);

            if (nextStart <= now) {
                nextStart.setDate(nextStart.getDate() + 1);
            }

            const diffMs = nextStart - now;
            const diffH = Math.floor(diffMs / (1000 * 60 * 60));
            const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

            updateScheduleStatus('waiting', `Próximo início em ${diffH}h ${diffM}m`);

            // Auto-pausar se estiver rodando fora do horário
            if (state.dispatchRunning) {
                addConsoleLog('⏰ Agendamento: pausando disparos (fora do horário)', 'warning');
                pauseDispatch();
            }
        }
    };

    // Verificar imediatamente e a cada minuto
    checkSchedule();
    scheduleInterval = setInterval(checkSchedule, 60000);
}

function stopScheduleMonitor() {
    if (scheduleInterval) {
        clearInterval(scheduleInterval);
        scheduleInterval = null;
    }
}

// Salvar config quando mudar horários ou dias
document.addEventListener('change', (e) => {
    if (e.target.id?.startsWith('scheduleDay') ||
        e.target.id === 'scheduleStartTime' ||
        e.target.id === 'scheduleEndTime') {
        saveScheduleConfig();
        if (scheduleConfig.enabled) {
            startScheduleMonitor();
        }
    }
});

// ==== SUBSCRIPTION CHECK ====

/**
 * Verifica se o usuário tem assinatura ativa
 * @returns {Promise<{hasSubscription: boolean, status: string, planName: string}>}
 */
async function checkSubscriptionStatus() {
    try {
        const token = localStorage.getItem('firebaseToken');
        if (!token) {
            return { hasSubscription: false, status: 'none', planName: null };
        }

        const response = await fetch('/api/stripe/subscription-status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            console.warn('Erro ao verificar assinatura:', response.status);
            return { hasSubscription: false, status: 'error', planName: null };
        }

        const data = await response.json();
        return {
            hasSubscription: data.hasSubscription || false,
            status: data.status || 'none',
            planName: data.planName || null,
            subscriptionBypass: !!data.subscriptionBypass
        };
    } catch (error) {
        console.error('Erro ao verificar assinatura:', error);
        return { hasSubscription: false, status: 'error', planName: null };
    }
}

/**
 * Mostra overlay de assinatura necessária
 */
function showSubscriptionRequired() {
    const overlay = document.getElementById('subscriptionRequired');
    const authLoading = document.getElementById('authLoading');
    const mainContainer = document.getElementById('mainContainer');

    if (authLoading) authLoading.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'none';
    if (overlay) overlay.style.display = 'flex';
}

/**
 * Logout e redireciona para login
 */
async function logoutAndRedirect() {
    try {
        const { logout } = await import('./firebase-auth.js');
        await logout();
    } catch (error) {
        localStorage.removeItem('firebaseToken');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
}

// Expõe globalmente para o botão no HTML
window.logoutAndRedirect = logoutAndRedirect;

// ==== INITIALIZATION ====

async function initializeApp() {
    // Verificação de assinatura desativada temporariamente
    // const subscription = await checkSubscriptionStatus();
    // if ((!subscription.hasSubscription || subscription.status !== 'active') && !subscription.subscriptionBypass) {
    //     // Usuário não tem assinatura ativa
    //     showSubscriptionRequired();
    //     return;
    // }

    // Bypass: sempre libera acesso
    const subscription = { hasSubscription: true, status: 'active', planName: 'Free', subscriptionBypass: true };

    // Salva info do plano no state
    state.subscription = subscription;

    // Continua carregamento normal
    loadCampaigns();
    loadSessions();
    loadInstances();
    loadSchedulesList();
    loadTemplates();
    loadScheduledCampaigns();
    loadAnalytics();

    // Verifica se há algum dispatch em andamento
    checkDispatchStatus();

    // Listener para filtro de categoria de templates
    document.getElementById('templateCategory')?.addEventListener('change', loadTemplates);

    // Update campaign selects to include schedule
    const originalUpdateSelects = updateCampaignSelects;
    window.updateCampaignSelects = function (campaigns) {
        originalUpdateSelects(campaigns);
        const scheduleSelect = document.getElementById('scheduleCampaign');
        if (scheduleSelect) {
            const current = scheduleSelect.value;
            scheduleSelect.innerHTML = '<option value="">-- Selecione --</option>' +
                campaigns.map(c => `<option value="${c.name}">${c.displayName || c.name}</option>`).join('');
            scheduleSelect.value = current;
        }
    };
}

// ====== FUNÇÕES DE IA (Gemini) ======

// Estado temporário das variações geradas
let generatedVariations = [];
let selectedVariationIndex = null;

// Toggle do modo IA
function toggleAiMode() {
    const enabled = document.getElementById('enableAiMessages').checked;
    const aiContainer = document.getElementById('aiModeContainer');
    const aiDisabled = document.getElementById('aiDisabledMessage');

    if (enabled) {
        aiContainer.style.display = 'block';
        aiDisabled.style.display = 'none';
        checkAiAvailability();
    } else {
        aiContainer.style.display = 'none';
        aiDisabled.style.display = 'block';
    }
}

// Verifica disponibilidade do serviço de IA
async function checkAiAvailability() {
    try {
        const result = await apiCall('/api/ai/status');

        if (result.status !== 'healthy') {
            const btn = document.getElementById('btnGenerateAi');
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-ai-icon">⚠️</span> IA Indisponível';
            showToast('Serviço de IA não está configurado. Configure GEMINI_API_KEY.', 'warning');
        }
    } catch (error) {
        console.warn('Serviço de IA não disponível:', error);
    }
}

// Insere variável no campo de IA
function insertVariableAi(variable) {
    const textarea = document.getElementById('aiBaseMessage');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    textarea.value = text.substring(0, start) + variable + text.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + variable.length, start + variable.length);
    updateAiPreview();
}

// Atualiza preview da mensagem base de IA
function updateAiPreview() {
    const message = document.getElementById('aiBaseMessage').value;
    const previewElement = document.getElementById('whatsappPreviewMessage');

    if (previewElement && message) {
        const previewText = message.replace(/\{\{(\w+)\}\}/g, '[$1]');
        previewElement.querySelector('.whatsapp-message-text').textContent = previewText || 'Pré-visualização da mensagem';
    }
}

// Gera variações com IA
async function generateAiVariations() {
    const baseMessage = document.getElementById('aiBaseMessage').value.trim();
    const tone = document.getElementById('aiTone').value;
    const count = parseInt(document.getElementById('aiVariationCount').value);

    if (!baseMessage) {
        showToast('Digite uma mensagem base para gerar variações', 'warning');
        return;
    }

    const btn = document.getElementById('btnGenerateAi');
    const originalContent = btn.innerHTML;
    const previewContainer = document.getElementById('aiVariationsPreview');
    const variationsList = document.getElementById('aiVariationsList');

    // Estado de loading
    btn.disabled = true;
    btn.innerHTML = '<div class="ai-loading-spinner" style="width:20px;height:20px;border-width:2px;"></div> Gerando...';

    // Mostra loading no preview
    previewContainer.style.display = 'block';
    variationsList.innerHTML = `
        <div class="ai-loading">
            <div class="ai-loading-spinner"></div>
            <span class="ai-loading-text">A IA está criando ${count} variações únicas...</span>
        </div>
    `;

    try {
        const result = await apiCall('/api/ai/generate-variations', {
            method: 'POST',
            body: JSON.stringify({
                baseMessage,
                count,
                tone,
                preserveVariables: true
            })
        });

        if (result.success && result.variations) {
            generatedVariations = result.variations;
            selectedVariationIndex = null;
            const btnApplySelected = document.getElementById('btnApplySelected');
            if (btnApplySelected) btnApplySelected.disabled = false;

            // Renderiza as variações (clicáveis)
            variationsList.innerHTML = result.variations.map((variation, index) => `
                <div class="ai-variation-item" data-index="${index}" onclick="selectAiVariation(${index})">
                    <span class="ai-variation-number">#${index + 1}</span>
                    ${escapeHtml(variation)}
                </div>
            `).join('');

            showToast(`✨ ${result.variations.length} variações geradas com sucesso!`, 'success');
        } else {
            throw new Error(result.error || 'Erro ao gerar variações');
        }

    } catch (error) {
        console.error('Erro ao gerar variações:', error);
        variationsList.innerHTML = `
            <div class="ai-disabled-message">
                <p>❌ ${error.message || 'Erro ao gerar variações. Tente novamente.'}</p>
            </div>
        `;
        showToast(error.message || 'Erro ao gerar variações', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// Aplica as variações geradas à campanha
async function applyAiVariations() {
    const campaignName = document.getElementById('selectedCampaign').value;

    if (!campaignName) {
        showToast('Selecione uma campanha primeiro', 'warning');
        return;
    }

    if (!generatedVariations || generatedVariations.length === 0) {
        showToast('Gere as variações primeiro', 'warning');
        return;
    }

    const baseMessage = document.getElementById('aiBaseMessage').value.trim();
    const tone = document.getElementById('aiTone').value;
    const replaceExisting = document.getElementById('aiReplaceExisting').checked;

    try {
        const result = await apiCall(`/api/campaign/${campaignName}/ai-messages`, {
            method: 'POST',
            body: JSON.stringify({
                baseMessage,
                count: generatedVariations.length,
                tone,
                preserveVariables: true,
                replaceExisting
            })
        });

        if (result.success) {
            showToast(`✅ ${result.aiGenerated.count} mensagens adicionadas à campanha!`, 'success');

            // Limpa o estado
            generatedVariations = [];
            selectedVariationIndex = null;
            document.getElementById('aiBaseMessage').value = '';
            document.getElementById('aiVariationsPreview').style.display = 'none';
            document.getElementById('aiReplaceExisting').checked = false;

            // Recarrega detalhes da campanha
            loadCampaignDetails({ preserveTab: true });
        } else {
            throw new Error(result.error || 'Erro ao aplicar variações');
        }

    } catch (error) {
        console.error('Erro ao aplicar variações:', error);
        showToast(error.message || 'Erro ao aplicar variações', 'error');
    }
}

// Escape HTML para evitar XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Expõe funções globalmente
window.toggleAiMode = toggleAiMode;
window.insertVariableAi = insertVariableAi;
window.updateAiPreview = updateAiPreview;
window.generateAiVariations = generateAiVariations;
window.applyAiVariations = applyAiVariations;
window.clearMessages = clearMessages;
window.selectAiVariation = selectAiVariation;
window.applySelectedVariation = applySelectedVariation;

// ====== FUNÇÕES DO EDITOR MANUAL ======

function toggleManualMode() {
    const enabled = document.getElementById('enableManualMessages')?.checked;
    const container = document.getElementById('manualModeContainer');
    const disabledMsg = document.getElementById('manualDisabledMessage');

    if (!container || !disabledMsg) return;

    if (enabled) {
        container.style.display = 'block';
        disabledMsg.style.display = 'none';
    } else {
        container.style.display = 'none';
        disabledMsg.style.display = 'block';
    }
}

window.toggleManualMode = toggleManualMode;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
