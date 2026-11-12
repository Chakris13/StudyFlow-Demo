const statusMessage = document.getElementById('status-message');
const homeworkList = document.getElementById('homework-list');
const editDialog = document.getElementById('edit-homework-dialog');
const editForm = document.getElementById('edit-homework-form');
const homeworkSort = document.getElementById('homework-sort');
let allHomework = [];
let expandedColumn = null;
let sortMode = 'submitted';

function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? timestamp : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium', timeStyle: 'short'
    }).format(date);
}

const query = new URLSearchParams(window.location.search);
if (query.has('saved')) {
    const calendar = query.get('calendar');
    if (calendar === 'created') {
        statusMessage.textContent = 'บันทึกการบ้านเรียบร้อยแล้ว และเพิ่มกำหนดส่งลง Google Calendar แล้ว';
    } else if (calendar === 'not_connected') {
        statusMessage.textContent = 'บันทึกการบ้านแล้ว แต่ยังไม่ได้เชื่อม Google Calendar ไปที่หน้า Settings เพื่อเชื่อมต่อ';
    } else if (calendar === 'failed') {
        const detail = query.get('calendar_message');
        statusMessage.textContent = 'บันทึกการบ้านแล้ว แต่เพิ่มลง Google Calendar ไม่สำเร็จ' + (detail ? ': ' + detail : '');
    } else {
        statusMessage.textContent = 'บันทึกข้อมูลเรียบร้อยแล้ว';
    }
}

function displayHomework(homework) {
    if (!Array.isArray(homework)) throw new Error('ข้อมูลการบ้านไม่ถูกต้อง');
    allHomework = homework.slice();
    renderSortedHomework();
}

function renderSortedHomework() {
    homeworkList.replaceChildren();
    const sorted = allHomework.slice();
    const timestampValue = (value) => value ? new Date(value).getTime() || 0 : 0;
    if (sortMode === 'submitted') {
        sorted.sort((a, b) => timestampValue(b.submitted_at) - timestampValue(a.submitted_at));
    } else if (sortMode === 'created') {
        sorted.sort((a, b) => timestampValue(b.created_at) - timestampValue(a.created_at));
    } else if (sortMode === 'name') {
        sorted.sort((a, b) => (a.hw_name || '').localeCompare(b.hw_name || '', 'th', { sensitivity: 'base' }));
    }

    sorted.forEach((item) => {
        const row = document.createElement('tr');
        [item.hw_name, item.hw_type, item.subject, item.due_date || item.test_date, item.notes].forEach((value) => {
            const cell = document.createElement('td');
            cell.textContent = value || '';
            row.appendChild(cell);
        });

        const timestampCell = document.createElement('td');
        timestampCell.className = 'homework-timestamps';
        [['เพิ่ม', item.created_at], ['เสร็จ', item.completed_at], ['ส่ง', item.submitted_at]].forEach(([label, timestamp]) => {
            const line = document.createElement('div');
            line.textContent = `${label}: ${formatTimestamp(timestamp)}`;
            timestampCell.appendChild(line);
        });
        if (item.record_kind === 'exam' && (item.score != null || item.total_score != null)) {
            const scoreLine = document.createElement('div');
            scoreLine.textContent = `คะแนน: ${item.score ?? '-'} / ${item.total_score ?? '-'}`;
            timestampCell.appendChild(scoreLine);
        }
        row.appendChild(timestampCell);

        const actionCell = document.createElement('td');
        actionCell.className = 'homework-actions';
        const progressButton = document.createElement('button');
        progressButton.type = 'button';
        progressButton.className = 'submit-button';
        progressButton.textContent = item.submitted ? 'ส่งแล้ว' : (item.ready_to_submit || item.completed ? 'ส่ง' : 'เสร็จ');
        progressButton.disabled = Boolean(item.submitted);
        progressButton.addEventListener('click', () => {
            const action = item.ready_to_submit || item.completed ? 'submit_homework' : 'prepare_homework';
            updateHomework(item.id, action);
        });

        if (item.record_kind !== 'exam') {
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.textContent = 'แก้ไข';
            editButton.addEventListener('click', () => openEditDialog(item));
            actionCell.appendChild(editButton);
        }

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'ลบ';
        deleteButton.addEventListener('click', () => updateHomework(item.id, 'delete_homework'));
        actionCell.append(progressButton, deleteButton);
        row.appendChild(actionCell);
        homeworkList.appendChild(row);
    });

    if (sorted.length === 0) statusMessage.textContent = 'ยังไม่มีรายการการบ้าน';
}

