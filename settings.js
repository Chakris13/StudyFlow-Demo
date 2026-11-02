const settingsStatus = document.getElementById('settings-status');

async function loadSettingsPage() {
    try {
        const [{ data, error }, profile] = await Promise.all([
            window.studyFlowSupabase.auth.getUser(),
            window.StudyFlowAPI.loadProfile()
        ]);
        if (error) throw error;
        const user = data.user;
        document.getElementById('account-identifier').textContent = user.email || 'ผู้ใช้ไม่ระบุตัวตน';
        document.getElementById('account-type').textContent = user.is_anonymous
            ? 'ไม่ระบุตัวตน (ผู้เยี่ยมชม)'
            : 'บัญชีที่ลงทะเบียน';
        window.studyFlowSettings = profile.settings;
        if (user.is_anonymous) {
            settingsStatus.textContent = 'บัญชีผู้เยี่ยมชมผูกกับเบราว์เซอร์นี้ หากออกจากระบบหรือเปลี่ยนอุปกรณ์ อาจไม่สามารถกลับมาใช้บัญชีนี้ได้';
        }
    } catch (error) {
        settingsStatus.textContent = error.message;
    }
}

loadSettingsPage();

document.getElementById('logout-button').addEventListener('click', async () => {
    try {
        const { error } = await window.studyFlowSupabase.auth.signOut();
        if (error) throw error;
        window.location.replace('login.html');
    } catch (error) {
        settingsStatus.textContent = error.message;
    }
});
