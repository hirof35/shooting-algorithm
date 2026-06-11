// ============================================================================
// 1. 基本抽象クラス & 共通システム
// ============================================================================

abstract class GameObject {
    public active: boolean = true;
    constructor(
        public x: number,
        public y: number,
        public radius: number,
        protected color: string
    ) {}

    abstract update(): void;
    
    draw(ctx: CanvasRenderingContext2D): void {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

class InputManager {
    private keys: { [key: string]: boolean } = {};
    constructor() {
        window.addEventListener('keydown', (e) => this.keys[e.key] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
    }
    isPressed(key: string): boolean {
        return !!this.keys[key];
    }
}

// ============================================================================
// 2. 背景（星のパララックススクロール）
// ============================================================================

class Star {
    constructor(public x: number, public y: number, public speed: number, public size: number) {}
    update(canvasHeight: number) {
        this.y += this.speed;
        if (this.y > canvasHeight) {
            this.y = 0;
            this.x = Math.random() * 400;
        }
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = this.speed < 2 ? '#555555' : this.speed < 4 ? '#aaaaaa' : '#ffffff';
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

class Background {
    private stars: Star[] = [];
    constructor(width: number, height: number) {
        for (let i = 0; i < 80; i++) {
            let speed = 1; let size = 1;
            if (i < 15) { speed = 4; size = 2; }       // 手前の速い星
            else if (i < 40) { speed = 2; size = 1.5; } // 中間の星
            this.stars.push(new Star(Math.random() * width, Math.random() * height, speed, size));
        }
    }
    update(height: number) { this.stars.forEach(s => s.update(height)); }
    draw(ctx: CanvasRenderingContext2D) { this.stars.forEach(s => s.draw(ctx)); }
}

// ============================================================================
// 3. パーティクル（爆発エフェクト）
// ============================================================================

class Particle {
    public active: boolean = true;
    private vx: number;
    private vy: number;
    private alpha: number = 1.0;
    private life: number;
    private maxLife: number;

    constructor(private x: number, private y: number, private color: string) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.maxLife = Math.random() * 20 + 20;
        this.life = this.maxLife;
    }

    update() {
        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.96; this.vy *= 0.96; // 摩擦減速
        this.life--;
        this.alpha = Math.max(0, this.life / this.maxLife);
        if (this.life <= 0) this.active = false;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
        ctx.restore();
    }
}

// ============================================================================
// 4. キャラクター・弾・アイテムの実装
// ============================================================================

class Player extends GameObject {
    private speed: number = 4;
    private isInvincible: boolean = false;
    private invincibleTimer: number = 0;

    constructor(x: number, y: number, private input: InputManager) {
        super(x, y, 12, '#00ffcc');
    }

    public startInvincible(duration: number = 90) {
        this.isInvincible = true;
        this.invincibleTimer = duration;
    }

    public getIsInvincible(): boolean { return this.isInvincible; }

    update() {
        if (this.input.isPressed('ArrowUp') || this.input.isPressed('w')) this.y -= this.speed;
        if (this.input.isPressed('ArrowDown') || this.input.isPressed('s')) this.y += this.speed;
        if (this.input.isPressed('ArrowLeft') || this.input.isPressed('a')) this.x -= this.speed;
        if (this.input.isPressed('ArrowRight') || this.input.isPressed('d')) this.x += this.speed;

        // 画面外はみ出し防止限界
        this.x = Math.max(this.radius, Math.min(400 - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(600 - this.radius, this.y));

        if (this.isInvincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) this.isInvincible = false;
        }
    }

    override draw(ctx: CanvasRenderingContext2D) {
        // 無敵時間中の点滅ロジック (4フレーム周期)
        if (this.isInvincible && (this.invincibleTimer % 4 < 2)) return;
        super.draw(ctx);
    }
}

abstract class Bullet extends GameObject {
    constructor(x: number, y: number, protected angle: number, protected speed: number, color: string) {
        super(x, y, 4, color);
    }
    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        if (this.y < -this.radius || this.y > 600 + this.radius || this.x < -this.radius || this.x > 400 + this.radius) {
            this.active = false;
        }
    }
}

class StraightBullet extends Bullet {
    constructor(x: number, y: number) { super(x, y, -Math.PI / 2, 8, '#ffff00'); }
}

class HomingBullet extends Bullet {
    private turnSpeed: number = 0.08;
    constructor(x: number, y: number, private target: Enemy | null) {
        super(x, y, -Math.PI / 2, 6, '#00ffff');
    }
    update() {
        if (this.target && this.target.active) {
            const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            let angleDiff = targetAngle - this.angle;
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff)); // 最短経路補正

            if (Math.abs(angleDiff) < this.turnSpeed) {
                this.angle = targetAngle;
            } else {
                this.angle += angleDiff > 0 ? this.turnSpeed : -this.turnSpeed;
            }
        }
        super.update();
    }
}

class Enemy extends GameObject {
    private speed: number = 2;
    constructor(x: number, y: number) { super(x, y, 18, '#ff4444'); }
    update() {
        this.y += this.speed;
        if (this.y > 600 + this.radius) this.active = false;
    }
}

class Item extends GameObject {
    private speedY: number = 1.5;
    private magnetRange: number = 120;
    private magnetSpeed: number = 6;

