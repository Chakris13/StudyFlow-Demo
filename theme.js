
(() => {
    const STORAGE_KEY = "studyflow-theme";

    function applyTheme(theme) {
        const allowedThemes = [
            "default",
            "red-yellow",
            "green-blue",
            "gray-black"
        ];

        const selected = allowedThemes.includes(theme)
            ? theme
            : "default";

        document.documentElement.setAttribute("data-theme", selected);

        try {
            localStorage.setItem(STORAGE_KEY, selected);
        } catch (error) {
            console.warn("Cannot save theme:", error);
        }

        const selector = document.getElementById("theme-select");
        if (selector) selector.value = selected;
    }

    document.addEventListener("DOMContentLoaded", () => {
        let savedTheme = "default";

        try {
            savedTheme = localStorage.getItem(STORAGE_KEY) || "default";
        } catch (error) {
            console.warn("Cannot load theme:", error);
        }

        applyTheme(savedTheme);

        const selector = document.getElementById("theme-select");

        if (selector) {
            selector.addEventListener("change", () => {
                applyTheme(selector.value);
            });
        }
    });
})();
