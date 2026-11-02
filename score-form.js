const scoreForm = document.getElementById('homework-form');
scoreForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = scoreForm.querySelector('[type="submit"]');
    const status = document.getElementById('form-status');
    submitButton.disabled = true;
    if (status) status.textContent = 'กำลังบันทึก...';
    const form = new FormData(scoreForm);
    try {
        await window.StudyFlowAPI.addHomework({
            record_kind: 'exam',
            hw_name: form.get('hw_name'),
            hw_type: form.get('hw_type'),
            subject: form.get('subject'),
            test_date: form.get('test_date'),
            score: form.get('score'),
            total_score: form.get('total_score'),
            notes: form.get('notes')
        });
        window.location.replace('ViewHW.html?saved=1');
    } catch (error) {
        if (status) status.textContent = error.message;
        else alert(error.message);
        submitButton.disabled = false;
    }
});
