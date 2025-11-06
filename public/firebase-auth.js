// Firebase Authentication Helper para App Principal
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Estado de autenticação
let currentUser = null;

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
