/**
 * ENTITY SYSTEM (PLAYER & INTERCEPTOR)
 */

/**
 * Countermeasure Class (Chaff & Flare untuk mengecohkan rudal)
 */
class Countermeasure {
    constructor(lat, lng, type = 'chaff') {
        this.id = `cm-${Countermeasure._nextId++}`;
        this.lat = lat;
        this.lng = lng;
        this.type = type; // 'chaff' atau 'flare'
        this.lifeMs = 5000; // Umur countermeasure
        this.createdAt = performance.now();
        this.active = true;
        this.driftLat = (Math.random() - 0.5) * 0.001;
        this.driftLng = (Math.random() - 0.5) * 0.001;
    }

    update(deltaMs) {
        const elapsed = performance.now() - this.createdAt;
        if (elapsed > this.lifeMs) {
            this.active = false;
            return false;
        }

        // Drift drift drift (simulasi pergerakan udara)
        this.lat += this.driftLat * (deltaMs / 16);
        this.lng += this.driftLng * (deltaMs / 16);

        return true;
    }

    distanceTo(lat, lng) {
        return Math.hypot(this.lat - lat, this.lng - lng);
    }
}
Countermeasure._nextId = 1;

class Aircraft {
    constructor(lat, lng, specKey, customName = null) {
        Aircraft._nextId = (Aircraft._nextId || 1);
        this.id = `${specKey}-${Aircraft._nextId++}`;
        this.lat = lat;
        this.lng = lng;
        this.spec = AIRCRAFT_DATABASE[specKey];
        this.name = customName || this.spec.name;
        this.destroyed = false;
        this.lockTargetId = null;
        this.lockProgressMs = 0;
        this.lockDurationMs = 1200;
        this.fireCooldownMs = 1800;
        this.lastFireAt = -Infinity;
        
        // Lock tracking untuk defensive engagement
        this.hasBeenLockedBy = null; // ID player yang sudah lock pesawat ini
        
        // Countermeasure system
        this.countermeasures = [];
        this.chaffCount = 12;
        this.flareCount = 12;
        this.cmCooldownMs = 300;
        this.lastCMDeployAt = -Infinity;
    }

    getCoords() {
        return [this.lat, this.lng];
    }

    distanceTo(other) {
        return turf.distance(
            turf.point([this.lng, this.lat]),
            turf.point([other.lng, other.lat]),
            { units: "kilometers" }
        );
    }

    isTargetInRadar(other) {
        if (!other || other.destroyed) return false;
        return this.distanceTo(other) <= this.spec.radarRangeKm;
    }

    resetLock() {
        this.lockTargetId = null;
        this.lockProgressMs = 0;
    }

    deployCountermeasure(type = 'chaff') {
        const now = performance.now();
        if (now - this.lastCMDeployAt < this.cmCooldownMs) return false;

        if (type === 'chaff' && this.chaffCount > 0) {
            const cm = new Countermeasure(this.lat, this.lng, 'chaff');
            this.countermeasures.push(cm);
            this.chaffCount--;
            this.lastCMDeployAt = now;
            return true;
        } else if (type === 'flare' && this.flareCount > 0) {
            const cm = new Countermeasure(this.lat, this.lng, 'flare');
            this.countermeasures.push(cm);
            this.flareCount--;
            this.lastCMDeployAt = now;
            return true;
        }
        return false;
    }

    deployMultipleCountermeasures(count = 4, type = 'chaff') {
        let deployed = 0;
        for (let i = 0; i < count; i++) {
            if (this.deployCountermeasure(type)) {
                deployed++;
            }
        }
        return deployed;
    }

    updateCountermeasures() {
        this.countermeasures = this.countermeasures.filter(cm => cm.update(0));
    }
}

// 1. Player Aircraft Class
class PlayerAircraft extends Aircraft {
    constructor(lat, lng, specKey, customName = null) {
        super(lat, lng, specKey, customName || AIRCRAFT_DATABASE[specKey].name);
        this.speed = 0.012; // Translasi per-frame
    }

    move(keysPressed) {
        if (keysPressed['arrowup'] || keysPressed['w']) this.lat += this.speed;
        if (keysPressed['arrowdown'] || keysPressed['s']) this.lat -= this.speed;
        if (keysPressed['arrowleft'] || keysPressed['a']) this.lng -= this.speed;
        if (keysPressed['arrowright'] || keysPressed['d']) this.lng += this.speed;
    }
}

