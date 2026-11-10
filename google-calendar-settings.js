const calendarStatusElement = document.getElementById('google-calendar-status');
const connectCalendarButton = document.getElementById('connect-google-calendar');

function setCalendarStatus(message, isError = false) {
    calendarStatusElement.textContent = message;
    calendarStatusElement.style.color = isError ? '#b42318' : '#166534';
}

const callbackStatus = new URLSearchParams(window.location.search).get('calendar');
const callbackMessages = {
    connected: 'Google Calendar เชื่อมต่อสำเร็จแล้ว',
    denied: 'คุณยกเลิกการอนุญาต Google Calendar',
    expired: 'คำขอเชื่อมต่อหมดอายุ กรุณาลองใหม่',
    token_error: 'Google ไม่สามารถออก Token ได้ กรุณาตรวจสอบ OAuth Client ID และ Client Secret',
    no_refresh_token: 'Google ไม่ได้ส่ง Refresh Token กลับมา กรุณากดเชื่อมต่อใหม่และยืนยันสิทธิ์',
    save_error: 'เชื่อม Google สำเร็จ แต่บันทึก Token ไม่สำเร็จ กรุณาตรวจ Supabase Edge Function Logs',
    error: 'เกิดข้อผิดพลาดระหว่างเชื่อมต่อ Google Calendar'
};
if (callbackStatus && callbackMessages[callbackStatus]) {
    setCalendarStatus(callbackMessages[callbackStatus], callbackStatus !== 'connected');
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('calendar');
    window.history.replaceState({}, '', cleanUrl.toString());
}

async function refreshGoogleCalendarStatus() {
    try {
        const { data: userResult, error: userError } = await window.studyFlowSupabase.auth.getUser();
        if (userError) throw userError;
        if (userResult.user?.is_anonymous) {
            setCalendarStatus('บัญชี Guest ไม่สามารถเชื่อม Google Calendar ได้ กรุณาใช้บัญชีที่ลงทะเบียน', true);
            connectCalendarButton.disabled = true;
            return;
        }

        const { data, error } = await window.studyFlowSupabase.functions.invoke('google-calendar-status', { body: {} });
        if (error) throw error;
        if (data?.connected) {
            setCalendarStatus('เชื่อมต่อแล้ว — การบ้านใหม่ที่มีวันครบกำหนดจะถูกเพิ่มลง Google Calendar');
            connectCalendarButton.textContent = 'เชื่อมต่อบัญชี Google ใหม่';
        } else {
            setCalendarStatus('ยังไม่ได้เชื่อมต่อ Google Calendar');
        }
    } catch (error) {
        setCalendarStatus(error?.message || 'ตรวจสอบสถานะ Google Calendar ไม่สำเร็จ', true);
    }
}

connectCalendarButton.addEventListener('click', async () => {
    connectCalendarButton.disabled = true;
    connectCalendarButton.textContent = 'กำลังเปิด Google...';
    setCalendarStatus('กำลังเตรียมการเชื่อมต่อ Google Calendar');
    try {
        const { data, error } = await window.studyFlowSupabase.functions.invoke('google-calendar-auth-url', { body: {} });
        if (error) throw error;
        if (!data?.url) throw new Error(data?.error || 'ไม่ได้รับ URL สำหรับเชื่อมต่อจาก Supabase');
        window.location.assign(data.url);
    } catch (error) {
        setCalendarStatus(error?.message || 'เริ่มเชื่อมต่อ Google Calendar ไม่สำเร็จ', true);
        connectCalendarButton.disabled = false;
        connectCalendarButton.textContent = 'เชื่อมต่อ Google Calendar';
    }
});

// Do not immediately overwrite the OAuth callback result. The callback may
// have redirected with a useful error status (token_error, save_error, etc.).
// Refresh the live status only on a normal page load without a callback result.
if (callbackStatus === 'connected') {
    connectCalendarButton.textContent = 'เชื่อมต่อบัญชี Google ใหม่';
} else if (!callbackStatus) {
    refreshGoogleCalendarStatus();
}
