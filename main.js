const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ゲーム状態管理 ---
let gameState = 'menu'; // 'menu' (開始画面), 'playing' (プレイ中), 'result' (結果)
let currentMode = 'earth';
let isDrawing = false;
let pathData = [];
let currentScore = 0;
let resultMessage = "";

// モードごとの設定（半径X, 半径Y）
const modes = {
    earth: { name: '地球', rx: 150, ry: 150, color: '#00FFFF' },
    comet: { name: '彗星', rx: 250, ry: 80, color: '#FF4500' }
};

let bestScores = {
    earth: localStorage.getItem('perfectOrbitBest_earth') || 0,
    comet: localStorage.getItem('perfectOrbitBest_comet') || 0
};
let isNewBest = false;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function calculateScore() {
    if (pathData.length < 10) return { score: 0, message: "軌道が短すぎます" };

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const rx = modes[currentMode].rx;
    const ry = modes[currentMode].ry;

    let totalError = 0;
    let pathLength = 0; // 塗りつぶし対策：線の総距離

    for (let i = 0; i < pathData.length; i++) {
        // 1. 誤差の計算（楕円を円に変換して計算するトリック）
        const dx = pathData[i].x - centerX;
        const dy = pathData[i].y - centerY;
        const normalizedY = dy * (rx / ry);
        const distance = Math.sqrt(dx * dx + normalizedY * normalizedY);
        const error = Math.abs(distance - rx);
        totalError += error;

        // 2. 線の総距離を足していく
        if (i > 0) {
            const stepX = pathData[i].x - pathData[i-1].x;
            const stepY = pathData[i].y - pathData[i-1].y;
            pathLength += Math.sqrt(stepX * stepX + stepY * stepY);
        }
    }

    // --- チート（塗りつぶし）対策 ---
    // 楕円の円周の近似値を計算
    const expectedPerimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    // 軌道の1.5倍以上描いていたら「塗りつぶし」と判定して0点
    if (pathLength > expectedPerimeter * 1.5) {
        return { score: 0, message: "線が長すぎます！(塗りつぶし禁止)" };
    }

    const averageError = totalError / pathData.length;

    // 始点と終点の距離チェック（一周したか）
    const startPoint = pathData[0];
    const endPoint = pathData[pathData.length - 1];
    const gapDistance = Math.sqrt(Math.pow(startPoint.x - endPoint.x, 2) + Math.pow(startPoint.y - endPoint.y, 2));

    if (gapDistance > 50) return { score: 0, message: "軌道が閉じていません" };

    // スコア計算
    let score = 100 - (averageError / rx) * 100;
    score = Math.max(0, Math.min(100, score)); // 0〜100に収める

    let msg = "Try Again";
    if (score >= 99) msg = "PERFECT!!";
    else if (score >= 95) msg = "GREAT!";
    else if (score >= 90) msg = "GOOD!";

    return { score: score, message: msg };
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    if (gameState === 'menu') {
        // --- スタート画面 ---
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('Perfect Orbit', centerX, centerY - 150);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('描く軌道を選んでください', centerX, centerY - 100);

        // 地球ボタン
        ctx.fillStyle = '#00008B';
        ctx.fillRect(centerX - 120, centerY - 40, 240, 60);
        ctx.fillStyle = 'white';
        ctx.font = '24px sans-serif';
        ctx.fillText('地球 (円軌道)', centerX, centerY);

        // 彗星ボタン
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(centerX - 120, centerY + 40, 240, 60);
        ctx.fillStyle = 'white';
        ctx.fillText('彗星 (楕円軌道)', centerX, centerY + 80);
        return;
    }

    // --- プレイ中 ＆ 結果画面 ---
    const rx = modes[currentMode].rx;
    const ry = modes[currentMode].ry;

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '24px sans-serif';
    ctx.fillText(modes[currentMode].name + 'の軌道を描こう', centerX, 50);

    // 正解の軌道（楕円描画に対応）
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 太陽
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#FFCC00';
    ctx.fill();

    // プレイヤーの線
    if (pathData.length > 0) {
        ctx.beginPath();
        ctx.moveTo(pathData[0].x, pathData[0].y);
        for (let i = 1; i < pathData.length; i++) {
            ctx.lineTo(pathData[i].x, pathData[i].y);
        }
        ctx.strokeStyle = modes[currentMode].color;
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    if (gameState === 'result') {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillText(currentScore.toFixed(2) + '%', centerX, centerY - 60);

        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#32CD32';
        ctx.fillText(resultMessage, centerX, centerY - 15);

        ctx.font = '24px sans-serif';
        const best = bestScores[currentMode];
        if (isNewBest) {
            ctx.fillStyle = '#FF69B4';
            ctx.fillText('NEW BEST! ' + best.toFixed(2) + '%', centerX, centerY + 30);
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText('BEST: ' + parseFloat(best).toFixed(2) + '%', centerX, centerY + 30);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '18px sans-serif';
        ctx.fillText('画面をタッチ/クリックでメニューへ', centerX, centerY + 100);
    }
}

// --- イベント処理 ---
canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    if (gameState === 'menu') {
        // ボタンの当たり判定
        if (x > centerX - 120 && x < centerX + 120) {
            if (y > centerY - 40 && y < centerY + 20) {
                currentMode = 'earth';
                gameState = 'playing';
            } else if (y > centerY + 40 && y < centerY + 100) {
                currentMode = 'comet';
                gameState = 'playing';
            }
        }
        render();
        return;
    }

    if (gameState === 'result') {
        gameState = 'menu';
        isNewBest = false;
        pathData = [];
        render();
        return;
    }

    isDrawing = true;
    pathData = [{ x, y }];
    render();
});

canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing || gameState !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    pathData.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    render();
});

canvas.addEventListener('pointerup', () => {
    if (!isDrawing || gameState !== 'playing') return;
    isDrawing = false;

    const result = calculateScore();
    currentScore = result.score;
    resultMessage = result.message;
    gameState = 'result';

    // ベストスコア更新判定
    if (currentScore > bestScores[currentMode]) {
        bestScores[currentMode] = currentScore;
        isNewBest = true;
        localStorage.setItem('perfectOrbitBest_' + currentMode, bestScores[currentMode]);
    }

    render();
});

resizeCanvas();
render();