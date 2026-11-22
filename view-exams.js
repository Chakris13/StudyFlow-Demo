const examList = document.getElementById('exam-list');
const examStatus = document.getElementById('exam-status');
const examSort = document.getElementById('exam-sort');
const editDialog = document.getElementById('edit-exam-dialog');
const editForm = document.getElementById('edit-exam-form');
let exams = [];

function formatExamDate(value) {
    if (!value) return '-';
    const parts = value.split('-');
    return parts.length === 3
        ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('th-TH', { dateStyle: 'medium' })
        : value;
}
function makeCell(value) {
    const td = document.createElement('td');
    td.textContent = value == null || value === '' ? '-' : String(value).replace(/<br\s*\/?\s*>/gi, '\n');
    return td;
}
function renderExams() {
    examList.replaceChildren();
    const sorted = exams.slice();
    if (examSort.value === 'date') sorted.sort((a,b) => (a.test_date || '9999').localeCompare(b.test_date || '9999'));
    else if (examSort.value === 'created') sorted.sort((a,b) => (b.created_at || '').localeCompare(a.created_at || ''));
    else sorted.sort((a,b) => (a.hw_name || '').localeCompare(b.hw_name || '', 'th'));
    sorted.forEach(exam => {
        const row = document.createElement('tr');
        row.append(
            makeCell(exam.hw_name),
            makeCell(exam.subject),
            makeCell(formatExamDate(exam.test_date)),
            makeCell((exam.score ?? '-') + ' / ' + (exam.total_score ?? '-') + ' / ' + (exam.passing_score ?? '-')),
            makeCell(exam.notes)
        );
        const actions = document.createElement('td');
        actions.className = 'homework-actions';
        const edit = document.createElement('button');
        edit.type = 'button'; edit.textContent = 'แก้ไข';
        edit.addEventListener('click', () => openEdit(exam));
        const del = document.createElement('button');
        del.type = 'button'; del.textContent = 'ลบ';
        del.addEventListener('click', () => removeExam(exam));
        actions.append(edit, del);
        row.append(actions);
        examList.append(row);
    });
    if (!sorted.length) examStatus.textContent = 'ยังไม่มีข้อมูลสอบ — เพิ่มข้อมูลได้จากหน้าเพิ่มคะแนนสอบ';
}
async function loadExams() {
    try {
        const profile = await window.StudyFlowAPI.loadProfile();
        exams = (profile.homework || []).filter(item => item.record_kind === 'exam');
        renderExams();
    } catch (error) {
        examStatus.textContent = error.message || 'โหลดข้อมูลสอบไม่สำเร็จ';
    }
}
function openEdit(exam) {
    document.getElementById('edit-exam-id').value = exam.id;
    document.getElementById('edit-exam-name').value = exam.hw_name || '';
    document.getElementById('edit-exam-subject').value = exam.subject || '';
    document.getElementById('edit-exam-date').value = exam.test_date || '';
    document.getElementById('edit-exam-score').value = exam.score ?? '';
    document.getElementById('edit-exam-total').value = exam.total_score ?? '';
    document.getElementById('edit-exam-pass').value = exam.passing_score ?? '';
    document.getElementById('edit-exam-notes').value = exam.notes || '';
    editDialog.showModal();
}
async function removeExam(exam) {
    if (!confirm('ต้องการลบข้อมูลสอบ "' + exam.hw_name + '" ใช่หรือไม่?')) return;
    examStatus.textContent = 'กำลังลบข้อมูล...';
    try {
        const warning = await window.StudyFlowAPI.deleteExam(exam.id);
        await loadExams();
        examStatus.textContent = 'ลบข้อมูลสอบเรียบร้อยแล้ว' + (warning || '');
    } catch (error) {
        examStatus.textContent = error.message || 'ลบข้อมูลสอบไม่สำเร็จ';
    }
}
examSort.addEventListener('change', renderExams);
document.getElementById('cancel-edit-exam').addEventListener('click', () => editDialog.close());
editForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = editForm.querySelector('[type="submit"]');
    button.disabled = true;
    examStatus.textContent = 'กำลังบันทึกการแก้ไข...';
    try {
        await window.StudyFlowAPI.editExam(document.getElementById('edit-exam-id').value, {
            hw_name: document.getElementById('edit-exam-name').value,
            subject: document.getElementById('edit-exam-subject').value,
            test_date: document.getElementById('edit-exam-date').value,
            score: document.getElementById('edit-exam-score').value,
            total_score: document.getElementById('edit-exam-total').value,
            passing_score: document.getElementById('edit-exam-pass').value,
            notes: document.getElementById('edit-exam-notes').value
        });
        editDialog.close();
        await loadExams();
        examStatus.textContent = 'แก้ไขข้อมูลสอบเรียบร้อยแล้ว';
    } catch (error) {
        examStatus.textContent = error.message || 'แก้ไขข้อมูลสอบไม่สำเร็จ';
    } finally {
        button.disabled = false;
    }
});
loadExams();