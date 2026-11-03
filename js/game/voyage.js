// One play session ("voyage") of a sprint: steering, spawning, collisions, timer.
import { STAGE_X, LANE } from './world.js';
import { C } from './palette.js';
import {
  shipPosition, applyWork, blockRandom, clearBlocker, applyRemote, isComplete,
  remainingEffort, totals, starsFor, DONE,
} from './sprintModel.js';

export const DAYS = 10;

// flow: river speed (units/s). rowChance: chance a spawn is a full-width wall with one narrow gap.
// gapMargin: clearance each side of the ship inside the gap (smaller = tighter). spawnDist: how far ahead items appear.
const DIFFICULTY = {
  calm: { flow: 9, interval: 1.0, hazard: 0.28, steer: 15, rowChance: 0, spawnDist: 74, invuln: 1.4, crateRate: 0.6, orb: 0.12, hp: 8 },
  rapids: { flow: 13, interval: 0.72, hazard: 0.38, steer: 18, rowChance: 0, spawnDist: 74, invuln: 1.4, crateRate: 0.6, orb: 0.12, hp: 6 },
  hardcore: { flow: 44, interval: 0.42, hazard: 0.5, steer: 24, rowChance: 0.72, gapMargin: 0.7, spawnDist: 50, invuln: 0.8, crateRate: 0.9, orb: 0.28, hp: 5 },
};

export class Voyage {
  constructor(world, { sprint, tickets, difficulty = 'calm', jira, writeBack = false, onEvent = () => {} }) {
    this.world = world;
    this.sprint = sprint;
    this.tickets = tickets;
    this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.calm;
    this.jira = jira;
    this.writeBack = writeBack;
    this.emit = onEvent;

    this.focusKey = null;
    this.state = 'running'; // running | finishing | ended
    this.paused = false;
    this.elapsed = 0;
    this.spawnTimer = 1.5;
    this.pollTimer = 14;
    this.invuln = 0;
    this.maxHp = this.cfg.hp;
    this.hp = this.maxHp;
    this.sink = 0;
    this.items = [];
    this.input = 0;
    this.pointerZ = null;
    this.stats = { caught: 0, missed: 0, hits: 0, orbs: 0, remote: 0, streak: 0, bestStreak: 0 };

    // Time budget: enough for a good run to finish if most crates are caught.
    const need = remainingEffort(tickets);
    const rate = this.cfg.crateRate * 0.55;
    this.duration = Math.round(Math.min(240, Math.max(60, (need / rate) * 1.15)));

    const p = shipPosition(tickets);
    this.ship = { x: this.posToX(p), z: 0, vz: 0, roll: 0, speed: 0 };
    world.flowSpeed = this.cfg.flow;
    world.clearItems();
    world.setCameraMode('play');
    world.setCargo(this.doneCount());
  }

  posToX(p) { return (p / 3) * STAGE_X[3]; }
  doneCount() { return this.tickets.filter(t => t.stage === DONE).length; }
  get position() { return shipPosition(this.tickets); }
  get day() { return Math.min(DAYS, Math.floor((this.elapsed / this.duration) * DAYS) + 1); }
  get timeLeft() { return Math.max(0, this.duration - this.elapsed); }

  setFocus(key) { this.focusKey = this.focusKey === key ? null : key; this.emit({ type: 'focus', key: this.focusKey }); }

