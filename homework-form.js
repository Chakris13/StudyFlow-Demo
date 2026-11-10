const homeworkForm = document.getElementById('homework-form');
homeworkForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = homeworkForm.querySelector('[type="submit"]');
    const status = document.getElementById('form-status');
    submitButton.disabled = true;
    if (status) status.textContent = 'กำลังบันทึก...';
    const form = new FormData(homeworkForm);
    try {
        const result = await window.StudyFlowAPI.addHomework({
            hw_name: form.get('hw_name'),
            hw_type: form.get('hw_type'),
            subject: form.get('subject'),
            due_date: form.get('due_date'),
            notes: form.get('notes'),
            calendar_color_id: form.get('calendar_color_id'),
            record_kind: 'homework'
        });
        const params = new URLSearchParams({ saved: '1' });
        if (result.calendarSync) params.set('calendar', result.calendarSync);
        if (result.calendarMessage) params.set('calendar_message', result.calendarMessage);
        window.location.replace(`ViewHW.html?${params.toString()}`);
    } catch (error) {
        if (status) status.textContent = error.message;
        else alert(error.message);
        submitButton.disabled = false;
    }
});
