const root = document.getElementById('appRoot');

async function loadView(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path}.`);
    return response.text();
}

async function bootstrap() {
    try {
        const [authView, chatView] = await Promise.all([
            loadView('/views/auth.html'),
            loadView('/views/chat.html')
        ]);
        root.innerHTML = `${authView}${chatView}`;
        await import('./main.js');
    } catch (error) {
        root.textContent = error.message || 'Commonroom could not start.';
    }
}

bootstrap();
