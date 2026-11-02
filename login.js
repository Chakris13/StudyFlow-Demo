const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const supabase = window.studyFlowSupabase;

function getDestination() {
    const requested = new URLSearchParams(window.location.search).get('return');
    const allowed = ['index.html', 'HW.html', 'ViewHW.html', 'Settings.html', 'Score.html'];
    return allowed.includes(requested) ? requested : 'index.html';
}

function showError(error) {
    loginStatus.textContent = error?.message || 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่';
}

async function redirectIfSignedIn() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session?.user) window.location.replace(getDestination());
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginStatus.textContent = '';
    const email = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;

    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.replace(getDestination());
    } catch (error) {
        showError(error);
    }
});

document.getElementById('register-button').addEventListener('click', async () => {
    if (!loginForm.reportValidity()) return;
    loginStatus.textContent = '';
    const email = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;
    if (password.length < 8) {
        loginStatus.textContent = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
        return;
    }

    try {
        const redirectTo = new URL('login.html', window.location.href).href;
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: redirectTo }
        });
        if (error) throw error;
        if (data.session) {
            window.location.replace(getDestination());
        } else {
            loginStatus.textContent = 'ลงทะเบียนแล้ว กรุณาตรวจสอบอีเมลและกดลิงก์ยืนยันก่อนเข้าสู่ระบบ';
        }
    } catch (error) {
        showError(error);
    }
});

document.getElementById('guest-button').addEventListener('click', async () => {
    loginStatus.textContent = '';
    try {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        window.location.replace(getDestination());
    } catch (error) {
        loginStatus.textContent = error.message.includes('anonymous')
            ? 'ยังไม่ได้เปิด Anonymous Sign-Ins ใน Supabase Authentication settings'
            : error.message;
    }
});

redirectIfSignedIn().catch(showError);
