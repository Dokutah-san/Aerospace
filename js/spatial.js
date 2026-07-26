const FALLBACK_COUNTRY_DATABASE = {
    INDONESIA: {
        name: "Indonesia",
        legalClass: "archipelagic state",
        baseline: turf.polygon([[
            [95.0, 5.8], [98.5, 3.6], [101.5, 2.5], [103.2, 1.0],
            [104.5, 1.1], [109.0, -1.0], [107.0, -6.0], [95.0, -5.0], [95.0, 5.8]
        ]])
    },
    MALAYSIA: {
        name: "Malaysia",
        legalClass: "coastal state",
        baseline: turf.polygon([[
            [100.5, 4.5], [101.5, 6.5], [104.5, 6.5], [104.5, 1.3], [103.0, 1.3], [100.5, 4.5]
        ]])
    },
    SINGAPURA: {
        name: "Singapore",
        legalClass: "coastal state",
        baseline: turf.polygon([[
            [103.6, 1.2], [104.0, 1.2], [104.0, 1.45], [103.6, 1.45], [103.6, 1.2]
        ]])
    },
    THAILAND: {
        name: "Thailand",
        legalClass: "coastal state",
        baseline: turf.polygon([[
            [97.0, 5.5], [100.0, 7.5], [105.0, 7.0], [104.7, 12.0],
            [103.5, 15.0], [100.2, 15.0], [98.2, 12.0], [97.0, 5.5]
        ]])
    },
    FILIPINA: {
        name: "Philippines",
        legalClass: "archipelagic state",
        baseline: turf.polygon([[
            [117.0, 20.0], [124.5, 20.8], [126.2, 17.5], [125.2, 12.0],
            [121.0, 5.0], [117.3, 8.0], [118.0, 15.5], [117.0, 20.0]
        ]])
    },
    VIETNAM: {
        name: "Vietnam",
        legalClass: "coastal state",
        baseline: turf.polygon([[
            [102.0, 23.5], [109.5, 23.5], [110.8, 16.0], [108.5, 8.5],
            [105.0, 8.0], [103.0, 10.5], [102.0, 23.5]
        ]])
    }
};

const OFFICIAL_BOUNDARY_SOURCES = {
    INDONESIA: {
        kind: "geojson",
        url: "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/Administrasi_AR_KabKota_50K/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson",
        pick: "features"
    },
    MALAYSIA: {
        kind: "esri-json",
        url: "https://mygos.mygeoportal.gov.my/gisserver/rest/services/APMM/APMM_Public/MapServer/2/query?where=1%3D1&returnGeometry=true&outFields=*&f=json",
        pick: "features"
    },
    SINGAPURA: {
        kind: "datagov",
        datasetId: "d_29f066d67df3eae91df8a42f443863c8"
    }
};

const COUNTRY_VISUALS = {
    INDONESIA: { fill: "#ef6f6c", border: "#ffd1cf" },
    MALAYSIA: { fill: "#c08cff", border: "#f0d9ff" },
    SINGAPURA: { fill: "#f6d365", border: "#fff0b3" },
    THAILAND: { fill: "#7bd389", border: "#d6f5da" },
    FILIPINA: { fill: "#9bbcff", border: "#d8e6ff" },
    VIETNAM: { fill: "#f4a261", border: "#ffe0c2" }
};

class SpatialEngine {
    constructor() {
        this.countries = JSON.parse(JSON.stringify(FALLBACK_COUNTRY_DATABASE));
        Object.keys(this.countries).forEach(country => {
            this.countries[country].source = "fallback";
        });
        this.zones = {};
        this.map = null;
        this.zoneLayerGroup = null;
        this.airbaseLayerGroup = null;
        this.localBoundaryCache = (typeof window !== "undefined" && window.OFFICIAL_BOUNDARY_CACHE) ? window.OFFICIAL_BOUNDARY_CACHE : {};

        this.ready = this.loadOfficialBaselines()
            .catch(error => {
                console.warn("Official boundary load failed, using fallback geometry:", error);
            })
            .then(() => {
                this.generateZones();
                this.refreshLayers();
            });

        this.generateZones();
    }

    bindMap(map) {
        this.map = map;
        this.refreshLayers();
    }

    static getRadiusInPixels(map, lat, distanceKm) {
        if (!map || typeof map.latLngToContainerPoint !== "function") {
            return distanceKm * 2;
        }

        const origin = L.latLng(lat, 0);
        const target = L.latLng(lat, distanceKm / 111.32);
        const originPx = map.latLngToContainerPoint(origin);
        const targetPx = map.latLngToContainerPoint(target);
        const radius = Math.hypot(targetPx.x - originPx.x, targetPx.y - originPx.y);

        return Number.isFinite(radius) && radius > 0 ? radius : distanceKm * 2;
    }

