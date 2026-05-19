(function () {
    const defaultTheme = 'theme-c';
    const headerUrl = 'include/header.html';
    const criticalStyleId = 'shared-header-critical-style';
    const criticalHeaderCss = `
.shared-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 15px 20px;
    text-align: left;
    font-weight: bold;
    font-size: 18px;
}
.shared-header-title {
    display: inline-flex;
    align-items: center;
    min-width: 0;
}
.shared-header-title img {
    display: block;
    max-width: min(50vw, 320px);
    height: auto;
}
.shared-header select {
    flex-shrink: 0;
    width: auto;
    max-width: 45%;
}
.shared-home-links {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 15px;
    background: #f8f9fa;
    border-bottom: 1px solid #eee;
    font-size: 12px;
    text-align: right;
}
.shared-home-link-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px 16px;
    width: 100%;
}
.shared-home-links a {
    color: #666;
    text-decoration: none;
}
.shared-home-links a:hover {
    color: #333;
    text-decoration: underline;
}
@media (max-width: 480px) {
    .shared-header {
        align-items: flex-start;
        gap: 12px;
        padding: 10px 15px;
    }
    .shared-header-title img {
        max-width: 55vw;
    }
    .shared-header select {
        max-width: 40%;
    }
    .shared-home-link-list {
        justify-content: flex-start;
    }
}`;
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
        <a href="poemist.html">诗雾</a>
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

    function ensureCriticalStyle() {
        if (document.getElementById(criticalStyleId)) return;
        const style = document.createElement('style');
        style.id = criticalStyleId;
        style.textContent = criticalHeaderCss;
        document.head.appendChild(style);
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
        ensureCriticalStyle();
        window.loadSavedTheme();
        loadSharedHeader();
    });
})();
