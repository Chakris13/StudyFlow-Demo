const registerForm = document.getElementById('register-form');
const registerStatus = document.getElementById('register-status');
const submitButton = document.getElementById('register-submit');
const supabase = window.studyFlowSupabase;

function getDestination() {
    const requested = new URLSearchParams(window.location.search).get('return');
    const allowed = ['index.html', 'HW.html', 'ViewHW.html', 'Settings.html', 'Score.html'];
    return allowed.includes(requested) ? requested : 'index.html';
}

function showError(error) {
    registerStatus.textContent = error?.message || 'ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่';
}

async function redirectIfSignedIn() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session?.user) window.location.replace(getDestination());
}

const loginLink = document.getElementById('login-link');
const returnValue = new URLSearchParams(window.location.search).get('return');
if (returnValue) loginLink.href = `login.html?return=${encodeURIComponent(returnValue)}`;

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    registerStatus.textContent = '';

    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password.length < 8) {
        registerStatus.textContent = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
        return;
    }
    if (password !== confirmPassword) {
        registerStatus.textContent = 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน';
        document.getElementById('register-confirm-password').focus();
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'กำลังสร้างบัญชี...';

    try {
        const emailRedirectTo = new URL('login.html', window.location.href).href;
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo }
        });
        if (error) throw error;

        if (data.session) {
            window.location.replace(getDestination());
            return;
        }

        registerForm.hidden = true;
        registerStatus.textContent = `สร้างบัญชีเรียบร้อยแล้ว กรุณาตรวจสอบอีเมล ${email} และกดลิงก์ยืนยัน จากนั้นกลับมาเข้าสู่ระบบ`;
        const loginUrl = new URL('login.html', window.location.href);
        const requested = new URLSearchParams(window.location.search).get('return');
        if (requested) loginUrl.searchParams.set('return', requested);
        const link = document.createElement('a');
        link.className = 'auth-switch';
        link.href = loginUrl.href;
        link.textContent = 'ไปหน้าเข้าสู่ระบบ';
        registerStatus.appendChild(document.createTextNode(' '));
        registerStatus.appendChild(link);
    } catch (error) {
        showError(error);
        submitButton.disabled = false;
        submitButton.textContent = 'สร้างบัญชี';
    }
});

redirectIfSignedIn().catch(showError);
