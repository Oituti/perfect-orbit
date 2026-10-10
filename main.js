const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 音声管理 ---
const bgmList = [
    'bgm.mp3',
    '05 meteor shower.mp3',
    '07 Argo Navis.mp3',
    '08 ウラノメトリア.mp3'
];
const bgmAudio = new Audio();
bgmAudio.loop = true;

const seResult = new Audio('se_result.mp3');
const seBell = new Audio('Bell_Accent13-1(High).mp3');

const bgmSelect = document.getElementById('bgmSelect');
const volumeSlider = document.getElementById('volumeSlider');
const orientBtn = document.getElementById('orientBtn');
const audioControls = document.getElementById('audioControls');
const toggleControlsBtn = document.getElementById('toggleControlsBtn');

let isPortraitMode = true;

// 設定パネルの開閉処理
toggleControlsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    audioControls.classList.toggle('collapsed');
});

function updateAudioVolume() {
    const vol = parseFloat(volumeSlider.value);
    bgmAudio.volume = vol;
    seResult.volume = Math.min(1, vol * 1.5);
    seBell.volume = Math.min(1, vol * 1.2);
}

function startBgmPlayback() {
    let selected = bgmSelect.value;
    if (selected === 'random') {
        const randomIndex = Math.floor(Math.random() * bgmList.length);
        selected = bgmList[randomIndex];
    }

    const currentSrc = decodeURIComponent(bgmAudio.src);
    if (!currentSrc.endsWith(selected)) {
        bgmAudio.src = encodeURI(selected);
    }

    updateAudioVolume();
    bgmAudio.play().catch(() => {
        console.log("Audio playback blocked until further user gesture.");
    });
}

// ドロップダウンで変更した瞬間に即座にBGMを切り替えて再生
bgmSelect.addEventListener('change', () => {
    startBgmPlayback();
});

volumeSlider.addEventListener('input', updateAudioVolume);

orientBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    isPortraitMode = !isPortraitMode;
    orientBtn.innerText = isPortraitMode ? "📱 縦固定" : "🔄 横固定";

    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen().catch(() => {});
        }
        if (screen.orientation && screen.orientation.lock) {
            const targetOrient = isPortraitMode ? 'portrait-primary' : 'landscape-primary';
            await screen.orientation.lock(targetOrient).catch(() => {});
        }
    } catch (e) {
        console.log("Orientation lock not supported:", e);
    }

    resizeCanvas();
});

// --- DOM要素 ---
const menuUI = document.getElementById('menuUI');
const playingUI = document.getElementById('playingUI');
const resultUI = document.getElementById('resultUI');
const targetText = document.getElementById('targetText');
const liveScoreText = document.getElementById('liveScoreText');
const evalText = document.getElementById('evalText');
const scoreText = document.getElementById('scoreText');
const bestText = document.getElementById('bestText');
const triviaText = document.getElementById('triviaText');

let gameState = 'menu';
let currentMode = 'earth';
let isDrawing = false;
let pathData = [];
let particles = [];
let currentScore = 0;
let cumulativeAngle = 0;
let lastAngle = 0;

const modes = {
    earth: { name: 'EARTH', baseHue: 168, starColor: '#49d5b6', starShadow: 'rgba(73, 213, 182, 0.5)' },
    comet: { name: 'COMET', baseHue: 12, starColor: '#ff5e3a', starShadow: 'rgba(255, 94, 58, 0.5)' }
};

const triviaList = {
    earth: [
        "地球は太陽の周囲を秒速約30kmという猛スピードで航行しています。",
        "地球の公転軌道は完全な真円ではなく、離心率約0.0167の極めて僅かな楕円です。",
        "地球が太陽に最も近づく「近日点」は毎年1月上旬に到達します。"
    ],
    comet: [
        "多くの彗星は太陽系外縁のオールトの雲やカイパーベルトを起源としています。",
        "彗星の尾は太陽風に煽られるため、進行方向に関わらず常に太陽と反対側に伸びます。",
        "楕円軌道を描く長周期彗星の中には、1周に数万年以上の時間を要するものも存在します。"
    ]
};

let bestScores = {
    earth: parseFloat(localStorage.getItem('perfectOrbitBest_earth')) || 0,
    comet: parseFloat(localStorage.getItem('perfectOrbitBest_comet')) || 0
};

