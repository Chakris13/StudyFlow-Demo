document.documentElement.classList.add('auth-pending');

if (window.location.protocol === 'file:') {
    document.documentElement.classList.remove('auth-pending');
    const notice = document.createElement('p');
    notice.className = 'server-required';
    notice.setAttribute('role', 'alert');
    notice.textContent = 'StudyFlow requires PHP. Open the site through your PHP server instead of opening this file directly.';
    document.querySelector('main')?.prepend(notice);
} else {
    fetch('auth.php?action=session')
        .then((response) => {
            if (!response.ok) {
                throw new Error('ไม่สามารถตรวจสอบบัญชีได้');
            }
            return response.json();
        })
        .then((session) => {
            if (!session.authenticated) {
                const returnPage = window.location.pathname.split('/').pop();
                const login = new URL('login.html', window.location.href);
                if (['index.html', 'HW.html', 'ViewHW.html', 'Settings.html'].includes(returnPage)) {
                    login.searchParams.set('return', returnPage);
                }
                window.location.replace(login.href);
                return;
            }

            window.studyFlowSession = session;
            document.documentElement.classList.remove('auth-pending');

            const csrfInput = document.querySelector('input[name="csrf"]');
            if (csrfInput) {
                csrfInput.value = session.csrf;
            }
        })
        .catch(() => {
            window.location.replace('login.html?error=server');
        });
}
