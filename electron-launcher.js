const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;
const PORT = 3000;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "Stream Games",
        backgroundColor: '#0f172a', // Тёмный фон до загрузки
        show: false, // Покажем, когда загрузится
        icon: path.join(__dirname, 'Img', 'png', 'PeekH_512x512.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Функция для проверки готовности сервера
    const checkServer = () => {
        http.get(`http://localhost:${PORT}`, (res) => {
            console.log('✅ Сервер готов, загружаем UI...');
            mainWindow.loadURL(`http://localhost:${PORT}`);
        }).on('error', () => {
            console.log('⏳ Ожидание запуска сервера...');
            setTimeout(checkServer, 500);
        });
    };

    checkServer();

    // Устанавливаем масштаб 80% и показываем окно
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setZoomFactor(0.8);
        mainWindow.show();
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
    // На Mac приложение обычно остается активным, пока пользователь не выйдет (Cmd+Q)
    if (process.platform !== 'darwin') {
        if (serverProcess) serverProcess.kill();
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});

// Убиваем сервер при выходе
app.on('before-quit', () => {
    if (serverProcess) serverProcess.kill();
});