  update(dt) {
    if (this.paused || this.state === 'ended') return;
    const s = this.ship;

    if (this.state === 'running') {
      this.elapsed += dt;
      if (this.elapsed >= this.duration) return this.finish(false);
    }

    // Shipwreck: roll over and go under, then report.
    if (this.state === 'sinking') {
      this.sink += dt;
      const k = Math.min(1, this.sink / 2.2);
      this.world.ship.position.y = -k * k * 3.2;
      this.world.ship.rotation.x = k * 0.9;
      this.world.ship.rotation.z = k * 0.35;
      if (this.sink > 2.6) { this.state = 'ended'; this.emit({ type: 'end', result: this.result(false, true) }); }
      this.world.setReached(this.position);
      return;
    }

    // Forward motion: sail toward the point-weighted progress.
    const targetX = this.state === 'finishing' ? STAGE_X[3] + 6 : this.posToX(this.position);
    const prevX = s.x;
    s.x += (targetX - s.x) * (1 - Math.exp(-dt * 1.4));
    s.speed = (s.x - prevX) / Math.max(dt, 1e-4);

    // Steering
    let dir = this.input;
    if (this.pointerZ != null) {
      const diff = this.pointerZ - s.z;
      dir = Math.abs(diff) < 0.25 ? 0 : Math.max(-1, Math.min(1, diff / 2));
    }
    if (this.state === 'finishing') dir = -s.z / 3;
    const targetV = dir * this.cfg.steer;
    s.vz += (targetV - s.vz) * (1 - Math.exp(-dt * 9));
    s.z += s.vz * dt;
    if (Math.abs(s.z) > LANE) { s.z = Math.sign(s.z) * LANE; s.vz = 0; }
    s.roll += ((-s.vz * 0.018) - s.roll) * (1 - Math.exp(-dt * 6));
    this.invuln = Math.max(0, this.invuln - dt);
    this.world.shipInner.visible = this.invuln <= 0 || Math.floor(this.invuln * 12) % 2 === 0;

    if (this.state === 'running') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnTimer = this.cfg.interval * (0.75 + Math.random() * 0.5); this.spawn(); }
      this.pollTimer -= dt;
      if (this.pollTimer <= 0) { this.pollTimer = 16 + Math.random() * 10; this.poll(); }
    }

    // Items drift downstream
    for (const it of this.items) {
      it.x -= this.cfg.flow * dt;
      it.obj.position.x = it.x;
      if (!it.dead && this.state === 'running') this.collide(it);
      if (it.x < s.x - 8) {
        if (!it.dead && it.type === 'crate') { this.stats.missed++; this.stats.streak = 0; this.emit({ type: 'miss' }); }
        it.dead = true;
      }
    }
    this.items = this.items.filter(it => {
      if (it.dead) { this.world.despawn(it.obj); return false; }
      return true;
    });

    this.world.setReached(this.position);
  }

  spawn() {
    const s = this.ship;
    const x = Math.min(s.x + this.cfg.spawnDist, 252);
    if (x - s.x < 20) return; // too close to the falls to be fair
    const anyBlocked = this.tickets.some(t => t.blocked) || this.hp < this.maxHp;
    if (this.cfg.rowChance && Math.random() < this.cfg.rowChance) return this.spawnRow(x);
    const r = Math.random();
    let type;
    if (anyBlocked && r < this.cfg.orb) type = 'orb';
    else if (r < this.cfg.orb + this.cfg.hazard) type = Math.random() < 0.6 ? 'rock' : 'log';
    else type = 'crate';
    const z = (Math.random() * 2 - 1) * LANE;
    // Keep a gap: don't stack an item directly on a recent one.
    const near = this.items.find(it => Math.abs(it.x - x) < 5 && Math.abs(it.z - z) < 4);
    if (near) return;
    this.items.push({ type, x, z, obj: this.world.spawn(type, x, z) });
  }

  /** A wall of hazards across the whole river with one narrow gap. A reward sits in the gap. */
  spawnRow(x) {
    if (this.items.some(it => Math.abs(it.x - x) < 9)) return;
    const gap = (Math.random() * 2 - 1) * (LANE - 0.5);
    const type = Math.random() < 0.7 ? 'rock' : 'log';
    // Rock hits at |dz| < 1.9, log at < 3.3: spacing = hit radius + the clearance left in the gap.
    const spacing = (type === 'rock' ? 1.9 : 3.3) + this.cfg.gapMargin;
    for (const dir of [-1, 1]) {
      for (let z = gap + dir * spacing; Math.abs(z) < LANE + 2.6; z += dir * spacing * 1.05) {
        this.items.push({ type, x, z, obj: this.world.spawn(type, x, z) });
      }
    }
    const reward = (this.tickets.some(t => t.blocked) || this.hp < this.maxHp) && Math.random() < 0.4 ? 'orb' : 'crate';
    this.items.push({ type: reward, x, z: gap, obj: this.world.spawn(reward, x, gap) });
  }

  collide(it) {
    const s = this.ship;
    const dx = Math.abs(it.x - s.x), dz = Math.abs(it.z - s.z);
    const hit =
      it.type === 'log' ? dx < 2.3 && dz < 3.3 :
      it.type === 'rock' ? dx < 2.5 && dz < 1.9 :
      dx < 2.4 && dz < 2.0;
    if (!hit) return;

    if (it.type === 'crate') {
      it.dead = true;
      this.stats.caught++; this.stats.streak++; this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
      this.world.burst(it.x, 1, it.z, C.sun300, 16, 5);
      const ev = applyWork(this.tickets, this.focusKey);
      if (!ev) return;
      if (ev.type === 'advance') this.onAdvance(ev);
      else this.emit({ ...ev, at: [it.x, 2, it.z] });
    } else if (it.type === 'orb') {
      it.dead = true;
      this.stats.orbs++;
      this.world.burst(it.x, 1.2, it.z, C.glow300, 24, 7);
      if (this.hp < this.maxHp) { this.hp++; this.emit({ type: 'heal', hp: this.hp, at: [s.x, 3.2, s.z] }); }
      const ev = clearBlocker(this.tickets, this.focusKey);
      if (ev) { this.emit({ ...ev, at: [it.x, 2, it.z] }); this.sync(ev.ticket, 'unflag'); }
    } else if (this.invuln <= 0) {
      this.stats.hits++; this.stats.streak = 0;
      this.invuln = this.cfg.invuln;
      this.world.shake(0.9);
      this.world.burst(s.x, 1, s.z, C.wood300, 20, 6);
      s.vz = -Math.sign(it.z - s.z || 1) * 10;
      this.hp = Math.max(0, this.hp - 1);
      const ev = blockRandom(this.tickets);
      this.emit({ type: 'hit', ticket: ev?.ticket, hp: this.hp, at: [s.x, 2, s.z] });
      if (ev) this.sync(ev.ticket, 'flag');
      if (this.hp <= 0) this.wreck();
    }
  }

  onAdvance(ev) {
    this.world.burst(this.ship.x, 2, this.ship.z, ev.to === 'Done' ? C.leaf300 : C.water300, 30, 8);
    this.world.setCargo(this.doneCount());
    this.emit({ ...ev, at: [this.ship.x, 3, this.ship.z] });
    if (!ev.remote) this.sync(ev.ticket, 'transition');
    if (isComplete(this.tickets)) this.finish(true);
  }

  sync(ticket, what) {
    if (!this.writeBack || !this.jira) return;
    const p = what === 'transition' ? this.jira.transitionIssue(ticket.key, ['To Do', 'In Progress', 'In Review', 'Done'][ticket.stage])
      : this.jira.setFlagged(ticket.key, what === 'flag');
    p.catch(() => {});
  }

  /** Ask (mock) Jira for teammate updates. Returns a promise of applied events. */
  async poll() {
    if (!this.jira || this.state !== 'running') return [];
    this.emit({ type: 'syncing' });
    let updates = [];
    try { updates = await this.jira.pollUpdates(this.tickets.map(t => ({ ...t }))); } catch { /* offline */ }
    if (this.state !== 'running') return [];
    const applied = [];
    for (const u of updates) {
      const ev = applyRemote(this.tickets, u);
      if (!ev) continue;
      this.stats.remote++;
      applied.push(ev);
      if (ev.type === 'advance') this.onAdvance(ev);
      else this.emit(ev);
    }
    this.emit({ type: 'synced', count: applied.length });
    return applied;
  }

  result(complete, wrecked = false) {
    return {
      complete,
      wrecked,
      // A wreck caps the voyage at 1 star, however far the sprint got.
      stars: wrecked ? Math.min(1, starsFor(this.tickets)) : starsFor(this.tickets),
      ...totals(this.tickets),
      stats: { ...this.stats },
      daysUsed: this.day,
      tickets: this.tickets,
    };
  }

  wreck() {
    if (this.state !== 'running') return;
    this.state = 'sinking';
    this.sink = 0;
    for (const it of this.items) it.dead = true;
    this.world.shipInner.visible = true;
    this.world.shake(1.6);
    this.world.burst(this.ship.x, 1, this.ship.z, C.wood500, 40, 8);
    this.world.setCameraMode('finish');
    this.emit({ type: 'wrecked' });
  }

  finish(complete) {
    if (this.state !== 'running') return;
    this.state = complete ? 'finishing' : 'ended';
    for (const it of this.items) it.dead = true;
    const result = () => this.result(complete);
    if (complete) {
      this.world.setCameraMode('finish');
      this.emit({ type: 'complete' });
      setTimeout(() => { this.state = 'ended'; this.emit({ type: 'end', result: result() }); }, 3200);
    } else {
      this.emit({ type: 'end', result: result() });
    }
  }

  dispose() {
    this.state = 'ended';
    this.world.clearItems();
    this.world.shipInner.visible = true;
    this.world.ship.position.y = 0;
    this.world.ship.rotation.set(0, 0, 0);
  }
}