function getOrbitRadius(mode) {
    const minDim = Math.min(canvas.width, canvas.height);
    const isPortrait = canvas.height > canvas.width;

    if (mode === 'earth') {
        const radius = Math.min(minDim * 0.32, 160);
        return { rx: radius, ry: radius };
    } else {
        if (isPortrait) {
            const ry = Math.min(canvas.height * 0.32, 240);
            const rx = Math.min(canvas.width * 0.35, 100);
            return { rx, ry };
        } else {
            const rx = Math.min(canvas.width * 0.35, 250);
            const ry = Math.min(canvas.height * 0.32, 90);
            return { rx, ry };
        }
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function getPointColor(point, centerX, centerY, mode) {
    const { rx, ry } = getOrbitRadius(mode);
    const baseHue = modes[mode].baseHue;

    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const normalizedY = dy * (rx / ry);
    const distance = Math.sqrt(dx * dx + normalizedY * normalizedY);

    const error = Math.abs(distance - rx);
    const maxError = 40;
    const ratio = Math.min(1, error / maxError);

    const currentHue = (baseHue + ratio * 180) % 360;
    return `hsl(${currentHue}, 85%, 55%)`;
}

function createParticles(x, y, color) {
    const count = 2;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 0.8,
            color: color
        });
    }
}

// 修正後スコア計算関数
function calculateScore() {
    if (pathData.length < 10) return { score: 0, message: "TOO SHORT" };
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const { rx, ry } = getOrbitRadius(currentMode);

    let totalError = 0;
    let pathLength = 0;

    for (let i = 0; i < pathData.length; i++) {
        const dx = pathData[i].x - centerX;
        const dy = pathData[i].y - centerY;
        const normalizedY = dy * (rx / ry);
        const distance = Math.sqrt(dx * dx + normalizedY * normalizedY);
        totalError += Math.abs(distance - rx);
        if (i > 0) {
            pathLength += Math.sqrt(Math.pow(pathData[i].x - pathData[i-1].x, 2) + Math.pow(pathData[i].y - pathData[i-1].y, 2));
        }
    }

    const expectedPerimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    if (pathLength > expectedPerimeter * 1.5) return { score: 0, message: "OVERDRAWN" };

    // ★ 修正：描画完了前に指を離してしまった場合はスコア0でINCOMPLETEとする
    if (Math.abs(cumulativeAngle) < Math.PI * (350 / 180)) {
        return { score: 0, message: "INCOMPLETE" };
    }

    let score = 100 - ((totalError / pathData.length) / rx) * 100;
    score = Math.max(0, Math.min(100, score));

    let msg = "STABLE";
    if (score >= 99) msg = "PERFECT";
    else if (score >= 95) msg = "EXCELLENT";
    else if (score >= 90) msg = "GREAT";
    else if (score < 70) msg = "UNSTABLE";

    return { score: score, message: msg };
}