async function refreshHomework() {
    try {
        const profile = await window.StudyFlowAPI.loadProfile();
        displayHomework(profile.homework);
    } catch (error) {
        statusMessage.textContent = error.message;
    }
}

async function updateHomework(id, action) {
    try {
        await window.StudyFlowAPI.updateHomework(id, action);
        await refreshHomework();
        statusMessage.textContent = action === 'delete_homework'
            ? 'ลบรายการเรียบร้อยแล้ว'
            : action === 'prepare_homework'
                ? 'ทำเครื่องหมายว่าเสร็จแล้ว กดส่งเมื่องานพร้อมส่ง'
                : 'ส่งการบ้านเรียบร้อยแล้ว';
    } catch (error) {
        statusMessage.textContent = error.message;
    }
}

function openEditDialog(item) {
    document.getElementById('edit-homework-id').value = item.id;
    document.getElementById('edit-hw-name').value = item.hw_name || '';
    document.getElementById('edit-hw-type').value = item.hw_type || 'การบ้าน';
    document.getElementById('edit-subject').value = item.subject || '';
    document.getElementById('edit-due-date').value = item.due_date || '';
    document.getElementById('edit-notes').value = item.notes || '';
    editDialog.showModal();
}

homeworkSort.addEventListener('change', () => {
    sortMode = homeworkSort.value;
    renderSortedHomework();
});

const homeworkTable = document.getElementById('homework-table');
const columnHeaders = Array.from(homeworkTable.querySelectorAll('thead th'));

function syncExpandedColumnState() {
    columnHeaders.forEach((header, index) => {
        const isExpanded = expandedColumn === index + 1;
        header.setAttribute('aria-pressed', String(isExpanded));
        header.setAttribute('aria-expanded', String(isExpanded));
        header.title = isExpanded
            ? 'กด Enter หรือ Space เพื่อคืนขนาดคอลัมน์'
            : 'กด Enter หรือ Space เพื่อขยายคอลัมน์';
    });
}

function toggleExpandedColumn(header) {
    const columnIndex = columnHeaders.indexOf(header) + 1;
    if (columnIndex < 1) return;

    homeworkTable.classList.remove(...Array.from(homeworkTable.classList).filter(name => name.startsWith('expanded-column-')));
    expandedColumn = expandedColumn === columnIndex ? null : columnIndex;

    if (expandedColumn !== null) {
        homeworkTable.classList.add(`expanded-column-${expandedColumn}`);
    }
    syncExpandedColumnState();
}

columnHeaders.forEach((header) => {
    header.tabIndex = 0;
    header.setAttribute('role', 'button');
    header.addEventListener('click', () => toggleExpandedColumn(header));
    header.addEventListener('keydown', (event) => {
        if (event.repeat) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleExpandedColumn(header);
        }
    });
});
syncExpandedColumnState();

document.getElementById('cancel-edit-homework').addEventListener('click', () => editDialog.close());
editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = editForm.querySelector('[type="submit"]');
    button.disabled = true;
    statusMessage.textContent = 'กำลังบันทึกการแก้ไข...';
    try {
        await window.StudyFlowAPI.editHomework(document.getElementById('edit-homework-id').value, {
            hw_name: document.getElementById('edit-hw-name').value,
            hw_type: document.getElementById('edit-hw-type').value,
            subject: document.getElementById('edit-subject').value,
            due_date: document.getElementById('edit-due-date').value,
            notes: document.getElementById('edit-notes').value
        });
        editDialog.close();
        await refreshHomework();
        statusMessage.textContent = 'แก้ไขการบ้านเรียบร้อยแล้ว';
    } catch (error) {
        statusMessage.textContent = error.message || 'ไม่สามารถแก้ไขการบ้านได้';
    } finally {
        button.disabled = false;
    }
});

refreshHomework();
