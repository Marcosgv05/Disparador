// Firebase Authentication Helper para App Principal
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Estado de autenticação
let currentUser = null;

// Renovar token automaticamente a cada 50 minutos (tokens expiram em 1 hora)
setInterval(async () => {
    if (currentUser) {
        try {
            const newToken = await currentUser.getIdToken(true); // Force refresh
            localStorage.setItem('firebaseToken', newToken);
            console.log('🔄 Token do Firebase renovado automaticamente');
        } catch (error) {
            console.error('❌ Erro ao renovar token:', error);
            // Se falhar, força logout
            await logout();
        }
    }
}, 50 * 60 * 1000); // 50 minutos

// Verifica autenticação e retorna promessa
export function checkAuthState() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                // Atualiza token no localStorage
                const token = await user.getIdToken();
                localStorage.setItem('firebaseToken', token);
                localStorage.setItem('user', JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0]
                }));
                resolve(user);
            } else {
                // Não autenticado
                localStorage.removeItem('firebaseToken');
                localStorage.removeItem('user');
                reject(new Error('Não autenticado'));
            }
        });
    });
}

// Logout
export async function logout() {
    try {
        await signOut(auth);
        localStorage.removeItem('firebaseToken');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        // Força logout mesmo com erro
        localStorage.removeItem('firebaseToken');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
}

// Função para renovar token manualmente
export async function refreshToken() {
    if (!currentUser) {
        throw new Error('Usuário não autenticado');
    }
    
    try {
        const newToken = await currentUser.getIdToken(true); // Force refresh
        localStorage.setItem('firebaseToken', newToken);
        console.log('✅ Token renovado com sucesso');
        return newToken;
    } catch (error) {
        console.error('❌ Erro ao renovar token:', error);
        throw error;
    }
}

// Pega usuário atual
export function getCurrentUser() {
    return currentUser;
}

// Pega token atual
export async function getCurrentToken() {
    if (currentUser) {
        return await currentUser.getIdToken();
    }
    return null;
}