    static normalizeFeatureCollection(data) {
        if (!data) return null;

        if (data.type === "FeatureCollection") return data;
        if (data.type === "Feature") return { type: "FeatureCollection", features: [data] };
        return null;
    }

    static normalizeBoundaryPayload(data) {
        if (!data) return null;

        const normalized = SpatialEngine.normalizeFeatureCollection(data);
        if (normalized) return normalized;

        if (Array.isArray(data.features) && data.features.length > 0) {
            const first = data.features[0];
            if (first && first.geometry && first.geometry.rings) {
                const features = data.features
                    .map(feature => SpatialEngine.esriGeometryToGeoJSONFeature(feature))
                    .filter(Boolean);
                return { type: "FeatureCollection", features };
            }
        }

        return null;
    }

    static isPolygonalFeatureCollection(data) {
        const normalized = SpatialEngine.normalizeBoundaryPayload(data);
        if (!normalized || !Array.isArray(normalized.features) || normalized.features.length === 0) {
            return false;
        }

        return normalized.features.every(feature => {
            const type = feature && feature.geometry && feature.geometry.type;
            return type === "Polygon" || type === "MultiPolygon";
        });
    }

    static esriGeometryToGeoJSONFeature(feature) {
        const geometry = feature.geometry || {};
        const properties = feature.attributes || {};
        let geoGeometry = null;

        if (geometry.rings) {
            geoGeometry = {
                type: "Polygon",
                coordinates: geometry.rings
            };
        } else if (geometry.paths) {
            geoGeometry = {
                type: "MultiLineString",
                coordinates: geometry.paths
            };
        } else if (geometry.x !== undefined && geometry.y !== undefined) {
            geoGeometry = {
                type: "Point",
                coordinates: [geometry.x, geometry.y]
            };
        }

        if (!geoGeometry) return null;

        return {
            type: "Feature",
            properties,
            geometry: geoGeometry
        };
    }