// 2. AI Interceptor Aircraft Class (Real-Time Transit dari Base)
class InterceptorAircraft extends Aircraft {
    constructor(lat, lng, specKey, homeBaseName) {
        super(lat, lng, specKey, `INTERCEPTOR (${AIRCRAFT_DATABASE[specKey].name})`);
        this.homeBase = homeBaseName;
        
        // Konversi Kecepatan Real (KM/H) ke Delta Koordinat per Frame
        // Misal: Mach 2.0 (~2120 km/h) -> diperhitungkan untuk pergerakan halus di peta
        this.speedFactor = (this.spec.maxSpeedKmh / 2120) * 0.008; 
    }

    // Terbang dari Base menuju Posisi Player Saat Ini
    updateInterception(player) {
        const dLat = player.lat - this.lat;
        const dLng = player.lng - this.lng;
        const distance = Math.hypot(dLat, dLng);

        // Jika belum mendekati player, terbang mendekati vektor target
        if (distance > 0.005) {
            this.lat += (dLat / distance) * this.speedFactor;
            this.lng += (dLng / distance) * this.speedFactor;
        }
    }
}

// 3. Friendly Support Aircraft (Wingman)
class FriendlyAircraft extends Aircraft {
    constructor(lat, lng, specKey, homeBaseName) {
        super(lat, lng, specKey, `WINGMAN (${AIRCRAFT_DATABASE[specKey].name})`);
        this.homeBase = homeBaseName;
        // Wingman lebih lambat dari interceptor agar terlihat formasi
        this.speedFactor = (this.spec.maxSpeedKmh / 2120) * 0.006;
        this.offsetIndex = 0; // Untuk formasi posisi
    }

    // Mengikuti player dengan formasi
    followPlayer(player, index = 0) {
        if (!player || player.destroyed) return;
        
        const dLat = player.lat - this.lat;
        const dLng = player.lng - this.lng;
        const distance = Math.hypot(dLat, dLng);
        
        // Jarak ideal formasi: sedikit di belakang dan samping player
        const formationDist = 0.02; // ~2km formasi
        const angleOffset = (index + 1) * 0.8; // Posisi formasi melingkar
        
        // Target posisi: di belakang player dengan offset formasi
        const targetLat = player.lat - (formationDist * Math.cos(angleOffset));
        const targetLng = player.lng - (formationDist * Math.sin(angleOffset));
        
        const toTargetLat = targetLat - this.lat;
        const toTargetLng = targetLng - this.lng;
        const distToFormation = Math.hypot(toTargetLat, toTargetLng);
        
        if (distToFormation > 0.003) { // Threshold formasi
            this.lat += (toTargetLat / distToFormation) * this.speedFactor;
            this.lng += (toTargetLng / distToFormation) * this.speedFactor;
        }
    }
}

class Projectile {
    constructor(owner, target, isTracking = true) {
        this.id = `proj-${Projectile._nextId++}`;
        this.ownerId = owner.id;
        this.ownerName = owner.name;
        this.targetId = target.id;
        this.targetRef = target;
        this.lat = owner.lat;
        this.lng = owner.lng;
        this.prevLat = owner.lat;
        this.prevLng = owner.lng;
        this.color = owner.spec.color;
        
        // Hitung jarak ke target saat launch
        const distToTarget = turf.distance(
            turf.point([this.lng, this.lat]),
            turf.point([target.lng, target.lat]),
            { units: "kilometers" }
        );
        
        // DISTANCE-AWARE SPEED: Rudal akan sampai target dalam ~2-3 detik
        // Kecepatan dihitung agar rudal mencapai target dalam 2 detik (7200 frame ms)
        // Ditambah minimum speed 20000 km/h untuk jarak dekat
        const desiredTimeSec = 2.5; // Waktu tempuh yang diinginkan (2.5 detik)
        const requiredSpeedKmh = (distToTarget / desiredTimeSec) * 3600; // Konversi km/s ke km/h
        this.speedKmh = Math.max(25000, requiredSpeedKmh); // Minimum 25.000 km/h
        
        this.hitRadiusKm = 12; // Blast radius lebih besar untuk guaranteed hit
        this.maxTravelKm = Math.max(500, distToTarget * 1.5); // Max range dinamis
        this.travelledKm = 0;
        this.active = true;
        this.isTracking = isTracking;
        
        // Tracking missile properties
        this.lockedOnCM = null; // Countermeasure yang sedang dilacak
        this.trackingLossThreshold = 8; // km - jarak maks untuk kehilangan lock pada CM
        this.lastTargetLat = target.lat;
        this.lastTargetLng = target.lng;
        this.createdAt = performance.now();
    }

