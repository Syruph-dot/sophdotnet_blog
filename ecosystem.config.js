module.exports = {
    apps: [
        {
            name: 'sophdotnet',
            script: 'app.js',
            watch: ['app.js', 'blog-service.js', 'blog.html', 'openblog'],
            ignore_watch: ['node_modules', '.git', 'openblog/**/.git'],
            env: {
                NODE_ENV: 'production',
                PORT: 8787
            }
        }
    ]
};
