const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ゲームの状態を管理する変数 ---
let isDrawing = false;
let pathData = []; // プレイヤーが描いた座標を保存する配列
const orbitRadius = 150; // 正解軌道の半径

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// 画面全体を描画（更新）する関数
function render() {
    // 毎フレーム画面を一旦綺麗に消去する
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // 1. 正解の軌道（ガイド）を描画
    ctx.beginPath();
    ctx.arc(centerX, centerY, orbitRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // 薄い白
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    // 2. 太陽を描画
    ctx.beginPath();
    ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#FFCC00';
    ctx.fill();
    ctx.closePath();

    // 3. プレイヤーが描いた軌跡を描画
    if (pathData.length > 0) {
        ctx.beginPath();
        ctx.moveTo(pathData[0].x, pathData[0].y);
        for (let i = 1; i < pathData.length; i++) {
            ctx.lineTo(pathData[i].x, pathData[i].y);
        }
        ctx.strokeStyle = '#00FFFF'; // プレイヤーの線の色（見やすいシアン）
        ctx.lineWidth = 4;
        ctx.stroke();
    }
}

// --- 入力イベント（マウス・タッチ両対応） ---

// 画面を押したとき（描き始め）
canvas.addEventListener('pointerdown', (e) => {
    isDrawing = true;
    pathData = []; // 新しく描き始める時に過去の線をリセット
    pathData.push({ x: e.clientX, y: e.clientY });
    render();
});

// 押したまま動かしたとき（描画中）
canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing) return; // 押していなければ何もしない
    pathData.push({ x: e.clientX, y: e.clientY });
    render();
});

// 指（マウス）を離したとき（描き終わり）
canvas.addEventListener('pointerup', () => {
    isDrawing = false;
    // ※ここに後でスコア計算の処理が入ります
});

// 初期化と最初の描画
resizeCanvas();
render();