const reportStatus = document.getElementById('report-status');

async function loadReport() {
    try {
        const profile = await window.StudyFlowAPI.loadProfile();
        const homework = profile.homework;
        const counts = {
            hw_count: homework.length,
            finished: homework.filter((item) => item.completed).length,
            unsubmited: homework.filter((item) => !item.submitted).length,
            submited: homework.filter((item) => item.submitted).length
        };
        for (const [id, count] of Object.entries(counts)) {
            const element = document.getElementById(id);
            if (element) element.textContent = count;
        }
    } catch (error) {
        if (reportStatus) reportStatus.textContent = error.message;
        console.error(error);
    }
}

loadReport();
