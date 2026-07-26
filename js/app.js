class ApplicationEngine {
    constructor() {
        this.map = L.map('map', { keyboard: false }).setView([3.0000, 104.5000], 6);
        this.spatial = new SpatialEngine();
        this.spatial.bindMap(this.map);
        
        this.player = null;
        this.homeCountry = null;
        this.interceptors = [];
        this.projectiles = [];
        this.keysPressed = {};
        this.currentStatus = "PENDING";
        this.currentCountry = "NONE";
        this.lastHudSignature = "";
        this.lastLogicTick = 0;
        this.gameOver = false;
        this.activeTarget = null;
        this.lockRequested = false; // Tombol L untuk toggle lock manual
        this.debugMode = /[?&]debug=1\b/i.test(window.location.search) || localStorage.getItem('UNBLOS_DEBUG') === '1';

        this.initMap();
        this.initInputListeners();
    }

    // Dipanggil saat tombol pilihan negara diklik di Modal
    setupPlayerBase(country) {
        this.homeCountry = country;

        // Ambil pangkalan militer utama negara tersebut
        const homeBases = AIRBASE_DATABASE.filter(b => b.country === country);
        const homeBase = homeBases[0];
        if (!homeBase) {
            console.error(`Base untuk negara ${country} tidak ditemukan!`);
            return;
        }

        const defaultAircraft = homeBase.homeAircraftKey || homeBase.squadron[0];
        const aircraftName = AIRCRAFT_DATABASE[defaultAircraft] ? AIRCRAFT_DATABASE[defaultAircraft].name : defaultAircraft;

        // Spawn player di koordinat base pilihan
        this.player = new PlayerAircraft(
            homeBase.coords[0],
            homeBase.coords[1],
            defaultAircraft,
            `${homeBase.name} | ${aircraftName}`
        );

        // Sembunyikan modal selection
        const modal = document.getElementById('selection-modal');
        if (modal) modal.style.display = 'none';

        // Pindahkan kamera peta ke posisi base
        this.map.flyTo(homeBase.coords, 7);

        // Inisialisasi Canvas Radar Loop
        this.initCanvasOverlay();
    }

    initMap() {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 19
        }).addTo(this.map);
    }

    initInputListeners() {
        window.addEventListener('keydown', (e) => this.keysPressed[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', (e) => this.keysPressed[e.key.toLowerCase()] = false);
        
        // Left click - Fire weapon
        this.map.getContainer().addEventListener('click', () => this.tryFirePlayerWeapon());
        
        // Middle click / Wheel click - Deploy countermeasures (Chaff & Flare)
        this.map.getContainer().addEventListener('mousedown', (e) => {
            if (e.button === 1) { // Middle mouse button
                e.preventDefault();
                this.deployPlayerCountermeasures();
            }
        });
        
        // Also support Ctrl+C for chaff and Ctrl+F for flare as alternatives
        window.addEventListener('keydown', (e) => {
            if (this.player && !this.player.destroyed) {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                    e.preventDefault();
                    this.player.deployMultipleCountermeasures(4, 'chaff');
                }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                    e.preventDefault();
                    this.player.deployMultipleCountermeasures(4, 'flare');
                }
            }
        });
        
        // Tombol L - Toggle Lock Manual
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'l' && this.player && !this.player.destroyed && !this.gameOver) {
                if (!this.lockRequested) {
                    // Mulai lock
                    const target = this.selectTarget(this.player);
                    if (target) {
                        this.lockRequested = true;
                        this.activeTarget = target;
                        const radioLog = document.getElementById('radio-log');
                        if (radioLog) radioLog.innerHTML = `[RADAR]: Lock engaged on ${target.name} | Press L again to cancel.`;
                    } else {
                        const radioLog = document.getElementById('radio-log');
                        if (radioLog) radioLog.innerHTML = `[RADAR]: No target in radar range to lock.`;
                    }
                } else {
                    // Batal lock
                    this.lockRequested = false;
                    if (this.player) this.player.resetLock();
                    this.activeTarget = null;
                    const radioLog = document.getElementById('radio-log');
                    if (radioLog) radioLog.innerHTML = `[RADAR]: Lock cancelled.`;
                }
            }
        });
    }

    deployPlayerCountermeasures() {
        if (!this.player || this.player.destroyed) return;
        
        // Deploy 4 chaff dan 2 flare
        const chaffDeployed = this.player.deployMultipleCountermeasures(4, 'chaff');
        const flareDeployed = this.player.deployMultipleCountermeasures(2, 'flare');
        
        if (chaffDeployed > 0 || flareDeployed > 0) {
            const radioLog = document.getElementById('radio-log');
            if (radioLog) {
                radioLog.innerHTML = `[DEFENSIVE SYSTEMS]: Deployed ${chaffDeployed} chaff + ${flareDeployed} flare | Chaff: ${this.player.chaffCount} | Flare: ${this.player.flareCount}`;
            }
        }
    }

    getLiveAircraftList() {
        return [
            this.player,
            ...this.interceptors
        ].filter(ent => ent && !ent.destroyed);
    }

    getRadarTargets(source) {
        if (!source || source.destroyed) return [];

        const candidates = source === this.player
            ? this.interceptors
            : [this.player];

        return candidates.filter(target => target && !target.destroyed && target.id !== source.id && source.isTargetInRadar(target));
    }

    selectTarget(source) {
        const targets = this.getRadarTargets(source);
        if (targets.length === 0) return null;

        if (source.lockTargetId) {
            const persisted = targets.find(target => target.id === source.lockTargetId);
            if (persisted) return persisted;
        }

        return targets.reduce((best, candidate) => {
            if (!best) return candidate;
            return source.distanceTo(candidate) < source.distanceTo(best) ? candidate : best;
        }, null);
    }

    updateLockState(source, target, deltaMs) {
        if (!source || source.destroyed) return false;
        if (!target || target.destroyed || !source.isTargetInRadar(target)) {
            source.resetLock();
            return false;
        }

        if (source.lockTargetId !== target.id) {
            source.lockTargetId = target.id;
            source.lockProgressMs = 0;
        }

        source.lockProgressMs = Math.min(source.lockDurationMs, source.lockProgressMs + deltaMs);
        return source.lockProgressMs >= source.lockDurationMs;
    }

    fireProjectile(owner, target, manual = false) {
        if (!owner || !target || owner.destroyed || target.destroyed) return false;
        if (!owner.isTargetInRadar(target)) return false;

        const now = performance.now();
        if (now - owner.lastFireAt < owner.fireCooldownMs) {
            return false;
        }

        owner.lastFireAt = now;
        const projectile = new Projectile(owner, target);
        this.projectiles.push(projectile);

        const radioLog = document.getElementById('radio-log');
        if (radioLog) {
            radioLog.innerHTML = manual
                ? `[FIRE]: ${owner.name} fired at ${target.name}.`
                : `[AUTO]: ${owner.name} launched shot at ${target.name}.`;
        }

        return true;
    }

    tryFirePlayerWeapon() {
        if (!this.player || this.gameOver || this.player.destroyed) return;

        const target = this.activeTarget || this.selectTarget(this.player);
        const radioLog = document.getElementById('radio-log');

        if (!target) {
            if (radioLog) radioLog.innerHTML = `[RADIO]: No target in radar lock.`;
            return;
        }

        const lockReady = this.player.lockTargetId === target.id && this.player.lockProgressMs >= this.player.lockDurationMs;
        if (!lockReady) {
            if (radioLog) radioLog.innerHTML = `[RADIO]: Target not locked yet. Hold lock until ready.`;
            return;
        }

        this.fireProjectile(this.player, target, true);
    }

    updateCombatSystems(deltaMs, nowMs) {
        if (!this.player || this.gameOver) return;

        // Update countermeasures for all aircraft
        if (this.player) this.player.updateCountermeasures();
        this.interceptors.forEach(interceptor => interceptor.updateCountermeasures());

        // ===== PLAYER: Hanya lock jika lockRequested = true (tombol L) =====
        if (this.lockRequested) {
            // Cari target yang masih live
            if (!this.activeTarget || this.activeTarget.destroyed || !this.player.isTargetInRadar(this.activeTarget)) {
                this.activeTarget = this.selectTarget(this.player);
            }
            
            if (this.activeTarget) {
                const lockJustCompleted = this.updateLockState(this.player, this.activeTarget, deltaMs);
                
                // Saat lock selesai, catat bahwa player sudah lock target ini
                if (lockJustCompleted && this.player.lockProgressMs >= this.player.lockDurationMs) {
                    // Cek apakah lock baru selesai (progress tepat mencapai 100%)
                    if (this.activeTarget.hasBeenLockedBy !== this.player.id) {
                        this.activeTarget.hasBeenLockedBy = this.player.id;
                        const radioLog = document.getElementById('radio-log');
                        if (radioLog) radioLog.innerHTML = `[RADAR]: Target LOCKED - ${this.activeTarget.name} | LMB to fire.`;
                    }
                }
            }
        } else {
            // Jika lock tidak diminta, reset lock player
            if (this.player) this.player.resetLock();
            this.activeTarget = null;
        }

        this.interceptors = this.interceptors.filter(interceptor => interceptor && !interceptor.destroyed);

        // ===== AI: Hanya serang jika sudah di-lock player duluan =====
        this.interceptors.forEach(interceptor => {
            // AI hanya akan menyerang jika player sudah lock mereka terlebih dahulu
            if (interceptor.hasBeenLockedBy === this.player.id) {
                const aiTarget = this.player && !this.player.destroyed ? this.player : null;
                if (aiTarget) {
                    const locked = this.updateLockState(interceptor, aiTarget, deltaMs);
                    if (locked && nowMs - interceptor.lastFireAt >= interceptor.fireCooldownMs) {
                        this.fireProjectile(interceptor, this.player, false);
                    }
                }
            } else {
                // AI tidak lock jika belum di-lock, reset lock state
                interceptor.resetLock();
            }
        });
    }

    updateProjectiles(deltaMs) {
        if (!Array.isArray(this.projectiles) || this.projectiles.length === 0) return;

        const nextProjectiles = [];
        this.projectiles.forEach(projectile => {
            const result = projectile.update(deltaMs);
            if (result.hit && result.target) {
                this.resolveHit(result.target, projectile);
            }
            if (result.countermeasureEvade) {
                const radioLog = document.getElementById('radio-log');
                if (radioLog) {
                    radioLog.innerHTML = `[COUNTERMEASURE]: Missile decoyed by ${projectile.targetRef.name}'s chaff/flare!`;
                }
            }
            if (result.active) {
                nextProjectiles.push(projectile);
            }
        });

        this.projectiles = nextProjectiles;
    }

    resolveHit(target, projectile) {
        if (!target || target.destroyed) return;

        target.destroyed = true;
        target.resetLock?.();

        const radioLog = document.getElementById('radio-log');
        if (radioLog) {
            radioLog.innerHTML = `[HIT]: ${target.name} destroyed by ${projectile.ownerName}.`;
        }

        if (target === this.player) {
            this.gameOver = true;
            const hudCard = document.getElementById('status-card');
            if (hudCard) {
                hudCard.className = "hud-card status-red";
                hudCard.innerHTML = `<strong>MISSION FAILED</strong><br>Pesawat utama terkena tembakan.<br>Status: KIA`;
            }
            return;
        }

        this.interceptors = this.interceptors.filter(interceptor => interceptor.id !== target.id);
        if (this.player && this.player.lockTargetId === target.id) {
            this.player.resetLock();
        }
        if (this.activeTarget && this.activeTarget.id === target.id) {
            this.activeTarget = null;
        }
    }

    updateGameLogic(deltaMs = 50, nowMs = performance.now()) {
        if (!this.player || this.gameOver) return;

        this.player.move(this.keysPressed);

        const evaluation = this.spatial.evaluateAirspace(this.player.lat, this.player.lng, this.homeCountry);
        const hudCard = document.getElementById('status-card');
        const radioLog = document.getElementById('radio-log');
        const debugLog = document.getElementById('debug-log');

        this.interceptors.forEach(interceptor => interceptor.updateInterception(this.player));
        this.updateCombatSystems(deltaMs, nowMs);
        this.updateProjectiles(deltaMs);

        const statusChanged = this.currentStatus !== evaluation.status || this.currentCountry !== evaluation.country;
        const lockBucket = Math.floor((this.player.lockProgressMs || 0) / 100);
        const hudSignature = `${evaluation.status}|${evaluation.country}|${evaluation.zone}|${this.activeTarget ? this.activeTarget.id : 'none'}|${lockBucket}`;

        if (statusChanged || this.lastHudSignature !== hudSignature) {
            // Cek apakah ada target di radar (tanpa lock)
            const radarTargets = this.getRadarTargets(this.player);
            const hasRadarContact = radarTargets.length > 0;
            
            const targetName = this.activeTarget && !this.activeTarget.destroyed ? this.activeTarget.name : (hasRadarContact ? radarTargets[0].name : 'NO CONTACT');
            const lockPercent = this.player.lockDurationMs > 0
                ? Math.min(100, Math.round((this.player.lockProgressMs / this.player.lockDurationMs) * 100))
                : 0;
            
            let combatLine;
            if (this.lockRequested && this.activeTarget && !this.activeTarget.destroyed) {
                if (this.player.lockProgressMs >= this.player.lockDurationMs) {
                    combatLine = `[L] LOCKED ON ${targetName} | LMB TO FIRE`;
                } else {
                    combatLine = `[L] LOCKING ${targetName} [${lockPercent}%] | L to cancel`;
                }
            } else if (hasRadarContact) {
                combatLine = `RADAR CONTACT: ${targetName} | Press L to lock`;
            } else {
                combatLine = `Scanning...`;
            }

            if (evaluation.status === "HOME_TERRITORIAL") {
                hudCard.className = "hud-card status-green";
                hudCard.innerHTML = `<strong>${this.homeCountry} - ${evaluation.zone.toUpperCase()}</strong><br>Legal status: ${evaluation.legalMeaning}<br>Status: FRIENDLY PATROL<br>${combatLine}`;

                if (this.interceptors.length > 0) {
                    radioLog.innerHTML = `[RADIO]: Target returned to home jurisdiction. Interceptors disengaging.`;
                    this.interceptors = [];
                }
            } else if (evaluation.status === "FOREIGN_TERRITORIAL") {
                hudCard.className = "hud-card status-red";
                hudCard.innerHTML = `<strong>FOREIGN TERRITORIAL VIOLATION</strong><br>Country: ${evaluation.country}<br>Legal status: ${evaluation.legalMeaning}<br>Status: SCRAMBLE INTERCEPTOR<br>${combatLine}`;

                if (this.interceptors.length === 0) {
                    const nearestBase = this.spatial.getNearestAirbase(this.player.lat, this.player.lng, evaluation.country);

                    if (nearestBase) {
                        const aircraftModel = nearestBase.homeAircraftKey || nearestBase.squadron[0];
                        const interceptor = new InterceptorAircraft(
                            nearestBase.coords[0],
                            nearestBase.coords[1],
                            aircraftModel,
                            nearestBase.name
                        );

                        this.interceptors.push(interceptor);
                        radioLog.innerHTML = `[ALERT]: ${nearestBase.name} launched ${interceptor.spec.name} after territorial violation.`;
                    }
                }
            } else {
                hudCard.className = "hud-card status-green";
                hudCard.innerHTML = `<strong>INTERNATIONAL AIRSPACE</strong><br>Batas Hukum: freedom of navigation<br>Status: CLEAR<br>${combatLine}`;

                if (this.interceptors.length > 0) {
                    radioLog.innerHTML = `[RADIO]: Target left foreign jurisdiction. Interceptors RTB.`;
                    this.interceptors = [];
                }
            }

            this.lastHudSignature = hudSignature;
        }

        this.currentStatus = evaluation.status;
        this.currentCountry = evaluation.country;

        // Update ammo display real-time
        const ammoDisplay = document.querySelector('.hud-panel > div:nth-child(2)');
        if (ammoDisplay) {
            ammoDisplay.innerHTML = `
                Kontrol: <span style="color: var(--text-cyan)">[W][A][S][D]</span> / Panah Keyboard<br>
                <span style="color: #38bdf8;">🔫 TEMBAK: LMB (Left Mouse) | 🛡️ CHAFF/FLARE: Middle Mouse</span><br>
                <span style="color: #fca5a5;">Chaff: ${this.player.chaffCount}x | Flare: ${this.player.flareCount}x | Cooldown: 0.3s</span>
            `;
        }

        if (debugLog) {
            if (this.debugMode) {
                debugLog.style.display = 'block';
                const source = this.spatial.countries[evaluation.country]?.source || 'n/a';
                const territorial = evaluation.debug?.territorial?.length
                    ? evaluation.debug.territorial.map(item => `${item.country} [${item.source}]`).join(' | ')
                    : '-';

                debugLog.innerHTML = `<strong>DEBUG</strong><br>` +
                    `Country: ${evaluation.country}<br>` +
                    `Zone: ${evaluation.zone}<br>` +
                    `Winner source: ${source}<br>` +
                    `Territorial candidates: ${territorial}<br>` +
                    `Lock target: ${this.activeTarget && !this.activeTarget.destroyed ? this.activeTarget.name : '-'}<br>` +
                    `Lock progress: ${this.player.lockProgressMs}/${this.player.lockDurationMs}`;
            } else {
                debugLog.style.display = 'none';
            }
        }
    }

    initCanvasOverlay() {
        if (this.radarLayer) return;

        const self = this;
        const RadarCanvasLayer = L.Layer.extend({
            onAdd: function(map) {
                this._map = map;
                this._canvas = L.DomUtil.create('canvas', 'leaflet-radar-layer');
                this._canvas.style.position = 'absolute';
                this._canvas.style.pointerEvents = 'none';
                this._canvas.style.zIndex = '1000';

                map.getPanes().overlayPane.appendChild(this._canvas);
                map.on('moveend zoomend resize', this._reset, this);
                
                this._reset();
                this._step = 0;
                this._animate();
            },

            onRemove: function(map) {
                L.DomUtil.remove(this._canvas);
                map.off('moveend zoomend resize', this._reset, this);
            },

            _reset: function() {
                const topLeft = this._map.containerPointToLayerPoint([0, 0]);
                L.DomUtil.setPosition(this._canvas, topLeft);
                const size = this._map.getSize();
                this._canvas.width = size.x;
                this._canvas.height = size.y;
            },

            _animate: function() {
                const now = performance.now();
                const deltaMs = this._lastLogicTick ? Math.min(80, now - this._lastLogicTick) : 50;
                if (!this._lastLogicTick || (now - this._lastLogicTick) >= 50) {
                    self.updateGameLogic(deltaMs, now);
                    this._lastLogicTick = now;
                }
                this._step += 1.2;
                this._draw();
                requestAnimationFrame(this._animate.bind(this));
            },

            _draw: function() {
                if (!self.player) return;

                const ctx = this._canvas.getContext('2d');
                ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

                const sweepAngle = (this._step * 0.03) % (Math.PI * 2);
                const allAircrafts = [self.player, ...self.interceptors].filter(ent => ent && !ent.destroyed);

                allAircrafts.forEach(ent => {
                    const pt = self.map.latLngToContainerPoint([ent.lat, ent.lng]);
                    const radiusPx = SpatialEngine.getRadiusInPixels(self.map, ent.lat, ent.spec.radarRangeKm);

                    ctx.save();

                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                    ctx.fillStyle = ent.spec.color;
                    ctx.shadowColor = ent.spec.color;
                    ctx.shadowBlur = 10;
                    ctx.fill();

                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, radiusPx, 0, Math.PI * 2);
                    ctx.strokeStyle = ent.spec.color;
                    ctx.lineWidth = 1.2;
                    ctx.globalAlpha = 0.3;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(pt.x, pt.y);
                    ctx.arc(pt.x, pt.y, radiusPx, sweepAngle - 0.4, sweepAngle);
                    ctx.lineTo(pt.x, pt.y);

                    if (typeof ctx.createConicGradient === 'function') {
                        let gradient = ctx.createConicGradient(sweepAngle, pt.x, pt.y);
                        gradient.addColorStop(0, 'transparent');
                        gradient.addColorStop(1, ent.spec.color);
                        ctx.fillStyle = gradient;
                    } else {
                        ctx.fillStyle = ent.spec.color;
                    }
                    ctx.globalAlpha = 0.18;
                    ctx.fill();

                    ctx.globalAlpha = 0.9;
                    ctx.font = '11px monospace';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(`${ent.name} [RADAR: ${ent.spec.radarRangeKm}km]`, pt.x + 12, pt.y + 4);

                    ctx.restore();
                });

                if (self.activeTarget && !self.activeTarget.destroyed) {
                    const targetPt = self.map.latLngToContainerPoint([self.activeTarget.lat, self.activeTarget.lng]);
                    const lockRatio = self.player && self.player.lockDurationMs > 0
                        ? Math.min(1, self.player.lockProgressMs / self.player.lockDurationMs)
                        : 0;
                    const ringRadius = 18 + (lockRatio * 10);

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(targetPt.x, targetPt.y, ringRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = lockRatio >= 1 ? "#facc15" : "#f97316";
                    ctx.lineWidth = 2.5;
                    ctx.globalAlpha = 0.9;
                    ctx.stroke();
                    ctx.font = '12px monospace';
                    ctx.fillStyle = lockRatio >= 1 ? "#facc15" : "#fb923c";
                    ctx.fillText(lockRatio >= 1 ? "LOCKED" : `LOCK ${Math.round(lockRatio * 100)}%`, targetPt.x + 16, targetPt.y - 14);
                    ctx.restore();
                }

                // Draw countermeasures (Chaff & Flare)
                allAircrafts.forEach(ent => {
                    ent.countermeasures.forEach(cm => {
                        const cmPt = self.map.latLngToContainerPoint([cm.lat, cm.lng]);
                        ctx.save();
                        
                        // Chaff = cyan, Flare = red
                        const cmColor = cm.type === 'chaff' ? '#00ff7f' : '#ff4444';
                        const size = cm.type === 'chaff' ? 2 : 2.5;
                        
                        ctx.beginPath();
                        ctx.arc(cmPt.x, cmPt.y, size, 0, Math.PI * 2);
                        ctx.fillStyle = cmColor;
                        ctx.shadowColor = cmColor;
                        ctx.shadowBlur = 6;
                        ctx.fill();
                        
                        // Draw small marker untuk countermeasure yang aktif
                        const life = (performance.now() - cm.createdAt) / cm.lifeMs;
                        ctx.globalAlpha = 0.8 - (life * 0.5);
                        ctx.beginPath();
                        ctx.arc(cmPt.x, cmPt.y, size * 2.5, 0, Math.PI * 2);
                        ctx.strokeStyle = cmColor;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                        
                        ctx.restore();
                    });
                });

                // Draw projectiles dengan tracking visualization
                self.projectiles.forEach(projectile => {
                    const projectilePt = self.map.latLngToContainerPoint([projectile.lat, projectile.lng]);
                    ctx.save();
                    
                    // Main projectile circle
                    ctx.beginPath();
                    ctx.arc(projectilePt.x, projectilePt.y, 3, 0, Math.PI * 2);
                    ctx.fillStyle = projectile.color;
                    ctx.shadowColor = projectile.color;
                    ctx.shadowBlur = 8;
                    ctx.fill();
                    
                    // Draw tracking line jika missile sedang dilacak ke countermeasure
                    if (projectile.lockedOnCM) {
                        const cmPt = self.map.latLngToContainerPoint([projectile.lockedOnCM.lat, projectile.lockedOnCM.lng]);
                        ctx.beginPath();
                        ctx.moveTo(projectilePt.x, projectilePt.y);
                        ctx.lineTo(cmPt.x, cmPt.y);
                        ctx.strokeStyle = projectile.color;
                        ctx.lineWidth = 1.5;
                        ctx.globalAlpha = 0.6;
                        ctx.setLineDash([3, 3]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }
                    
                    // Draw trail effect
                    ctx.beginPath();
                    ctx.arc(projectilePt.x, projectilePt.y, 5, 0, Math.PI * 2);
                    ctx.strokeStyle = projectile.color;
                    ctx.lineWidth = 0.8;
                    ctx.globalAlpha = 0.3;
                    ctx.stroke();
                    
                    ctx.restore();
                });
            }
        });

        this.radarLayer = new RadarCanvasLayer();
        this.map.addLayer(this.radarLayer);
    }
}

// 1. Inisialisasi Instance Utama (Cukup 1 kali di paling bawah)
const app = new ApplicationEngine();
window.app = app; // Export untuk debugging

// 2. Fungsi Global untuk Onclick Modal HTML
window.selectHomeBase = function(country) {
    try {
        console.log("Selecting base for country:", country);

        if (typeof AIRBASE_DATABASE === 'undefined') {
            console.error("AIRBASE_DATABASE belum dimuat di HTML!");
            return;
        }

        app.setupPlayerBase(country);

    } catch (error) {
        console.error("Error saat memilih base:", error);
    }
};
