const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const studyFlowClient = window.studyFlowSupabase;

function getDestination() {
    const requested = new URLSearchParams(window.location.search).get('return');
    const allowed = ['index.html', 'HW.html', 'ViewHW.html', 'Settings.html', 'Score.html'];
    return allowed.includes(requested) ? requested : 'index.html';
}

function showError(error) {
    loginStatus.textContent = error?.message || 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่';
}

async function redirectIfSignedIn() {
    const { data, error } = await studyFlowClient.auth.getSession();
    if (error) throw error;
    if (data.session?.user) window.location.replace(getDestination());
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginStatus.textContent = '';
    const email = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;

    try {
        const { error } = await studyFlowClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.replace(getDestination());
    } catch (error) {
        showError(error);
    }
});

const registerLink = document.getElementById('register-link');
const returnValue = new URLSearchParams(window.location.search).get('return');
if (returnValue) registerLink.href = `register.html?return=${encodeURIComponent(returnValue)}`;

document.getElementById('guest-button').addEventListener('click', async () => {
    loginStatus.textContent = '';
    try {
        const { error } = await studyFlowClient.auth.signInAnonymously();
        if (error) throw error;
        window.location.replace(getDestination());
    } catch (error) {
        loginStatus.textContent = error.message.includes('anonymous')
            ? 'ยังไม่ได้เปิด Anonymous Sign-Ins ใน Supabase Authentication settings'
            : error.message;
    }
});

redirectIfSignedIn().catch(showError);
