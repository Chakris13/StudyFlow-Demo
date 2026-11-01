const reportStatus = document.getElementById('report-status');

async function loadReport() {
    try {
        const response = await fetch('user_data.php');

        if (!response.ok) {
            throw new Error('ไม่สามารถโหลดสรุปการบ้านได้');
        }

        const profile = await response.json();
        if (!Array.isArray(profile.homework)) {
            throw new Error('ข้อมูลการบ้านไม่ถูกต้อง');
        }

        const homework = profile.homework;
        const counts = {
            hw_count: homework.length,
            finished: homework.filter((item) => item.completed).length,
            unsubmited: homework.filter((item) => !item.submitted).length,
            submited: homework.filter((item) => item.submitted).length
        };

        for (const [id, count] of Object.entries(counts)) {
            document.getElementById(id).textContent = count;
        }
    } catch (error) {
        reportStatus.textContent = error.message;
    }
}

loadReport();