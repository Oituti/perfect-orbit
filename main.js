const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 音声データの読み込み ---
const bgm = new Audio('bgm.mp3');
bgm.loop = true; // BGMはループ再生
bgm.volume = 0.5; // 音量調整 (0.0 〜 1.0)

const seResult = new Audio('se_result.mp3');
seResult.volume = 0.8;

// --- ゲーム状態管理 ---
let gameState = 'menu';
let currentMode = 'earth';
let isDrawing = false;
let pathData = [];
let particles = [];
let currentScore = 0;
let resultMessage = "";

const modes = {
    earth: { name: '地球', rx: 150, ry: 150, color: '#00FFFF' },
    comet: { name: '彗星', rx: 250, ry: 80, color: '#FF4500' }
};

const triviaList = {
    earth: [
        "地球は太陽の周りを約365.24日で一周します。",
        "地球の軌道は完全な円ではなく、わずかに歪んだ楕円です。",
        "太陽から地球までの距離は約1億5000万km（1天文単位）です。"
    ],
    comet: [
        "彗星は氷とチリでできた「汚れた雪だるま」とも呼ばれます。",
        "太陽に近づくと熱でガスが放出され、美しい尾を引きます。",
        "彗星の軌道は非常に細長い楕円になることが特徴です。"
    ]
};
let currentTrivia = "";

let bestScores = {
    earth: localStorage.getItem('perfectOrbitBest_earth') || 0,
    comet: localStorage.getItem('perfectOrbitBest_comet') || 0
};
let isNewBest = false;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function createParticles(x, y, color) {
    const count = Math.random() * 3 + 2;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1.0,
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

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    if (gameState === 'menu') {
        ctx.shadowBlur = 0;
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

    ctx.shadowBlur = 0;

    // 正解の軌道
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 太陽
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FFCC00';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#FFCC00';
    ctx.fill();

    // プレイヤーの線
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

    // パーティクル
    ctx.shadowBlur = 10;
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;

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

    // UIテキスト
    ctx.shadowBlur = 0;
    if (gameState === 'playing') {
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = '24px sans-serif';
        ctx.fillText(modes[currentMode].name + 'の軌道を描こう', centerX, 50);
    }

    if (gameState === 'result') {
        ctx.textAlign = 'center';

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

        // --- 𝕏 シェアボタン (右上に移動) ---
        const shareBtnWidth = 140;
        const shareBtnHeight = 40;
        const shareX = canvas.width - shareBtnWidth - 20; // 右から20px
        const shareY = 20; // 上から20px

        ctx.fillStyle = 'white';
        ctx.fillRect(shareX, shareY, shareBtnWidth, shareBtnHeight);
        ctx.fillStyle = 'black';
        ctx.fillRect(shareX + 2, shareY + 2, shareBtnWidth - 4, shareBtnHeight - 4);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px sans-serif';
        // テキストをボタンの中央に配置
        ctx.fillText('𝕏 でシェア', shareX + shareBtnWidth / 2, shareY + 26);

        // 豆知識の表示
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '16px sans-serif';
        ctx.fillText('💡 豆知識', centerX, canvas.height - 110);
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText(currentTrivia, centerX, canvas.height - 80);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '16px sans-serif';
        ctx.fillText('画面の空いている場所をタッチでメニューへ', centerX, canvas.height - 30);
    }

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
                bgm.play().catch(e => console.log("BGMの再生がブロックされました"));
            } else if (y > centerY + 40 && y < centerY + 100) {
                currentMode = 'comet';
                gameState = 'playing';
                bgm.play().catch(e => console.log("BGMの再生がブロックされました"));
            }
        }
        return;
    }

    if (gameState === 'result') {
        // シェアボタンの当たり判定 (右上)
        const shareBtnWidth = 140;
        const shareBtnHeight = 40;
        const shareX = canvas.width - shareBtnWidth - 20;
        const shareY = 20;

        if (x > shareX && x < shareX + shareBtnWidth && y > shareY && y < shareY + shareBtnHeight) {
            const text = encodeURIComponent(`私の${modes[currentMode].name}軌道スコアは ${currentScore.toFixed(2)}% でした！\nあなたは完璧な軌道を描けるか？\n#PerfectOrbit`);
            window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
            return;
        }

        gameState = 'menu';
        isNewBest = false;
        pathData = [];
        particles = [];
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
    createParticles(x, y, modes[currentMode].color);
});

canvas.addEventListener('pointerup', () => {
    if (!isDrawing || gameState !== 'playing') return;
    isDrawing = false;

    const result = calculateScore();
    currentScore = result.score;
    resultMessage = result.message;
    gameState = 'result';

    // 描き終わった瞬間にSEを鳴らす
    seResult.currentTime = 0; // 連続で鳴らせるように再生位置をリセット
    seResult.play().catch(e => console.log("SEの再生エラー"));

    const triviaArray = triviaList[currentMode];
    currentTrivia = triviaArray[Math.floor(Math.random() * triviaArray.length)];

    if (currentScore > bestScores[currentMode]) {
        bestScores[currentMode] = currentScore;
        isNewBest = true;
        localStorage.setItem('perfectOrbitBest_' + currentMode, bestScores[currentMode]);
    }
});

resizeCanvas();
render();