    static async fetchGeoJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }
        return response.json();
    }

    static async fetchSingaporeGeoJSON(datasetId) {
        const pollUrl = `https://api-open.data.gov.sg/v1/public/api/datasets/${datasetId}/poll-download`;
        const poll = await SpatialEngine.fetchGeoJSON(pollUrl);
        if (!poll || poll.code !== 0 || !poll.data || !poll.data.url) {
            throw new Error("Singapore download URL unavailable");
        }
        return SpatialEngine.fetchGeoJSON(poll.data.url);
    }

    async loadOfficialBaselines() {
        const loaders = {
            INDONESIA: async () => SpatialEngine.fetchGeoJSON(OFFICIAL_BOUNDARY_SOURCES.INDONESIA.url),
            MALAYSIA: async () => {
                const data = await SpatialEngine.fetchGeoJSON(OFFICIAL_BOUNDARY_SOURCES.MALAYSIA.url);
                const features = (data.features || [])
                    .map(feature => SpatialEngine.esriGeometryToGeoJSONFeature(feature))
                    .filter(Boolean);
                return { type: "FeatureCollection", features };
            },
            SINGAPURA: async () => SpatialEngine.fetchSingaporeGeoJSON(OFFICIAL_BOUNDARY_SOURCES.SINGAPURA.datasetId)
        };

        for (const [country, loader] of Object.entries(loaders)) {
            try {
                const localCache = SpatialEngine.normalizeBoundaryPayload(this.localBoundaryCache[country]);
                if (SpatialEngine.isPolygonalFeatureCollection(localCache)) {
                    this.countries[country].baseline = localCache;
                    this.countries[country].source = "local-cache";
                    continue;
                }

                const fetched = SpatialEngine.normalizeBoundaryPayload(await loader());
                if (SpatialEngine.isPolygonalFeatureCollection(fetched)) {
                    this.countries[country].baseline = fetched;
                    this.countries[country].source = "remote";
                } else if (fetched) {
                    console.warn(`Official boundary for ${country} ignored because it is not polygonal.`);
                }
            } catch (error) {
                console.warn(`Official boundary load skipped for ${country}:`, error);
            }
        }
    }

    static bufferGeometry(geom, distanceKm) {
        const applyBuffer = feature => turf.buffer(feature, distanceKm, { units: "kilometers", steps: 96 });

        if (!geom) return null;
        if (geom.type === "FeatureCollection") {
            const buffered = geom.features.map(feature => applyBuffer(feature)).filter(Boolean);
            return { type: "FeatureCollection", features: buffered };
        }
        return applyBuffer(geom);
    }

    static simplifyGeometry(geom, tolerance = 0.005) {
        if (!geom) return null;

        const simplifyFeature = feature => {
            if (!feature) return null;
            try {
                return turf.simplify(feature, {
                    tolerance,
                    highQuality: true,
                    mutate: false
                });
            } catch (error) {
                return feature;
            }
        };

        if (geom.type === "FeatureCollection") {
            const features = geom.features
                .map(feature => simplifyFeature(feature))
                .filter(Boolean);
            return { type: "FeatureCollection", features };
        }

        return simplifyFeature(geom);
    }

    static collectGeometryPoints(geom, sampleStep = 18) {
        const points = [];

        const pushCoords = coords => {
            if (!Array.isArray(coords)) return;
            for (let i = 0; i < coords.length; i += sampleStep) {
                const coord = coords[i];
                if (!Array.isArray(coord)) continue;
                if (typeof coord[0] === "number" && typeof coord[1] === "number") {
                    points.push(turf.point([coord[0], coord[1]]));
                }
            }
        };

        const walk = feature => {
            if (!feature || !feature.geometry) return;
            const geometry = feature.geometry;
            if (geometry.type === "Polygon") {
                geometry.coordinates.forEach(pushCoords);
            } else if (geometry.type === "MultiPolygon") {
                geometry.coordinates.forEach(polygon => polygon.forEach(pushCoords));
            } else if (geometry.type === "FeatureCollection") {
                geometry.features.forEach(walk);
            }
        };

        walk(geom);
        return turf.featureCollection(points);
    }

    static buildArchipelagicHull(geom) {
        const pointCollection = SpatialEngine.collectGeometryPoints(SpatialEngine.simplifyGeometry(geom, 0.01), 20);
        if (!pointCollection || !Array.isArray(pointCollection.features) || pointCollection.features.length < 3) {
            return null;
        }

        try {
            const hull = turf.convex(pointCollection);
            if (hull) return hull;
            return SpatialEngine.simplifyGeometry(geom, 0.004);
        } catch (error) {
            console.warn("Failed to build archipelagic hull:", error);
            try {
                return SpatialEngine.simplifyGeometry(geom, 0.004);
            } catch (convexError) {
                console.warn("Failed to build fallback archipelagic boundary:", convexError);
                return null;
            }
        }
    }

    static pointInGeometry(point, geom) {
        if (!geom) return false;
        try {
            if (geom.type === "FeatureCollection") {
                return geom.features.some(feature => SpatialEngine.pointInGeometry(point, feature));
            }
            if (geom.type === "Feature") {
                return turf.booleanPointInPolygon(point, geom);
            }
            if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
                return turf.booleanPointInPolygon(point, turf.feature(geom));
            }
        } catch (error) {
            return false;
        }
        return false;
    }

    static distanceToBaseline(point, geom) {
        if (!geom) return Infinity;

        const measure = feature => {
            try {
                if (!feature || !feature.geometry) return Infinity;
                const geometryType = feature.geometry.type;
                if (geometryType !== "Polygon" && geometryType !== "MultiPolygon") {
                    return Infinity;
                }
                const boundary = turf.polygonToLine(feature);
                return turf.pointToLineDistance(point, boundary, { units: "kilometers" });
            } catch (error) {
                return Infinity;
            }
        };

        if (geom.type === "FeatureCollection") {
            return Math.min(...geom.features.map(measure));
        }

        return measure(geom);
    }

    buildCandidateDebug(point, countryList) {
        return countryList.map(country => {
            return {
                country,
                source: (this.countries[country] && this.countries[country].source) || "fallback"
            };
        });
    }

    generateZones() {
        Object.keys(this.countries).forEach(country => {
            const baseline = this.countries[country].baseline;
            const archipelagicHull = country === "INDONESIA"
                ? SpatialEngine.buildArchipelagicHull(baseline)
                : null;
            const displayBaseline = SpatialEngine.simplifyGeometry(archipelagicHull || baseline, 0.004);
            const territorial = SpatialEngine.bufferGeometry(displayBaseline || baseline, 12 * 1.852);
            const displayTerritorial = SpatialEngine.simplifyGeometry(territorial, 0.003);

            this.zones[country] = {
                territorial,
                displayBaseline,
                displayTerritorial
            };
        });
    }

    refreshLayers() {
        if (!this.map || typeof L === "undefined") return;

        if (this.zoneLayerGroup) {
            this.zoneLayerGroup.remove();
        }
        if (this.airbaseLayerGroup) {
            this.airbaseLayerGroup.remove();
        }

        this.zoneLayerGroup = L.layerGroup().addTo(this.map);

        Object.keys(this.countries).forEach(country => {
            const meta = this.countries[country];
            const visual = COUNTRY_VISUALS[country] || { fill: "#94a3b8", border: "#e2e8f0" };
            const baselineGeometry = this.zones[country].displayBaseline || meta.baseline;
            const territorialGeometry = this.zones[country].displayTerritorial || this.zones[country].territorial;

            L.geoJSON(baselineGeometry, {
                smoothFactor: 1.8,
                style: {
                    color: visual.border,
                    weight: 2,
                    fillColor: visual.fill,
                    fillOpacity: 0.18
                }
            }).bindTooltip(`${meta.name} baseline`, { sticky: true }).addTo(this.zoneLayerGroup);

            L.geoJSON(territorialGeometry, {
                smoothFactor: 1.8,
                style: {
                    color: visual.fill,
                    weight: 1.4,
                    fillColor: visual.fill,
                    fillOpacity: 0.08
                }
            }).bindTooltip(`${meta.name} territorial sea (12 NM)`, { sticky: true }).addTo(this.zoneLayerGroup);
        });

        this.airbaseLayerGroup = L.layerGroup().addTo(this.map);
        AIRBASE_DATABASE.forEach(base => {
            const aircraftName = AIRCRAFT_DATABASE[base.homeAircraftKey]
                ? AIRCRAFT_DATABASE[base.homeAircraftKey].name
                : base.homeAircraftKey;

            const marker = L.circleMarker(base.coords, {
                radius: 6,
                color: "#22d3ee",
                weight: 2,
                fillColor: "#0ea5e9",
                fillOpacity: 0.8
            });

            // Fungsi deploy dari popup (dipanggil via global app)
            const deployFn = `window.app && window.app.respawnFromBase('${base.id}')`;
            
            marker.bindPopup(
                `<strong>${base.name}</strong><br>${base.city}<br>${base.country}<br>Primary asset: ${aircraftName}<br><br>` +
                `<button onclick="${deployFn}" style="background:#00ffcc;color:#000;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:bold;font-family:monospace;">🚀 DEPLOY</button>`
            );
            marker.bindTooltip(`${base.country}: ${base.name}`, { sticky: true });
            marker.addTo(this.airbaseLayerGroup);
        });
    }

    evaluateAirspace(lat, lng, homeCountry) {
        const pt = turf.point([lng, lat]);
        const countryOrder = [
            homeCountry,
            ...Object.keys(this.countries).filter(country => country !== homeCountry)
        ];
        const debug = {
            homeCountry,
            point: { lat, lng },
            territorial: []
        };

        for (const country of countryOrder) {
            if (!this.countries[country] || !this.countries[country].baseline) continue;

            const hitBaseline = this.zones[country]?.displayBaseline || this.countries[country].baseline;
            if (SpatialEngine.pointInGeometry(pt, hitBaseline)) {
                return {
                    status: country === homeCountry ? "HOME_TERRITORIAL" : "FOREIGN_TERRITORIAL",
                    country,
                    zone: "baseline",
                    legalMeaning: "sovereignty",
                    debug
                };
            }
        }

        const territorialCandidates = [];
        for (const country of countryOrder) {
            if (!this.countries[country] || !this.zones[country]) continue;

            if (SpatialEngine.pointInGeometry(pt, this.zones[country].territorial)) {
                territorialCandidates.push(country);
            }
        }

        if (territorialCandidates.length > 0) {
            debug.territorial = this.buildCandidateDebug(pt, territorialCandidates);
            const winner = territorialCandidates.find(country => {
                const baselineGeom = this.zones[country]?.displayBaseline || this.countries[country].baseline;
                return SpatialEngine.pointInGeometry(pt, baselineGeom);
            }) || territorialCandidates[0];

            return {
                status: winner === homeCountry ? "HOME_TERRITORIAL" : "FOREIGN_TERRITORIAL",
                country: winner,
                zone: "territorial",
                legalMeaning: "sovereignty",
                debug
            };
        }

        return {
            status: "INTERNATIONAL",
            country: "NONE",
            zone: "high_seas",
            legalMeaning: "freedom of navigation",
            debug
        };
    }

    getNearestAirbase(lat, lng, country) {
        if (typeof AIRBASE_DATABASE === "undefined" || !Array.isArray(AIRBASE_DATABASE)) {
            return null;
        }

        const candidates = AIRBASE_DATABASE.filter(base => base.country === country);
        if (candidates.length === 0) return null;

        let nearestBase = null;
        let nearestDistance = Infinity;

        candidates.forEach(base => {
            const distance = turf.distance(
                turf.point([lng, lat]),
                turf.point([base.coords[1], base.coords[0]]),
                { units: "kilometers" }
            );

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestBase = base;
            }
        });

        return nearestBase;
    }
}
