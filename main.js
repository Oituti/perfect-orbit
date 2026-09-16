const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ゲーム状態管理 ---
let gameState = 'menu';
let currentMode = 'earth';
let isDrawing = false;
let pathData = [];
let particles = []; // 追加：パーティクル（光の粒）を管理する配列
let currentScore = 0;
let resultMessage = "";

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

// --- パーティクル生成関数 ---
function createParticles(x, y, color) {
    // マウスの動きに合わせて2〜4個の粒子を生成
    const count = Math.random() * 3 + 2;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4, // X方向のランダムな速度
            vy: (Math.random() - 0.5) * 4, // Y方向のランダムな速度
            life: 1.0, // 寿命（1.0から減っていく）
            color: color
        });
    }
}

function calculateScore() {
    if (pathData.length < 10) return { score: 0, message: "軌道が短すぎます" };

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
        const error = Math.abs(distance - rx);
        totalError += error;

        if (i > 0) {
            const stepX = pathData[i].x - pathData[i-1].x;
            const stepY = pathData[i].y - pathData[i-1].y;
            pathLength += Math.sqrt(stepX * stepX + stepY * stepY);
        }
    }

    const expectedPerimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    if (pathLength > expectedPerimeter * 1.5) {
        return { score: 0, message: "線が長すぎます！(塗りつぶし禁止)" };
    }

    const averageError = totalError / pathData.length;

    const startPoint = pathData[0];
    const endPoint = pathData[pathData.length - 1];
    const gapDistance = Math.sqrt(Math.pow(startPoint.x - endPoint.x, 2) + Math.pow(startPoint.y - endPoint.y, 2));

    if (gapDistance > 50) return { score: 0, message: "軌道が閉じていません" };

    let score = 100 - (averageError / rx) * 100;
    score = Math.max(0, Math.min(100, score));

    let msg = "Try Again";
    if (score >= 99) msg = "PERFECT!!";
    else if (score >= 95) msg = "GREAT!";
    else if (score >= 90) msg = "GOOD!";

    return { score: score, message: msg };
}

// 毎フレーム呼ばれる描画ループ
function render() {
    // 画面消去
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    if (gameState === 'menu') {
        ctx.shadowBlur = 0; // グロー効果リセット
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('Perfect Orbit', centerX, centerY - 150);
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('描く軌道を選んでください', centerX, centerY - 100);

        ctx.fillStyle = '#00008B';
        ctx.fillRect(centerX - 120, centerY - 40, 240, 60);
        ctx.fillStyle = 'white';
        ctx.font = '24px sans-serif';
        ctx.fillText('地球 (円軌道)', centerX, centerY);

        ctx.fillStyle = '#8B0000';
        ctx.fillRect(centerX - 120, centerY + 40, 240, 60);
        ctx.fillStyle = 'white';
        ctx.fillText('彗星 (楕円軌道)', centerX, centerY + 80);

        requestAnimationFrame(render);
        return;
    }

    const rx = modes[currentMode].rx;
    const ry = modes[currentMode].ry;
    const lineColor = modes[currentMode].color;

    // --- エフェクトと背景の描画 ---
    ctx.shadowBlur = 0;

    // 正解の軌道
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 太陽 (少し光らせる)
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FFCC00';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#FFCC00';
    ctx.fill();

    // プレイヤーの線 (グロー効果)
    if (pathData.length > 0) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = lineColor;
        ctx.beginPath();
        ctx.moveTo(pathData[0].x, pathData[0].y);
        for (let i = 1; i < pathData.length; i++) {
            ctx.lineTo(pathData[i].x, pathData[i].y);
        }
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    // パーティクルの更新と描画
    ctx.shadowBlur = 10;
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03; // 少しずつ消える

        if (p.life <= 0) {
            particles.splice(i, 1);
        } else {
            ctx.shadowColor = p.color;
            ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.random() * 2 + 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // --- UI（テキスト）の描画 ---
    ctx.shadowBlur = 0; // テキストがぼやけないようにリセット

    if (gameState === 'playing') {
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = '24px sans-serif';
        // 画面上部に配置
        ctx.fillText(modes[currentMode].name + 'の軌道を描こう', centerX, 50);
    }

    if (gameState === 'result') {
        ctx.textAlign = 'center';

        // 結果は画面の「上部」にまとめて表示（軌道と被らないように）
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillText(currentScore.toFixed(2) + '%', centerX, 80);

        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#32CD32';
        ctx.fillText(resultMessage, centerX, 130);

        ctx.font = '24px sans-serif';
        const best = bestScores[currentMode];
        if (isNewBest) {
            ctx.fillStyle = '#FF69B4';
            ctx.fillText('NEW BEST! ' + best.toFixed(2) + '%', centerX, 170);
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText('BEST: ' + parseFloat(best).toFixed(2) + '%', centerX, 170);
        }

        // リトライ案内は画面の「下部」に配置
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '18px sans-serif';
        ctx.fillText('画面をタッチ/クリックでメニューへ', centerX, canvas.height - 40);
    }

    // アニメーションループを継続
    requestAnimationFrame(render);
}

// --- イベント処理 ---
canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    if (gameState === 'menu') {
        if (x > centerX - 120 && x < centerX + 120) {
            if (y > centerY - 40 && y < centerY + 20) {
                currentMode = 'earth';
                gameState = 'playing';
            } else if (y > centerY + 40 && y < centerY + 100) {
                currentMode = 'comet';
                gameState = 'playing';
            }
        }
        return;
    }

    if (gameState === 'result') {
        gameState = 'menu';
        isNewBest = false;
        pathData = [];
        particles = []; // パーティクルもリセット
        return;
    }

    isDrawing = true;
    pathData = [{ x, y }];
});

canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing || gameState !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    pathData.push({ x, y });

    // 動かしている間、パーティクルを生成
    createParticles(x, y, modes[currentMode].color);
});

canvas.addEventListener('pointerup', () => {
    if (!isDrawing || gameState !== 'playing') return;
    isDrawing = false;

    const result = calculateScore();
    currentScore = result.score;
    resultMessage = result.message;
    gameState = 'result';

    if (currentScore > bestScores[currentMode]) {
        bestScores[currentMode] = currentScore;
        isNewBest = true;
        localStorage.setItem('perfectOrbitBest_' + currentMode, bestScores[currentMode]);
    }
});

resizeCanvas();
// アニメーションループ開始
render();