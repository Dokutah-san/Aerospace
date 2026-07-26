class ApplicationEngine {
    constructor() {
        this.map = L.map('map', { keyboard: false }).setView([3.0000, 104.5000], 6);
        this.spatial = new SpatialEngine();
        this.spatial.bindMap(this.map);
        
        this.player = null;
        this.homeCountry = null;
        this.interceptors = [];
        this.projectiles = [];
        this.friendlyUnits = []; // Support wingman units
        this.sharedLocks = []; // Network-Centric Warfare: shared target locks from all friendly units
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
        
        // Setelah setup, refresh panel support units
        this.refreshSupportPanel();
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

    isAWACS(aircraft) {
        return aircraft && aircraft.spec && aircraft.spec.role === 'awacs';
    }

    fireProjectile(owner, target, manual = false) {
        if (!owner || !target || owner.destroyed || target.destroyed) return false;
        
        // AWACS tidak bisa menembak
        if (this.isAWACS(owner)) {
            const radioLog = document.getElementById('radio-log');
            if (radioLog && manual) radioLog.innerHTML = `[RADIO]: AWACS has no weapon systems. Use fighter units to engage.`;
            return false;
        }
        
        // Network-Centric Warfare: cek apakah target ada di sharedLocks
        // Jika owner tidak bisa radar target sendiri, tapi target ada di sharedLocks, tetap bisa fire
        const canSeeTarget = owner.isTargetInRadar(target);
        const isSharedLocked = this.sharedLocks.some(lock => lock.targetId === target.id);
        
        if (!canSeeTarget && !isSharedLocked) return false;

        const now = performance.now();
        if (now - owner.lastFireAt < owner.fireCooldownMs) {
            return false;
        }

        owner.lastFireAt = now;
        const projectile = new Projectile(owner, target);
        this.projectiles.push(projectile);

        const radioLog = document.getElementById('radio-log');
        if (radioLog) {
            const sourceInfo = canSeeTarget ? '' : ' [via datalink]';
            radioLog.innerHTML = manual
                ? `[FIRE]: ${owner.name} fired at ${target.name}${sourceInfo}.`
                : `[AUTO]: ${owner.name} launched shot at ${target.name}${sourceInfo}.`;
        }

        return true;
    }

    tryFirePlayerWeapon() {
        if (!this.player || this.gameOver || this.player.destroyed) return;

        // AWACS tidak bisa menembak
        if (this.isAWACS(this.player)) {
            const radioLog = document.getElementById('radio-log');
            if (radioLog) radioLog.innerHTML = `[RADIO]: AWACS has no weapon systems. Deploy fighter units from support panel to engage.`;
            return;
        }

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

        // Bersihkan sharedLocks yang targetnya sudah hancur
        this.sharedLocks = this.sharedLocks.filter(lock => {
            const target = this.findEntityById(lock.targetId);
            return target && !target.destroyed;
        });

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
                        
                        // Network-Centric Warfare: share lock ke semua friendly units
                        this.shareLock(this.player, this.activeTarget);
                        
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
        
        // ===== FRIENDLY UNITS: Auto-fire pada target yang ada di sharedLocks =====
        this.friendlyUnits = this.friendlyUnits.filter(unit => unit && !unit.destroyed);
        this.friendlyUnits.forEach(unit => {
            // Cari target di sharedLocks yang belum di-fire oleh unit ini
            const lockInfo = this.sharedLocks.find(lock => 
                lock.targetId && !lock.firedBy.includes(unit.id)
            );
            
            if (lockInfo) {
                const target = this.findEntityById(lockInfo.targetId);
                if (target && !target.destroyed) {
                    // Friendly unit bisa fire ke target yang di-share lock
                    // Cek cooldown
                    if (nowMs - unit.lastFireAt >= unit.fireCooldownMs) {
                        const success = this.fireProjectile(unit, target, false);
                        if (success) {
                            lockInfo.firedBy.push(unit.id);
                        }
                    }
                }
            }
        });
    }
    
    findEntityById(id) {
        if (!id) return null;
        if (this.player && this.player.id === id) return this.player;
        const interceptor = this.interceptors.find(i => i.id === id);
        if (interceptor) return interceptor;
        const friendly = this.friendlyUnits.find(f => f.id === id);
        if (friendly) return friendly;
        return null;
    }
    
    shareLock(source, target) {
        if (!source || !target) return;
        
        // Hapus lock lama untuk target yang sama
        this.sharedLocks = this.sharedLocks.filter(lock => lock.targetId !== target.id);
        
        // Tambah lock baru
        this.sharedLocks.push({
            sourceId: source.id,
            sourceName: source.name,
            targetId: target.id,
            targetName: target.name,
            firedBy: [], // Unit yang sudah fire ke target ini
            timestamp: performance.now()
        });
        
        const radioLog = document.getElementById('radio-log');
        if (radioLog) {
            const isAWACS = this.isAWACS(source);
            const awacsLabel = isAWACS ? ' [AWACS datalink]' : ' [datalink]';
            radioLog.innerHTML = `[NCW]: ${source.name} shared target lock${awacsLabel}. All units can engage.`;
        }
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
            // Set state menunggu deploy — player harus klik marker base di peta
            this.waitingForRespawn = true;
            this.gameOver = true;
            
            const hudCard = document.getElementById('status-card');
            if (hudCard) {
                hudCard.className = "hud-card status-red";
                hudCard.innerHTML = `<strong>AIRCRAFT SHOT DOWN</strong><br>Klik marker pangkalan di peta untuk deploy ulang.`;
            }
            if (radioLog) {
                radioLog.innerHTML = `[RADIO]: Mayday! Aircraft down! Click any airbase marker on map to redeploy.`;
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

    getAvailableSupportUnits() {
        if (!this.homeCountry) return [];
        
        // Ambil semua base dari negara player
        const bases = AIRBASE_DATABASE.filter(b => b.country === this.homeCountry);
        const unitMap = new Map();
        
        bases.forEach(base => {
            const aircraftKey = base.homeAircraftKey || (base.squadron && base.squadron[0]);
            if (!aircraftKey) return;
            
            if (!unitMap.has(aircraftKey)) {
                const spec = AIRCRAFT_DATABASE[aircraftKey];
                unitMap.set(aircraftKey, {
                    key: aircraftKey,
                    name: spec ? spec.name : aircraftKey,
                    count: 0,
                    bases: []
                });
            }
            unitMap.get(aircraftKey).count++;
            unitMap.get(aircraftKey).bases.push(base);
        });
        
        return Array.from(unitMap.values());
    }
    
    refreshSupportPanel() {
        const listContainer = document.getElementById('support-unit-list');
        if (!listContainer) return;
        
        if (!this.homeCountry) {
            listContainer.innerHTML = `<div style="color:#64748b;font-size:10px;">Select a country to see available units...</div>`;
            return;
        }
        
        const units = this.getAvailableSupportUnits();
        
        if (units.length === 0) {
            listContainer.innerHTML = `<div style="color:#64748b;font-size:10px;">No support units available.</div>`;
            return;
        }
        
        listContainer.innerHTML = '';
        units.forEach((unit, index) => {
            const btn = document.createElement('button');
            btn.className = 'support-unit-btn';
            btn.innerHTML = `
                <span>${unit.count > 1 ? '🛩️'.repeat(Math.min(unit.count, 3)) : '🛩️'} ${unit.name}</span>
                <div class="unit-name">${unit.bases[0].name}${unit.bases.length > 1 ? ' +' + (unit.bases.length - 1) : ''}</div>
            `;
            btn.onclick = () => this.callSupport(unit.key);
            listContainer.appendChild(btn);
        });
    }
    
    callSupport(aircraftKey) {
        if (!this.player || this.player.destroyed || this.gameOver) return;
        
        // Cari base terdekat yang punya aircraft ini
        const bases = AIRBASE_DATABASE.filter(b => 
            b.country === this.homeCountry && 
            (b.homeAircraftKey === aircraftKey || (b.squadron && b.squadron.includes(aircraftKey)))
        );
        
        if (bases.length === 0) return;
        
        // Cari base terdekat dari posisi player
        let nearestBase = null;
        let nearestDist = Infinity;
        
        bases.forEach(base => {
            const dist = turf.distance(
                turf.point([this.player.lng, this.player.lat]),
                turf.point([base.coords[1], base.coords[0]]),
                { units: "kilometers" }
            );
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestBase = base;
            }
        });
        
        if (!nearestBase) return;
        
        const wingman = new FriendlyAircraft(
            nearestBase.coords[0],
            nearestBase.coords[1],
            aircraftKey,
            nearestBase.name
        );
        
        wingman.offsetIndex = this.friendlyUnits.length;
        this.friendlyUnits.push(wingman);
        
        const radioLog = document.getElementById('radio-log');
        if (radioLog) {
            const spec = AIRCRAFT_DATABASE[aircraftKey];
            radioLog.innerHTML = `[RADIO]: ${spec ? spec.name : aircraftKey} from ${nearestBase.name} en route to your position.`;
        }
        
        this.refreshSupportPanel();
    }
    
    respawnFromBase(baseId) {
        // Cari base berdasarkan ID
        const base = AIRBASE_DATABASE.find(b => b.id === baseId);
        if (!base) return;
        
        // Cek apakah base ini dari negara yang sama dengan player
        if (base.country !== this.homeCountry) {
            const radioLog = document.getElementById('radio-log');
            if (radioLog) radioLog.innerHTML = `[RADIO]: Cannot deploy at foreign base!`;
            return;
        }
        
        // Reset semua state
        this.gameOver = false;
        this.waitingForRespawn = false;
        this.lockRequested = false;
        this.activeTarget = null;
        this.interceptors = [];
        this.projectiles = [];
        this.friendlyUnits = [];
        
        // Reset HUD
        const hudCard = document.getElementById('status-card');
        if (hudCard) {
            hudCard.className = "hud-card status-green";
        }
        
        const radioLog = document.getElementById('radio-log');
        if (radioLog) {
            radioLog.innerHTML = `[RADIO]: Redeploying at ${base.name}. All systems online.`;
        }
        
        // Deploy ulang player di base yang dipilih
        const defaultAircraft = base.homeAircraftKey || base.squadron[0];
        const aircraftName = AIRCRAFT_DATABASE[defaultAircraft] 
            ? AIRCRAFT_DATABASE[defaultAircraft].name 
            : defaultAircraft;
        
        this.player = new PlayerAircraft(
            base.coords[0],
            base.coords[1],
            defaultAircraft,
            `${base.name} | ${aircraftName}`
        );
        
        // Pindahkan kamera ke base
        this.map.flyTo(base.coords, 7);
    }

    updateGameLogic(deltaMs = 50, nowMs = performance.now()) {
        if (!this.player || this.gameOver) return;

        this.player.move(this.keysPressed);

        const evaluation = this.spatial.evaluateAirspace(this.player.lat, this.player.lng, this.homeCountry);
        const hudCard = document.getElementById('status-card');
        const radioLog = document.getElementById('radio-log');
        const debugLog = document.getElementById('debug-log');

        this.interceptors.forEach(interceptor => interceptor.updateInterception(this.player));
        
        // Update friendly units mengikuti player
        this.friendlyUnits = this.friendlyUnits.filter(unit => unit && !unit.destroyed);
        this.friendlyUnits.forEach((unit, index) => {
            unit.followPlayer(this.player, index);
        });
        
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
            
            // Network-Centric Warfare: cek apakah ada shared locks dari unit lain
            const activeSharedLock = this.sharedLocks.find(lock => {
                const tgt = this.findEntityById(lock.targetId);
                return tgt && !tgt.destroyed;
            });
            const isPlayerAWACS = this.isAWACS(this.player);
            const awacsLabel = isPlayerAWACS ? ' [AWACS - SUPPORT ONLY]' : '';
            
            let combatLine;
            if (isPlayerAWACS) {
                // AWACS: tampilkan shared lock info
                if (activeSharedLock) {
                    const unitsFiring = activeSharedLock.firedBy.length;
                    combatLine = `[AWACS] SHARED LOCK: ${activeSharedLock.targetName} | ${unitsFiring} unit(s) engaging`;
                } else if (hasRadarContact) {
                    combatLine = `[AWACS] RADAR: ${targetName} | Press L to lock & share with allies`;
                } else {
                    combatLine = `[AWACS] Scanning for targets... | Deploy fighters from support panel`;
                }
            } else if (this.lockRequested && this.activeTarget && !this.activeTarget.destroyed) {
                if (this.player.lockProgressMs >= this.player.lockDurationMs) {
                    const sharedInfo = activeSharedLock ? ' [SHARED via datalink]' : '';
                    combatLine = `[L] LOCKED ON ${targetName}${sharedInfo} | LMB TO FIRE`;
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
                hudCard.innerHTML = `<strong>${this.homeCountry} - ${evaluation.zone.toUpperCase()}${awacsLabel}</strong><br>Legal status: ${evaluation.legalMeaning}<br>Status: FRIENDLY PATROL<br>${combatLine}`;

                if (this.interceptors.length > 0) {
                    radioLog.innerHTML = `[RADIO]: Target returned to home jurisdiction. Interceptors disengaging.`;
                    this.interceptors = [];
                }
            } else if (evaluation.status === "FOREIGN_TERRITORIAL") {
                hudCard.className = "hud-card status-red";
                hudCard.innerHTML = `<strong>FOREIGN TERRITORIAL VIOLATION${awacsLabel}</strong><br>Country: ${evaluation.country}<br>Legal status: ${evaluation.legalMeaning}<br>Status: SCRAMBLE INTERCEPTOR<br>${combatLine}`;

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
                hudCard.innerHTML = `<strong>INTERNATIONAL AIRSPACE${awacsLabel}</strong><br>Batas Hukum: freedom of navigation<br>Status: CLEAR<br>${combatLine}`;

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
            if (this.isAWACS(this.player)) {
                ammoDisplay.innerHTML = `
                    Kontrol: <span style="color: var(--text-cyan)">[W][A][S][D]</span> / Panah Keyboard<br>
                    <span style="color: #a855f7;">🛩️ AWACS - SUPPORT PLATFORM</span><br>
                    <span style="color: #c084fc;">Radar: ${this.player.spec.radarRangeKm}km | Lock & share targets with fighters</span><br>
                    <span style="color: #fca5a5;">Chaff: ${this.player.chaffCount}x | Flare: ${this.player.flareCount}x</span>
                `;
            } else {
                ammoDisplay.innerHTML = `
                    Kontrol: <span style="color: var(--text-cyan)">[W][A][S][D]</span> / Panah Keyboard<br>
                    <span style="color: #38bdf8;">🔫 TEMBAK: LMB (Left Mouse) | 🛡️ CHAFF/FLARE: Middle Mouse</span><br>
                    <span style="color: #fca5a5;">Chaff: ${this.player.chaffCount}x | Flare: ${this.player.flareCount}x | Cooldown: 0.3s</span>
                `;
            }
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
                const allAircrafts = [self.player, ...self.interceptors, ...self.friendlyUnits].filter(ent => ent && !ent.destroyed);

                allAircrafts.forEach(ent => {
                    const pt = self.map.latLngToContainerPoint([ent.lat, ent.lng]);
                    const radiusPx = SpatialEngine.getRadiusInPixels(self.map, ent.lat, ent.spec.radarRangeKm);

                    // Determine color based on entity type
                    let displayColor = ent.spec.color;
                    
                    // Friendly units always show green
                    const isFriendly = self.friendlyUnits.includes(ent);
                    
                    ctx.save();

                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                    ctx.fillStyle = isFriendly ? '#22c55e' : displayColor;
                    ctx.shadowColor = isFriendly ? '#22c55e' : displayColor;
                    ctx.shadowBlur = 10;
                    ctx.fill();

                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, radiusPx, 0, Math.PI * 2);
                    ctx.strokeStyle = isFriendly ? '#22c55e' : displayColor;
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
                        gradient.addColorStop(1, isFriendly ? '#22c55e' : displayColor);
                        ctx.fillStyle = gradient;
                    } else {
                        ctx.fillStyle = isFriendly ? '#22c55e' : displayColor;
                    }
                    ctx.globalAlpha = 0.18;
                    ctx.fill();

                    ctx.globalAlpha = 0.9;
                    ctx.font = '11px monospace';
                    ctx.fillStyle = '#ffffff';
                    const labelPrefix = isFriendly ? '🟢 ' : '';
                    ctx.fillText(`${labelPrefix}${ent.name} [RADAR: ${ent.spec.radarRangeKm}km]`, pt.x + 12, pt.y + 4);

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
