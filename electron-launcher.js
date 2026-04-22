const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "Stream Games Standalone",
        icon: path.join(__dirname, 'Img', 'icon.png'), // Если есть иконка
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Загружаем локальный сервер (ждем 2 секунды, чтобы Node.js успел подняться)
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
    }, 2000);

    // Устанавливаем масштаб 80% (0.8)
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setZoomFactor(0.8);
    });

    // Если сервер еще не поднялся, пробуем перезагрузить через секунду
    mainWindow.webContents.on('did-fail-load', () => {
        setTimeout(() => {
            mainWindow.loadURL('http://localhost:3000');
        }, 1000);
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    // Убираем стандартное меню
    mainWindow.setMenu(null);
}

// Запускаем сервер как дочерний процесс
function startServer() {
    serverProcess = fork(path.join(__dirname, 'server.js'), [], {
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    });

    serverProcess.on('exit', (code) => {
        console.log(`Server process exited with code ${code}`);
        if (mainWindow) app.quit();
    });
}

app.on('ready', () => {
    startServer();
    createWindow();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        if (serverProcess) serverProcess.kill();
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});
