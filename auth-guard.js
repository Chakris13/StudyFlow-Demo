document.documentElement.classList.add('auth-pending');

(async () => {
    try {
        const { data, error } = await window.studyFlowSupabase.auth.getSession();
        if (error) throw error;
        if (!data.session?.user) {
            const returnPage = window.location.pathname.split('/').pop();
            const allowedPages = ['index.html', 'HW.html', 'ViewHW.html', 'Settings.html', 'Score.html'];
            const login = new URL('login.html', window.location.href);
            if (allowedPages.includes(returnPage)) login.searchParams.set('return', returnPage);
            window.location.replace(login.href);
            return;
        }
        window.studyFlowSession = data.session;
        document.documentElement.classList.remove('auth-pending');
    } catch (error) {
        console.error('StudyFlow authentication check failed:', error);
        window.location.replace('login.html?error=auth');
    }
})();
