(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const elScore = document.getElementById("score");
  const elLives = document.getElementById("lives");
  const elWave = document.getElementById("wave");
  const elHint = document.getElementById("hint");

  const keys = new Set();
  let state = "title"; // title | play | gameover
  let score = 0;
  let lives = 3;
  let wave = 1;
  let frame = 0;
  let spawnTimer = 0;
  let stars = [];

  const player = {
    x: W / 2,
    y: H - 90,
    w: 44,
    h: 52,
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
    elLives.textContent = String(lives);
    elWave.textContent = String(wave);
  }

  function spawnEnemy() {
    const tier = Math.min(wave, 6);
    const w = 36 + tier * 2;
    const h = 32 + tier;
    enemies.push({
      x: rand(w / 2, W - w / 2),
      y: -h,
      w,
      h,
      vx: rand(-1.2, 1.2) * (0.5 + tier * 0.08),
      vy: rand(1.8, 2.8) + tier * 0.15,
      hp: tier >= 4 ? 2 : 1,
      maxHp: tier >= 4 ? 2 : 1,
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

    // glow
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
    g.addColorStop(0, "rgba(80, 200, 255, 0.35)");
    g.addColorStop(1, "rgba(80, 200, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = "#3a5a8a";
    ctx.strokeStyle = "#7ee8ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 6, -h / 2 + 8, w - 12, h - 18, 6);
    ctx.fill();
    ctx.stroke();

    // head
    ctx.fillStyle = "#5a7aaa";
    ctx.beginPath();
    ctx.arc(0, -h / 2 + 10, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#9ef0ff";
    ctx.stroke();

    // eyes
    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.arc(-5, -h / 2 + 8, 3, 0, Math.PI * 2);
    ctx.arc(5, -h / 2 + 8, 3, 0, Math.PI * 2);
    ctx.fill();

    // wings
    ctx.fillStyle = "#2d4a78";
    ctx.beginPath();
    ctx.moveTo(-w / 2, 4);
    ctx.lineTo(-w / 2 - 14, 18);
    ctx.lineTo(-w / 2 + 4, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#5ab0e0";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w / 2, 4);
    ctx.lineTo(w / 2 + 14, 18);
    ctx.lineTo(w / 2 - 4, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // thruster
    const flicker = 0.6 + Math.sin(frame * 0.4) * 0.2;
    ctx.fillStyle = `rgba(255, 140, 60, ${flicker})`;
    ctx.beginPath();
    ctx.moveTo(-6, h / 2 - 4);
    ctx.lineTo(0, h / 2 + 12 + Math.sin(frame * 0.5) * 4);
    ctx.lineTo(6, h / 2 - 4);
    ctx.closePath();
    ctx.fill();

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
    ctx.fillText("← → / A D 移动  ·  空格 射击", W / 2, H / 2 + 38);
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

    // player move
    let dx = 0;
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) dx -= 1;
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dx += 1;
    player.x += dx * player.speed;
    player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));

    // shoot
    if (player.shootCd > 0) player.shootCd--;
    if ((keys.has(" ") || keys.has("Spacebar")) && player.shootCd <= 0) {
      bullets.push({ x: player.x, y: player.y - player.h / 2, w: 6, h: 16, vy: -12 });
      player.shootCd = 8;
    }

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.vy;
      if (b.y < -20) bullets.splice(i, 1);
    }

    // spawn
    const interval = Math.max(22, 55 - wave * 3);
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
    } else {
      drawStars();
      if (state === "title") drawTitle();
      else drawGameOver();
    }

    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (ev) => {
    const k = ev.key;
    if (k === "Enter") {
      if (state === "title" || state === "gameover") {
        resetGame();
        state = "play";
        elHint.textContent = "← → 或 A D 移动 · 空格 射击";
      }
      ev.preventDefault();
      return;
    }
    keys.add(k);
    if (k === " " || k === "ArrowLeft" || k === "ArrowRight") ev.preventDefault();
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
