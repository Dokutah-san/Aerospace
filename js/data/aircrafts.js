const AIRCRAFT_DATABASE = {
    // ===== INDONESIA =====
    F_16_BLOCK_52ID: {
        id: "F_16_BLOCK_52ID",
        name: "F-16C Block 52ID Fighting Falcon",
        origin: "INDONESIA",
        role: "fighter",
        maxSpeedMach: 2.0,
        maxSpeedKmh: 2120,
        radarType: "AN/APG-68(V)9",
        radarRangeKm: 105,
        color: "#00e5ff"
    },
    SU_27SKM: {
        id: "SU_27SKM",
        name: "Sukhoi Su-27SKM Flanker",
        origin: "INDONESIA",
        role: "fighter",
        maxSpeedMach: 2.35,
        maxSpeedKmh: 2500,
        radarType: "N001VEP",
        radarRangeKm: 120,
        color: "#7dd3fc"
    },
    SU_30MK2: {
        id: "SU_30MK2",
        name: "Sukhoi Su-30MK2 Flanker-C",
        origin: "INDONESIA",
        role: "fighter",
        maxSpeedMach: 2.0,
        maxSpeedKmh: 2120,
        radarType: "N001VEP",
        radarRangeKm: 140,
        color: "#22d3ee"
    },
    T_50I_GOLDEN_EAGLE: {
        id: "T_50I_GOLDEN_EAGLE",
        name: "T-50i Golden Eagle",
        origin: "INDONESIA",
        role: "trainer_light_fighter",
        maxSpeedMach: 1.5,
        maxSpeedKmh: 1830,
        radarType: "EL/M-2032",
        radarRangeKm: 80,
        color: "#2dd4bf"
    },
    HAWK_209: {
        id: "HAWK_209",
        name: "BAE Hawk 209",
        origin: "INDONESIA",
        role: "trainer_light_attack",
        maxSpeedMach: 0.85,
        maxSpeedKmh: 1028,
        radarType: "None",
        radarRangeKm: 40,
        color: "#5eead4"
    },
    // ===== MALAYSIA =====
    SU_30MKM: {
        id: "SU_30MKM",
        name: "Sukhoi Su-30MKM Flanker-H",
        origin: "MALAYSIA",
        role: "fighter",
        maxSpeedMach: 2.0,
        maxSpeedKmh: 2120,
        radarType: "N011M Bars",
        radarRangeKm: 140,
        color: "#ff0055"
    },
    F_A_18D_HORNET: {
        id: "F_A_18D_HORNET",
        name: "F/A-18D Hornet",
        origin: "MALAYSIA",
        role: "fighter",
        maxSpeedMach: 1.8,
        maxSpeedKmh: 1915,
        radarType: "AN/APG-73",
        radarRangeKm: 100,
        color: "#fb7185"
    },
    BAE_HAWK_208: {
        id: "BAE_HAWK_208",
        name: "BAE Hawk 208",
        origin: "MALAYSIA",
        role: "trainer_light_attack",
        maxSpeedMach: 0.85,
        maxSpeedKmh: 1028,
        radarType: "None",
        radarRangeKm: 40,
        color: "#f43f5e"
    },
    MIG_29N: {
        id: "MIG_29N",
        name: "MiG-29N Fulcrum",
        origin: "MALAYSIA",
        role: "fighter",
        maxSpeedMach: 2.25,
        maxSpeedKmh: 2400,
        radarType: "N019ME Topaz",
        radarRangeKm: 100,
        color: "#e11d48"
    },
    // ===== SINGAPURA =====
    F_15SG: {
        id: "F_15SG",
        name: "F-15SG Strike Eagle",
        origin: "SINGAPURA",
        role: "fighter",
        maxSpeedMach: 2.5,
        maxSpeedKmh: 2660,
        radarType: "AN/APG-63(V)3 AESA",
        radarRangeKm: 160,
        color: "#eab308"
    },
    F_16C_D: {
        id: "F_16C_D",
        name: "F-16C/D Fighting Falcon",
        origin: "SINGAPURA",
        role: "fighter",
        maxSpeedMach: 2.0,
        maxSpeedKmh: 2120,
        radarType: "AN/APG-68(V)9",
        radarRangeKm: 105,
        color: "#facc15"
    },
    G550_CAEW: {
        id: "G550_CAEW",
        name: "Gulfstream G550 CAEW (AWACS)",
        origin: "SINGAPURA",
        role: "awacs",
        maxSpeedMach: 0.85,
        maxSpeedKmh: 1041,
        radarType: "EL/W-2085 AESA",
        radarRangeKm: 370,
        color: "#a855f7"
    },
    F_35B: {
        id: "F_35B",
        name: "F-35B Lightning II",
        origin: "SINGAPURA",
        role: "stealth_fighter",
        maxSpeedMach: 1.6,
        maxSpeedKmh: 1930,
        radarType: "AN/APG-81 AESA",
        radarRangeKm: 180,
        color: "#c084fc"
    },
    // ===== THAILAND =====
    JAS_39C_GRIPEN: {
        id: "JAS_39C_GRIPEN",
        name: "JAS 39C Gripen",
        origin: "THAILAND",
        role: "fighter",
        maxSpeedMach: 2.0,
        maxSpeedKmh: 2200,
        radarType: "PS-05/A",
        radarRangeKm: 120,
        color: "#60a5fa"
    },
    F_16A_OCU: {
        id: "F_16A_OCU",
        name: "F-16A/B Fighting Falcon",
        origin: "THAILAND",
        role: "fighter",
        maxSpeedMach: 2.0,
        maxSpeedKmh: 2120,
        radarType: "AN/APG-66",
        radarRangeKm: 90,
        color: "#3b82f6"
    },
    SAAB_340_EW: {
        id: "SAAB_340_EW",
        name: "Saab 340 AEW&C (AWACS)",
        origin: "THAILAND",
        role: "awacs",
        maxSpeedMach: 0.5,
        maxSpeedKmh: 610,
        radarType: "Erieye AESA",
        radarRangeKm: 350,
        color: "#8b5cf6"
    },
    ALPHA_JET: {
        id: "ALPHA_JET",
        name: "Alpha Jet A",
        origin: "THAILAND",
        role: "trainer_light_attack",
        maxSpeedMach: 0.85,
        maxSpeedKmh: 1000,
        radarType: "None",
        radarRangeKm: 35,
        color: "#6366f1"
    },
    // ===== FILIPINA =====
    FA_50PH: {
        id: "FA_50PH",
        name: "FA-50PH Fighting Eagle",
        origin: "FILIPINA",
        role: "fighter",
        maxSpeedMach: 1.5,
        maxSpeedKmh: 1830,
        radarType: "EL/M-2032",
        radarRangeKm: 100,
        color: "#f97316"
    },
    A29B_SUPER_TUCANO: {
        id: "A29B_SUPER_TUCANO",
        name: "A-29B Super Tucano",
        origin: "FILIPINA",
        role: "light_attack",
        maxSpeedMach: 0.56,
        maxSpeedKmh: 590,
        radarType: "Optical/EO suite",
        radarRangeKm: 55,
        color: "#fb923c"
    },
    AS211_WARRIOR: {
        id: "AS211_WARRIOR",
        name: "SIAI-Marchetti AS-211 Warrior",
        origin: "FILIPINA",
        role: "trainer_light_attack",
        maxSpeedMach: 0.6,
        maxSpeedKmh: 720,
        radarType: "None",
        radarRangeKm: 30,
        color: "#fdba74"
    },
    // ===== VIETNAM =====
    SU_30MK2_VN: {
        id: "SU_30MK2_VN",
        name: "Sukhoi Su-30MK2",
        origin: "VIETNAM",
        role: "fighter",
        maxSpeedMach: 2.0,
        maxSpeedKmh: 2120,
        radarType: "N001VEP",
        radarRangeKm: 140,
        color: "#38bdf8"
    },
    SU_27UB_VN: {
        id: "SU_27UB_VN",
        name: "Sukhoi Su-27UB Flanker",
        origin: "VIETNAM",
        role: "fighter",
        maxSpeedMach: 2.35,
        maxSpeedKmh: 2500,
        radarType: "N001",
        radarRangeKm: 120,
        color: "#0ea5e9"
    },
    SU_22M4: {
        id: "SU_22M4",
        name: "Sukhoi Su-22M4 Fitter",
        origin: "VIETNAM",
        role: "ground_attack",
        maxSpeedMach: 1.7,
        maxSpeedKmh: 1860,
        radarType: "Klyon PS",
        radarRangeKm: 60,
        color: "#0284c7"
    },
    YAK_130: {
        id: "YAK_130",
        name: "Yakovlev Yak-130 Mitten",
        origin: "VIETNAM",
        role: "trainer_light_fighter",
        maxSpeedMach: 0.93,
        maxSpeedKmh: 1060,
        radarType: "BRLS-130",
        radarRangeKm: 70,
        color: "#7dd3fc"
    },
    // ===== FOREIGN / UNKNOWN =====
    UNKNOWN_INTERCEPTOR: {
        id: "UNKNOWN_INTERCEPTOR",
        name: "Unknown Military Aircraft",
        origin: "FOREIGN",
        role: "fighter",
        maxSpeedMach: 2.0,
        maxSpeedKmh: 2120,
        radarType: "Generic A/A radar",
        radarRangeKm: 100,
        color: "#ff9900"
    }
};
