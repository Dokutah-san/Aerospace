const AIRBASE_DATABASE = [
    // ===== INDONESIA (5 Bases) =====
    {
        id: "ID_LANUD_RNJ",
        country: "INDONESIA",
        name: "Lanud Roesmin Nurjadin",
        city: "Pekanbaru",
        coords: [0.461, 101.448],
        homeAircraftKey: "F_16_BLOCK_52ID",
        squadron: ["F_16_BLOCK_52ID", "T_50I_GOLDEN_EAGLE"]
    },
    {
        id: "ID_LANUD_ISWAHJUDI",
        country: "INDONESIA",
        name: "Lanud Iswahjudi",
        city: "Magetan",
        coords: [-7.635, 111.435],
        homeAircraftKey: "SU_27SKM",
        squadron: ["SU_27SKM", "SU_30MK2", "T_50I_GOLDEN_EAGLE"]
    },
    {
        id: "ID_LANUD_SULTAN_HASANUDDIN",
        country: "INDONESIA",
        name: "Lanud Sultan Hasanuddin",
        city: "Makassar",
        coords: [-5.069, 119.554],
        homeAircraftKey: "SU_30MK2",
        squadron: ["SU_30MK2", "F_16_BLOCK_52ID"]
    },
    {
        id: "ID_LANUD_SUPADIO",
        country: "INDONESIA",
        name: "Lanud Supadio",
        city: "Pontianak",
        coords: [-0.151, 109.404],
        homeAircraftKey: "T_50I_GOLDEN_EAGLE",
        squadron: ["T_50I_GOLDEN_EAGLE", "HAWK_209"]
    },
    {
        id: "ID_LANUD_HUSEIN",
        country: "INDONESIA",
        name: "Lanud Husein Sastranegara",
        city: "Bandung",
        coords: [-6.901, 107.577],
        homeAircraftKey: "HAWK_209",
        squadron: ["HAWK_209", "T_50I_GOLDEN_EAGLE"]
    },
    // ===== MALAYSIA (5 Bases) =====
    {
        id: "MY_RMAF_GONG_KEDAK",
        country: "MALAYSIA",
        name: "RMAF Gong Kedak",
        city: "Terengganu",
        coords: [5.799, 102.486],
        homeAircraftKey: "SU_30MKM",
        squadron: ["SU_30MKM", "MIG_29N"]
    },
    {
        id: "MY_RMAF_BUTTERWORTH",
        country: "MALAYSIA",
        name: "RMAF Butterworth",
        city: "Penang",
        coords: [5.465, 100.391],
        homeAircraftKey: "F_A_18D_HORNET",
        squadron: ["F_A_18D_HORNET", "BAE_HAWK_208"]
    },
    {
        id: "MY_RMAF_KUANTAN",
        country: "MALAYSIA",
        name: "RMAF Kuantan",
        city: "Pahang",
        coords: [3.770, 103.211],
        homeAircraftKey: "MIG_29N",
        squadron: ["MIG_29N", "BAE_HAWK_208"]
    },
    {
        id: "MY_RMAF_LABUAN",
        country: "MALAYSIA",
        name: "RMAF Labuan",
        city: "Labuan/Sabah",
        coords: [5.298, 115.250],
        homeAircraftKey: "BAE_HAWK_208",
        squadron: ["BAE_HAWK_208"]
    },
    {
        id: "MY_RMAF_KUCHING",
        country: "MALAYSIA",
        name: "RMAF Kuching",
        city: "Sarawak",
        coords: [1.485, 110.347],
        homeAircraftKey: "F_A_18D_HORNET",
        squadron: ["F_A_18D_HORNET", "BAE_HAWK_208"]
    },
    // ===== SINGAPURA (4 Bases) =====
    {
        id: "SG_TENGAH_AB",
        country: "SINGAPURA",
        name: "Tengah Air Base",
        city: "Singapore",
        coords: [1.386, 103.707],
        homeAircraftKey: "G550_CAEW",
        squadron: ["G550_CAEW", "F_15SG", "F_16C_D"]
    },
    {
        id: "SG_PAYA_LEBAR_AB",
        country: "SINGAPURA",
        name: "Paya Lebar Air Base",
        city: "Singapore",
        coords: [1.360, 103.909],
        homeAircraftKey: "F_15SG",
        squadron: ["F_15SG", "F_16C_D"]
    },
    {
        id: "SG_CHANGI_EAST",
        country: "SINGAPURA",
        name: "Changi East Air Base",
        city: "Singapore",
        coords: [1.344, 103.995],
        homeAircraftKey: "F_35B",
        squadron: ["F_35B", "F_16C_D"]
    },
    {
        id: "SG_SELETAR_AB",
        country: "SINGAPURA",
        name: "Seletar Air Base",
        city: "Singapore",
        coords: [1.420, 103.867],
        homeAircraftKey: "F_16C_D",
        squadron: ["F_16C_D", "G550_CAEW"]
    },
    // ===== THAILAND (5 Bases) =====
    {
        id: "TH_KORAT_AB",
        country: "THAILAND",
        name: "Korat Air Base",
        city: "Nakhon Ratchasima",
        coords: [14.933, 102.078],
        homeAircraftKey: "JAS_39C_GRIPEN",
        squadron: ["JAS_39C_GRIPEN", "F_16A_OCU", "ALPHA_JET"]
    },
    {
        id: "TH_TAKHLI_AB",
        country: "THAILAND",
        name: "Takhli Air Base",
        city: "Nakhon Sawan",
        coords: [15.268, 100.284],
        homeAircraftKey: "F_16A_OCU",
        squadron: ["F_16A_OCU", "ALPHA_JET"]
    },
    {
        id: "TH_UDON_THANI_AB",
        country: "THAILAND",
        name: "Udon Thani Air Base",
        city: "Udon Thani",
        coords: [17.385, 102.788],
        homeAircraftKey: "SAAB_340_EW",
        squadron: ["SAAB_340_EW", "ALPHA_JET"]
    },
    {
        id: "TH_HAT_YAI_AB",
        country: "THAILAND",
        name: "Hat Yai Air Base",
        city: "Songkhla",
        coords: [6.931, 100.393],
        homeAircraftKey: "ALPHA_JET",
        squadron: ["ALPHA_JET", "JAS_39C_GRIPEN"]
    },
    {
        id: "TH_PHITSANULOK_AB",
        country: "THAILAND",
        name: "Phitsanulok Air Base",
        city: "Phitsanulok",
        coords: [16.778, 100.274],
        homeAircraftKey: "F_16A_OCU",
        squadron: ["F_16A_OCU"]
    },
    // ===== FILIPINA (5 Bases) =====
    {
        id: "PH_BASA_AB",
        country: "FILIPINA",
        name: "Basa Air Base",
        city: "Pampanga",
        coords: [15.200, 120.560],
        homeAircraftKey: "FA_50PH",
        squadron: ["FA_50PH", "AS211_WARRIOR"]
    },
    {
        id: "PH_MACTAN_AB",
        country: "FILIPINA",
        name: "Mactan-Benito Ebuen Air Base",
        city: "Cebu",
        coords: [10.319, 123.980],
        homeAircraftKey: "A29B_SUPER_TUCANO",
        squadron: ["A29B_SUPER_TUCANO", "FA_50PH"]
    },
    {
        id: "PH_CLARK_AB",
        country: "FILIPINA",
        name: "Clark Air Base (Former US)",
        city: "Angeles City",
        coords: [15.186, 120.560],
        homeAircraftKey: "FA_50PH",
        squadron: ["FA_50PH", "AS211_WARRIOR"]
    },
    {
        id: "PH_ANTONIO_BAUTISTA",
        country: "FILIPINA",
        name: "Antonio Bautista Air Base",
        city: "Palawan",
        coords: [9.859, 118.733],
        homeAircraftKey: "A29B_SUPER_TUCANO",
        squadron: ["A29B_SUPER_TUCANO"]
    },
    {
        id: "PH_EDWIN_ANDREWS",
        country: "FILIPINA",
        name: "Edwin Andrews Air Base",
        city: "Zamboanga",
        coords: [6.907, 122.060],
        homeAircraftKey: "AS211_WARRIOR",
        squadron: ["AS211_WARRIOR", "A29B_SUPER_TUCANO"]
    },
    // ===== VIETNAM (5 Bases) =====
    {
        id: "VN_DANANG_AB",
        country: "VIETNAM",
        name: "Da Nang Air Base",
        city: "Da Nang",
        coords: [16.043, 108.199],
        homeAircraftKey: "SU_30MK2_VN",
        squadron: ["SU_30MK2_VN", "SU_27UB_VN", "YAK_130"]
    },
    {
        id: "VN_BIEN_HOA_AB",
        country: "VIETNAM",
        name: "Bien Hoa Air Base",
        city: "Dong Nai",
        coords: [10.954, 106.816],
        homeAircraftKey: "SU_27UB_VN",
        squadron: ["SU_27UB_VN", "YAK_130"]
    },
    {
        id: "VN_NOIBAI_AB",
        country: "VIETNAM",
        name: "Noi Bai Air Base",
        city: "Hanoi",
        coords: [21.221, 105.807],
        homeAircraftKey: "YAK_130",
        squadron: ["YAK_130", "SU_30MK2_VN"]
    },
    {
        id: "VN_PHUCAT_AB",
        country: "VIETNAM",
        name: "Phu Cat Air Base",
        city: "Quy Nhon",
        coords: [13.955, 109.042],
        homeAircraftKey: "SU_22M4",
        squadron: ["SU_22M4", "YAK_130"]
    },
    {
        id: "VN_CAMRANH_AB",
        country: "VIETNAM",
        name: "Cam Ranh Air Base",
        city: "Khanh Hoa",
        coords: [11.992, 109.219],
        homeAircraftKey: "SU_30MK2_VN",
        squadron: ["SU_30MK2_VN", "SU_22M4"]
    }
];
