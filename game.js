(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const elScore = document.getElementById("score");
  const elStage = document.getElementById("stage");
  const elStageTarget = document.getElementById("stageTarget");
  const elLives = document.getElementById("lives");
  const elWave = document.getElementById("wave");
  const elHint = document.getElementById("hint");

  /** 累计得分达到对应值后通关该关并进入下一关（共 10 关，之后为胜利结算） */
  const LEVEL_TARGETS = [
    200, // 第 1 关：熟悉操作与基础敌机
    500, // 第 2 关：敌机更密、走位要求提高
    900, // 第 3 关：引入更多之字敌机与速度
    1400, // 第 4 关：厚血敌机比例上升
    2000, // 第 5 关：中场难度
    2700, // 第 6 关：弹幕压力
    3500, // 第 7 关：高速下坠
    4500, // 第 8 关：精英波次感
    5700, // 第 9 关：终盘前奏
    7200, // 第 10 关：全线压迫，通关后游戏胜利
  ];

  const keys = new Set();
  let state = "title"; // title | play | gameover | victory
  let score = 0;
  let lives = 3;
  let wave = 1;
  let stage = 1;
  let levelClearTimer = 0;
  let frame = 0;
  let spawnTimer = 0;
  let stars = [];

  const player = {
    x: W / 2,
    y: H - 90,
    w: 48,
    h: 56,
    speed: 6,
    shootCd: 0,
  };

  let bullets = [];
  let enemies = [];
  let particles = [];

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function initStars() {
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: Math.random() * 2 + 0.5,
        v: Math.random() * 1.2 + 0.3,
        a: Math.random() * 0.5 + 0.3,
      });
    }
  }

  function resetGame() {
    score = 0;
    lives = 3;
    wave = 1;
    stage = 1;
    levelClearTimer = 0;
    frame = 0;
    spawnTimer = 0;
    player.x = W / 2;
    player.shootCd = 0;
    bullets = [];
    enemies = [];
    particles = [];
    updateHud();
  }

  function updateHud() {
    elScore.textContent = String(score);
    elStage.textContent = String(Math.min(stage, LEVEL_TARGETS.length));
    if (stage <= LEVEL_TARGETS.length) {
      elStageTarget.textContent = String(LEVEL_TARGETS[stage - 1]);
    } else {
      elStageTarget.textContent = "—";
    }
    elLives.textContent = String(lives);
    elWave.textContent = String(wave);
  }

  function tryAdvanceStage() {
    if (state !== "play") return;
    if (stage > LEVEL_TARGETS.length) return;
    if (score < LEVEL_TARGETS[stage - 1]) return;

    stage++;
    wave = Math.min(wave + 1, 99);
    bullets = [];
    enemies = [];
    player.shootCd = 0;
    updateHud();

    if (stage > LEVEL_TARGETS.length) {
      state = "victory";
      elHint.textContent = "Enter 返回标题 / 重开";
      levelClearTimer = 0;
      return;
    }
    levelClearTimer = 96;
  }

  function spawnEnemy() {
    const tier = Math.min(wave + stage - 1, 8);
    const w = 36 + tier * 2;
    const h = 32 + tier;
    enemies.push({
      x: rand(w / 2, W - w / 2),
      y: -h,
      w,
      h,
      vx: rand(-1.2, 1.2) * (0.5 + tier * 0.08),
      vy: rand(1.8, 2.8) + tier * 0.15,
      hp: tier >= 7 ? 3 : tier >= 4 ? 2 : 1,
      maxHp: tier >= 7 ? 3 : tier >= 4 ? 2 : 1,
      kind: Math.random() < 0.15 ? "zig" : "straight",
      phase: rand(0, Math.PI * 2),
    });
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(1, 4);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(20, 40),
        color,
      });
    }
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function playerBox() {
    return {
      x: player.x - player.w / 2,
      y: player.y - player.h / 2,
      w: player.w,
      h: player.h,
    };
  }

  function enemyBox(e) {
    return {
      x: e.x - e.w / 2,
      y: e.y - e.h / 2,
      w: e.w,
      h: e.h,
    };
  }

  function bulletBox(b) {
    return { x: b.x - 2, y: b.y - 14, w: 4, h: 18 };
  }

  function drawStars() {
    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#a8c4ff";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const { x, y, w, h } = player;
    ctx.save();
    ctx.translate(x, y);

    const fus = w * 0.22;
    const noseY = -h * 0.5 + 3;
    const tailY = h * 0.47;
    const wingBackY = h * 0.22;
    const wingTipX = w * 0.48 + 6;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const amb = ctx.createRadialGradient(0, -h * 0.1, 0, 0, 0, h * 0.65);
    amb.addColorStop(0, "rgba(120, 160, 200, 0.2)");
    amb.addColorStop(1, "rgba(40, 60, 90, 0)");
    ctx.fillStyle = amb;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.05, wingTipX + 6, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    function wing(side) {
      const s = side;
      ctx.beginPath();
      ctx.moveTo(s * fus * 0.85, -h * 0.06);
      ctx.lineTo(s * wingTipX, wingBackY - h * 0.04);
      ctx.lineTo(s * (wingTipX - 4), wingBackY + h * 0.1);
      ctx.lineTo(s * fus * 1.05, h * 0.12);
      ctx.lineTo(s * fus * 0.75, -h * 0.02);
      ctx.closePath();
    }

    ctx.fillStyle = "#3d4754";
    ctx.strokeStyle = "#1e252e";
    ctx.lineWidth = 1.25;
    wing(1);
    ctx.fill();
    ctx.stroke();
    wing(-1);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#5a6572";
    ctx.strokeStyle = "#2a3138";
    ctx.beginPath();
    ctx.moveTo(0, noseY);
    ctx.bezierCurveTo(
      fus * 0.55,
      noseY + h * 0.1,
      fus,
      -h * 0.12,
      fus,
      h * 0.06
    );
    ctx.lineTo(fus * 0.9, tailY - h * 0.08);
    ctx.quadraticCurveTo(0, tailY + 1, -fus * 0.9, tailY - h * 0.08);
    ctx.lineTo(-fus, h * 0.06);
    ctx.bezierCurveTo(-fus, -h * 0.12, -fus * 0.55, noseY + h * 0.1, 0, noseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, noseY + h * 0.06);
    ctx.lineTo(0, tailY - h * 0.14);
    ctx.stroke();

    const can = ctx.createLinearGradient(-fus, -h * 0.28, fus, -h * 0.14);
    can.addColorStop(0, "#1a3548");
    can.addColorStop(0.45, "#4a7a9a");
    can.addColorStop(1, "#2a5068");
    ctx.fillStyle = can;
    ctx.strokeStyle = "#6a9ab8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.2, fus * 0.62, h * 0.085, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#2a3238";
    ctx.beginPath();
    ctx.moveTo(0, tailY - h * 0.02);
    ctx.lineTo(-fus * 0.35, tailY);
    ctx.lineTo(0, tailY + h * 0.06);
    ctx.lineTo(fus * 0.35, tailY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#1a2026";
    ctx.stroke();

    const flick = 0.55 + Math.sin(frame * 0.45) * 0.22;
    const plume = 10 + Math.sin(frame * 0.55) * 3;
    function exhaust(dx) {
      const g = ctx.createLinearGradient(dx, tailY - 2, dx, tailY + plume + 6);
      g.addColorStop(0, `rgba(255,220,120,${flick})`);
      g.addColorStop(0.35, `rgba(255,120,40,${flick * 0.85})`);
      g.addColorStop(1, "rgba(255,80,20,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(dx - 3, tailY - 3);
      ctx.lineTo(dx + 3, tailY - 3);
      ctx.lineTo(dx + 5, tailY + plume);
      ctx.lineTo(0, tailY + plume + 4);
      ctx.lineTo(dx - 5, tailY + plume);
      ctx.closePath();
      ctx.fill();
    }
    exhaust(-fus * 0.42);
    exhaust(fus * 0.42);

    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const { w, h } = e;
    const dmg = e.hp < e.maxHp;
    ctx.fillStyle = dmg ? "#8a4a5a" : "#6a3050";
    ctx.strokeStyle = dmg ? "#ff8899" : "#ff66aa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(-w / 2, -h / 2);
    ctx.lineTo(0, -h / 2 + 6);
    ctx.lineTo(w / 2, -h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff3366";
    ctx.beginPath();
    ctx.arc(0, -h / 2 + 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBullets() {
    for (const b of bullets) {
      const grd = ctx.createLinearGradient(b.x, b.y - 12, b.x, b.y + 12);
      grd.addColorStop(0, "#ffffff");
      grd.addColorStop(0.5, "#44ddff");
      grd.addColorStop(1, "rgba(0,200,255,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(b.x - 2, b.y - 14, 4, 18);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life / 40;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawTitle() {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e8f4ff";
    ctx.font = "bold 32px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("机器人打飞机", W / 2, H / 2 - 40);
    ctx.font = "16px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillStyle = "#9bb8d8";
    ctx.fillText("按 Enter 开始", W / 2, H / 2 + 10);
    ctx.fillText("← → / A D 移动  ·  机炮自动开火", W / 2, H / 2 + 38);
  }

  function drawGameOver() {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ff8899";
    ctx.font = "bold 28px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("任务失败", W / 2, H / 2 - 30);
    ctx.fillStyle = "#c8d4e8";
    ctx.font = "18px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillText("最终得分 " + score, W / 2, H / 2 + 10);
    ctx.font = "15px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillStyle = "#8aa0c0";
    ctx.fillText("按 Enter 重新开始", W / 2, H / 2 + 44);
  }

  function drawVictory() {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#7ee8ff";
    ctx.font = "bold 28px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("全关卡通关", W / 2, H / 2 - 36);
    ctx.fillStyle = "#c8d4e8";
    ctx.font = "18px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillText("最终得分 " + score, W / 2, H / 2 + 2);
    ctx.font = "15px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillStyle = "#8aa0c0";
    ctx.fillText("按 Enter 重新开始", W / 2, H / 2 + 38);
  }

  function drawLevelClearBanner() {
    ctx.fillStyle = "rgba(0, 20, 40, 0.72)";
    ctx.fillRect(0, H / 2 - 52, W, 104);
    ctx.strokeStyle = "rgba(126, 232, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, H / 2 - 51, W - 2, 102);
    ctx.fillStyle = "#e8f4ff";
    ctx.font = "bold 22px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    const n = stage - 1;
    ctx.fillText("第 " + n + " 关 通关", W / 2, H / 2 - 8);
    ctx.font = "15px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillStyle = "#9bb8d8";
    if (stage <= LEVEL_TARGETS.length) {
      ctx.fillText("下一关目标得分 " + LEVEL_TARGETS[stage - 1], W / 2, H / 2 + 22);
    }
  }

  function updatePlay() {
    frame++;

    // stars
    for (const s of stars) {
      s.y += s.v;
      if (s.y > H) {
        s.y = 0;
        s.x = Math.random() * W;
      }
    }

    if (levelClearTimer > 0) {
      levelClearTimer--;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
      }
      if (levelClearTimer === 0) tryAdvanceStage();
      return;
    }

    // player move
    let dx = 0;
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) dx -= 1;
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dx += 1;
    player.x += dx * player.speed;
    player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));

    // shoot (auto-fire while playing)
    if (player.shootCd > 0) player.shootCd--;
    if (player.shootCd <= 0) {
      const noseY = player.y - player.h * 0.5 + 3;
      bullets.push({ x: player.x, y: noseY, w: 6, h: 16, vy: -12 });
      player.shootCd = 8;
    }

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.vy;
      if (b.y < -20) bullets.splice(i, 1);
    }

    // spawn
    const interval = Math.max(16, 55 - wave * 3 - (stage - 1) * 2);
    spawnTimer++;
    if (spawnTimer >= interval) {
      spawnTimer = 0;
      spawnEnemy();
    }
    if (frame % 600 === 0) {
      wave++;
      updateHud();
    }

    // enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.kind === "zig") {
        e.x += Math.sin(frame * 0.05 + e.phase) * 1.2;
      }
      e.x += e.vx;
      e.y += e.vy;
      e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x));

      // bullet hit
      const eb = enemyBox(e);
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        const bb = bulletBox(b);
        if (aabb(bb.x, bb.y, bb.w, bb.h, eb.x, eb.y, eb.w, eb.h)) {
          bullets.splice(j, 1);
          e.hp--;
          burst(e.x, e.y, "#66eeff", 6);
          if (e.hp <= 0) {
            score += 10 * e.maxHp;
            burst(e.x, e.y, "#ff88aa", 14);
            enemies.splice(i, 1);
            updateHud();
            tryAdvanceStage();
          }
          break;
        }
      }

      if (i < enemies.length && enemies[i] === e) {
        if (e.y > H + 40) enemies.splice(i, 1);
        else {
          const pb = playerBox();
          if (aabb(pb.x, pb.y, pb.w, pb.h, eb.x, eb.y, eb.w, eb.h)) {
            burst(e.x, e.y, "#ffaa44", 20);
            enemies.splice(i, 1);
            lives--;
            updateHud();
            if (lives <= 0) {
              state = "gameover";
              elHint.textContent = "Enter 重开";
            }
          }
        }
      }
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawStars();

    if (state === "play") {
      updatePlay();
      drawBullets();
      for (const e of enemies) drawEnemy(e);
      drawParticles();
      drawPlayer();
      if (levelClearTimer > 0) drawLevelClearBanner();
    } else {
      drawStars();
      if (state === "title") drawTitle();
      else if (state === "victory") drawVictory();
      else drawGameOver();
    }

    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (ev) => {
    const k = ev.key;
    if (k === "Enter") {
      if (state === "title" || state === "gameover" || state === "victory") {
        resetGame();
        state = "play";
        elHint.textContent = "← → 或 A D 移动 · 自动开火";
      }
      ev.preventDefault();
      return;
    }
    keys.add(k);
    if (k === "ArrowLeft" || k === "ArrowRight") ev.preventDefault();
  });

  window.addEventListener("keyup", (ev) => {
    keys.delete(ev.key);
  });

  // roundRect fallback for older browsers
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      this.beginPath();
      this.moveTo(x + rr, y);
      this.arcTo(x + w, y, x + w, y + h, rr);
      this.arcTo(x + w, y + h, x, y + h, rr);
      this.arcTo(x, y + h, x, y, rr);
      this.arcTo(x, y, x + w, y, rr);
      this.closePath();
    };
  }

  initStars();
  resetGame();
  requestAnimationFrame(loop);
})();
