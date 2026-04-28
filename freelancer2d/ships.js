// Freelancer 2D - Ship Data
// All ships from Freelancer HD installation

const SHIPS_DATA = {
    // === CIVILIAN SHIPS (Starting Zone) ===
    'civilian_cv_starflier': {
        id: 'civilian_cv_starflier',
        name: 'Starflier',
        faction: 'Civilian',
        price: 5000,
        stats: {
            hull: 80,
            shield: 20,
            maxSpeed: 40,
            turnRate: 2.2,
            firePower: 8
        },
        scale: 0.9,
        description: 'Standard civilian transport. Good for beginners.'
    },
    'civilian_cv_fighter': {
        id: 'civilian_cv_fighter',
        name: 'Civilian Fighter',
        faction: 'Civilian',
        price: 8000,
        stats: {
            hull: 100,
            shield: 30,
            maxSpeed: 50,
            turnRate: 2.0,
            firePower: 12
        },
        scale: 1.0,
        description: 'Upgraded transport with combat capabilities.'
    },
    'civilian_cv_elite': {
        id: 'civilian_cv_elite',
        name: 'Elite',
        faction: 'Civilian',
        price: 15000,
        stats: {
            hull: 150,
            shield: 50,
            maxSpeed: 80,
            turnRate: 1.8,
            firePower: 15
        },
        scale: 1.2,
        description: 'High-performance civilian ship with excellent armor.'
    },
    'civilian_cv_starblazer': {
        id: 'civilian_cv_starblazer',
        name: 'Starblazer',
        faction: 'Civilian',
        price: 12000,
        stats: {
            hull: 120,
            shield: 40,
            maxSpeed: 60,
            turnRate: 1.9,
            firePower: 12
        },
        scale: 1.1,
        description: 'Balanced civilian vessel with good all-around stats.'
    },
    'civilian_cv_startracker': {
        id: 'civilian_cv_startracker',
        name: 'Startracker',
        faction: 'Civilian',
        price: 6000,
        stats: {
            hull: 90,
            shield: 25,
            maxSpeed: 45,
            turnRate: 2.1,
            firePower: 10
        },
        scale: 0.95,
        description: 'Reliable scout vessel for exploration.'
    },
    'civilian_cv_vheavy_fighter': {
        id: 'civilian_cv_vheavy_fighter',
        name: 'Heavy Fighter',
        faction: 'Civilian',
        price: 25000,
        stats: {
            hull: 180,
            shield: 60,
            maxSpeed: 100,
            turnRate: 1.5,
            firePower: 20
        },
        scale: 1.4,
        description: 'Heavily armored fighter for combat operations.'
    },

    // === LIBERTY SHIPS ===
    'liberty_li_fighter': {
        id: 'liberty_li_fighter',
        name: 'Liberty Fighter',
        faction: 'Liberty',
        price: 10000,
        stats: {
            hull: 100,
            shield: 35,
            maxSpeed: 55,
            turnRate: 2.0,
            firePower: 12
        },
        scale: 1.0,
        description: 'Standard Liberty military fighter.'
    },
    'liberty_li_heavy_fighter': {
        id: 'liberty_li_heavy_fighter',
        name: 'Liberty Heavy Fighter',
        faction: 'Liberty',
        price: 20000,
        stats: {
            hull: 160,
            shield: 55,
            maxSpeed: 85,
            turnRate: 1.6,
            firePower: 18
        },
        scale: 1.3,
        description: 'Heavy combat vessel of the Liberty Navy.'
    },
    'liberty_li_bomber': {
        id: 'liberty_li_bomber',
        name: 'Liberty Bomber',
        faction: 'Liberty',
        price: 30000,
        stats: {
            hull: 200,
            shield: 70,
            maxSpeed: 100,
            turnRate: 1.3,
            firePower: 25
        },
        scale: 1.5,
        description: 'Heavy bomber for capital ship destruction.'
    },

    // === BRETONIA SHIPS ===
    'bretonia_br_fighter': {
        id: 'bretonia_br_fighter',
        name: 'Bretonia Fighter',
        faction: 'Bretonia',
        price: 11000,
        stats: {
            hull: 110,
            shield: 38,
            maxSpeed: 58,
            turnRate: 1.9,
            firePower: 13
        },
        scale: 1.05,
        description: 'Knightly order combat vessel.'
    },
    'bretonia_br_heavy_fighter': {
        id: 'bretonia_br_heavy_fighter',
        name: 'Bretonia Heavy Fighter',
        faction: 'Bretonia',
        price: 22000,
        stats: {
            hull: 170,
            shield: 58,
            maxSpeed: 88,
            turnRate: 1.5,
            firePower: 19
        },
        scale: 1.35,
        description: 'Heavily armored Bretonian war vessel.'
    },
    'bretonia_br_cruiser': {
        id: 'bretonia_br_cruiser',
        name: 'Bretonia Cruiser',
        faction: 'Bretonia',
        price: 50000,
        stats: {
            hull: 300,
            shield: 100,
            maxSpeed: 150,
            turnRate: 1.0,
            firePower: 30
        },
        scale: 2.0,
        description: 'Capital ship of the Bretonian fleet.'
    },

    // === RHEINLAND SHIPS ===
    'rheinland_rh_fighter': {
        id: 'rheinland_rh_fighter',
        name: 'Rheinland Fighter',
        faction: 'Rheinland',
        price: 9500,
        stats: {
            hull: 95,
            shield: 32,
            maxSpeed: 52,
            turnRate: 2.1,
            firePower: 11
        },
        scale: 0.95,
        description: 'Germanic engineering precision fighter.'
    },
    'rheinland_rh_heavy_fighter': {
        id: 'rheinland_rh_heavy_fighter',
        name: 'Rheinland Heavy Fighter',
        faction: 'Rheinland',
        price: 21000,
        stats: {
            hull: 165,
            shield: 55,
            maxSpeed: 85,
            turnRate: 1.5,
            firePower: 17
        },
        scale: 1.3,
        description: 'Superior Rheinland firepower vessel.'
    },
    'rheinland_rh_cruiser': {
        id: 'rheinland_rh_cruiser',
        name: 'Rheinland Cruiser',
        faction: 'Rheinland',
        price: 48000,
        stats: {
            hull: 290,
            shield: 95,
            maxSpeed: 145,
            turnRate: 1.1,
            firePower: 28
        },
        scale: 1.95,
        description: 'Command vessel of the Rheinland fleet.'
    },

    // === KUSARI SHIPS ===
    'kusari_ku_fighter': {
        id: 'kusari_ku_fighter',
        name: 'Kusari Fighter',
        faction: 'Kusari',
        price: 10500,
        stats: {
            hull: 105,
            shield: 36,
            maxSpeed: 56,
            turnRate: 2.0,
            firePower: 12
        },
        scale: 1.0,
        description: 'Sleek Asian design fighter.'
    },
    'kusari_ku_heavy_fighter': {
        id: 'kusari_ku_heavy_fighter',
        name: 'Kusari Heavy Fighter',
        faction: 'Kusari',
        price: 23000,
        stats: {
            hull: 175,
            shield: 58,
            maxSpeed: 90,
            turnRate: 1.5,
            firePower: 18
        },
        scale: 1.35,
        description: 'Advanced Kusari war machine.'
    },
    'kusari_ku_cruiser': {
        id: 'kusari_ku_cruiser',
        name: 'Kusari Cruiser',
        faction: 'Kusari',
        price: 52000,
        stats: {
            hull: 310,
            shield: 105,
            maxSpeed: 155,
            turnRate: 1.0,
            firePower: 32
        },
        scale: 2.05,
        description: 'Flagship of the Kusari navy.'
    },

    // === PIRATE SHIPS ===
    'pirate_pi_fighter': {
        id: 'pirate_pi_fighter',
        name: 'Pirate Fighter',
        faction: 'Pirate',
        price: 3000,
        stats: {
            hull: 60,
            shield: 15,
            maxSpeed: 30,
            turnRate: 2.5,
            firePower: 8
        },
        scale: 0.8,
        description: 'Stripped down raiding vessel.'
    },
    'pirate_pi_heavy_fighter': {
        id: 'pirate_pi_heavy_fighter',
        name: 'Pirate Heavy Fighter',
        faction: 'Pirate',
        price: 8000,
        stats: {
            hull: 120,
            shield: 40,
            maxSpeed: 65,
            turnRate: 1.8,
            firePower: 15
        },
        scale: 1.1,
        description: 'Upgraded pirate warship.'
    },

    // === ORDER SHIPS ===
    'order_order_fighter': {
        id: 'order_order_fighter',
        name: 'Order Fighter',
        faction: 'Order',
        price: 14000,
        stats: {
            hull: 130,
            shield: 45,
            maxSpeed: 70,
            turnRate: 1.8,
            firePower: 14
        },
        scale: 1.1,
        description: 'Order of the Flame elite fighter.'
    },
    'order_order_cruiser': {
        id: 'order_order_cruiser',
        name: 'Order Cruiser',
        faction: 'Order',
        price: 55000,
        stats: {
            hull: 320,
            shield: 110,
            maxSpeed: 160,
            turnRate: 0.9,
            firePower: 35
        },
        scale: 2.1,
        description: 'Super-heavy Order battleship.'
    },

    // === NOMAD SHIPS ===
    'nomad_nomad_fighter': {
        id: 'nomad_nomad_fighter',
        name: 'Nomad Fighter',
        faction: 'Nomad',
        price: 40000,
        stats: {
            hull: 180,
            shield: 60,
            maxSpeed: 100,
            turnRate: 1.6,
            firePower: 20
        },
        scale: 1.4,
        description: 'Mysterious alien technology vessel.'
    },
    'nomad_nomad_cruiser': {
        id: 'nomad_nomad_cruiser',
        name: 'Nomad Cruiser',
        faction: 'Nomad',
        price: 80000,
        stats: {
            hull: 400,
            shield: 150,
            maxSpeed: 200,
            turnRate: 0.8,
            firePower: 45
        },
        scale: 2.5,
        description: 'Massive Nomad capital ship.'
    }
};

// Default starter ship
const STARTER_SHIP = 'civilian_cv_starflier';

// Get all ships by faction
function getShipsByFaction(faction) {
    return Object.values(SHIPS_DATA).filter(ship => ship.faction === faction);
}

// Get ship by ID
function getShipById(id) {
    return SHIPS_DATA[id];
}

// Get all ships
function getAllShips() {
    return Object.values(SHIPS_DATA);
}