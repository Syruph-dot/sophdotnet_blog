(function () {
    const defaultTheme = 'theme-c';
    const headerUrl = 'include/header.html';
    const fallbackHeaderHtml = `
<div class="header text-left shared-header">
    <a href="index.html" class="shared-header-title">
        <img src="images/title.png" alt="千年民科网络 - Soph Dot Net">
    </a>
    <select id="theme-select" onchange="changeTheme(this.value)" aria-label="选择主题">
        <option value="theme-c">默认主题</option>
        <option value="theme-a">深色主题</option>
        <option value="theme-b">蓝色主题</option>
        <option value="theme-d">白色主题</option>
        <option value="theme-e">黄色主题</option>
        <option value="aero">Aero主题</option>
        <option value="metro">Metro主题</option>
    </select>
</div>
<div class="home-links shared-home-links">
    <div class="shared-home-link-list">
        <a href="index.html">首页</a>
        <a href="https://www.baidu.com" target="_blank">baidu.com</a>
        <a href="https://www.bilibili.com" target="_blank">bilibili.com</a>
        <a href="https://space.bilibili.com/650205035" target="_blank">站长主页</a>
        <a href="https://space.bilibili.com/627376584" target="_blank">站长经典老号</a>
    </div>
</div>`;

    function readSavedTheme() {
        try {
            return localStorage.getItem('theme');
        } catch (error) {
            return null;
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem('theme', theme);
        } catch (error) {
            // Ignore storage errors in restricted browser modes.
        }
    }

    function syncThemeSelect() {
        const select = document.getElementById('theme-select');
        if (!select) return;
        select.value = document.body.className || defaultTheme;
    }

    window.changeTheme = function (theme) {
        const nextTheme = theme || defaultTheme;
        document.body.className = nextTheme;
        saveTheme(nextTheme);
        syncThemeSelect();
    };

    window.loadSavedTheme = function () {
        const savedTheme = readSavedTheme();
        if (savedTheme) {
            document.body.className = savedTheme;
        }
        syncThemeSelect();
    };

    function bindThemeSelect() {
        syncThemeSelect();
    }

    async function fetchHeaderHtml() {
        if (window.location.protocol === 'file:') {
            return fallbackHeaderHtml;
        }

        try {
            const response = await fetch(headerUrl, { cache: 'no-cache' });
            if (!response.ok) {
                throw new Error('Failed to load ' + headerUrl + ': ' + response.status);
            }
            return await response.text();
        } catch (error) {
            return fallbackHeaderHtml;
        }
    }

    async function loadSharedHeader() {
        const placeholder = document.getElementById('topbar-placeholder');
        if (!placeholder) return;

        placeholder.outerHTML = await fetchHeaderHtml();
        bindThemeSelect();
    }

    document.addEventListener('DOMContentLoaded', function () {
        window.loadSavedTheme();
        loadSharedHeader();
    });
})();
