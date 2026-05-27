(function () {
    var defaultTheme = 'theme-c';
    var headerUrl = 'include/header.html';
    var criticalStyleId = 'shared-header-critical-style';
    var criticalHeaderCss =
        '.shared-header {\
    display: -ms-flexbox;\
    display: flex;\
    -ms-flex-pack: justify;\
    justify-content: space-between;\
    -ms-flex-align: center;\
    align-items: center;\
    gap: 16px;\
    padding: 15px 20px;\
    text-align: left;\
    font-weight: bold;\
    font-size: 18px;\
}\
.shared-header-title {\
    display: -ms-inline-flexbox;\
    display: inline-flex;\
    -ms-flex-align: center;\
    align-items: center;\
    min-width: 0;\
}\
.shared-header-title img {\
    display: block;\
    max-width: 320px;\
    width: auto;\
    height: auto;\
}\
.shared-header select {\
    -ms-flex-negative: 0;\
    flex-shrink: 0;\
    width: auto;\
    max-width: 45%;\
}\
.shared-home-links {\
    display: -ms-flexbox;\
    display: flex;\
    -ms-flex-pack: justify;\
    justify-content: space-between;\
    -ms-flex-align: center;\
    align-items: center;\
    padding: 8px 15px;\
    background: #f8f9fa;\
    border-bottom: 1px solid #eee;\
    font-size: 12px;\
    text-align: right;\
}\
.shared-home-link-list {\
    display: -ms-flexbox;\
    display: flex;\
    -ms-flex-wrap: wrap;\
    flex-wrap: wrap;\
    -ms-flex-pack: end;\
    justify-content: flex-end;\
    gap: 4px 16px;\
    width: 100%;\
}\
.shared-home-links a {\
    color: #666;\
    text-decoration: none;\
}\
.shared-home-links a:hover {\
    color: #333;\
    text-decoration: underline;\
}\
@media (max-width: 480px) {\
    .shared-header {\
        -ms-flex-align: start;\
        align-items: flex-start;\
        gap: 12px;\
        padding: 10px 15px;\
    }\
    .shared-header-title img {\
        max-width: 55vw;\
    }\
    .shared-header select {\
        max-width: 40%;\
    }\
    .shared-home-link-list {\
        -ms-flex-pack: start;\
        justify-content: flex-start;\
    }\
}';
    var fallbackHeaderHtml =
        '<div class="header text-left shared-header">\
    <a href="index.html" class="shared-header-title">\
        <img src="images/title.png" alt="千年民科网络 - Soph Dot Net">\
    </a>\
    <select id="theme-select" onchange="changeTheme(this.value)" aria-label="选择主题">\
        <option value="theme-c">默认主题</option>\
        <option value="theme-a">深色主题</option>\
        <option value="theme-b">蓝色主题</option>\
        <option value="theme-d">白色主题</option>\
        <option value="theme-e">黄色主题</option>\
        <option value="aero">Aero主题</option>\
        <option value="metro">Metro主题</option>\
    </select>\
</div>\
<div class="home-links shared-home-links">\
    <div class="shared-home-link-list">\
        <a href="index.html">首页</a>\
        <a href="card.html">名片</a>\
        <a href="https://www.baidu.com" target="_blank">baidu.com</a>\
        <a href="https://www.bilibili.com" target="_blank">bilibili.com</a>\
        <a href="https://space.bilibili.com/650205035" target="_blank">站长主页</a>\
        <a href="https://space.bilibili.com/627376584" target="_blank">站长经典老号</a>\
    </div>\
</div>';

    var xhrFallbackHeaderHtml = fallbackHeaderHtml;

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
        }
    }

    function syncThemeSelect() {
        var select = document.getElementById('theme-select');
        if (!select) return;
        select.value = document.body.className || defaultTheme;
    }

    window.changeTheme = function (theme) {
        var nextTheme = theme || defaultTheme;
        document.body.className = nextTheme;
        saveTheme(nextTheme);
        syncThemeSelect();
    };

    window.loadSavedTheme = function () {
        var savedTheme = readSavedTheme();
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
        var style = document.createElement('style');
        style.id = criticalStyleId;
        style.textContent = criticalHeaderCss;
        document.head.appendChild(style);
    }

    function fetchHeaderHtml(callback) {
        if (window.location.protocol === 'file:') {
            callback(xhrFallbackHeaderHtml);
            return;
        }

        var xhr = new XMLHttpRequest();
        xhr.open('GET', headerUrl + '?t=' + new Date().getTime(), true);
        xhr.withCredentials = false;

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    callback(xhr.responseText);
                } else {
                    callback(xhrFallbackHeaderHtml);
                }
            }
        };

        xhr.onerror = function () {
            callback(xhrFallbackHeaderHtml);
        };

        try {
            xhr.send();
        } catch (e) {
            callback(xhrFallbackHeaderHtml);
        }
    }

    function loadSharedHeader() {
        var placeholder = document.getElementById('topbar-placeholder');
        if (!placeholder) return;

        fetchHeaderHtml(function (html) {
            placeholder.outerHTML = html;
            bindThemeSelect();
        });
    }

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    onReady(function () {
        ensureCriticalStyle();
        window.loadSavedTheme();
        loadSharedHeader();
    });
})();
