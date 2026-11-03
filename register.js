// StudyFlow registration flow (Supabase Auth)
(() => {
    const registerForm = document.getElementById('register-form');
    const registerStatus = document.getElementById('register-status');
    const submitButton = document.getElementById('register-submit');
    const loginLink = document.getElementById('login-link');
    const client = window.studyFlowSupabase;

    const params = new URLSearchParams(window.location.search);
    const requestedDestination = params.get('return');
    const allowedDestinations = new Set([
        'index.html', 'HW.html', 'ViewHW.html', 'Settings.html', 'Score.html'
    ]);
    const destination = allowedDestinations.has(requestedDestination)
        ? requestedDestination
        : 'index.html';

    if (requestedDestination) {
        loginLink.href = `login.html?return=${encodeURIComponent(requestedDestination)}`;
    }

    function setStatus(message, kind = 'info') {
        registerStatus.textContent = message;
        registerStatus.dataset.state = kind;
        registerStatus.style.color = kind === 'error' ? '#b42318' : '#344054';
    }

    function addLoginLink(message) {
        registerStatus.textContent = message + ' ';
        const link = document.createElement('a');
        link.className = 'auth-switch';
        link.href = loginLink.href;
        link.textContent = 'ไปหน้าเข้าสู่ระบบ';
        registerStatus.appendChild(link);
    }

    function translateAuthError(error) {
        const code = String(error?.code || error?.name || '').toLowerCase();
        const message = String(error?.message || '').toLowerCase();
        const combined = `${code} ${message}`;

        if (combined.includes('email_address_not_authorized') || combined.includes('email address not authorized')) {
            return 'Supabase ยังไม่อนุญาตให้ส่งอีเมลไปยังที่อยู่นี้ เพราะยังใช้ระบบส่งอีเมลเริ่มต้นอยู่ ต้องตั้งค่า Custom SMTP เพื่อส่งไปยังอีเมลทั่วไป หรือปิด Confirm Email ชั่วคราวเพื่อทดสอบเท่านั้น';
        }
        if (combined.includes('over_email_send_rate_limit') || combined.includes('email rate limit exceeded')) {
            return 'Supabase ส่งอีเมลยืนยันเกินโควตาของระบบเริ่มต้นแล้ว ให้ตั้งค่า Custom SMTP หรือทดสอบโดยปิด Confirm Email ชั่วคราว';
        }
        if (combined.includes('user_already_exists') || combined.includes('user already registered')) {
            return 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ หรือใช้อีเมลอื่น';
        }
        if (combined.includes('email_provider_disabled') || combined.includes('email provider is disabled')) {
            return 'ยังไม่ได้เปิด Email Provider ใน Supabase: Authentication → Sign In / Providers → Email';
        }
        if (combined.includes('weak_password') || combined.includes('password should be')) {
            return 'รหัสผ่านไม่ผ่านข้อกำหนดของ Supabase กรุณาใช้รหัสผ่านที่ปลอดภัยและยาวขึ้น';
        }
        if (combined.includes('redirect') && (combined.includes('not allowed') || combined.includes('invalid'))) {
            return 'URL สำหรับยืนยันอีเมลยังไม่ได้รับอนุญาต กรุณาเพิ่ม https://chakris13.github.io/StudyFlow-Demo/** ใน Authentication → URL Configuration → Redirect URLs';
        }
        if (combined.includes('failed to fetch') || combined.includes('networkerror') || combined.includes('load failed')) {
            return 'เชื่อมต่อ Supabase ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตและลองรีเฟรชหน้าเว็บ หากยังไม่หายให้ตรวจว่า CDN ของ Supabase โหลดได้';
        }
        return error?.message || 'ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่';
    }

    function showError(error) {
        console.error('StudyFlow registration error:', error);
        setStatus(translateAuthError(error), 'error');
    }

    function setBusy(busy) {
        submitButton.disabled = busy;
        submitButton.textContent = busy ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี';
    }

    function showGuestSignOutOption() {
        registerForm.hidden = true;
        setStatus('ขณะนี้คุณกำลังใช้งานบัญชีผู้เยี่ยมชม (Guest). หากออกจาก Guest เพื่อสร้างบัญชีใหม่ ข้อมูลการบ้านเดิมจะยังอยู่กับบัญชี Guest และจะไม่ถูกย้ายไปบัญชีใหม่', 'info');

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'ออกจาก Guest แล้วสมัครบัญชีใหม่';
        button.addEventListener('click', async () => {
            const confirmed = window.confirm(
                'ยืนยันออกจากบัญชี Guest หรือไม่? ข้อมูลที่บันทึกในบัญชี Guest จะไม่ถูกย้ายไปบัญชีใหม่และอาจไม่สามารถกลับมาเข้าถึงได้'
            );
            if (!confirmed) return;

            button.disabled = true;
            try {
                const { error } = await client.auth.signOut({ scope: 'local' });
                if (error) throw error;
                button.remove();
                registerForm.hidden = false;
                setStatus('ออกจาก Guest แล้ว กรอกอีเมลและรหัสผ่านเพื่อสร้างบัญชีถาวรได้เลย');
            } catch (error) {
                button.disabled = false;
                showError(error);
            }
        });
        registerStatus.insertAdjacentElement('afterend', button);
    }

    async function initialize() {
        if (!client?.auth) {
            registerForm.hidden = true;
            setStatus('โหลด Supabase ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บและตรวจสอบอินเทอร์เน็ต หากยังพบปัญหาให้ตรวจไฟล์ supabase-client.js', 'error');
            return;
        }

        try {
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            const user = data.session?.user;
            if (!user) return;

            if (user.is_anonymous) {
                showGuestSignOutOption();
                return;
            }

            window.location.replace(destination);
        } catch (error) {
            showError(error);
        }
    }

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus('');

        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        if (password.length < 8) {
            setStatus('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', 'error');
            return;
        }
        if (password !== confirmPassword) {
            setStatus('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน', 'error');
            document.getElementById('register-confirm-password').focus();
            return;
        }
        if (!client?.auth) {
            showError(new Error('Supabase client is not available.'));
            return;
        }

        setBusy(true);
        try {
            const emailRedirectTo = new URL('login.html', window.location.href).href;
            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: { emailRedirectTo }
            });
            if (error) throw error;

            // Supabase may intentionally return an empty identities array for an
            // already-registered email when email confirmation is enabled.
            if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
                const duplicateError = new Error('อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ หรือใช้อีเมลอื่น');
                duplicateError.code = 'user_already_exists';
                throw duplicateError;
            }

            if (data.session) {
                setStatus('สร้างบัญชีและเข้าสู่ระบบสำเร็จ กำลังเปิด StudyFlow...');
                window.location.replace(destination);
                return;
            }

            registerForm.hidden = true;
            addLoginLink(`สร้างบัญชีแล้ว กรุณาตรวจสอบอีเมล ${email} และกดลิงก์ยืนยัน จากนั้นกลับมาเข้าสู่ระบบ`);
        } catch (error) {
            showError(error);
            setBusy(false);
        }
    });

    initialize();
})();