function updateLiveScore() {
    // 描画途中（画面上のリアルタイム計算）
    if (pathData.length < 2) {
        liveScoreText.innerText = "100.0%";
        liveScoreText.style.color = modes[currentMode].starColor;
        return;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const { rx, ry } = getOrbitRadius(currentMode);

    let totalError = 0;
    for (let i = 0; i < pathData.length; i++) {
        const dx = pathData[i].x - centerX;
        const dy = pathData[i].y - centerY;
        const normalizedY = dy * (rx / ry);
        const distance = Math.sqrt(dx * dx + normalizedY * normalizedY);
        totalError += Math.abs(distance - rx);
    }

    let currentAcc = 100 - ((totalError / pathData.length) / rx) * 100;
    currentAcc = Math.max(0, Math.min(100, currentAcc));

    liveScoreText.innerText = currentAcc.toFixed(1) + '%';

    if (currentAcc >= 90) {
        liveScoreText.style.color = modes[currentMode].starColor;
    } else if (currentAcc >= 70) {
        liveScoreText.style.color = '#f0f3f8';
    } else {
        liveScoreText.style.color = '#ff5e3a';
    }
}

function setUIState(state) {
    menuUI.classList.add('hidden');
    playingUI.classList.add('hidden');
    resultUI.classList.add('hidden');

    if (state === 'menu') menuUI.classList.remove('hidden');
    else if (state === 'playing') playingUI.classList.remove('hidden');
    else if (state === 'result') resultUI.classList.remove('hidden');
}

function startGame(mode) {
    currentMode = mode;
    gameState = 'playing';
    targetText.innerText = `${modes[currentMode].name} ORBIT`;
    liveScoreText.innerText = "100.0%";
    liveScoreText.style.color = modes[currentMode].starColor;
    setUIState('playing');
    startBgmPlayback();
}

document.getElementById('btnEarth').addEventListener('click', () => startGame('earth'));
document.getElementById('btnComet').addEventListener('click', () => startGame('comet'));

document.getElementById('btnShare').addEventListener('click', (e) => {
    e.stopPropagation();
    const text = encodeURIComponent(`My orbit score for ${modes[currentMode].name}: ${currentScore.toFixed(1)}%\nCan you draw a stable celestial orbit?\n#PerfectOrbit`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
});

function finishDrawing() {
    if (!isDrawing || gameState !== 'playing') return;
    isDrawing = false;

    seBell.currentTime = 0;
    seBell.play().catch(() => {});

    const result = calculateScore();
    currentScore = result.score;

    evalText.innerText = result.message;
    evalText.style.color = (currentScore === 0) ? '#ff5e3a' : modes[currentMode].starColor;
    scoreText.innerText = currentScore.toFixed(1) + '%';

    let isNewBest = false;
    if (currentScore > bestScores[currentMode]) {
        bestScores[currentMode] = currentScore;
        isNewBest = true;
        localStorage.setItem('perfectOrbitBest_' + currentMode, bestScores[currentMode]);
    }

    if (isNewBest) {
        bestText.innerText = 'NEW BEST  ' + bestScores[currentMode].toFixed(1) + '%';
        bestText.classList.add('new-best');
    } else {
        bestText.innerText = 'BEST  ' + bestScores[currentMode].toFixed(1) + '%';
        bestText.classList.remove('new-best');
    }

    const triviaArray = triviaList[currentMode];
    triviaText.innerText = triviaArray[Math.floor(Math.random() * triviaArray.length)];

    gameState = 'calculating';
    setUIState('calculating');

    setTimeout(() => {
        gameState = 'result';
        setUIState('result');
        seResult.currentTime = 0;
        seResult.play().catch(() => {});
    }, 600);
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const { rx, ry } = getOrbitRadius(currentMode);
    const modeConfig = modes[currentMode];

    // 基準軌道と恒星
    if (gameState === 'playing' || gameState === 'calculating') {
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 16, 0, Math.PI * 2);
        ctx.fillStyle = modeConfig.starColor;
        ctx.shadowColor = modeConfig.starShadow;
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // プレイヤーの描画軌道
    if (pathData.length > 1 && gameState !== 'menu') {
        const lineWidth = (gameState === 'playing') ? 3 : 4;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 0; i < pathData.length - 1; i++) {
            const p1 = pathData[i];
            const p2 = pathData[i + 1];

            const color1 = getPointColor(p1, centerX, centerY, currentMode);
            const color2 = getPointColor(p2, centerX, centerY, currentMode);

            const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            grad.addColorStop(0, color1);
            grad.addColorStop(1, color2);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = grad;
            ctx.stroke();
        }
    }

    // パーティクル
    if (gameState !== 'result') {
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.04;
            if (p.life <= 0) {
                particles.splice(i, 1);
            } else {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
        }
    }

    requestAnimationFrame(render);
}

// 入力イベント
canvas.addEventListener('pointerdown', (e) => {
    if (gameState === 'result') {
        gameState = 'menu';
        pathData = [];
        particles = [];
        setUIState('menu');
        return;
    }

    if (gameState !== 'playing') return;

    seBell.currentTime = 0;
    seBell.play().catch(() => {});

    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    pathData = [{ x, y }];
    cumulativeAngle = 0;
    lastAngle = Math.atan2(y - (canvas.height / 2), x - (canvas.width / 2));

    updateLiveScore();
});

canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing || gameState !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const currentPoint = { x, y };
    pathData.push(currentPoint);

    const currentColor = getPointColor(currentPoint, centerX, centerY, currentMode);
    createParticles(x, y, currentColor);

    const currentAngle = Math.atan2(y - centerY, x - centerX);
    let deltaAngle = currentAngle - lastAngle;

    if (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

    cumulativeAngle += deltaAngle;
    lastAngle = currentAngle;

    updateLiveScore();

    if (Math.abs(cumulativeAngle) >= Math.PI * (370 / 180) && pathData.length > 20) {
        finishDrawing();
    }
});

canvas.addEventListener('pointerup', finishDrawing);

window.addEventListener('resize', resizeCanvas);

resizeCanvas();
setUIState('menu');
render();