    constructor(x: number, y: number) { super(x, y, 6, '#ff00ff'); }

    updateWithPlayer(playerX: number, playerY: number) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.magnetRange) {
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.magnetSpeed;
            this.y += Math.sin(angle) * this.magnetSpeed;
        } else {
            this.y += this.speedY;
        }
        if (this.y > 600 + this.radius) this.active = false;
    }
    update() {} // 互換性維持
}

// ============================================================================
// 5. コア・ゲームシステム（統合マネージャー）
// ============================================================================

class GameSystem {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private input: InputManager;
    private background: Background;

    private player!: Player;
    private bullets: Bullet[] = [];
    private enemies: Enemy[] = [];
    private items: Item[] = [];
    private particles: Particle[] = [];

    private score: number = 0;
    private lives: number = 3;
    private weaponLevel: number = 1; // アイテムを取ると誘導弾が混ざる
    private spawnTimer: number = 0;
    private shotTimer: number = 0;
    private isGameOver: boolean = false;

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.input = new InputManager();
        this.background = new Background(this.canvas.width, this.canvas.height);

        this.init();
        this.loop();
    }

    private init() {
        this.player = new Player(200, 500, this.input);
        this.bullets = []; this.enemies = []; this.items = []; this.particles = [];
        this.score = 0; this.lives = 3; this.weaponLevel = 1;
        this.isGameOver = false;
    }

    private checkCircleCollision(obj1: GameObject, obj2: GameObject): boolean {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        return (dx * dx + dy * dy) < (obj1.radius + obj2.radius) * (obj1.radius + obj2.radius);
    }

    private getNearestEnemy(bx: number, by: number): Enemy | null {
        let nearest: Enemy | null = null;
        let minDist = Infinity;
        for (const e of this.enemies) {
            const d = (e.x - bx) * (e.x - bx) + (e.y - by) * (e.y - by);
            if (d < minDist) { minDist = d; nearest = e; }
        }
        return nearest;
    }

    private createExplosion(x: number, y: number) {
        const colors = ['#ff4444', '#ffaa44', '#ffff44'];
        for (let i = 0; i < 15; i++) {
            this.particles.push(new Particle(x, y, colors[Math.floor(Math.random() * colors.length)]));
        }
    }

    private update() {
        this.background.update(this.canvas.height);
        this.particles.forEach(p => p.update());

        if (this.isGameOver) {
            if (this.input.isPressed('Enter')) this.init();
            this.particles = this.particles.filter(p => p.active); // エフェクトだけは裏で動かす
            return;
        }

        // キャラクター更新
        this.player.update();
        this.bullets.forEach(b => b.update());
        this.enemies.forEach(e => e.update());
        this.items.forEach(item => item.updateWithPlayer(this.player.x, this.player.y));

        // 攻撃発射ロジック (8フレーム毎)
        this.shotTimer++;
        if (this.shotTimer >= 8) {
            // 常に正面へ通常弾を発射
            this.bullets.push(new StraightBullet(this.player.x, this.player.y - this.player.radius));
            
            // ウェポンレベルが2以上なら誘導弾（ホーミング）を追加
            if (this.weaponLevel >= 2) {
                const target = this.getNearestEnemy(this.player.x, this.player.y);
                this.bullets.push(new HomingBullet(this.player.x - 10, this.player.y, target));
                this.bullets.push(new HomingBullet(this.player.x + 10, this.player.y, target));
            }
            this.shotTimer = 0;
        }

        // 敵の出現管理 (25フレーム毎)
        this.spawnTimer++;
        if (this.spawnTimer >= 25) {
            const rx = Math.random() * (this.canvas.width - 40) + 20;
            this.enemies.push(new Enemy(rx, -20));
            this.spawnTimer = 0;
        }

        // --- 衝突判定セクション ---

        // 1. 弾 vs 敵
        for (const b of this.bullets) {
            for (const e of this.enemies) {
                if (b.active && e.active && this.checkCircleCollision(b, e)) {
                    b.active = false; e.active = false;
                    this.createExplosion(e.x, e.y);
                    this.score += 100;
                    if (Math.random() < 0.35) this.items.push(new Item(e.x, e.y)); // 35%でアイテム
                }
            }
        }

        // 2. 自機 vs 敵 (無敵時間中はスキップ)
        if (!this.player.getIsInvincible()) {
            for (const e of this.enemies) {
                if (e.active && this.checkCircleCollision(this.player, e)) {
                    e.active = false;
                    this.createExplosion(this.player.x, this.player.y);
                    this.lives--;
                    this.weaponLevel = Math.max(1, this.weaponLevel - 1); // 被弾でパワーダウン
                    
                    if (this.lives > 0) {
                        this.player.x = 200; this.player.y = 500;
                        this.player.startInvincible(90); // 1.5秒無敵
                    } else {
                        this.isGameOver = true;
                    }
                    break;
                }
            }
        }

        // 3. 自機 vs アイテム
        for (const item of this.items) {
            if (item.active && this.checkCircleCollision(this.player, item)) {
                item.active = false;
                this.score += 500;
                this.weaponLevel = Math.min(3, this.weaponLevel + 1); // パワーアップ
            }
        }

        // 不要オブジェクトの配列クリーンアップ（メモリリーク防止）
        this.bullets = this.bullets.filter(b => b.active);
        this.enemies = this.enemies.filter(e => e.active);
        this.items = this.items.filter(i => i.active);
        this.particles = this.particles.filter(p => p.active);
    }

    private draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 描画レイヤー順: 背景 -> アイテム -> 弾/敵 -> 自機 -> エフェクト -> UI
        this.background.draw(this.ctx);
        this.items.forEach(i => i.draw(this.ctx));
        this.bullets.forEach(b => b.draw(this.ctx));
        // 修正後（綺麗に直した状態）
this.enemies.forEach(e => e.draw(this.ctx));
        if (!this.isGameOver) this.player.draw(this.ctx);
        this.particles.forEach(p => p.draw(this.ctx));

        // UI表示
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 16px monospace';
        this.ctx.fillText(`SCORE: ${this.score}`, 15, 30);
        this.ctx.fillText(`LIVES: ${'★'.repeat(this.lives)}${'☆'.repeat(3 - this.lives)}`, 15, 55);
        this.ctx.fillText(`POWER: Lv.${this.weaponLevel}`, 15, 80);

        if (this.isGameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#ff3333';
            this.ctx.font = 'bold 32px sans-serif';
            this.ctx.fillText('GAME OVER', 100, 280);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '16px sans-serif';
            this.ctx.fillText('Press ENTER to Restart', 115, 330);
        }
    }

    private loop = () => {
        this.update();
        this.draw();
        requestAnimationFrame(this.loop);
    };
}

// 起動
window.addEventListener('DOMContentLoaded', () => { new GameSystem(); });