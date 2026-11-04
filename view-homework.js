const statusMessage = document.getElementById('status-message');
const homeworkList = document.getElementById('homework-list');

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
    homeworkList.replaceChildren();

    homework.forEach((item) => {
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

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'ลบ';
        deleteButton.addEventListener('click', () => updateHomework(item.id, 'delete_homework'));
        actionCell.append(progressButton, deleteButton);
        row.appendChild(actionCell);
        homeworkList.appendChild(row);
    });

    if (homework.length === 0) statusMessage.textContent = 'ยังไม่มีรายการการบ้าน';
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

refreshHomework();