    findNearestCountermeasure(target) {
        if (!target || target.countermeasures.length === 0) {
            return null;
        }

        let nearest = null;
        let minDist = this.trackingLossThreshold;

        target.countermeasures.forEach(cm => {
            const dist = turf.distance(
                turf.point([this.lng, this.lat]),
                turf.point([cm.lng, cm.lat]),
                { units: "kilometers" }
            );

            if (dist < minDist) {
                nearest = cm;
                minDist = dist;
            }
        });

        return nearest;
    }

    update(deltaMs) {
        if (!this.active) {
            return { active: false, hit: false, expired: true };
        }

        const target = this.targetRef;
        if (!target || target.destroyed) {
            this.active = false;
            return { active: false, hit: false, expired: true };
        }

        // Cek apakah target mengeluarkan countermeasure (chaff/flare) di dekat rudal
        if (target.countermeasures && target.countermeasures.length > 0) {
            const cm = this.findNearestCountermeasure(target);
            if (cm && Math.random() < 0.35) { // 35% chance terpengaruh countermeasure
                this.lockedOnCM = cm;
            }
        }

        // Jika sedang lock ke countermeasure, kejar countermeasure
        if (this.lockedOnCM) {
            const distToCM = turf.distance(
                turf.point([this.lng, this.lat]),
                turf.point([this.lockedOnCM.lng, this.lockedOnCM.lat]),
                { units: "kilometers" }
            );

            if (distToCM > this.trackingLossThreshold || !this.lockedOnCM.active) {
                this.lockedOnCM = null; // Lepas lock, kembali ke target
            } else {
                // Kejar countermeasure
                const stepKm = this.speedKmh * (deltaMs / 3600000);
                const from = turf.point([this.lng, this.lat]);
                const to = turf.point([this.lockedOnCM.lng, this.lockedOnCM.lat]);
                const bearing = turf.bearing(from, to);
                const nextPoint = turf.destination(from, stepKm, bearing, { units: "kilometers" });

                this.lng = nextPoint.geometry.coordinates[0];
                this.lat = nextPoint.geometry.coordinates[1];
                this.travelledKm += stepKm;

                // Cek apakah sampai ke CM
                if (distToCM <= this.hitRadiusKm) {
                    this.active = false;
                    this.lockedOnCM.active = false;
                    return { active: false, hit: false, expired: true, countermeasureEvade: true };
                }

                if (this.travelledKm >= this.maxTravelKm) {
                    this.active = false;
                    return { active: false, hit: false, expired: true };
                }

                return { active: true, hit: false, expired: false };
            }
        }

        // === INSTANT CHASE: Langsung ke posisi target saat ini ===
        const stepKm = this.speedKmh * (deltaMs / 3600000);
        const from = turf.point([this.lng, this.lat]);
        const to = turf.point([target.lng, target.lat]); // Posisi REAL-TIME target
        const bearing = turf.bearing(from, to);
        const nextPoint = turf.destination(from, stepKm, bearing, { units: "kilometers" });

        this.lng = nextPoint.geometry.coordinates[0];
        this.lat = nextPoint.geometry.coordinates[1];
        this.travelledKm += stepKm;

        // Cek collision dengan target (posisi real-time)
        const remaining = turf.distance(
            turf.point([this.lng, this.lat]),
            turf.point([target.lng, target.lat]),
            { units: "kilometers" }
        );

        if (remaining <= this.hitRadiusKm) {
            this.active = false;
            return { active: false, hit: true, expired: false, target };
        }

        if (this.travelledKm >= this.maxTravelKm) {
            this.active = false;
            return { active: false, hit: false, expired: true };
        }

        return { active: true, hit: false, expired: false };
    }
}

Projectile._nextId = 1;
