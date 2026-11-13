(() => {
    const STORAGE_KEY = 'studyflow-theme';
    const THEMES = ['default', 'red-yellow', 'green-blue', 'gray-black'];

    function applyTheme(theme) {
        const selected = THEMES.includes(theme) ? theme : 'default';
        document.documentElement.dataset.theme = selected;
        try {
            localStorage.setItem(STORAGE_KEY, selected);
        } catch (error) {
            // The theme still applies for this page if storage is unavailable.
        }
        const picker = document.getElementById('theme-select');
        if (picker && picker.value !== selected) picker.value = selected;
    }

    let savedTheme = 'default';
    try {
        savedTheme = localStorage.getItem(STORAGE_KEY) || 'default';
    } catch (error) {
        // Use the default theme when browser storage is unavailable.
    }
    applyTheme(savedTheme);

    document.addEventListener('DOMContentLoaded', () => {
        const picker = document.getElementById('theme-select');
        if (!picker) return;
        picker.value = THEMES.includes(savedTheme) ? savedTheme : 'default';
        picker.addEventListener('change', () => applyTheme(picker.value));
    });
})();