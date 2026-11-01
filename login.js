const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');

if (window.location.protocol === 'file:') {
    loginStatus.textContent = 'StudyFlow requires PHP. Open the site through your PHP server instead of opening this file directly.';
}

async function submitAccountAction(action) {
    if (window.location.protocol === 'file:') {
        loginStatus.textContent = 'StudyFlow requires PHP. Open the site through your PHP server instead of opening this file directly.';
        return;
    }

    loginStatus.textContent = '';
    const formData = new FormData(loginForm);
    const payload = new URLSearchParams({ action });
    for (const [key, value] of formData.entries()) {
        payload.set(key, String(value));
    }

    try {
        const response = await fetch('auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: payload
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'ไม่สามารถเข้าสู่ระบบได้');
        }

        const requestedReturn = new URLSearchParams(window.location.search).get('return');
        const allowedPages = ['index.html', 'HW.html', 'ViewHW.html', 'Settings.html'];
        const destination = allowedPages.includes(requestedReturn) ? requestedReturn : 'index.html';
        window.location.replace(destination);
    } catch (error) {
        loginStatus.textContent = window.location.protocol === 'file:'
            ? 'กรุณาเปิดเว็บไซต์ผ่าน PHP server เพื่อใช้งานระบบบัญชี'
            : error.message;
    }
}

loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitAccountAction('login');
});

document.getElementById('register-button').addEventListener('click', () => {
    if (!loginForm.reportValidity()) {
        return;
    }
    submitAccountAction('register');
});

document.getElementById('guest-button').addEventListener('click', () => {
    submitAccountAction('guest');
});

if (window.location.protocol !== 'file:') {
    fetch('auth.php?action=session')
        .then((response) => response.json())
        .then((result) => {
            if (result.authenticated) {
                window.location.replace('index.html');
            }
        })
        .catch(() => {
            loginStatus.textContent = 'ไม่สามารถเชื่อมต่อระบบบัญชีได้';
        });
}
