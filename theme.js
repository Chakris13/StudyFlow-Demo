(() => {
    const STORAGE_KEY = 'studyflow-theme';
    const THEMES = ['default', 'red-yellow', 'green-blue', 'gray-black'];
    const LABELS = {
        default: 'Default · น้ำเงิน-ม่วง',
        'red-yellow': 'แดง-เหลือง',
        'green-blue': 'เขียว-ฟ้า',
        'gray-black': 'เทา-ดำ'
    };

    function applyTheme(theme) {
        const selected = THEMES.includes(theme) ? theme : 'default';
        document.documentElement.dataset.theme = selected;
        try {
            localStorage.setItem(STORAGE_KEY, selected);
        } catch (error) {
            // Theme remains active for this page if storage is unavailable.
        }
        const picker = document.getElementById('theme-select');
        if (picker && picker.value !== selected) picker.value = selected;
        const globalPicker = document.getElementById('studyflow-theme-picker');
        if (globalPicker && globalPicker.value !== selected) globalPicker.value = selected;
    }

    let savedTheme = 'default';
    try {
        savedTheme = localStorage.getItem(STORAGE_KEY) || 'default';
    } catch (error) {
        // Use the default theme when browser storage is unavailable.
    }
    applyTheme(savedTheme);

    function createGlobalPicker() {
        if (document.getElementById('studyflow-theme-control')) return;
        const control = document.createElement('div');
        control.id = 'studyflow-theme-control';

        const label = document.createElement('label');
        label.htmlFor = 'studyflow-theme-picker';
        label.textContent = 'ธีม';

        const select = document.createElement('select');
        select.id = 'studyflow-theme-picker';
        select.setAttribute('aria-label', 'เปลี่ยนธีมสีของ StudyFlow');

        THEMES.forEach((theme) => {
            const option = document.createElement('option');
            option.value = theme;
            option.textContent = LABELS[theme];
            select.appendChild(option);
        });

        select.value = THEMES.includes(savedTheme) ? savedTheme : 'default';
        select.addEventListener('change', () => applyTheme(select.value));
        control.append(label, select);
        document.body.appendChild(control);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const settingsPicker = document.getElementById('theme-select');
        if (settingsPicker) {
            settingsPicker.value = THEMES.includes(savedTheme) ? savedTheme : 'default';
            settingsPicker.addEventListener('change', () => applyTheme(settingsPicker.value));
        }
        createGlobalPicker();
    });
})();