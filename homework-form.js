const homeworkForm = document.getElementById('homework-form');
homeworkForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = homeworkForm.querySelector('[type="submit"]');
    const status = document.getElementById('form-status');
    submitButton.disabled = true;
    if (status) status.textContent = 'กำลังบันทึก...';
    const form = new FormData(homeworkForm);
    try {
        await window.StudyFlowAPI.addHomework({
            hw_name: form.get('hw_name'),
            hw_type: form.get('hw_type'),
            subject: form.get('subject'),
            due_date: form.get('due_date'),
            notes: form.get('notes'),
            record_kind: 'homework'
        });
        window.location.replace('ViewHW.html?saved=1');
    } catch (error) {
        if (status) status.textContent = error.message;
        else alert(error.message);
        submitButton.disabled = false;
    }
});
