const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 音声管理 ---
// BGM候補リスト（Bell_Accent13-1(High).mp3を除外）
const bgmList = [
    'bgm.mp3',
    '05 meteor shower.mp3',
    '07 Argo Navis.mp3',
    '08 ウラノメトリア.mp3'
];
const bgmAudio = new Audio();
bgmAudio.loop = true;

const seResult = new Audio('se_result.mp3');
// 描き始めと接続時のベル効果音
const seBell = new Audio('Bell_Accent13-1(High).mp3');

const bgmSelect = document.getElementById('bgmSelect');
const volumeSlider = document.getElementById('volumeSlider');

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

    // 日本語ファイル名などのURLエンコード差異を吸収して判定
    const currentSrc = decodeURIComponent(bgmAudio.src);
    if (!currentSrc.endsWith(selected)) {
        bgmAudio.src = encodeURI(selected);
    }

    updateAudioVolume();
    bgmAudio.play().catch(() => {
        console.log("Audio playback blocked until further user gesture.");
    });
}

bgmSelect.addEventListener('change', () => {
    if (gameState === 'playing' || gameState === 'result') {
        startBgmPlayback();
    }
});

volumeSlider.addEventListener('input', updateAudioVolume);

// --- DOM要素 ---
const menuUI = document.getElementById('menuUI');
const playingUI = document.getElementById('playingUI');
const resultUI = document.getElementById('resultUI');
const targetText = document.getElementById('targetText');
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
    earth: { name: 'EARTH', rx: 150, ry: 150, color: '#49d5b6' },
    comet: { name: 'COMET', rx: 250, ry: 80, color: '#ff5e3a' }
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

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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

function calculateScore() {
    if (pathData.length < 10) return { score: 0, message: "TOO SHORT" };
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const rx = modes[currentMode].rx;
    const ry = modes[currentMode].ry;

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
    if (Math.abs(cumulativeAngle) < Math.PI * (350 / 180)) return { score: 0, message: "INCOMPLETE" };

    let score = 100 - ((totalError / pathData.length) / rx) * 100;
    score = Math.max(0, Math.min(100, score));

    let msg = "STABLE";
    if (score >= 99) msg = "PERFECT";
    else if (score >= 95) msg = "EXCELLENT";
    else if (score >= 90) msg = "GREAT";
    else if (score < 70) msg = "UNSTABLE";

    return { score: score, message: msg };
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

    // 接続時にベルSEを再生
    seBell.currentTime = 0;
    seBell.play().catch(() => {});

    const result = calculateScore();
    currentScore = result.score;

    evalText.innerText = result.message;
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

    const rx = modes[currentMode].rx;
    const ry = modes[currentMode].ry;
    const lineColor = modes[currentMode].color;

    // 基準軌道と恒星
    if (gameState === 'playing' || gameState === 'calculating') {
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#ffcf56';
        ctx.shadowColor = 'rgba(255, 207, 86, 0.4)';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // プレイヤーの描画軌道
    if (pathData.length > 0 && gameState !== 'menu') {
        ctx.beginPath();
        ctx.moveTo(pathData[0].x, pathData[0].y);
        for (let i = 1; i < pathData.length; i++) {
            ctx.lineTo(pathData[i].x, pathData[i].y);
        }
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = (gameState === 'playing') ? 3 : 4;
        ctx.stroke();
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

    // 描き始めにベルSEを再生
    seBell.currentTime = 0;
    seBell.play().catch(() => {});

    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    pathData = [{ x, y }];
    cumulativeAngle = 0;
    lastAngle = Math.atan2(y - (canvas.height / 2), x - (canvas.width / 2));
});

canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing || gameState !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    pathData.push({ x, y });
    createParticles(x, y, modes[currentMode].color);

    const currentAngle = Math.atan2(y - centerY, x - centerX);
    let deltaAngle = currentAngle - lastAngle;

    if (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

    cumulativeAngle += deltaAngle;
    lastAngle = currentAngle;

    if (Math.abs(cumulativeAngle) >= Math.PI * (370 / 180) && pathData.length > 20) {
        finishDrawing();
    }
});

canvas.addEventListener('pointerup', finishDrawing);

window.addEventListener('resize', resizeCanvas);

resizeCanvas();
setUIState('menu');
render();