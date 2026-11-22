// View and manage exam records. Mirrors the interaction model of ViewHW.
const examList = document.getElementById('exam-list');
const examStatus = document.getElementById('exam-status');
const examSort = document.getElementById('exam-sort');
const examTable = document.getElementById('exam-table');
const editDialog = document.getElementById('edit-exam-dialog');
const editForm = document.getElementById('edit-exam-form');

let exams = [];
let expandedColumn = null;

function formatExamDate(value) {
    if (!value) return '-';
    const parts = value.split('-');
    if (parts.length !== 3) return value;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        .toLocaleDateString('th-TH', { dateStyle: 'medium' });
}

function makeCell(value) {
    const td = document.createElement('td');
    td.textContent = value == null || value === ''
        ? '-'
        : String(value).replace(/<br\s*\/?\s*>/gi, '\n').replace(/\r\n?/g, '\n');
    return td;
}

function showSavedMessage() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('saved')) return false;
    const calendar = params.get('calendar');
    if (calendar === 'created') {
        examStatus.textContent = 'บันทึกข้อมูลสอบแล้ว และเพิ่มวันสอบลง Google Calendar เรียบร้อย';
    } else if (calendar === 'failed') {
        examStatus.textContent = 'บันทึกข้อมูลสอบแล้ว แต่เพิ่มลง Google Calendar ไม่สำเร็จ: ' +
            (params.get('calendar_message') || 'กรุณาตรวจสอบการเชื่อมต่อ');
    } else if (calendar === 'not_connected') {
        examStatus.textContent = 'บันทึกข้อมูลสอบแล้ว แต่ยังไม่ได้เชื่อม Google Calendar';
    } else {
        examStatus.textContent = 'บันทึกข้อมูลสอบเรียบร้อยแล้ว';
    }
    history.replaceState({}, '', location.pathname);
    return true;
}

function renderExams() {
    examList.replaceChildren();
    const sorted = exams.slice();

    if (examSort.value === 'date') {
        sorted.sort((a, b) => (a.test_date || '9999-99-99').localeCompare(b.test_date || '9999-99-99'));
    } else if (examSort.value === 'created') {
        sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    } else {
        sorted.sort((a, b) => (a.hw_name || '').localeCompare(b.hw_name || '', 'th', { sensitivity: 'base' }));
    }

    sorted.forEach((exam) => {
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
        edit.type = 'button';
        edit.textContent = 'แก้ไข';
        edit.addEventListener('click', () => openEdit(exam));

        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = 'ลบ';
        del.addEventListener('click', () => removeExam(exam));

        actions.append(edit, del);
        row.append(actions);
        examList.append(row);
    });

    if (!sorted.length) {
        examStatus.textContent = 'ยังไม่มีข้อมูลสอบ — เพิ่มข้อมูลได้จากหน้าเพิ่มคะแนนสอบ';
    }
}

async function loadExams() {
    try {
        const profile = await window.StudyFlowAPI.loadProfile();
        exams = (profile.homework || []).filter(item => item.record_kind === 'exam');
        renderExams();
        return true;
    } catch (error) {
        examStatus.textContent = error.message || 'โหลดข้อมูลสอบไม่สำเร็จ';
        return false;
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
        const loaded = await loadExams();
        if (loaded) examStatus.textContent = 'ลบข้อมูลสอบเรียบร้อยแล้ว' + (warning || '');
    } catch (error) {
        examStatus.textContent = error.message || 'ลบข้อมูลสอบไม่สำเร็จ';
    }
}

function toggleExpandedColumn(header) {
    const columnIndex = Array.from(header.parentElement.children).indexOf(header) + 1;
    examTable.classList.remove(...Array.from(examTable.classList).filter(name => name.startsWith('expanded-column-')));
    if (expandedColumn === columnIndex) {
        expandedColumn = null;
        return;
    }
    expandedColumn = columnIndex;
    examTable.classList.add('expanded-column-' + columnIndex);
}

examTable.querySelectorAll('thead th').forEach((header) => {
    header.tabIndex = 0;
    header.setAttribute('role', 'button');
    header.title = 'คลิกเพื่อขยายคอลัมน์นี้';
    header.addEventListener('click', () => toggleExpandedColumn(header));
    header.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleExpandedColumn(header);
        }
    });
});

examSort.addEventListener('change', renderExams);

document.getElementById('cancel-edit-exam').addEventListener('click', () => editDialog.close());

editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = editForm.querySelector('[type="submit"]');
    const score = document.getElementById('edit-exam-score').value;
    const total = document.getElementById('edit-exam-total').value;
    const passing = document.getElementById('edit-exam-pass').value;

    if (score !== '' && total !== '' && Number(score) > Number(total)) {
        examStatus.textContent = 'คะแนนที่ได้ต้องไม่เกินคะแนนเต็ม';
        return;
    }
    if (passing !== '' && total !== '' && Number(passing) > Number(total)) {
        examStatus.textContent = 'เกณฑ์ผ่านต้องไม่เกินคะแนนเต็ม';
        return;
    }

    button.disabled = true;
    examStatus.textContent = 'กำลังบันทึกการแก้ไข...';
    try {
        await window.StudyFlowAPI.editExam(document.getElementById('edit-exam-id').value, {
            hw_name: document.getElementById('edit-exam-name').value,
            subject: document.getElementById('edit-exam-subject').value,
            test_date: document.getElementById('edit-exam-date').value,
            score,
            total_score: total,
            passing_score: passing,
            notes: document.getElementById('edit-exam-notes').value
        });
        editDialog.close();
        const loaded = await loadExams();
        if (loaded) examStatus.textContent = 'แก้ไขข้อมูลสอบเรียบร้อยแล้ว';
    } catch (error) {
        examStatus.textContent = error.message || 'แก้ไขข้อมูลสอบไม่สำเร็จ';
    } finally {
        button.disabled = false;
    }
});

(async () => {
    const hasSavedMessage = showSavedMessage();
    const loaded = await loadExams();
    if (loaded && hasSavedMessage && exams.length === 0) {
        examStatus.textContent = 'บันทึกข้อมูลสอบเรียบร้อยแล้ว แต่ยังไม่พบรายการในตาราง';
    }
})();
