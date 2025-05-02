/*
Combined Game Code: The Longest Day
Includes:
- Base Survival Mechanics
- Day/Night Cycle & Stats
- Inventory & Crafting
- Placeable Objects (Campfire, Shelter, Purifier, Signal Fire)
- Resource Gathering (Trees, Rocks, Shrubs, Driftwood)
- Regrowth & Spawning
- UI Elements (Stats Panel, Inventory, Tooltip, Messages, Prompts, Menus)
- Leaderboard
- Help Panel & Pause
- World Generation
- Dynamic Tree Shadows
- Player Shade/Shelter Effects (Transparency, Sun Damage Avoidance, Shade Regen)
- Swimming Mechanics (Speed, Health Drain)
- Fishing Mechanics (Rod, Cooldown, Jumping Fish)
- Shark Enemy (Spawns far from land, Patrols, Chases, Attacks, Despawns)
- Game Over States (Starvation/Thirst/Damage, Shark Attack, Rescue)
- Scaling Logic
*/

(function() {
    'use strict';

    // --- FROM constants.js ---
    // Holds fixed values and configuration for the game.

    // Tile & World Dimensions
    const TILE_SIZE = 32;
    const WORLD_WIDTH_TILES = 45; // New width in tiles (1440 / 32)
    const WORLD_HEIGHT_TILES = 28; // New height in tiles (floor(900 / 32))
    const WORLD_WIDTH = 1440;    // New width in pixels
    const WORLD_HEIGHT = 896;     // New height in pixels (28 * 32)
    const SUN_DAMAGE_RATE = 1.75; // Health lost per second when exposed to direct sun during the day
    const SHELTER_ALPHA = 0.4;   // Player transparency when inside a shelter

    // Water Interaction
    const PURIFIER_PROXIMITY_THRESHOLD = TILE_SIZE * 2.0; // Min distance player must be from purifier to drink dirty water (center-to-center)

    // <<< NEW: Scattered Effect Noise Constants >>>
    const EFFECT_NOISE_SCALE_XY = 2.6; // Spatial scale of the effect patches (smaller = larger patches)
    const EFFECT_NOISE_SCALE_T = 0.00;  // How fast the effect patches evolve over time (smaller = slower)
    const EFFECT_ACTIVATION_THRESHOLD = 0.75; // Noise value (0-1) above which the effect appears PERMANENTLY

    // Inventory
    const VISIBLE_INVENTORY_SLOTS = 5;
    const MAX_INVENTORY_SIZE = 20;

    // Stats
    const MAX_STAT = 100;

    // Gameplay Mechanics
    const RESCUE_START_DAY = 4;
    const BASE_RESCUE_CHANCE = 0.15;
    const PLAYER_STUMP_SLOWDOWN = 0.5; // Speed multiplier when on stumps

    // Resources & Regrowth
    const TREE_REGROW_DAYS = 365; // Keep existing tree values
    const TREE_HEALTH = 5;
    const TREE_WOOD_YIELD = 5;
    const TREE_DAMAGE_THRESHOLD = 0.6;
    const INITIAL_TREE_RESOURCE = 400;

    // NEW: Shrub Constants
    const SHRUB_REGROW_DAYS = 2;
    const SHRUB_HEALTH = 3;
    const SHRUB_WOOD_YIELD = 5;
    const SHRUB_STUMP_DURATION = 0.5;

    const INITIAL_ROCK_RESOURCE = 3000;

    // NEW: Driftwood Constants
    const DRIFTWOOD_SPAWN_CHANCE_PER_DAY = 0.6;
    const MAX_DRIFTWOOD_COUNT = 15;
    const DRIFTWOOD_WOOD_YIELD_MIN = 50;
    const DRIFTWOOD_WOOD_YIELD_MAX = 100;

    // Terrain Types
    const TERRAIN_GRASS = 'grass';
    const TERRAIN_SAND = 'sand';
    const TERRAIN_WATER = 'water'; // Now represents LAKES
    const TERRAIN_OCEAN_WATER = 'ocean_water'; // <<< NEW: Represents Ocean
    const TERRAIN_SHALLOW_WATER = 'shallow_water'; // Currently unused but defined

    // Misc
    const FISHING_ZONE_Y_START = WORLD_HEIGHT_TILES * 0.7; // Likely unused
    const MAX_PURIFIER_DIST_TO_EDGE = 60; // Likely unused
    const LEADERBOARD_MAX_ENTRIES = 10;

    // Fishing Mechanics
    const FISHING_DURATION = 2.5; // Seconds to wait for a normal catch
    const FISHING_COOLDOWN = 1.0; // Seconds before you can fish again after an attempt
    const FISH_JUMPING_CHANCE_PER_SECOND = 0.02; // Approx 2% chance per second
    const FISH_JUMPING_DURATION = 8.0; // How long the jumping state lasts in seconds

    // Swimming Mechanics
    const SWIM_SPEED_MULTIPLIER = 0.6; // Player moves at 60% speed in water
    const SWIM_HEALTH_DRAIN_RATE = 0.15; // Health points lost per second while swimming
    const SHADE_HEALTH_REGEN_RATE = 1.75; // NEW: Health points gained per second in shade (daytime)

    // NEW: Shark Constants
    const SHARK_SPAWN_DISTANCE_TILES = 5;      // Player must be this many tiles from land
    const SHARK_SPAWN_CHANCE = 0.005;         // Chance *per frame* in deep water (adjust!)
    const SHARK_SPEED = 2.0 * TILE_SIZE;       // Speed in pixels per second
    const SHARK_DETECTION_RANGE = TILE_SIZE * 8; // Range to notice player
    const SHARK_ATTACK_RANGE = TILE_SIZE * 1.2;  // Range to attack
    const SHARK_LOSE_SIGHT_RANGE_MULTIPLIER = 1.8; // Factor to lose sight
    const SHARK_COOLDOWN = 3.0;                // Seconds cooldown after losing sight
    const SHARK_DESPAWN_LAND_TIME = 5.0;       // Seconds on land before shark despawns (if not chasing)

    // NEW: Jumping Fish Animation State
    let jumpingFishAnimation = {
        active: false,       // Is an animation currently playing?
        x: 0,                // Horizontal position of the jump
        startY: 0,           // Vertical position of the water surface for this jump
        progress: 0,         // Animation timer/progress (0 to 1)
        duration: 0.7,       // How long the jump animation takes (seconds)
        maxHeight: TILE_SIZE * 1.2 // How high the fish jumps relative to water surface
    };

    // <<< NEW: Debounce flag for click handling >>>
    let isProcessingClick = false; // Prevents handling clicks too close together

    // --- State Getters/Setters --- (or wherever your functions start)
    // ... function getGameState() { ... } ...

    // <<< NEW: Wave Animation Constants >>>
    const WAVE_AMPLITUDE = 1.5; // pixels
    const WAVE_SPEED = 1.5;     // Radians per second
    const WAVE_FREQUENCY_X = 0.2; // Radians per pixel
    const WAVE_FREQUENCY_Y = 0.15; // Radians per pixel
    const WAVE_COLOR_LIGHT = '#6BBEC0'; // Lighter wave crest color
    const WAVE_COLOR_DARK = '#0E9FA3';  // Slightly darker trough color

          
// --- START PERLIN NOISE IMPLEMENTATION ---
// (Source: Adapted from various common examples, e.g., Stefan Gustavson, Ken Perlin)
const PerlinNoise = (function() {
    const p = new Uint8Array(512);
    let isInitialized = false;

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(t, a, b) { return a + t * (b - a); }
    function grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    function noise(x, y = 0, z = 0) {
        if (!isInitialized) seed(Math.random()); // Auto-seed if not done

        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = fade(x);
        const v = fade(y);
        const w = fade(z);

        const A = p[X] + Y;
        const AA = p[A] + Z;
        const AB = p[A + 1] + Z;
        const B = p[X + 1] + Y;
        const BA = p[B] + Z;
        const BB = p[B + 1] + Z;

        return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z),
                                       grad(p[BA], x - 1, y, z)),
                               lerp(u, grad(p[AB], x, y - 1, z),
                                       grad(p[BB], x - 1, y - 1, z))),
                       lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1),
                                       grad(p[BA + 1], x - 1, y, z - 1)),
                               lerp(u, grad(p[AB + 1], x, y - 1, z - 1),
                                       grad(p[BB + 1], x - 1, y - 1, z - 1))));
    }

    function seed(seedValue) {
        const random = (() => {
             // Simple pseudo-random number generator ( mulberry32 )
             let a = seedValue * 0x12345678;
             return function() {
               let t = a += 0x6D2B79F5;
               t = Math.imul(t ^ t >>> 15, t | 1);
               t ^= t + Math.imul(t ^ t >>> 7, t | 61);
               return ((t ^ t >>> 14) >>> 0) / 4294967296;
             }
           })();

        const permutation = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            permutation[i] = i;
        }
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [permutation[i], permutation[j]] = [permutation[j], permutation[i]]; // Swap
        }
        for (let i = 0; i < 256; i++) {
            p[i] = p[i + 256] = permutation[i];
        }
        isInitialized = true;
        console.log("Perlin noise seeded.");
    }

    return { noise, seed };
})();
// --- END PERLIN NOISE IMPLEMENTATION ---

    

    // --- FROM utils.js ---
    // Contains small helper functions used across different modules.

    function checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }

    function dist(x1, y1, x2, y2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function distSq(x1, y1, x2, y2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return dx * dx + dy * dy;
    }

    function isPointNearObject(objectList, maxDistance, targetX, targetY) {
        const maxDistSq = maxDistance * maxDistance;
        for (const obj of objectList) {
            const objCenterX = obj.x + (obj.width || TILE_SIZE) / 2;
            const objCenterY = obj.y + (obj.height || TILE_SIZE) / 2;
            if (distSq(targetX, targetY, objCenterX, objCenterY) < maxDistSq) {
                return true;
            }
        }
        return false;
    }


    // --- FROM assets.js ---
    // Defines game assets like resources and craftable items.

    const resources = {
        wood: { name: 'Wood', description: 'Basic building material.' },
        stone: { name: 'Stone', description: 'Sturdy material for tools.' },
        fish: { name: 'Fish', heals: 3, restoresHunger: 30, description: 'Eat (Space) for nourishment.' },
    };

    const craftableItems = {
        axe: { name: 'Axe', requires: { wood: 5, stone: 2 }, description: 'Chops trees faster.' },
        fishingRod: { name: 'Fishing Rod', requires: { wood: 3 }, description: 'Enables fishing.' },
        campfire: { name: 'Campfire', requires: { wood: 10, stone: 3 }, placeable: true, width: 48, height: 48, description: 'Place (Space) for light/warmth.' },
        shelter: { name: 'Shelter', requires: { wood: 20 }, placeable: true, pickupable: true, width: 64, height: 48, description: 'Place (Space). Click to enter/exit. Press E nearby to pick up.' },
        waterPurifier: { name: 'Water Purifier', requires: { wood: 8, stone: 5 }, placeable: true, width: 40, height: 40, description: `Place near sand/water edge. Interact (E) for water.` },
        largeSignalFire: { name: 'Signal Fire', requires: { wood: 30, stone: 10 }, placeable: true, width: 64, height: 64, isSignal: true, description: 'Place & keep lit for rescue chance.' }
    };


    // --- FROM world.js ---
    // Manages the game world grid, object lists, resource placement, and terrain drawing.

    // --- World State (declared within IIFE scope) ---
    let world = []; // The 2D grid representing terrain
    let grassPatches = []; // Decorative grass details

    // Lists of objects in the world
    let trees = [];
    let rocks = [];
    let shrubs = [];
    let driftwoodPieces = [];
    let campfires = [];
    let shelters = [];
    let waterFilters = [];
    let signalFires = [];

    // Functions to get the current state (read-only access)
    function getWorldState() {
        return {
            world,
            grassPatches,
            trees,
            rocks,
            shrubs,
            driftwoodPieces,
            campfires,
            shelters,
            waterFilters,
            signalFires
        };
    }

    // Functions to modify the world state (add/remove objects)
    function addWorldObject(type, object) {
        switch(type) {
            case 'trees': trees.push(object); break;
            case 'rocks': rocks.push(object); break;
            case 'shrubs': shrubs.push(object); break;
            case 'driftwoodPieces': driftwoodPieces.push(object); break;
            case 'campfires': campfires.push(object); break;
            case 'shelters': shelters.push(object); break;
            case 'waterFilters': waterFilters.push(object); break;
            case 'signalFires': signalFires.push(object); break;
            default: console.warn(`Unknown object type to add: ${type}`);
        }
    }

    function removeWorldObject(type, objectToRemove) {
        let list = null;
        switch(type) {
            case 'trees': list = trees; break;
            case 'rocks': list = rocks; break;
            case 'shrubs': list = shrubs; break;
            case 'driftwoodPieces': list = driftwoodPieces; break;
            case 'campfires': list = campfires; break;
            case 'shelters': list = shelters; break;
            case 'waterFilters': list = waterFilters; break;
            case 'signalFires': list = signalFires; break;
            default: console.warn(`Unknown object type to remove: ${type}`); return;
        }
        if (list) {
            const index = list.indexOf(objectToRemove);
            if (index > -1) {
                list.splice(index, 1);
            }
        }
    }

    // --- World Generation ---

    // Creates decorative grass patches.
    function generateGrassPatches() {
        grassPatches = []; // Clear old patches
        const widthTiles = WORLD_WIDTH_TILES;
        const heightTiles = WORLD_HEIGHT_TILES;
        const tileSize = TILE_SIZE;
        const terrainGrassConst = TERRAIN_GRASS;

        const numPatches = 500 * (widthTiles / 25);
        const patchSizeBase = tileSize / 3;
        for (let i = 0; i < numPatches; i++) {
            const tileX = Math.floor(Math.random() * widthTiles);
            const tileY = Math.floor(Math.random() * heightTiles);
            if (world[tileY]?.[tileX] === terrainGrassConst) {
                const px = tileX * tileSize + Math.random() * tileSize;
                const py = tileY * tileSize + Math.random() * tileSize;
                const patchW = patchSizeBase * (0.5 + Math.random());
                const patchH = patchSizeBase * (0.5 + Math.random());
                grassPatches.push({ x: px, y: py, w: patchW, h: patchH });
            }
        }
    }


// ========================================================================= //
    // SIMPLEX NOISE - Compact JavaScript Implementation
    // Source: https://github.com/jwagner/simplex-noise.js
    // (Included directly for single-file convenience)
    // ========================================================================= //
    /*
     * A fast javascript implementation of simplex noise by Jonas Wagner
     *
     * Based on a speed-improved simplex noise algorithm for 2D, 3D and 4D in Java.
     * Which is based on example code by Stefan Gustavson (stegu@itn.liu.se).
     * With Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
     * Better rank ordering method by Stefan Gustavson in 2012.
     *
     * This code was placed in the public domain by its original author,
     * Stefan Gustavson. You may use it as you see fit, but
     * attribution is appreciated.
     */
    const SimplexNoise = (function() {
        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
        const F3 = 1.0 / 3.0;
        const G3 = 1.0 / 6.0;
        const F4 = (Math.sqrt(5.0) - 1.0) / 4.0;
        const G4 = (5.0 - Math.sqrt(5.0)) / 20.0;

        const grad3 = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
        const grad4 = new Float32Array([0, 1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, -1, 0, -1, 1, 1, 0, -1, 1, -1, 0, -1, -1, 1, 0, -1, -1, -1, 1, 0, 1, 1, 1, 0, 1, -1, 1, 0, -1, 1, 1, 0, -1, -1, -1, 0, 1, 1, -1, 0, 1, -1, -1, 0, -1, 1, -1, 0, -1, -1, 1, 1, 0, 1, 1, 1, 0, -1, 1, -1, 0, 1, 1, -1, 0, -1, -1, 1, 0, 1, -1, 1, 0, -1, -1, -1, 0, 1, -1, -1, 0, -1, 1, 1, 1, 0, 1, -1, 1, 0, -1, 1, 1, 0, -1, -1, 1, 0]);

        function SimplexNoise(randomOrSeed) {
            let random;
            if (typeof randomOrSeed === 'function') {
                random = randomOrSeed;
            } else if (randomOrSeed) {
                let seed = randomOrSeed;
                random = function() {
                    const x = Math.sin(seed++) * 10000;
                    return x - Math.floor(x);
                };
            } else {
                random = Math.random;
            }
            this.p = new Uint8Array(256);
            this.perm = new Uint8Array(512);
            this.permMod12 = new Uint8Array(512);
            for (let i = 0; i < 256; i++) {
                this.p[i] = i;
            }
            for (let i = 0; i < 255; i++) {
                const r = i + ~~(random() * (256 - i));
                const aux = this.p[i];
                this.p[i] = this.p[r];
                this.p[r] = aux;
            }
            for (let i = 0; i < 512; i++) {
                this.perm[i] = this.p[i & 255];
                this.permMod12[i] = this.perm[i] % 12;
            }
        }

        SimplexNoise.prototype = {
            noise2D: function(xin, yin) {
                const permMod12 = this.permMod12;
                const perm = this.perm;
                let n0 = 0, n1 = 0, n2 = 0; // Noise contributions from the three corners
                // Skew the input space to determine which simplex cell we're in
                const s = (xin + yin) * F2; // Hairy factor for 2D
                const i = Math.floor(xin + s);
                const j = Math.floor(yin + s);
                const t = (i + j) * G2;
                const X0 = i - t; // Unskew the cell origin back to (x,y) space
                const Y0 = j - t;
                const x0 = xin - X0; // The x,y distances from the cell origin
                const y0 = yin - Y0;
                // For the 2D case, the simplex shape is an equilateral triangle.
                // Determine which simplex we are in.
                let i1, j1; // Offsets for second corner of simplex in (i,j) coords
                if (x0 > y0) { i1 = 1; j1 = 0; } // lower triangle, XY order: (0,0)->(1,0)->(1,1)
                else { i1 = 0; j1 = 1; } // upper triangle, YX order: (0,0)->(0,1)->(1,1)
                // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
                // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
                // c = (3-sqrt(3))/6
                const x1 = x0 - i1 + G2; // Offsets for second corner in (x,y) coords
                const y1 = y0 - j1 + G2;
                const x2 = x0 - 1.0 + 2.0 * G2; // Offsets for third corner in (x,y) coords
                const y2 = y0 - 1.0 + 2.0 * G2;
                // Work out the hashed gradient indices of the three simplex corners
                const ii = i & 255;
                const jj = j & 255;
                // Calculate the contribution from the three corners
                let t0 = 0.5 - x0 * x0 - y0 * y0;
                if (t0 >= 0) {
                    t0 *= t0;
                    const gi0 = permMod12[ii + perm[jj]] * 3;
                    n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0);
                }
                let t1 = 0.5 - x1 * x1 - y1 * y1;
                if (t1 >= 0) {
                    t1 *= t1;
                    const gi1 = permMod12[ii + i1 + perm[jj + j1]] * 3;
                    n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1);
                }
                let t2 = 0.5 - x2 * x2 - y2 * y2;
                if (t2 >= 0) {
                    t2 *= t2;
                    const gi2 = permMod12[ii + 1 + perm[jj + 1]] * 3;
                    n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2);
                }
                // Add contributions from each corner to get the final noise value.
                // The result is scaled to return values in the interval [-1,1].
                return 70.0 * (n0 + n1 + n2);
            }
            // Add noise3D and noise4D if needed, but we only need 2D here
        };

        return SimplexNoise;
    })();
    // ========================================================================= //
    // END SIMPLEX NOISE
    // ========================================================================= //

      
      
      
// Generates the main world map using Simplex noise (with octaves), radial falloff,
// explicit thresholds, sand border post-processing, and ocean/lake distinction via flood fill.
function generateWorld() {
    console.log("Starting world generation (noise, falloff, explicit thresholds, sand border, ocean/lake fill)...");
    // Clear existing objects
    trees = []; rocks = []; shrubs = []; driftwoodPieces = [];
    campfires = []; shelters = []; waterFilters = []; signalFires = [];
    grassPatches = [];

    const widthTiles = WORLD_WIDTH_TILES;
    const heightTiles = WORLD_HEIGHT_TILES;
    const worldWidth = WORLD_WIDTH;
    const worldHeight = WORLD_HEIGHT;
    const tileSize = TILE_SIZE;

    // --- Noise and Generation Parameters (TUNE THESE!) ---
    const baseNoiseScale = 0.045;
    const numOctaves = 4;
    const persistence = 0.5;
    const lacunarity = 2.0;
    const islandFalloffPower = 2.0;
    const islandSizeFactor = 0.45;
    const waterThreshold = -0.1;    // <<< RESTORED: Noise value below this becomes initial Water
    const sandThreshold = -0.1;      // Keep low for large grass interior initially
                                    // <<< NOTE: Value above sandThreshold becomes initial Grass
    // const useLakes = false; // Lake generation is now implicit via flood fill
    // const lakeNoiseScale = 0.01; // Not directly used in this restored structure
    // const lakeThreshold = 0.01; // Not directly used
    // const lakePlacementChance = 0.01; // Not directly used
    // --- End Parameters ---

    const noiseGen = new SimplexNoise(Math.random);
    const centerX = widthTiles / 2; const centerY = heightTiles / 2; const maxDist = Math.sqrt(centerX * centerX + centerY * centerY); const falloffRadius = maxDist * islandSizeFactor;

    // 1. Generate Initial Terrain (Noise + Falloff + Explicit Thresholds) into a temporary grid
    let tempWorld = Array(heightTiles).fill(0).map(() => Array(widthTiles).fill(TERRAIN_WATER)); // Start all as potential water
    for (let y = 0; y < heightTiles; y++) {
        for (let x = 0; x < widthTiles; x++) {
            let totalNoise = 0; let frequency = baseNoiseScale; let amplitude = 1.0; let maxAmplitude = 0;
            for (let i = 0; i < numOctaves; i++) { totalNoise += noiseGen.noise2D(x * frequency, y * frequency) * amplitude; maxAmplitude += amplitude; amplitude *= persistence; frequency *= lacunarity; }
            let normalizedNoise = totalNoise / maxAmplitude; normalizedNoise = Math.max(-1, Math.min(1, normalizedNoise));
            const dx = x - centerX; const dy = y - centerY; const distFromCenter = Math.sqrt(dx * dx + dy * dy);
            let normalizedDist = Math.max(0, Math.min(1, distFromCenter / falloffRadius)); let falloff = Math.pow(1.0 - normalizedDist, islandFalloffPower);
            let finalValue = normalizedNoise * falloff;
             if (distFromCenter / maxDist > 0.48) { finalValue -= 0.1; } // Make edges more likely water

            // <<< RESTORED THRESHOLD LOGIC >>>
            // Assign initial grass/sand/water based on explicit thresholds
            if (finalValue > sandThreshold) { // Above sand threshold is grass
                 tempWorld[y][x] = TERRAIN_GRASS;
            } else if (finalValue > waterThreshold) { // Between water and sand thresholds is sand
                 tempWorld[y][x] = TERRAIN_SAND;
            } else { // Below water threshold is water
                 tempWorld[y][x] = TERRAIN_WATER;
            }
            // <<< END RESTORED THRESHOLD LOGIC >>>
        }
    }
    console.log("Step 1: Initial noise/falloff/threshold generation complete.");

    // 2. Apply Sand Border Post-processing (Operates on final 'world' grid)
    // This step remains important to ensure playable beaches.
    console.log("Step 2: Applying sand border post-processing...");
    world = Array(heightTiles).fill(0).map(() => Array(widthTiles).fill(TERRAIN_WATER)); // Initialize final world grid
    const neighbors = [ { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 } ]; // N, S, W, E
    for (let y = 0; y < heightTiles; y++) {
        for (let x = 0; x < widthTiles; x++) {
             world[y][x] = tempWorld[y][x]; // Copy initial type from tempWorld

             if (tempWorld[y][x] === TERRAIN_GRASS) { // If it was initially grass...
                  let hasWaterNeighbor = false;
                  for (const neighbor of neighbors) {
                       const nx = x + neighbor.dx; const ny = y + neighbor.dy;
                       // Check neighbors in the *original* tempWorld state
                       if (nx >= 0 && nx < widthTiles && ny >= 0 && ny < heightTiles && tempWorld[ny][nx] === TERRAIN_WATER) {
                            hasWaterNeighbor = true; break;
                       }
                  }
                  if (hasWaterNeighbor) {
                       world[y][x] = TERRAIN_SAND; // Change to sand in the final grid if it bordered initial water
                  }
             }
        }
    }
     console.log("Step 2: Sand border applied.");


    // 3. Distinguish Ocean from Lakes using Flood Fill (Operates on final 'world' grid)
    // This step remains essential for the different water animations.
    console.log("Step 3: Distinguishing Ocean vs Lakes via Flood Fill...");
    let visited = Array(heightTiles).fill(0).map(() => Array(widthTiles).fill(false));
    let queue = [];

    // Initialize queue with all edge water tiles that ended up as water *after* sand border processing
    for (let y = 0; y < heightTiles; y++) {
        for (let x = 0; x < widthTiles; x++) {
            // Check the *final* world grid type at this stage
            if ((world[y][x] === TERRAIN_WATER || world[y][x] === TERRAIN_OCEAN_WATER) && // It should be some kind of water
                (x === 0 || x === widthTiles - 1 || y === 0 || y === heightTiles - 1)) // And it's on an edge
            {
                if (!visited[y][x]) {
                    world[y][x] = TERRAIN_OCEAN_WATER; // Mark as ocean
                    visited[y][x] = true;
                    queue.push({ x, y });
                }
            }
        }
    }

    // Flood fill from the edges
    let head = 0;
    while (head < queue.length) {
        const current = queue[head++];
        const cx = current.x;
        const cy = current.y;

        for (const neighbor of neighbors) {
            const nx = cx + neighbor.dx;
            const ny = cy + neighbor.dy;

            // Check bounds and if it's *any* kind of water tile that hasn't been visited
             if (nx >= 0 && nx < widthTiles && ny >= 0 && ny < heightTiles && !visited[ny][nx] &&
                 (world[ny][nx] === TERRAIN_WATER || world[ny][nx] === TERRAIN_OCEAN_WATER) )
             {
                visited[ny][nx] = true;
                world[ny][nx] = TERRAIN_OCEAN_WATER; // Mark as ocean
                queue.push({ x: nx, y: ny });
            }
        }
    }
    console.log(`Step 3: Flood Fill complete. ${queue.length} ocean tiles identified.`);
    // Any water tile *not* visited by the flood fill remains TERRAIN_WATER (lake).


    // 4. Generate Grass Patches (Uses FINAL 'world' grid)
    generateGrassPatches();
    console.log("Step 4: Generated grass patches on final terrain.");

    // 5. Find Player Spawn Point (Uses FINAL 'world' grid)
    let spawnTileX = Math.floor(centerX); let spawnTileY = Math.floor(centerY); let foundSpawn = false; const maxSpawnSearchRadius = Math.floor(Math.max(centerX, centerY));
    for (let r = 0; r < maxSpawnSearchRadius && !foundSpawn; r++) { for (let dy = -r; dy <= r && !foundSpawn; dy++) { for (let dx = -r; dx <= r && !foundSpawn; dx++) { if (r > 0 && Math.abs(dx) < r && Math.abs(dy) < r) continue; let checkY = Math.floor(centerY) + dy; let checkX = Math.floor(centerX) + dx; checkX = Math.max(0, Math.min(widthTiles - 1, checkX)); checkY = Math.max(0, Math.min(heightTiles - 1, checkY)); if (world[checkY]?.[checkX] === TERRAIN_GRASS || world[checkY]?.[checkX] === TERRAIN_SAND) { spawnTileX = checkX; spawnTileY = checkY; foundSpawn = true; }}}}
    if (!foundSpawn) {
          console.warn("Could not find spawn near center, searching whole map...");
          for (let y = 0; y < heightTiles && !foundSpawn; y++) { for (let x = 0; x < widthTiles && !foundSpawn; x++) { if (world[y][x] === TERRAIN_GRASS || world[y][x] === TERRAIN_SAND) { spawnTileX = x; spawnTileY = y; foundSpawn = true; }}}
          if (!foundSpawn) { spawnTileX = Math.floor(widthTiles/2); spawnTileY = Math.floor(heightTiles/2); if(!world[spawnTileY]) world[spawnTileY] = []; world[spawnTileY][spawnTileX] = TERRAIN_GRASS; console.error("World generation failed to create any land! Forced spawn tile."); }
    }
    const playerSpawnX = spawnTileX * tileSize + tileSize / 4; const playerSpawnY = spawnTileY * tileSize + tileSize / 4; console.log(`Step 5: Player spawn set to tile (${spawnTileX}, ${spawnTileY})`);

    // 6. Place Resources (Uses FINAL 'world' grid)
    // (Resource placement code remains unchanged - copy/paste the existing block here)
    console.log("Step 6: Placing resources on final terrain...");
    const numTrees = Math.floor(50 * (widthTiles * heightTiles) / (45*28)); const numRocks = Math.floor(15 * (widthTiles * heightTiles) / (45*28)); const numShrubs = Math.floor(30 * (widthTiles * heightTiles) / (45*28));
    const timePlaceholder = { dayLength: 120 }; const shrubRegrowTimeSeconds = SHRUB_REGROW_DAYS * timePlaceholder.dayLength; const treeRegrowTimeSeconds = TREE_REGROW_DAYS * timePlaceholder.dayLength;
    const isLandTile = (tx, ty) => world[ty]?.[tx] === TERRAIN_GRASS || world[ty]?.[tx] === TERRAIN_SAND; const isGrassTile = (tx, ty) => world[ty]?.[tx] === TERRAIN_GRASS;
    const canPlaceResource = (px, py, w, h, resourceType) => { const buffer = tileSize * 0.5; const placeRect = { x: px - buffer, y: py - buffer, width: w + 2 * buffer, height: h + 2 * buffer }; if (px < 0 || py < 0 || px + w > worldWidth || py + h > worldHeight) return false; const tileX = Math.floor((px + w / 2) / tileSize); const tileY = Math.floor((py + h / 2) / tileSize); if (!isLandTile(tileX, tileY)) return false; if ((resourceType === 'tree' || resourceType === 'shrub') && !isGrassTile(tileX, tileY)) { return false; } if (resourceType === 'rock' && !isLandTile(tileX, tileY)) { return false; } if (distSq(px + w/2, py + h/2, playerSpawnX + TILE_SIZE/2, playerSpawnY + TILE_SIZE/2) < (tileSize * 5)**2) { return false; } const allObstacles = [...trees, ...rocks, ...shrubs]; for (const obs of allObstacles) { const obsW = obs.width || tileSize; const obsH = obs.height || tileSize; if (checkCollision(placeRect.x, placeRect.y, placeRect.width, placeRect.height, obs.x, obs.y, obsW, obsH)) { return false; } } return true; };
    // --- Place Trees ---
    let attempts = 0; let treesPlaced = 0; const maxTreeAttempts = numTrees * 70; const treeW = TILE_SIZE * 1.8; const treeH = TILE_SIZE * 2.8;
    while (treesPlaced < numTrees && attempts < maxTreeAttempts) { const tileX = Math.floor(Math.random() * widthTiles); const tileY = Math.floor(Math.random() * heightTiles); if (isGrassTile(tileX, tileY)) { let x = tileX * tileSize + (tileSize - treeW) / 2 + (Math.random() - 0.5) * tileSize * 0.2; let y = tileY * tileSize + (tileSize - treeH); if (canPlaceResource(x, y, treeW, treeH, 'tree')) { trees.push({ x, y, width: treeW, height: treeH, totalResource: INITIAL_TREE_RESOURCE, initialResource: INITIAL_TREE_RESOURCE, isStump: false, regrowTimer: 0, regrowTime: treeRegrowTimeSeconds, type: 'tree', currentShadow: null, isShadingPlayer: false }); treesPlaced++; } } attempts++; } console.log(`Placed ${treesPlaced}/${numTrees} trees.`); if (treesPlaced < numTrees) console.warn(`Could not place all requested trees after ${maxTreeAttempts} attempts.`);
    // --- Place Rocks ---
    const rockTypes = [ { type: 'medium', baseW: TILE_SIZE * 0.9, baseH: TILE_SIZE * 0.9, minRes: 60, maxRes: 120, weight: 2 }, { type: 'large', baseW: TILE_SIZE * 1.2, baseH: TILE_SIZE * 1.2, minRes: 120, maxRes: 250, weight: 1 } ]; const weightedRockTypes = []; rockTypes.forEach(type => { for (let i = 0; i < type.weight; i++) { weightedRockTypes.push(type); } }); attempts = 0; let rocksPlaced = 0; const maxRockAttempts = numRocks * 100;
    while(rocksPlaced < numRocks && attempts < maxRockAttempts) { const chosenType = weightedRockTypes[Math.floor(Math.random() * weightedRockTypes.length)]; const rockW = chosenType.baseW * (0.9 + Math.random() * 0.2); const rockH = chosenType.baseH * (0.9 + Math.random() * 0.2); const rockResource = chosenType.minRes + Math.floor(Math.random() * (chosenType.maxRes - chosenType.minRes + 1)); const tileX = Math.floor(Math.random() * widthTiles); const tileY = Math.floor(Math.random() * heightTiles); if (isLandTile(tileX, tileY)) { let x = tileX * tileSize + (tileSize - rockW) / 2 + (Math.random() - 0.5) * tileSize * 0.2; let y = tileY * tileSize + (tileSize - rockH) / 2 + (Math.random() - 0.5) * tileSize * 0.2; if (canPlaceResource(x, y, rockW, rockH, 'rock')) { rocks.push({ x: x, y: y, width: rockW, height: rockH, type: chosenType.type, totalResource: rockResource, initialResource: rockResource }); rocksPlaced++; } } attempts++; } console.log(`Placed ${rocksPlaced}/${numRocks} rocks.`); if(rocksPlaced < numRocks) console.warn(`Could not place all rocks after ${maxRockAttempts} attempts.`);
     // --- Place Shrubs ---
     attempts = 0; let shrubsPlaced = 0; const maxShrubAttempts = numShrubs * 80; const shrubW = TILE_SIZE * (0.8 + Math.random() * 0.4); const shrubH = TILE_SIZE * (0.7 + Math.random() * 0.3);
     while (shrubsPlaced < numShrubs && attempts < maxShrubAttempts) { const tileX = Math.floor(Math.random() * widthTiles); const tileY = Math.floor(Math.random() * heightTiles); if (isGrassTile(tileX, tileY)) { let x = tileX * tileSize + (tileSize - shrubW) / 2 + (Math.random() - 0.5) * tileSize * 0.3; let y = tileY * tileSize + (tileSize - shrubH) / 2 + (Math.random() - 0.5) * tileSize * 0.3; if (canPlaceResource(x, y, shrubW, shrubH, 'shrub')) { shrubs.push({ x, y, width: shrubW, height: shrubH, health: SHRUB_HEALTH, maxHealth: SHRUB_HEALTH, regrowTimer: 0, regrowTime: shrubRegrowTimeSeconds, isStump: false, stumpTimer: 0, type: 'shrub' }); shrubsPlaced++; } } attempts++; } console.log(`Placed ${shrubsPlaced}/${numShrubs} shrubs.`); if(shrubsPlaced < numShrubs) console.warn(`Could not place all shrubs after ${maxShrubAttempts} attempts.`);


    console.log("World generation complete.");
    return { x: playerSpawnX, y: playerSpawnY };
} // End generateWorld function





    // --- World Drawing ---

    // Updated to draw waves on TERRAIN_OCEAN_WATER
    function drawBackgroundAndTerrain(ctx, currentTime) { // Added currentTime for animation
        const widthTiles = WORLD_WIDTH_TILES; const heightTiles = WORLD_HEIGHT_TILES;
        const tileSize = TILE_SIZE;
        const terrainGrassConst = TERRAIN_GRASS;
        const terrainSandConst = TERRAIN_SAND;
        const terrainWaterConst = TERRAIN_WATER;         // Lakes
        const terrainOceanWaterConst = TERRAIN_OCEAN_WATER; // Ocean

        // Colors
        const grassColor = '#89b048'; const sandColor = '#c6b568';
        const baseWaterColor = '#10afb3'; // Base color for both lake and ocean
        const darkGrassColor = '#6A8C3A'; const sandDetailColor = '#B0A25A';

        for (let y = 0; y < heightTiles; y++) {
            for (let x = 0; x < widthTiles; x++) {
                let tileColor = baseWaterColor; // Default to base water
                const tileType = world[y]?.[x];

                switch (tileType) {
                    case terrainGrassConst: tileColor = grassColor; break;
                    case terrainSandConst: tileColor = sandColor; break;
                    case terrainWaterConst: tileColor = baseWaterColor; break; // Lake water is just base color
                    case terrainOceanWaterConst: tileColor = baseWaterColor; break; // Ocean starts with base color
                    default: tileColor = baseWaterColor; // Fallback
                }

                // Draw base tile color
                ctx.fillStyle = tileColor;
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

                // Add details based on type
                if (tileType === terrainSandConst) {
                    ctx.fillStyle = sandDetailColor;
                    for (let i = 0; i < 3; i++) { const dx=x*tileSize+Math.random()*tileSize; const dy=y*tileSize+Math.random()*tileSize; ctx.fillRect(dx, dy, 2, 2); }
                }
                else if (tileType === terrainOceanWaterConst) {
      
      
      
      
      
// --- Draw Static Waves (Evolving Pattern, Static Twirl) ---
const tileLeft = x * tileSize;
const tileTop = y * tileSize;
const tileCenterX = tileLeft + tileSize / 2;
const tileCenterY = tileTop + tileSize / 2;

// --- Calculate effect probability using noise based on coordinates AND time ---
const noiseX = x * EFFECT_NOISE_SCALE_XY;
const noiseY = y * EFFECT_NOISE_SCALE_XY;
const noiseT = currentTime * EFFECT_NOISE_SCALE_T; // << USE TIME for pattern evolution

// Get noise value (PerlinNoise outputs roughly -1 to 1)
const effectNoiseValue = PerlinNoise.noise(noiseX, noiseY, noiseT); // << USE noiseT

// Normalize noise to 0-1 range
const normalizedEffectNoise = (effectNoiseValue + 1) / 2;

// Check if the effect should be active on this tile AT THIS TIME
if (normalizedEffectNoise > EFFECT_ACTIVATION_THRESHOLD) {

    // --- Optional: World Center Falloff ---
    const worldCenterX = WORLD_WIDTH / 2;
    const distFromWorldCenter = Math.abs(tileCenterX - worldCenterX);
    const worldCenterFalloff = Math.max(0, 1 - Math.pow(distFromWorldCenter / (WORLD_WIDTH * 0.6), 2.0));

    // --- Calculate Intensity (Optional but nice for fading) ---
    // Intensity based on how far noise is above threshold
    const effectIntensity = (normalizedEffectNoise - EFFECT_ACTIVATION_THRESHOLD) / (1 - EFFECT_ACTIVATION_THRESHOLD);
    const finalIntensity = effectIntensity * worldCenterFalloff; // Combine with falloff

    // Skip if combined intensity is too low
    if (finalIntensity < 0.05) {
        continue; // Skip drawing for this tile
    }

    // --- Define Static Twirl Parameters ---
    // Parameters depend on intensity/falloff but NOT directly on time for shape animation
    const baseLineY = tileCenterY;
    const staticTwirlAmplitude = 1.0 + 1.5 * finalIntensity; // Amplitude based on intensity
    const staticTwirlFrequency = 0.6; // Fixed frequency for the shape itself
    // const twirlSpeed = 2.0; // NO Shape animation speed

    // --- Draw the Static Twirling Line ---
    ctx.beginPath();
    ctx.lineWidth = 2.5; // Fixed thickness, removed intensity scaling
    ctx.globalAlpha = 0.2 + 0.6 * finalIntensity; // Opacity varies with intensity
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'; // Fixed base color (could also lerp based on intensity)

    const segments = 10;
    for (let i = 0; i <= segments; i++) {
        const currentX = tileLeft + (i / segments) * tileSize;
        const relativeX = (currentX - tileCenterX) / (tileSize / 2);
        const twirlAmplitudeFalloff = Math.max(0, 1 - relativeX * relativeX);

        // Phase calculations WITHOUT time - shape is static
        const staticPhaseOffset = y * tileSize * 0.1; // Base on row
        const xPhase = relativeX * Math.PI * staticTwirlFrequency;

        // Calculate the static vertical offset
        const twirlOffset = Math.sin(staticPhaseOffset + xPhase) // NO timePhase
                          * staticTwirlAmplitude
                          * twirlAmplitudeFalloff;

        const currentY = baseLineY + twirlOffset;

        if (i === 0) {
            ctx.moveTo(currentX, currentY);
        } else {
            ctx.lineTo(currentX, currentY);
        }
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0; // Reset global alpha

} // End if (effect active based on noise)

// --- End Static Wave Drawing (Evolving Pattern) ---






                }
            }
        }
        // Draw grass patches on top
        ctx.fillStyle = darkGrassColor; for (const patch of grassPatches) { ctx.fillRect(patch.x, patch.y, patch.w, patch.h); }
    }


    // --- FROM objects/campfire.js ---
    function drawCampfire(ctx, obj) { /* ... (drawing code unchanged) ... */ const stoneColor = '#696969'; const woodColor = '#A0522D'; const fireColor1 = '#FFA500'; const fireColor2 = '#FF8C00'; const fireColor3 = '#FF6347'; const baseRadius = obj.width * 0.4; const centerX = obj.x + obj.width / 2; const centerY = obj.y + obj.height * 0.7; ctx.fillStyle = stoneColor; ctx.beginPath(); ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = woodColor; ctx.fillRect(centerX - baseRadius * 0.6, centerY - baseRadius * 0.2, baseRadius * 1.2, baseRadius * 0.4); ctx.fillRect(centerX - baseRadius * 0.2, centerY - baseRadius * 0.6, baseRadius * 0.4, baseRadius * 1.2); const fireHeightBase = obj.height * 0.7; const fireWidthBase = obj.width * 0.6; const fireBottomY = obj.y + obj.height * 0.3; for (let i = 0; i < 3; i++) { const flickerX = (Math.random() - 0.5) * fireWidthBase * 0.3; const flickerY = Math.random() * fireHeightBase * 0.2; const flickerW = fireWidthBase * (0.6 + Math.random() * 0.4); const flickerH = fireHeightBase * (0.7 + Math.random() * 0.3); let fireColor = fireColor1; const randColor = Math.random(); if (randColor > 0.66) fireColor = fireColor3; else if (randColor > 0.33) fireColor = fireColor2; ctx.fillStyle = fireColor; ctx.beginPath(); ctx.ellipse(centerX + flickerX, fireBottomY + flickerH / 2 - flickerY, flickerW / 2, flickerH / 2, 0, 0, Math.PI * 2); ctx.fill(); } }

    // --- FROM objects/rock.js ---
    function drawRock(ctx, obj) { /* ... (drawing code unchanged) ... */ const totalResource = obj.totalResource ?? 0; const isDepleted = totalResource <= 0; const baseColor = isDepleted ? '#585858' : '#7C7C7C'; const shadowColor = '#454545'; const highlightColor = isDepleted ? '#6A6A6A' : '#A0A0A0'; const darkCrackColor = isDepleted ? '#404040' : '#606060'; const x = obj.x; const y = obj.y; const w = obj.width; const h = obj.height; const cx = x + w / 2; const cy = y + h / 2; const seed = obj.x * 0.11 + obj.y * 0.33 + obj.initialResource * 0.05; const shapeSeed = obj.x * 0.5 + obj.y * 0.2; const detailSeed = obj.x * 0.8 + obj.y * 0.5; const rW = 1 + Math.sin(seed) * 0.15; const rH = 1 + Math.cos(seed * 1.2) * 0.15; const mainAngleOffset = Math.sin(seed * 0.5) * 0.2; ctx.fillStyle = shadowColor; ctx.beginPath(); const shadowW = w * 0.5 * rW; const shadowH = h * 0.2 * rH; const shadowX = cx + Math.cos(seed) * (w * 0.05); const shadowY = y + h * 0.92 + Math.sin(seed*1.5) * (h*0.03); ctx.ellipse(shadowX, shadowY, shadowW, shadowH, mainAngleOffset, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = baseColor; ctx.beginPath(); const points = 6 + Math.floor(Math.sin(shapeSeed) * 2 + 1); let vertices = []; for (let i = 0; i < points; i++) { const angle = (i / points) * Math.PI * 2 + mainAngleOffset; const baseRadiusX = (w / 2) * rW * (0.8 + Math.sin(shapeSeed + angle * 3) * 0.2); const baseRadiusY = (h / 2) * rH * (0.8 + Math.cos(shapeSeed + angle * 5) * 0.2); let vx = cx + baseRadiusX * Math.cos(angle); let vy = cy + baseRadiusY * Math.sin(angle); vertices.push({ x: vx, y: vy }); } ctx.moveTo(vertices[0].x, vertices[0].y); for (let i = 0; i < points; i++) { const p1 = vertices[i]; const p2 = vertices[(i + 1) % points]; const pPrev = vertices[(i + points - 1) % points]; const tangentFactor = 0.3 + Math.sin(shapeSeed * 2 + i) * 0.1; const cp1x = p1.x + (p2.x - pPrev.x) * tangentFactor * (0.9 + Math.cos(detailSeed + i * 3)*0.1); const cp1y = p1.y + (p2.y - pPrev.y) * tangentFactor * (0.9 + Math.sin(detailSeed + i * 3)*0.1); const cp2x = p2.x - (vertices[(i + 2) % points].x - p1.x) * tangentFactor * (0.9 + Math.sin(detailSeed + i * 4)*0.1); const cp2y = p2.y - (vertices[(i + 2) % points].y - p1.y) * tangentFactor * (0.9 + Math.cos(detailSeed + i * 4)*0.1); ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y); } ctx.closePath(); ctx.fill(); if (!isDepleted) { ctx.strokeStyle = darkCrackColor; ctx.lineWidth = 1 + Math.sin(detailSeed*2) * 0.5; ctx.beginPath(); const startPointIndex = Math.floor(points * 0.75) % points; const endPointIndex = Math.floor(points * 0.25) % points; const startPt = vertices[startPointIndex]; const endPt = vertices[endPointIndex]; const crackCtrlX = cx + Math.cos(detailSeed * 3) * (w * 0.2); const crackCtrlY = cy + Math.sin(detailSeed * 3) * (h * 0.2); ctx.moveTo(startPt.x, startPt.y); ctx.quadraticCurveTo(crackCtrlX, crackCtrlY, endPt.x, endPt.y); ctx.stroke(); } if (!isDepleted) { ctx.fillStyle = highlightColor; ctx.globalAlpha = 0.8; ctx.beginPath(); const highlightX = cx - w * 0.15 * rW + Math.cos(seed * 2) * (w * 0.05); const highlightY = cy - h * 0.20 * rH + Math.sin(seed * 2.5) * (h * 0.05); const highlightW = w * 0.2 * rW * (0.8 + Math.sin(detailSeed * 4)*0.2); const highlightH = h * 0.15 * rH * (0.8 + Math.cos(detailSeed * 5)*0.2); ctx.ellipse(highlightX, highlightY, highlightW, highlightH, mainAngleOffset + Math.PI / 5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; } }

    // --- FROM objects/shelter.js ---
    function drawShelter(ctx, obj) { /* ... (drawing code unchanged) ... */ const wallColor = '#A0522D'; const roofColor = '#8B7355'; const frameColor = '#5C4033'; const floorColor = '#D2B48C'; ctx.fillStyle = floorColor; ctx.fillRect(obj.x, obj.y + obj.height * 0.85, obj.width, obj.height * 0.15); ctx.fillStyle = wallColor; ctx.fillRect(obj.x + obj.width * 0.1, obj.y + obj.height * 0.2, obj.width * 0.8, obj.height * 0.65); ctx.fillStyle = roofColor; ctx.beginPath(); ctx.moveTo(obj.x, obj.y + obj.height * 0.3); ctx.lineTo(obj.x + obj.width / 2, obj.y); ctx.lineTo(obj.x + obj.width, obj.y + obj.height * 0.3); ctx.lineTo(obj.x + obj.width * 0.9, obj.y + obj.height * 0.85); ctx.lineTo(obj.x + obj.width * 0.1, obj.y + obj.height * 0.85); ctx.closePath(); ctx.fill(); ctx.strokeStyle = frameColor; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(obj.x, obj.y + obj.height * 0.3); ctx.lineTo(obj.x + obj.width / 2, obj.y); ctx.lineTo(obj.x + obj.width, obj.y + obj.height * 0.3); ctx.stroke(); ctx.strokeRect(obj.x + obj.width * 0.3, obj.y + obj.height * 0.4, obj.width * 0.4, obj.height * 0.45); }

    // --- FROM objects/signalFire.js ---
    function drawSignalFire(ctx, obj) { /* ... (drawing code unchanged) ... */ const stoneColor = '#696969'; const woodColor = '#A0522D'; const fireColor1 = '#FFA500'; const fireColor2 = '#FF8C00'; const fireColor3 = '#FF6347'; const smokeColor = 'rgba(100, 100, 100, 0.5)'; const ashColor = '#444'; ctx.fillStyle = stoneColor; const baseHeight = obj.height * 0.4; ctx.fillRect(obj.x, obj.y + obj.height - baseHeight, obj.width, baseHeight); ctx.fillStyle = '#505050'; ctx.fillRect(obj.x + obj.width * 0.1, obj.y + obj.height - baseHeight * 0.8, obj.width*0.8, baseHeight * 0.2); ctx.fillRect(obj.x + obj.width * 0.3, obj.y + obj.height - baseHeight * 0.4, obj.width*0.4, baseHeight * 0.2); ctx.fillStyle = woodColor; const woodPileY = obj.y + obj.height * 0.3; const woodPileH = obj.height * 0.3; ctx.fillRect(obj.x + obj.width * 0.1, woodPileY, obj.width * 0.8, woodPileH); ctx.fillRect(obj.x + obj.width * 0.3, woodPileY - woodPileH*0.4, obj.width * 0.4, woodPileH*1.2); if (obj.isBurning) { const fireHeightBase = obj.height * 0.6; const fireWidthBase = obj.width * 0.7; const fireBottomY = obj.y + obj.height * 0.1; const centerX = obj.x + obj.width / 2; for (let i = 0; i < 4; i++) { const fx=(Math.random()-0.5)*fireWidthBase*0.4; const fy=Math.random()*fireHeightBase*0.3; const fw=fireWidthBase*(0.5+Math.random()*0.5); const fh=fireHeightBase*(0.8+Math.random()*0.4); let fc=fireColor1; const rc=Math.random(); if (rc>0.66) fc=fireColor3; else if (rc>0.33) fc=fireColor2; ctx.fillStyle=fc; ctx.beginPath(); ctx.ellipse(centerX+fx, fireBottomY+fh/2-fy, fw/2, fh/2, Math.PI*(1.4+Math.random()*0.2), 0, Math.PI*2); ctx.fill(); } ctx.fillStyle = smokeColor; for (let i = 0; i < 5; i++) { const sx=centerX+(Math.random()-0.5)*obj.width*0.5; const sy=obj.y-i*10-Math.random()*15; const sr=obj.width*0.1+Math.random()*obj.width*0.15; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2); ctx.fill(); } } else { ctx.fillStyle = ashColor; ctx.fillRect(obj.x + obj.width * 0.2, woodPileY + woodPileH * 0.5, obj.width * 0.6, woodPileH * 0.3); } }
    function updateSignalFire(fire, deltaTime) { /* ... (update code unchanged) ... */ let wasBurning = false; if (fire.isBurning) { wasBurning = true; fire.fuel -= deltaTime * fire.burnRate; if (fire.fuel <= 0) { fire.isBurning = false; fire.fuel = 0; } } return wasBurning && fire.isBurning; }
    function checkRescueChance(anySignalFireActive, deltaTime) { /* ... (check code unchanged) ... */ const currentStats = getStatsState(); const currentTime = getTimeState(); const isGameOverState = getIsGameOver(); if (currentStats.day >= RESCUE_START_DAY && anySignalFireActive && !isGameOverState) { const chanceThisFrame = BASE_RESCUE_CHANCE * deltaTime / currentTime.dayLength; if (Math.random() < chanceThisFrame) { triggerRescue(); } } }

    // --- FROM objects/tree.js ---
    // Split drawing into trunk/shadow and canopy
    // Draws only the trunk and the calculated dynamic shadow of a tree.
    function drawTreeTrunkAndShadow(ctx, tree, timeState) { // Pass timeState if shadow isn't pre-calculated on obj
        const x = tree.x; const y = tree.y; const w = tree.width; const h = tree.height;

        // --- Draw Dynamic Shadow ---
        // Use pre-calculated shadow if available, otherwise calculate again
        const shadow = tree.currentShadow || calculateTreeShadow(tree, timeState); // Use pre-calculated shadow

        if (shadow && shadow.exists) {
            const shadowColor = 'rgba(0, 0, 0, 0.25)';
            ctx.fillStyle = shadowColor;
            ctx.beginPath();
            ctx.ellipse(shadow.x, shadow.y, shadow.radiusX, shadow.radiusY, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        // --- End Shadow Drawing ---

        // --- Draw Trunk ---
        if (tree.isStump) {
            // Draw stump (same logic as before)
            const trunkWidth = tree.width * 0.3; const trunkX = tree.x + (tree.width - trunkWidth) / 2;
            const stumpHeight = tree.height * 0.3; const stumpY = y + tree.height - stumpHeight;
            const stumpColor = '#A0522D'; const cutSurfaceColor = '#C1A875'; const darkStumpColor = '#6B4226';
            ctx.fillStyle = darkStumpColor; ctx.fillRect(trunkX + trunkWidth * 0.6, stumpY, trunkWidth * 0.4, stumpHeight);
            ctx.fillStyle = stumpColor; ctx.fillRect(trunkX, stumpY, trunkWidth * 0.6, stumpHeight);
            ctx.fillStyle = cutSurfaceColor; ctx.beginPath(); ctx.ellipse(trunkX + trunkWidth / 2, stumpY, trunkWidth / 2 * 1.1, trunkWidth * 0.25, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = darkStumpColor; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(trunkX + trunkWidth / 2, stumpY, trunkWidth / 2 * 0.7, trunkWidth * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(trunkX + trunkWidth / 2, stumpY, trunkWidth / 2 * 0.4, trunkWidth * 0.10, 0, 0, Math.PI * 2); ctx.stroke();
        } else {
            // Draw living tree trunk (same logic as before)
            const trunkLight = '#A07040'; const trunkMid = '#8B5A2B'; const trunkDark = '#5C4033';
            const trunkBaseWidth = w * 0.35; const trunkTopWidth = w * 0.25; const trunkHeight = h * 0.55;
            const trunkBaseY = y + h; const trunkTopY = y + h - trunkHeight; const trunkCenterX = x + w / 2;
            const seed = tree.x * 19 + tree.y * 43;
            const random = (s) => { let val = Math.sin(s) * 10000; return val - Math.floor(val); };
            ctx.fillStyle = trunkDark; ctx.beginPath(); ctx.moveTo(trunkCenterX + trunkTopWidth * 0.2, trunkTopY); ctx.lineTo(trunkCenterX + trunkBaseWidth * 0.2, trunkBaseY); ctx.lineTo(trunkCenterX + trunkBaseWidth * 0.5, trunkBaseY); ctx.lineTo(trunkCenterX + trunkTopWidth * 0.5, trunkTopY); ctx.closePath(); ctx.fill();
            ctx.fillStyle = trunkMid; ctx.beginPath(); ctx.moveTo(trunkCenterX - trunkTopWidth * 0.5, trunkTopY); ctx.lineTo(trunkCenterX - trunkBaseWidth * 0.5, trunkBaseY); ctx.lineTo(trunkCenterX + trunkBaseWidth * 0.2, trunkBaseY); ctx.lineTo(trunkCenterX + trunkTopWidth * 0.2, trunkTopY); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = trunkLight; ctx.lineWidth = 1; ctx.beginPath();
            const numLines = 2 + Math.floor(random(seed * 2) + 1);
            for (let i = 0; i < numLines; i++) { const lineX = trunkCenterX - trunkBaseWidth * (0.1 + i * 0.15 + random(seed + i) * 0.05); const lineTopY = trunkTopY + trunkHeight * (0.1 + random(seed * 1.5 + i) * 0.05); const lineBottomY = trunkBaseY - trunkHeight * (0.05 + random(seed * 3 + i) * 0.05); ctx.moveTo(lineX, lineTopY); ctx.lineTo(lineX + (random(seed*4+i)*4-2), lineBottomY); } ctx.stroke();
        }
    }
    // Draws only the canopy (leaves) of a living tree.
    function drawTreeCanopy(ctx, tree) {
        if (tree.isStump) return; // No canopy for stumps

        const x = tree.x; const y = tree.y; const w = tree.width; const h = tree.height;
        const leavesDark = '#386641'; const leavesMid = '#6A994E'; const leavesLight = '#A7C957';
        const trunkHeight = h * 0.55; const trunkTopY = y + h - trunkHeight; const trunkCenterX = x + w / 2;
        const seed = tree.x * 19 + tree.y * 43;
        const random = (s) => { let val = Math.sin(s) * 10000; return val - Math.floor(val); };

        // Canopy drawing logic (same as before, just isolated)
        const canopyCenterY = trunkTopY + h * 0.05; const canopyRadiusX = w * 0.65; const canopyRadiusY = h * 0.45;
        const numBlobs = 7 + Math.floor(random(seed * 5) * 4); const baseBlobRadius = w * 0.2;
        ctx.fillStyle = leavesDark; for (let i = 0; i < numBlobs; i++) { const angle = (i / numBlobs) * Math.PI * 2 + random(seed*3 + i*0.5) * 0.3; const distFactor = 0.6 + random(seed*4 + i*0.8) * 0.35; const blobX = trunkCenterX + Math.cos(angle) * canopyRadiusX * distFactor * (0.9 + random(seed + i)*0.1); const blobY = canopyCenterY + Math.sin(angle) * canopyRadiusY * distFactor * (0.9 + random(seed*1.2 + i)*0.1) + canopyRadiusY * 0.1; const blobRadius = baseBlobRadius * (0.8 + random(seed*2 + i*1.1) * 0.3); if (blobRadius > 2) { ctx.beginPath(); ctx.arc(blobX, blobY, blobRadius, 0, Math.PI * 2); ctx.fill(); } }
        ctx.fillStyle = leavesMid; for (let i = 0; i < numBlobs; i++) { const angle = (i / numBlobs + 0.05) * Math.PI * 2 + random(seed*3.5 + i*0.6) * 0.25; const distFactor = 0.5 + random(seed*4.5 + i*0.7) * 0.4; const blobX = trunkCenterX + Math.cos(angle) * canopyRadiusX * distFactor * (0.95 + random(seed*1.1 + i)*0.05); const blobY = canopyCenterY + Math.sin(angle) * canopyRadiusY * distFactor * (0.95 + random(seed*1.3 + i)*0.05); const blobRadius = baseBlobRadius * (0.85 + random(seed*2.5 + i*1.2) * 0.25); if (blobRadius > 2) { ctx.beginPath(); ctx.arc(blobX, blobY, blobRadius, 0, Math.PI * 2); ctx.fill(); } }
        ctx.fillStyle = leavesLight; const numHighlights = Math.floor(numBlobs * 0.6); for (let i = 0; i < numHighlights; i++) { const baseAngle = -Math.PI * (0.35 + random(seed*6 + i*0.9) * 0.1); const angle = baseAngle + (random(seed*5 + i*0.4) * 0.3); const distFactor = 0.3 + random(seed*5.5 + i*1.1) * 0.25; const blobX = trunkCenterX + Math.cos(angle) * canopyRadiusX * distFactor; const blobY = canopyCenterY + Math.sin(angle) * canopyRadiusY * distFactor * 0.8; const blobRadius = baseBlobRadius * (0.5 + random(seed*3 + i*1.5) * 0.2); if (blobRadius > 1) { ctx.beginPath(); ctx.arc(blobX, blobY, blobRadius, 0, Math.PI * 2); ctx.fill(); } }
    }
    function updateTree(tree, deltaTime) { /* ... (update code unchanged) ... */ if (tree.isStump) { tree.regrowTimer += deltaTime; if (tree.regrowTimer >= tree.regrowTime) { tree.isStump = false; tree.totalResource = tree.initialResource; tree.regrowTimer = 0; console.log("A tree regrew!"); } } }

    // --- FROM objects/waterPurifier.js ---
    function drawWaterPurifier(ctx, obj) { /* ... (drawing code unchanged) ... */ const x = obj.x; const y = obj.y; const w = obj.width; const h = obj.height; const stoneColor = '#888c8d'; const stoneShadow = '#65696a'; const woodColor = '#8B4513'; const woodShadow = '#5C4033'; const waterColor = '#10afb3'; const charcoalColor = '#333'; const sandColor = '#D2B48C'; ctx.fillStyle = stoneShadow; ctx.fillRect(x + w * 0.1, y + h * 0.75, w * 0.3, h * 0.25); ctx.fillRect(x + w * 0.6, y + h * 0.8, w * 0.35, h * 0.2); ctx.fillStyle = stoneColor; ctx.fillRect(x + w * 0.15, y + h * 0.7, w * 0.28, h * 0.25); ctx.fillRect(x + w * 0.55, y + h * 0.75, w * 0.33, h * 0.2); ctx.fillRect(x + w * 0.35, y + h * 0.65, w * 0.3, h * 0.28); const containerY = y + h * 0.1; const containerH = h * 0.55; ctx.fillStyle = woodShadow; ctx.fillRect(x, containerY + containerH * 0.1, w, containerH * 0.9); ctx.fillStyle = woodColor; ctx.fillRect(x + w * 0.05, containerY, w * 0.9, containerH); ctx.fillStyle = woodShadow; ctx.fillRect(x + w * 0.15, containerY + h * 0.05, w * 0.7, h * 0.1); const layerYStart = containerY + h * 0.15; const layerHeight = h * 0.12; ctx.fillStyle = charcoalColor; ctx.fillRect(x + w * 0.15, layerYStart, w * 0.7, layerHeight); ctx.fillStyle = sandColor; ctx.fillRect(x + w * 0.15, layerYStart + layerHeight, w * 0.7, layerHeight * 0.8); ctx.fillStyle = waterColor; ctx.globalAlpha = 0.7; ctx.fillRect(x + w * 0.15, containerY + h * 0.05, w * 0.7, h * 0.1); ctx.globalAlpha = 1.0; ctx.fillStyle = woodShadow; ctx.beginPath(); ctx.moveTo(x + w * 0.4, y + h * 0.8); ctx.lineTo(x + w * 0.45, y + h * 0.95); ctx.lineTo(x + w * 0.55, y + h * 0.95); ctx.lineTo(x + w * 0.6, y + h * 0.8); ctx.closePath(); ctx.fill(); }

    // --- NEW: objects/shrub.js ---
    function drawShrub(ctx, obj) { /* ... (drawing code unchanged) ... */ const x = obj.x; const y = obj.y; const w = obj.width; const h = obj.height; if (obj.isStump) { if (obj.stumpTimer > 0) { const stumpColor = '#A0522D'; const cutSurfaceColor = '#C1A875'; const darkStumpColor = '#6B4226'; const stumpVisualHeight = h * 0.3; const stumpVisualWidth = w * 0.6; const stumpX = x + (w - stumpVisualWidth) / 2; const stumpY = y + h - stumpVisualHeight; ctx.fillStyle = stumpColor; ctx.fillRect(stumpX, stumpY, stumpVisualWidth, stumpVisualHeight); ctx.fillStyle = cutSurfaceColor; ctx.fillRect(stumpX, stumpY, stumpVisualWidth, stumpVisualHeight * 0.4); ctx.fillStyle = darkStumpColor; ctx.fillRect(stumpX, stumpY, stumpVisualWidth, 1); } return; } const leavesDark = '#386641'; const leavesMid = '#6A994E'; const leavesLight = '#A7C957'; const seed = obj.x * 19 + obj.y * 43; const random = (s) => { let x = Math.sin(s) * 10000; return x - Math.floor(x); }; const numBlobs = 5 + Math.floor(random(seed) * 4); const baseBlobRadiusX = w * 0.3; const baseBlobRadiusY = h * 0.35; const centerX = x + w / 2; const centerY = y + h / 2; ctx.fillStyle = leavesDark; for (let i = 0; i < numBlobs; i++) { const angle = (i / numBlobs) * Math.PI * 2 + random(seed + i) * 0.5; const distFactor = 0.6 + random(seed + i * 2) * 0.4; const blobX = centerX + Math.cos(angle) * baseBlobRadiusX * 1.1 * distFactor; const blobY = centerY + Math.sin(angle) * baseBlobRadiusY * 1.1 * distFactor + h*0.1; const blobRadius = (baseBlobRadiusX + baseBlobRadiusY)/2 * (0.7 + random(seed + i * 3) * 0.3); if (blobRadius > 2) { ctx.beginPath(); ctx.ellipse(blobX, blobY, blobRadius * 1.1, blobRadius * 0.9, random(seed+i*5)*Math.PI, 0, Math.PI * 2); ctx.fill(); } } ctx.fillStyle = leavesMid; for (let i = 0; i < numBlobs; i++) { const angle = (i / numBlobs + 0.1) * Math.PI * 2 + random(seed + i * 1.5) * 0.4; const distFactor = 0.5 + random(seed + i * 2.5) * 0.5; const blobX = centerX + Math.cos(angle) * baseBlobRadiusX * distFactor; const blobY = centerY + Math.sin(angle) * baseBlobRadiusY * distFactor; const blobRadius = (baseBlobRadiusX + baseBlobRadiusY)/2 * (0.8 + random(seed + i * 3.5) * 0.3); if (blobRadius > 2) { ctx.beginPath(); ctx.ellipse(blobX, blobY, blobRadius, blobRadius, 0, 0, Math.PI * 2); ctx.fill(); } } ctx.fillStyle = leavesLight; const numHighlights = Math.floor(numBlobs * 0.6); for (let i = 0; i < numHighlights; i++) { const angle = (i / numHighlights) * Math.PI * 2 + random(seed + i * 4) * 0.6; const distFactor = 0.3 + random(seed + i * 5) * 0.3; const blobX = centerX + Math.cos(angle) * baseBlobRadiusX * distFactor * 0.8; const blobY = centerY + Math.sin(angle) * baseBlobRadiusY * distFactor * 0.8 - h*0.05; const blobRadius = (baseBlobRadiusX + baseBlobRadiusY)/2 * (0.4 + random(seed + i * 6) * 0.2); if (blobRadius > 1) { ctx.beginPath(); ctx.ellipse(blobX, blobY, blobRadius, blobRadius * 0.7, random(seed+i*7)*Math.PI, 0, Math.PI*2); ctx.fill(); } } }
    function updateShrub(shrub, deltaTime, dayLength) { /* ... (update code unchanged) ... */ if (shrub.isStump) { if (shrub.stumpTimer > 0) { shrub.stumpTimer -= deltaTime / dayLength; if (shrub.stumpTimer < 0) shrub.stumpTimer = 0; } shrub.regrowTimer += deltaTime; if (shrub.regrowTimer >= shrub.regrowTime) { shrub.health = shrub.maxHealth; shrub.isStump = false; shrub.regrowTimer = 0; shrub.stumpTimer = 0; } } }

    // --- NEW: objects/driftwood.js ---
    function drawDriftwood(ctx, obj) { /* ... (drawing code unchanged) ... */ const x = obj.x; const y = obj.y; const w = obj.width; const h = obj.height; const color1 = '#A1887F'; const color2 = '#BCAAA4'; const darkLine = '#5D4037'; const seed = obj.x * 11 + obj.y * 23 + obj.resourceAmount * 5; const random = (s) => { let x = Math.sin(s) * 10000; return x - Math.floor(x); }; ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(random(seed) * Math.PI * 0.1 - Math.PI * 0.05); ctx.fillStyle = color1; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = color2; ctx.fillRect(-w / 2, -h / 2, w, h * 0.4); ctx.strokeStyle = darkLine; ctx.lineWidth = 1; const numLines = 1 + Math.floor(random(seed + 1) * 3); for (let i = 0; i < numLines; i++) { const startY = -h / 2 + (h / (numLines + 1)) * (i + 1) + (random(seed + 2 + i) - 0.5) * h * 0.1; const endY = startY + (random(seed + 3 + i) - 0.5) * h * 0.05; const startX = -w / 2 + random(seed + 4 + i) * w * 0.1; const endX = w / 2 - random(seed + 5 + i) * w * 0.1; ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke(); } ctx.restore(); }
    function updateDriftwoodSpawning(deltaTime, dayLength) { /* ... (update code unchanged) ... */ const { world: currentWorld, driftwoodPieces: currentDriftwood } = getWorldState(); const spawnChancePerSecond = DRIFTWOOD_SPAWN_CHANCE_PER_DAY / dayLength; const spawnChanceThisFrame = spawnChancePerSecond * deltaTime; if (currentDriftwood.length >= MAX_DRIFTWOOD_COUNT || Math.random() > spawnChanceThisFrame) { return; } let spawnTileX = -1, spawnTileY = -1; let attempts = 0; const maxSpawnAttempts = 50; while (attempts < maxSpawnAttempts) { const tx = Math.floor(Math.random() * WORLD_WIDTH_TILES); const ty = Math.floor(Math.random() * WORLD_HEIGHT_TILES); if (currentWorld[ty]?.[tx] === TERRAIN_SAND) { let tooClose = false; const checkRadiusSq = (TILE_SIZE * 1.5) ** 2; for(const existing of currentDriftwood) { if (distSq(tx * TILE_SIZE + TILE_SIZE/2, ty * TILE_SIZE + TILE_SIZE/2, existing.x + existing.width/2, existing.y + existing.height/2) < checkRadiusSq) { tooClose = true; break; } } if (!tooClose) { spawnTileX = tx; spawnTileY = ty; break; } } attempts++; } if (spawnTileX !== -1) { const pieceW = TILE_SIZE * (0.8 + Math.random() * 0.7); const pieceH = TILE_SIZE * (0.2 + Math.random() * 0.2); const spawnX = spawnTileX * TILE_SIZE + (TILE_SIZE - pieceW) / 2 + (Math.random() - 0.5) * TILE_SIZE * 0.4; const spawnY = spawnTileY * TILE_SIZE + (TILE_SIZE - pieceH) / 2 + (Math.random() - 0.5) * TILE_SIZE * 0.4; const resourceAmount = DRIFTWOOD_WOOD_YIELD_MIN + Math.floor(Math.random() * (DRIFTWOOD_WOOD_YIELD_MAX - DRIFTWOOD_WOOD_YIELD_MIN + 1)); const newDriftwood = { x: spawnX, y: spawnY, width: pieceW, height: pieceH, resourceAmount: resourceAmount }; addWorldObject('driftwoodPieces', newDriftwood); } }


    // --- FROM player.js ---

    // Initializes the player object state
    function initializePlayer(spawnX, spawnY) {
        return {
            x: spawnX, y: spawnY,
            width: TILE_SIZE, height: TILE_SIZE,
            speed: 3, // Base speed factor
            interactionRange: TILE_SIZE * 2.0,
            direction: 'down', // Initial facing direction
            isInsideShelter: false, // Tracks if player is currently inside a shelter object
            alpha: 1.0, // Opacity for visual effects (like being inside shelter)
            shadeRegenMessageCooldown: 0, // Timer to prevent "+Health" message spam
            // Fishing state properties (will be added in resetGameState or init)
            isFishing: false,
            fishingTimer: 0,
            fishingCooldown: 0,
            // Auto-Walk State Properties
            isAutoWalking: false,        // True if player is automatically walking to a target
            autoWalkTargetX: null,     // Destination X coordinate for auto-walk
            autoWalkTargetY: null,     // Destination Y coordinate for auto-walk
            autoWalkTargetObject: null // Reference to the target object (e.g., shelter)
        };
    }

      
    function updatePlayerMovement(deltaTime) {
        const currentPlayer = getPlayerState();

        // --- >>> NEW: Check for Auto-Walking FIRST <<< ---
        if (currentPlayer.isAutoWalking) {
            handleAutoWalk(deltaTime); // Handle automatic movement
            return; // Skip manual movement if auto-walking
        }
        // --- >>> END Auto-Walk Check <<< ---


        // --- Original Shelter Check (Still needed for blocking manual input) ---
        const shelterStateRead = !!currentPlayer.isInsideShelter;
        if (shelterStateRead) {
             return; // Block manual movement if inside shelter
        }
        // --- End Shelter Check ---


        // --- Manual Movement Logic (Only runs if not auto-walking AND not inside shelter) ---
        const currentKeys = getKeys();
        const { world: currentWorld, shelters: currentShelters, trees: currentTrees, rocks: currentRocks, shrubs: currentShrubs, campfires: currentCampfires, waterFilters: currentFilters, signalFires: currentFires /* other objects... */ } = getWorldState();

        // Player position / Water Check
        const playerBottomCenterX = currentPlayer.x + currentPlayer.width / 2;
        const playerBottomCenterY = currentPlayer.y + currentPlayer.height - 1;
        const currentTileX = Math.floor(playerBottomCenterX / TILE_SIZE);
        const currentTileY = Math.floor(playerBottomCenterY / TILE_SIZE);
        const currentTileType = currentWorld[currentTileY]?.[currentTileX];
        const isInWater = currentTileType === TERRAIN_WATER || currentTileType === TERRAIN_OCEAN_WATER;

        // Movement Calculation
        let speedMultiplier = isInWater ? SWIM_SPEED_MULTIPLIER : 1.0;
        // Add other speed modifiers (stump) if needed
        const baseSpeed = currentPlayer.speed * TILE_SIZE * deltaTime * speedMultiplier;
        let dx = 0; let dy = 0;
        let keyDetected = false;

        if (currentKeys['w'] || currentKeys['arrowup']) { dy -= baseSpeed; currentPlayer.direction = 'up'; keyDetected = true; }
        if (currentKeys['s'] || currentKeys['arrowdown']) { dy += baseSpeed; currentPlayer.direction = 'down'; keyDetected = true; }
        if (currentKeys['a'] || currentKeys['arrowleft']) { dx -= baseSpeed; currentPlayer.direction = 'left'; keyDetected = true; }
        if (currentKeys['d'] || currentKeys['arrowright']) { dx += baseSpeed; currentPlayer.direction = 'right'; keyDetected = true; }

        if (!keyDetected || (dx === 0 && dy === 0)) {
            return; // No manual movement input or calculation result
        }

        // Collision Detection Obstacles (for manual movement)
        const obstacles = [
            ...currentTrees.filter(t => !t.isStump), ...currentRocks, ...currentShrubs.filter(s => !s.isStump),
            ...currentCampfires, ...currentFilters, ...currentFires, ...currentShelters
        ];

        let nextX = currentPlayer.x + dx;
        let nextY = currentPlayer.y + dy;

        // Collision Checking Helper (for manual movement)
        const checkCollisionAt = (checkX, checkY) => {
            const checkPlayerRect = { x: checkX, y: checkY, width: currentPlayer.width, height: currentPlayer.height };
            if (checkX < 0 || checkX + currentPlayer.width > WORLD_WIDTH || checkY < 0 || checkY + currentPlayer.height > WORLD_HEIGHT) return { collision: true, type: 'boundary' };
            for (const obj of obstacles) {
                 if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number' || !obj.width || !obj.height) continue;
                 let cBox = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
                 if (obj.type === 'tree' && !obj.isStump) { const tW=obj.width, tH=obj.height; cBox={x:obj.x+tW/2-(tW*0.35)/2, y:obj.y+tH-(TILE_SIZE*0.5), width:tW*0.35, height:TILE_SIZE*0.5}; }
                 if (checkCollision(checkPlayerRect.x, checkPlayerRect.y, checkPlayerRect.width, checkPlayerRect.height, cBox.x, cBox.y, cBox.width, cBox.height)) return { collision: true, type: 'obstacle', object: obj };
            } return { collision: false, type: 'none' };
        };

        // Apply Manual Movement with Collision Checks
        let collisionResultX = checkCollisionAt(nextX, currentPlayer.y);
        if (!collisionResultX.collision) currentPlayer.x = nextX; else dx = 0;
        let collisionResultY = checkCollisionAt(currentPlayer.x, nextY);
        if (!collisionResultY.collision) currentPlayer.y = nextY; else dy = 0;

        // Final boundary clamp
        currentPlayer.x = Math.max(0, Math.min(currentPlayer.x, WORLD_WIDTH - currentPlayer.width));
        currentPlayer.y = Math.max(0, Math.min(currentPlayer.y, WORLD_HEIGHT - currentPlayer.height));

    } // End updatePlayerMovement

    // --- NEW Function to Handle Automatic Player Movement ---
    function handleAutoWalk(deltaTime) {
        if (!player.isAutoWalking || !player.autoWalkTargetObject || player.autoWalkTargetX === null || player.autoWalkTargetY === null) {
            // Safety check: If state is inconsistent, stop auto-walking
            console.warn("[AutoWalk] Invalid state, stopping.");
            player.isAutoWalking = false;
            player.autoWalkTargetObject = null; // Clear target object too
            return;
        }

        const targetX = player.autoWalkTargetX;
        const targetY = player.autoWalkTargetY;
        const targetShelter = player.autoWalkTargetObject;

        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;

        const dx = targetX - playerCenterX;
        const dy = targetY - playerCenterY;
        const distanceSq = dx * dx + dy * dy;

        // Define arrival threshold (how close player needs to be)
        const arrivalThresholdSq = (TILE_SIZE * 0.4) * (TILE_SIZE * 0.4); // Within ~half a tile

        // --- Check for Arrival ---
        if (distanceSq < arrivalThresholdSq) {
            console.log("[AutoWalk] Arrived at shelter destination.");

            // --- Trigger Enter Shelter Logic ---
            player.isInsideShelter = targetShelter; // Assign the specific shelter object
            player.alpha = SHELTER_ALPHA;           // Set transparency
            // Center player visually inside the shelter
            player.x = targetShelter.x + targetShelter.width / 2 - player.width / 2;
            player.y = targetShelter.y + targetShelter.height / 2 - player.height / 2;
            showMessage("Entered shelter.", 2000);
            // --- End Enter Shelter Logic ---

            // Clean up auto-walk state completely
            player.isAutoWalking = false;
            player.autoWalkTargetX = null;
            player.autoWalkTargetY = null;
            player.autoWalkTargetObject = null;
            hideInteractionPrompt(); // Ensure prompt is hidden after entering
            updateTooltip();
            return; // Finished auto-walk logic for this frame
        }

        // --- Calculate Movement (if not arrived) ---
        const distance = Math.sqrt(distanceSq);
        const moveX = dx / distance; // Normalized direction X
        const moveY = dy / distance; // Normalized direction Y

        // Calculate speed (consider water, etc.)
        const { world: currentWorld } = getWorldState();
        const playerFeetTileY = Math.floor((player.y + player.height - 1) / TILE_SIZE); // Check feet tile
        const playerTileX = Math.floor(playerCenterX / TILE_SIZE);
        const currentTileType = currentWorld[playerFeetTileY]?.[playerTileX];
        const isInWater = currentTileType === TERRAIN_WATER || currentTileType === TERRAIN_OCEAN_WATER;
        let speedMultiplier = isInWater ? SWIM_SPEED_MULTIPLIER : 1.0;
        // Add other speed modifiers if needed (e.g., stump)
        const baseSpeed = player.speed * TILE_SIZE * deltaTime * speedMultiplier;

        // Calculate step, ensuring player doesn't overshoot the target in one frame
        const stepMagnitude = Math.min(baseSpeed, distance);
        const stepX = moveX * stepMagnitude;
        const stepY = moveY * stepMagnitude;

        // --- Simple Collision Check (Can be improved later) ---
        // For now, only check world bounds. A full pathfinding or better collision
        // check would be needed for complex environments.
        const nextX = player.x + stepX;
        const nextY = player.y + stepY;

        let blocked = false;
        if (nextX < 0 || nextX + player.width > WORLD_WIDTH || nextY < 0 || nextY + player.height > WORLD_HEIGHT) {
             console.log("[AutoWalk] Path blocked by boundary, stopping walk.");
             blocked = true;
        }
         // TODO: Add obstacle collision check here if desired, similar to updatePlayerMovement
         // but potentially ignoring the targetShelter itself. If blocked, set blocked = true.

        if (blocked) {
            showMessage("Path blocked!", 2000);
            player.isAutoWalking = false;
            player.autoWalkTargetX = null;
            player.autoWalkTargetY = null;
            player.autoWalkTargetObject = null;
            return;
        }

        // --- Apply Movement ---
        player.x = nextX;
        player.y = nextY;

        // --- Update Player Direction Sprite based on movement vector ---
        if (Math.abs(dx) > Math.abs(dy) * 1.2) { // Prioritize horizontal if significant difference
            player.direction = dx > 0 ? 'right' : 'left';
        } else if (Math.abs(dy) > Math.abs(dx) * 1.2) { // Prioritize vertical
            player.direction = dy > 0 ? 'down' : 'up';
        } else { // Roughly diagonal - pick one based on largest component
             player.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        }
    } // End handleAutoWalk    

    // --- Helper Function to Calculate Shadow ---
    function calculateTreeShadow(tree, timeState) { /* ... (function code unchanged) ... */ if (tree.isStump) return null; const timeOfDayFactor = timeState.current / timeState.dayLength; const isEffectivelyNight = timeOfDayFactor >= timeState.nightStartFactor || timeOfDayFactor < timeState.morningStartFactor; if (isEffectivelyNight) return null; const trunkBaseY = tree.y + tree.height; const trunkCenterX = tree.x + tree.width / 2; const maxShadowLength = tree.height * 0.5; const shadowYOffsetBase = tree.height * 0.03; let sunAngle = Math.PI * (timeOfDayFactor - timeState.morningStartFactor) / (timeState.nightStartFactor - timeState.morningStartFactor); sunAngle = Math.max(0.01, Math.min(Math.PI - 0.01, sunAngle)); const shadowOffsetX = -Math.cos(sunAngle) * maxShadowLength; const shadowOffsetY = Math.sin(sunAngle) * maxShadowLength * 0.2 + shadowYOffsetBase; const shadowScaleFactor = Math.max(0.3, Math.sin(sunAngle)); const shadowRadiusX = (tree.width * 0.5) * shadowScaleFactor; const shadowRadiusY = shadowRadiusX * 0.3; const shadowCenterX = trunkCenterX + shadowOffsetX; const shadowCenterY = trunkBaseY + shadowOffsetY; return { x: shadowCenterX, y: shadowCenterY, radiusX: shadowRadiusX, radiusY: shadowRadiusY, exists: true }; }

    // --- Updated isPlayerInShade Function ---
    function isPlayerInShade() { /* ... (function code unchanged, checks shelter and tree.currentShadow) ... */ const currentPlayer = getPlayerState(); const { trees: currentTrees } = getWorldState(); if (currentPlayer.isInsideShelter) { return true; } const playerRect = { x: currentPlayer.x, y: currentPlayer.y, width: currentPlayer.width, height: currentPlayer.height }; for (const tree of currentTrees) { if (tree.currentShadow && tree.currentShadow.exists) { const shadow = tree.currentShadow; const shadowBounds = { x: shadow.x - shadow.radiusX, y: shadow.y - shadow.radiusY, width: shadow.radiusX * 2, height: shadow.radiusY * 2 }; if (checkCollision(playerRect.x, playerRect.y, playerRect.width, playerRect.height, shadowBounds.x, shadowBounds.y, shadowBounds.width, shadowBounds.height)) { const playerCenterX = playerRect.x + playerRect.width / 2; const playerCenterY = playerRect.y + playerRect.height / 2; const dx = playerCenterX - shadow.x; const dy = playerCenterY - shadow.y; if (shadow.radiusX > 0 && shadow.radiusY > 0) { if ( ((dx * dx) / (shadow.radiusX * shadow.radiusX)) + ((dy * dy) / (shadow.radiusY * shadow.radiusY)) <= 1 ) { return true; } } else if (dx === 0 && dy === 0) { return true; } } } } return false; }

    function drawPlayer(ctx, p) { /* ... (drawing code unchanged) ... */ const { world: currentWorld } = getWorldState(); const playerCenterX = p.x + p.width / 2; const playerFeetY = p.y + p.height * 0.9; const currentTileX = Math.floor(playerCenterX / TILE_SIZE); const currentTileY = Math.floor(playerFeetY / TILE_SIZE); const currentTileType = currentWorld[currentTileY]?.[currentTileX]; const isSwimmingVisual = currentTileType === TERRAIN_WATER || currentTileType === TERRAIN_OCEAN_WATER; ctx.save(); if (p.isInsideShelter) { ctx.globalAlpha = SHELTER_ALPHA; } else { ctx.globalAlpha = 1.0; } if (isSwimmingVisual) { ctx.beginPath(); const clipHeight = p.height * 0.6; ctx.rect(p.x - 1, p.y - 1, p.width + 2, clipHeight + 1); ctx.clip(); } const skinColor = '#F0C8A0'; const hairColor = '#5B3A29'; const shirtColor = '#4682B4'; const pantsColor = '#3B5323'; const eyeColor = '#000000'; const shoeColor = '#8B4513'; const headSize = p.width * 0.6; const headX = p.x + (p.width - headSize) / 2; const headY = p.y; const bodyWidth = p.width * 0.8; const bodyHeight = p.height * 0.5; const bodyX = p.x + (p.width - bodyWidth) / 2; const bodyY = headY + headSize * 0.8; const legHeight = p.height * 0.3; const legWidth = bodyWidth / 2 * 0.8; const legY = bodyY + bodyHeight * 0.9; ctx.fillStyle = pantsColor; ctx.fillRect(bodyX, legY, legWidth, legHeight); ctx.fillRect(bodyX + bodyWidth - legWidth, legY, legWidth, legHeight); ctx.fillStyle = shoeColor; const shoeHeight = legHeight * 0.3; ctx.fillRect(bodyX, legY + legHeight - shoeHeight, legWidth, shoeHeight); ctx.fillRect(bodyX + bodyWidth - legWidth, legY + legHeight - shoeHeight, legWidth, shoeHeight); ctx.fillStyle = shirtColor; ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight); ctx.fillStyle = skinColor; ctx.fillRect(headX, headY, headSize, headSize); ctx.fillStyle = hairColor; ctx.fillRect(headX, headY, headSize, headSize * 0.3); if (p.direction === 'left') { ctx.fillRect(headX, headY + headSize * 0.2, headSize * 0.2, headSize * 0.5); } else if (p.direction === 'right') { ctx.fillRect(headX + headSize * 0.8, headY + headSize * 0.2, headSize * 0.2, headSize * 0.5); } else if (p.direction === 'down') { ctx.fillRect(headX + headSize * 0.1, headY + headSize * 0.3, headSize * 0.8, headSize * 0.2); } ctx.fillStyle = eyeColor; const eyeY = headY + headSize * 0.4; const eyeSize = 2; if (p.direction === 'down') { ctx.fillRect(headX + headSize * 0.25, eyeY, eyeSize, eyeSize); ctx.fillRect(headX + headSize * 0.65, eyeY, eyeSize, eyeSize); } else if (p.direction === 'left') { ctx.fillRect(headX + headSize * 0.25, eyeY, eyeSize, eyeSize); } else if (p.direction === 'right') { ctx.fillRect(headX + headSize * 0.65, eyeY, eyeSize, eyeSize); } const armWidth = bodyWidth * 0.15; const armHeight = bodyHeight * 0.8; const armY = bodyY + bodyHeight * 0.1; ctx.fillStyle = skinColor; if (p.direction === 'down' || p.direction === 'up') { ctx.fillRect(bodyX - armWidth, armY, armWidth, armHeight); ctx.fillRect(bodyX + bodyWidth, armY, armWidth, armHeight); } else if (p.direction === 'left') { ctx.fillRect(bodyX + bodyWidth * 0.1, armY, armWidth, armHeight); } else if (p.direction === 'right') { ctx.fillRect(bodyX + bodyWidth * 0.75 , armY, armWidth, armHeight); } ctx.restore(); ctx.globalAlpha = 1.0; }


    // --- FROM inventory.js ---
    let inventorySlotsContainer = null; let invNavLeftButton = null; let invNavRightButton = null;
    function initializeInventoryUI() { /* ... (init code unchanged) ... */ inventorySlotsContainer = document.getElementById('inventory-slots-container'); invNavLeftButton = document.getElementById('inv-nav-left'); invNavRightButton = document.getElementById('inv-nav-right'); if (!inventorySlotsContainer || !invNavLeftButton || !invNavRightButton) { console.error("Inventory UI elements not found!"); return; } invNavLeftButton.addEventListener('click', navigateInventoryLeft); invNavRightButton.addEventListener('click', navigateInventoryRight); }
    function addItemToInventory(itemName, count) { /* ... (add item code unchanged) ... */ if (count <= 0) return false; const currentInventory = getInventoryState(); let addedSuccessfully = false; for (let i = 0; i < currentInventory.length; i++) { if (currentInventory[i] && currentInventory[i].item === itemName) { currentInventory[i].count += count; addedSuccessfully = true; break; } } if (!addedSuccessfully) { for (let i = 0; i < currentInventory.length; i++) { if (!currentInventory[i] || currentInventory[i].item === 'none') { currentInventory[i] = { item: itemName, count: count }; addedSuccessfully = true; break; } } } if (!addedSuccessfully && currentInventory.length < MAX_INVENTORY_SIZE) { currentInventory.push({ item: itemName, count: count }); addedSuccessfully = true; } if (addedSuccessfully) { if (currentInventory.length > MAX_INVENTORY_SIZE) { console.warn("Inventory exceeded max size - trimming."); currentInventory.splice(MAX_INVENTORY_SIZE); if (getSelectedSlot() >= currentInventory.length) { setSelectedSlot(Math.max(0, currentInventory.length - 1)); } } if (resources[itemName] && (itemName === 'wood' || itemName === 'stone' || itemName === 'fish')) { const currentStats = getStatsState(); currentStats.totalItemsCollected += count; if (itemName === 'fish') currentStats.fishCaught += count; updateStatsState(currentStats); } setInventoryState(currentInventory); updateInventoryUI(); updateCraftingUI(); return true; } else { showMessage("Inventory is full!", 2000); return false; } }
    function removeItemFromInventory(itemName, count) { /* ... (remove item code unchanged) ... */ if (count <= 0) return false; const currentInventory = getInventoryState(); let currentSelectedSlot = getSelectedSlot(); let remainingToRemove = count; let itemFound = false; for (let i = currentInventory.length - 1; i >= 0; i--) { if (currentInventory[i] && currentInventory[i].item === itemName) { itemFound = true; let amountToRemoveFromSlot = Math.min(remainingToRemove, currentInventory[i].count); currentInventory[i].count -= amountToRemoveFromSlot; remainingToRemove -= amountToRemoveFromSlot; if (currentInventory[i].count <= 0) { let originalSelectedIndex = currentSelectedSlot; currentInventory.splice(i, 1); if (i < currentSelectedSlot) { currentSelectedSlot--; } if (originalSelectedIndex === i){ if(currentInventory.length === 0){ currentSelectedSlot = 0; } else { currentSelectedSlot = Math.max(0, Math.min(currentSelectedSlot, currentInventory.length - 1)); if(!currentInventory[currentSelectedSlot] || currentInventory[currentSelectedSlot].item === 'none'){ const firstValid = currentInventory.findIndex(slot => slot && slot.item !== 'none'); currentSelectedSlot = (firstValid >= 0) ? firstValid : 0; } } } } if (remainingToRemove <= 0) break; } } setSelectedSlot(currentSelectedSlot); if (remainingToRemove > 0 && itemFound) console.warn(`Could not remove the full required ${count} of ${itemName}. Removed ${count - remainingToRemove}.`); else if (remainingToRemove > 0 && !itemFound) console.warn(`Could not remove ${count} of ${itemName}, item not found.`); setInventoryState(currentInventory); updateInventoryUI(); updateCraftingUI(); return remainingToRemove <= 0; }
    function countItem(itemName) { /* ... (count item code unchanged) ... */ const currentInventory = getInventoryState(); let total = 0; for(const slot of currentInventory) { if(slot && slot.item === itemName) { total += slot.count; } } return total; }
    function hasEnoughResources(requirements) { /* ... (check resources code unchanged) ... */ return Object.entries(requirements).every(([res, reqCount]) => countItem(res) >= reqCount); }
    function generateInventorySlots() { /* ... (generate slots code unchanged) ... */ if (!inventorySlotsContainer) return; inventorySlotsContainer.innerHTML = ''; for (let i = 0; i < VISIBLE_INVENTORY_SLOTS; i++) { const slot = document.createElement('div'); slot.classList.add('inventory-slot'); slot.dataset.visibleIndex = i; slot.addEventListener('click', (e) => { const visibleIdx = parseInt(e.currentTarget.dataset.visibleIndex); const actualIndex = getInventoryStartIndex() + visibleIdx; if (actualIndex < getInventoryState().length) { selectInventorySlot(actualIndex); } e.stopPropagation(); }); inventorySlotsContainer.appendChild(slot); } updateInventoryUI(); }
    function updateInventoryUI() { /* ... (update UI code unchanged) ... */ if (!inventorySlotsContainer) return; const slots = inventorySlotsContainer.querySelectorAll('.inventory-slot'); const currentInventory = getInventoryState(); const currentSelectedSlot = getSelectedSlot(); const currentInventoryStartIndex = getInventoryStartIndex(); const currentInventorySize = currentInventory.length; slots.forEach((slot, index) => { const actualIndex = currentInventoryStartIndex + index; slot.innerHTML = ''; slot.classList.remove('selected', 'no-sprite'); slot.style.backgroundImage = ''; slot.style.backgroundPosition = ''; slot.dataset.item = 'none'; slot.dataset.actualIndex = actualIndex; if (actualIndex < currentInventorySize && currentInventory[actualIndex] && currentInventory[actualIndex].item !== 'none') { const itemData = currentInventory[actualIndex]; const itemDef = craftableItems[itemData.item] || resources[itemData.item]; const displayName = itemDef?.name || itemData.item; slot.dataset.item = itemData.item; slot.classList.add('no-sprite'); const nameSpan = document.createElement('span'); nameSpan.classList.add('inventory-item-name'); nameSpan.textContent = displayName; slot.appendChild(nameSpan); if (itemData.count > 0) { const countSpan = document.createElement('span'); countSpan.classList.add('inventory-count'); countSpan.textContent = `x${itemData.count}`; slot.appendChild(countSpan); } if (actualIndex === currentSelectedSlot) { slot.classList.add('selected'); } } else { slot.classList.add('no-sprite'); slot.dataset.item = 'none'; if (actualIndex === currentSelectedSlot) slot.classList.remove('selected'); } }); if(invNavLeftButton) invNavLeftButton.disabled = (currentInventoryStartIndex <= 0); if(invNavRightButton) invNavRightButton.disabled = (currentInventoryStartIndex + VISIBLE_INVENTORY_SLOTS >= currentInventorySize); updateTooltip(); }
    function selectInventorySlot(absoluteIndex) { /* ... (select slot code unchanged) ... */ const currentInventory = getInventoryState(); const currentInventorySize = currentInventory.length; let currentInventoryStartIndex = getInventoryStartIndex(); if (currentInventorySize === 0) { setSelectedSlot(0); setInventoryStartIndex(0); updateInventoryUI(); return; } absoluteIndex = Math.max(0, Math.min(absoluteIndex, currentInventorySize - 1)); setSelectedSlot(absoluteIndex); if (absoluteIndex < currentInventoryStartIndex) { currentInventoryStartIndex = absoluteIndex; } else if (absoluteIndex >= currentInventoryStartIndex + VISIBLE_INVENTORY_SLOTS) { currentInventoryStartIndex = absoluteIndex - VISIBLE_INVENTORY_SLOTS + 1; } setInventoryStartIndex(currentInventoryStartIndex); updateInventoryUI(); }
    function navigateInventoryLeft() { /* ... (navigate code unchanged) ... */ let startIndex = getInventoryStartIndex(); if (startIndex > 0) { setInventoryStartIndex(startIndex - 1); updateInventoryUI(); } }
    function navigateInventoryRight() { /* ... (navigate code unchanged) ... */ let startIndex = getInventoryStartIndex(); const currentInventory = getInventoryState(); if (startIndex + VISIBLE_INVENTORY_SLOTS < currentInventory.length) { setInventoryStartIndex(startIndex + 1); updateInventoryUI(); } }


    // --- FROM ui.js ---
    let messageBox = null; let interactionPrompt = null; let tooltipArea = null; let statsPanelElements = null; let dayNightIndicator = null; let craftingPanel = null; let helpButton = null; let helpPanel = null; let helpPauseButton = null; let helpMainMenuButton = null; let closeHelpButton = null; let pausePopup = null; let resumeButton = null; let mainMenuButton = null; let closeCraftingButton = null; let messageTimeout = null; let interactionTimeout = null;
    function initializeGeneralUI() { /* ... (init code unchanged) ... */ messageBox = document.getElementById('message-box'); interactionPrompt = document.getElementById('interaction-prompt'); tooltipArea = document.getElementById('tooltip-area'); statsPanelElements = { healthBar: document.getElementById('health-bar-inner'), healthText: document.getElementById('health-text'), hungerBar: document.getElementById('hunger-bar-inner'), hungerText: document.getElementById('hunger-text'), thirstBar: document.getElementById('thirst-bar-inner'), thirstText: document.getElementById('thirst-text'), dayValue: document.getElementById('day-value'), dayBar: document.getElementById('day-bar-inner'), dayText: document.getElementById('day-text') }; dayNightIndicator = document.getElementById('day-night-indicator'); craftingPanel = document.getElementById('crafting-panel'); helpButton = document.getElementById('help-button'); helpPanel = document.getElementById('help-panel'); closeHelpButton = document.getElementById('close-help-panel'); pausePopup = document.getElementById('pause-popup'); resumeButton = document.getElementById('resume-button'); mainMenuButton = document.getElementById('main-menu-button'); closeCraftingButton = document.getElementById('close-crafting'); helpPauseButton = document.getElementById('help-pause-button'); helpMainMenuButton = document.getElementById('help-main-menu-button'); if (closeCraftingButton) closeCraftingButton.addEventListener('click', closeCraftingMenu); if (helpButton) helpButton.addEventListener('click', toggleHelpPanel); if (closeHelpButton) closeHelpButton.addEventListener('click', hideHelpPanel); if (resumeButton) resumeButton.addEventListener('click', () => { if(getIsPaused()) togglePause(); }); if (mainMenuButton) mainMenuButton.addEventListener('click', goToMainMenu); if (helpPauseButton) { helpPauseButton.addEventListener('click', () => { hideHelpPanel(); if (!getIsPaused()) { togglePause(); } }); } if (helpMainMenuButton) { helpMainMenuButton.addEventListener('click', () => { const userConfirmed = confirm("Are you sure you want to return to the main menu? Your current game progress will be lost."); if (userConfirmed) { goToMainMenu(); } }); } }
    function updateStatsUI() { /* ... (update UI code unchanged) ... */ if (!statsPanelElements || !statsPanelElements.healthBar) return; const currentStats = getStatsState(); const currentTime = getTimeState(); const healthPercent = (currentStats.health / MAX_STAT) * 100; const hungerPercent = (currentStats.hunger / MAX_STAT) * 100; const thirstPercent = (currentStats.thirst / MAX_STAT) * 100; const dayPercent = (currentTime.current / currentTime.dayLength) * 100; const timeOfDayFactor = currentTime.current / currentTime.dayLength; statsPanelElements.healthBar.style.width = `${Math.max(0, healthPercent)}%`; statsPanelElements.healthText.textContent = `${Math.floor(currentStats.health)}/${MAX_STAT}`; statsPanelElements.hungerBar.style.width = `${Math.max(0, hungerPercent)}%`; statsPanelElements.hungerText.textContent = `${Math.floor(currentStats.hunger)}/${MAX_STAT}`; statsPanelElements.thirstBar.style.width = `${Math.max(0, thirstPercent)}%`; statsPanelElements.thirstText.textContent = `${Math.floor(currentStats.thirst)}/${MAX_STAT}`; statsPanelElements.dayValue.textContent = currentStats.day; statsPanelElements.dayBar.style.width = `${Math.max(0, dayPercent)}%`; let timeText = "Night"; if (timeOfDayFactor >= currentTime.dayStartFactor && timeOfDayFactor < currentTime.morningStartFactor) timeText = "Dawn"; else if (timeOfDayFactor >= currentTime.morningStartFactor && timeOfDayFactor < currentTime.afternoonStartFactor) timeText = "Morning"; else if (timeOfDayFactor >= currentTime.afternoonStartFactor && timeOfDayFactor < currentTime.eveningStartFactor) timeText = "Afternoon"; else if (timeOfDayFactor >= currentTime.eveningStartFactor && timeOfDayFactor < currentTime.nightStartFactor) timeText = "Evening"; statsPanelElements.dayText.textContent = timeText; }

    // --- Stats Update Logic (Reviewed for Water Effects) ---
    function updateStats(deltaTime) {
        const currentStats = getStatsState(); // Use getter
        const currentTime = getTimeState(); // Use getter
        const { world: currentWorld } = getWorldState(); // Need world to check player position
        const currentPlayer = getPlayerState(); // Need player object for cooldown

        // --- Check Player Location (Land/Water/Shade) ---
        const playerBottomCenterX = currentPlayer.x + currentPlayer.width / 2;
        const playerBottomCenterY = currentPlayer.y + currentPlayer.height - 1; // Check feet location
        const currentTileX = Math.floor(playerBottomCenterX / TILE_SIZE);
        const currentTileY = Math.floor(playerBottomCenterY / TILE_SIZE);
        const currentTileType = currentWorld[currentTileY]?.[currentTileX];

        // Check if player is in ANY water type
        const isInWater = currentTileType === TERRAIN_WATER || currentTileType === TERRAIN_OCEAN_WATER;

        // Check if sun is up
        const timeOfDayFactor = currentTime.current / currentTime.dayLength;
        const isSunUp = timeOfDayFactor >= currentTime.morningStartFactor && timeOfDayFactor < currentTime.eveningStartFactor;

        // Check if player is in shade (uses pre-calculated tree shadows or shelter state)
        const inShade = isPlayerInShade();
        // --- End Location Checks ---


        // --- Define Penalty Rates ---
        const healthLossRateHungerZero = 0.5;
        const healthLossRateThirstZero = 1.0;
        const healthLossRateHungerBelowHalf = 0.03; // Minor drain below 50%
        const healthLossRateThirstBelowHalf = 0.05; // Minor drain below 50%

        // --- Stat Decrease Rates ---
        const hungerRate = 0.4; // Base hunger decrease
        const thirstRate = 0.6; // Base thirst decrease
        const swimHungerMultiplier = 1.5; // Swimming makes you hungrier faster (Optional)
        const swimThirstMultiplier = 1.7; // Swimming makes you thirstier faster (Optional)


        // --- Decrease Base Stats ---
        let currentHungerRate = hungerRate;
        let currentThirstRate = thirstRate;

        // Apply swimming multipliers if player is in water
        if (isInWater) {
            currentHungerRate *= swimHungerMultiplier;
            currentThirstRate *= swimThirstMultiplier;
        }

        currentStats.hunger -= currentHungerRate * deltaTime;
        currentStats.thirst -= currentThirstRate * deltaTime;


        // --- Apply Health Penalties / Regeneration ---
        let healthChangeThisFrame = 0; // Use positive for gain, negative for loss

        // -- Handle Sun Damage OR Shade Regeneration (Only during daytime) --
        if (isSunUp) {
            if (inShade) {
                // *** Apply Shade Regeneration ***
                if (currentStats.health < MAX_STAT) { // Only regen if not max health
                    const regenAmount = SHADE_HEALTH_REGEN_RATE * deltaTime;
                    // We add to healthChangeThisFrame, apply later
                    healthChangeThisFrame += regenAmount;

                    // Show message only if health actually increased and cooldown is ready
                    // Check if potential health > current health before applying clamp
                    if ((currentStats.health + regenAmount) > currentStats.health && currentPlayer.shadeRegenMessageCooldown <= 0) {
                         showMessage("+Health (In Shade)", 2500);
                         currentPlayer.shadeRegenMessageCooldown = 5.0; // Set cooldown
                    }
                }
            } else if (!isInWater) { // Apply Sun Damage only if NOT in shade and NOT swimming
                const sunDamage = SUN_DAMAGE_RATE * deltaTime;
                // We subtract from healthChangeThisFrame
                healthChangeThisFrame -= sunDamage;
                 // Optional: Show a recurring message? Could be annoying.
                 // if (currentPlayer.sunDamageMessageCooldown <= 0) {
                 //    showMessage("Sun is strong! Find shade or water.", 4000);
                 //    currentPlayer.sunDamageMessageCooldown = 15.0; // Show every 15s
                 // }
            }
            // If in water during the day, neither sun damage nor shade regen applies directly here.
            // The swimming penalty (below) handles the health effect of being exposed in water.
        } // End if(isSunUp)

        // -- Decrement Message Cooldowns --
        if (currentPlayer.shadeRegenMessageCooldown > 0) {
            currentPlayer.shadeRegenMessageCooldown -= deltaTime;
        }
        // Reset shade cooldown immediately if player leaves shade
        if (!inShade) {
            currentPlayer.shadeRegenMessageCooldown = 0;
        }
        // Optional sun damage cooldown
        // if (currentPlayer.sunDamageMessageCooldown > 0) {
        //     currentPlayer.sunDamageMessageCooldown -= deltaTime;
        // }


        // -- Apply Swimming Penalty (Applies day or night, whenever in water) --
        if (isInWater) {
            const swimHealthLoss = SWIM_HEALTH_DRAIN_RATE * deltaTime;
            healthChangeThisFrame -= swimHealthLoss; // Subtract from health change
        }

        // -- Apply Hunger/Thirst Health Penalties --
        // 1. ZERO penalties (Severe drain)
        if (currentStats.hunger <= 0) {
            const healthLoss = healthLossRateHungerZero * deltaTime;
            healthChangeThisFrame -= healthLoss;
            currentStats.hunger = 0; // Clamp hunger at 0
        }
        if (currentStats.thirst <= 0) {
            const healthLoss = healthLossRateThirstZero * deltaTime;
            healthChangeThisFrame -= healthLoss;
            currentStats.thirst = 0; // Clamp thirst at 0
        }
        // 2. BELOW 50% penalties (Minor drain)
        const halfMax = MAX_STAT * 0.5;
        if (currentStats.hunger < halfMax && currentStats.hunger > 0) {
            const healthLoss = healthLossRateHungerBelowHalf * deltaTime;
            healthChangeThisFrame -= healthLoss;
        }
        if (currentStats.thirst < halfMax && currentStats.thirst > 0) {
            const healthLoss = healthLossRateThirstBelowHalf * deltaTime;
            healthChangeThisFrame -= healthLoss;
        }

        // --- Finalize Stats ---
        // Apply accumulated health changes
        currentStats.health += healthChangeThisFrame;

        // Clamp stats to min/max values
        currentStats.health = Math.max(0, Math.min(MAX_STAT, currentStats.health));
        currentStats.hunger = Math.max(0, Math.min(MAX_STAT, currentStats.hunger));
        currentStats.thirst = Math.max(0, Math.min(MAX_STAT, currentStats.thirst));

        // Update global state & UI
        updateStatsState(currentStats); // Save the updated stats object
        updateStatsUI();                // Update the display
    }

    function updateDayNightIndicator() { /* ... (update code unchanged) ... */ if (!dayNightIndicator) return; const currentTime = getTimeState(); const timeOfDayFactor = currentTime.current / currentTime.dayLength; let bgColor, shadowColor; if (timeOfDayFactor >= currentTime.nightStartFactor || timeOfDayFactor < currentTime.morningStartFactor) { bgColor = 'linear-gradient(to bottom, #1a1a4a, #00001a)'; shadowColor='rgba(50,50,100,0.7)'; } else if (timeOfDayFactor >= currentTime.eveningStartFactor) { bgColor = 'linear-gradient(to bottom, #483D8B, #8A2BE2)'; shadowColor='rgba(138,43,226,0.6)'; } else if (timeOfDayFactor >= currentTime.afternoonStartFactor) { bgColor = 'linear-gradient(to bottom, #87CEEB, #4682B4)'; shadowColor='rgba(135,206,235,0.7)'; } else { bgColor = 'linear-gradient(to bottom, #FFD700, #FFA500)'; shadowColor='rgba(255,165,0,0.6)'; } dayNightIndicator.style.background = bgColor; dayNightIndicator.style.boxShadow = `0 0 10px ${shadowColor}`; }
    function showMessage(message, duration = 3000) { /* ... (show message code unchanged) ... */ if (!messageBox) return; messageBox.textContent = message; messageBox.style.display = 'block'; clearTimeout(messageTimeout); messageTimeout = setTimeout(() => { if(messageBox) messageBox.style.display = 'none'; }, duration); }
    function showInteractionPrompt(message) { /* ... (show prompt code unchanged) ... */ if (!interactionPrompt || getIsPaused()) return; interactionPrompt.textContent = message; interactionPrompt.style.display = 'block'; clearTimeout(interactionTimeout); interactionTimeout = setTimeout(hideInteractionPrompt, 150); }
    function hideInteractionPrompt() { /* ... (hide prompt code unchanged) ... */ if (interactionPrompt) interactionPrompt.style.display = 'none'; }
    function updateTooltip() { /* ... (update tooltip code unchanged) ... */ if (!tooltipArea || getIsPaused()) { hideTooltip(); return; } const currentInventory = getInventoryState(); const currentSelectedSlot = getSelectedSlot(); const selected = currentInventory[currentSelectedSlot]; let tooltipText = ""; if (selected && selected.item !== 'none' && selected.count > 0) { const itemDef = craftableItems[selected.item] || resources[selected.item]; if (itemDef) tooltipText = `${itemDef.name || selected.item}: ${itemDef.description || 'A useful item.'}`; else tooltipText = selected.item; } if (tooltipText) { tooltipArea.textContent = tooltipText; tooltipArea.style.display = 'block'; } else { hideTooltip(); } }
    function hideTooltip() { /* ... (hide tooltip code unchanged) ... */ if (tooltipArea) tooltipArea.style.display = 'none'; }

    // --- Updated Crafting Button Generation ---
    function generateCraftingButtons() { /* ... (code as provided in previous response) ... */ if (!craftingPanel) return; craftingPanel.querySelectorAll('.craft-button').forEach(btn => btn.remove()); for (const itemId in craftableItems) { const item = craftableItems[itemId]; const button = document.createElement('button'); button.classList.add('craft-button'); button.dataset.item = itemId; let reqText = Object.entries(item.requires) .map(([res, count]) => `${resources[res]?.name || res}: ${count}`) .join(', '); button.innerHTML = ` ${item.name} <span class="craft-req">Requires: (${reqText})</span> <span class="craft-req">${item.description}</span> `; button.addEventListener('click', craftItem); const closeButton = document.getElementById('close-crafting'); if (closeButton) { craftingPanel.insertBefore(button, closeButton); } else { craftingPanel.appendChild(button); } } }

    function toggleCraftingMenu() { /* ... (toggle code unchanged) ... */ if (!craftingPanel || getIsPaused()) return; const isVisible = craftingPanel.style.display === 'flex'; craftingPanel.style.display = isVisible ? 'none' : 'flex'; if (!isVisible) { updateCraftingUI(); } }
    function closeCraftingMenu() { /* ... (close code unchanged) ... */ if (craftingPanel) craftingPanel.style.display = 'none'; }
    function updateCraftingUI() { /* ... (update UI code unchanged) ... */ if (!craftingPanel || craftingPanel.style.display !== 'flex') return; const buttons = craftingPanel.querySelectorAll('.craft-button'); buttons.forEach(button => { const itemId = button.dataset.item; const itemData = craftableItems[itemId]; if (itemData) { button.disabled = !hasEnoughResources(itemData.requires); } }); }
    function showHelpPanel() { /* ... (show code unchanged) ... */ if (!helpPanel || getIsPaused()) return; helpPanel.style.display = 'flex'; }
    function hideHelpPanel() { /* ... (hide code unchanged) ... */ if (helpPanel) helpPanel.style.display = 'none'; }
    function toggleHelpPanel() { /* ... (toggle code unchanged) ... */ if (!helpPanel || getIsPaused()) return; helpPanel.style.display = (helpPanel.style.display === 'none' || helpPanel.style.display === '') ? 'flex' : 'none'; }
    function showPausePopup() { /* ... (show code unchanged) ... */ if(pausePopup) pausePopup.style.display = 'flex'; }
    function hidePausePopup() { /* ... (hide code unchanged) ... */ if(pausePopup) pausePopup.style.display = 'none'; }


    // --- FROM interactions.js ---
    function getInteractionPoint() { /* ... (get point code unchanged) ... */ const currentPlayer = getPlayerState(); let ix = currentPlayer.x + currentPlayer.width / 2; let iy = currentPlayer.y + currentPlayer.height / 2; const reach = TILE_SIZE * 0.6; switch (currentPlayer.direction) { case 'up': iy -= reach; break; case 'down': iy += reach + (currentPlayer.height / 2); break; case 'left': ix -= reach; break; case 'right': ix += reach; break; } ix = Math.max(0, Math.min(WORLD_WIDTH - 1, ix)); iy = Math.max(0, Math.min(WORLD_HEIGHT - 1, iy)); return { x: ix, y: iy }; }
    function peekInteractionTarget() { /* ... (peek target code unchanged) ... */ const currentPlayer = getPlayerState(); const currentInventory = getInventoryState(); const currentSelectedSlot = getSelectedSlot(); const { world: currentWorld, trees: currentTrees, rocks: currentRocks, shrubs: currentShrubs, driftwoodPieces: currentDriftwood, campfires: currentCampfires, shelters: currentShelters, waterFilters: currentFilters, signalFires: currentFires } = getWorldState(); const iP = getInteractionPoint(); const playerCX = currentPlayer.x + currentPlayer.width / 2; const playerCY = currentPlayer.y + currentPlayer.height / 2; const selectedItem = currentInventory[currentSelectedSlot]; const interactionRangeSquared = currentPlayer.interactionRange * currentPlayer.interactionRange; if (selectedItem && selectedItem.item === 'wood' && selectedItem.count > 0) { for (const f of currentFires) { if (distSq(playerCX, playerCY, f.x + f.width / 2, f.y + f.height / 2) < interactionRangeSquared) { if (typeof f.fuel !== 'undefined' && typeof f.maxFuel !== 'undefined') { return { type: 'addFuel', target: f }; } else { console.warn("Signal fire target missing fuel/maxFuel properties:", f); return { type: 'addFuel', target: f }; } } } } for (const p of currentFilters) { if (distSq(iP.x, iP.y, p.x + p.width / 2, p.y + p.height / 2) < (TILE_SIZE * 0.8) ** 2 && distSq(playerCX, playerCY, p.x + p.width / 2, p.y + p.height / 2) < interactionRangeSquared) { return { type: 'usePurifier', target: p }; } } const potentiallyNearbyResources = [ ...currentTrees.filter(t => !t.isStump), ...currentRocks, ...currentShrubs.filter(s => !s.isStump), ...currentDriftwood ] .filter(r => distSq(playerCX, playerCY, r.x + r.width / 2, r.y + r.height / 2) < interactionRangeSquared * 1.5); let closestResource = null; let minDistSqToIP = interactionRangeSquared; for (const resource of potentiallyNearbyResources) { const resCenterX = resource.x + (resource.width || TILE_SIZE) / 2; const resCenterY = resource.y + (resource.height || TILE_SIZE) / 2; const dSq = distSq(iP.x, iP.y, resCenterX, resCenterY); if (dSq < minDistSqToIP) { minDistSqToIP = dSq; closestResource = resource; } } if (closestResource) { if (selectedItem && selectedItem.item === 'wood' && selectedItem.count > 0) { let closestFire = null; let minFireDist = interactionRangeSquared; for(const f of currentFires) { const dSqFire = distSq(playerCX, playerCY, f.x + f.width / 2, f.y + f.height / 2); if (dSqFire < minFireDist) { minFireDist = dSqFire; closestFire = f; } } if(closestFire && typeof closestFire.fuel !== 'undefined' && typeof closestFire.maxFuel !== 'undefined') { return { type: 'addFuel', target: closestFire }; } } if (currentTrees.includes(closestResource)) return { type: 'gatherTree', target: closestResource }; if (currentRocks.includes(closestResource)) return { type: 'gatherRock', target: closestResource }; if (currentShrubs.includes(closestResource)) return { type: 'gatherShrub', target: closestResource }; if (currentDriftwood.includes(closestResource)) return { type: 'gatherDriftwood', target: closestResource }; } const iTX = Math.floor(iP.x / TILE_SIZE); const iTY = Math.floor(iP.y / TILE_SIZE); let targetTileType = currentWorld[iTY]?.[iTX]; let isNearWaterTile = targetTileType === TERRAIN_WATER || targetTileType === TERRAIN_OCEAN_WATER; if (!isNearWaterTile && targetTileType !== undefined) { const adjacent = [{x: iTX, y: iTY - 1}, {x: iTX, y: iTY + 1}, {x: iTX - 1, y: iTY}, {x: iTX + 1, y: iTY}]; for (const adj of adjacent) if (currentWorld[adj.y]?.[adj.x] === TERRAIN_WATER || currentWorld[adj.y]?.[adj.x] === TERRAIN_OCEAN_WATER) { isNearWaterTile = true; break; }} if (isNearWaterTile) { const playerFeetTileX = Math.floor(playerCX / TILE_SIZE); const playerFeetTileY = Math.floor((currentPlayer.y + currentPlayer.height) / TILE_SIZE); let isOnOrNearSandTile = currentWorld[playerFeetTileY]?.[playerFeetTileX] === TERRAIN_SAND; if(!isOnOrNearSandTile) { const adjSandCheck = [{x: playerFeetTileX, y: playerFeetTileY - 1}, {x: playerFeetTileX, y: playerFeetTileY + 1}, {x: playerFeetTileX - 1, y: playerFeetTileY}, {x: playerFeetTileX + 1, y: playerFeetTileY}]; for(const a of adjSandCheck) if(currentWorld[a.y]?.[a.x] === TERRAIN_SAND) { isOnOrNearSandTile = true; break; } } const hasRod = currentInventory.some(s => s && s.item === 'fishingRod'); if (hasRod ) { return { type: 'fish' }; } let purifierVeryCloseCheck = false; for (const p of currentFilters) if (distSq(playerCX, playerCY, p.x + p.width / 2, p.y + p.height / 2) < (TILE_SIZE * 1.5)**2) { purifierVeryCloseCheck = true; break; } if (!purifierVeryCloseCheck) { return { type: 'drinkDirtyWater' }; } } for (const shelter of currentShelters) { const shelterCenterX = shelter.x + shelter.width / 2; const shelterCenterY = shelter.y + shelter.height / 2; const shelterDef = craftableItems['shelter']; if (shelterDef && shelterDef.pickupable && distSq(iP.x, iP.y, shelterCenterX, shelterCenterY) < (TILE_SIZE * 1.2)**2 && distSq(playerCX, playerCY, shelterCenterX, shelterCenterY) < interactionRangeSquared) { return { type: 'pickupShelter', target: shelter }; } } return { type: 'none' }; }
    function performGatheringAction(interactionResult) { /* ... (gather action code unchanged) ... */ if (!interactionResult || !interactionResult.target) return false; const { trees: currentTrees, rocks: currentRocks, shrubs: currentShrubs, driftwoodPieces: currentDriftwood } = getWorldState(); const currentInventory = getInventoryState(); const target = interactionResult.target; let gathered = false; const currentDayLength = getTimeState().dayLength; if (interactionResult.type === 'gatherTree' && currentTrees.includes(target) && !target.isStump && target.totalResource > 0) { const hasAxe = currentInventory.some(s => s && s.item === 'axe'); const woodPerHit = hasAxe ? 30 : 1; const woodToGive = Math.min(woodPerHit, target.totalResource); if (woodToGive > 0) { addItemToInventory('wood', woodToGive); target.totalResource -= woodToGive; showMessage(`Chopped tree. Got ${woodToGive} wood.`, 1500); if (target.totalResource <= 0) { target.isStump = true; target.regrowTimer = 0; target.totalResource = 0; showMessage(`Tree depleted, became a stump.`, 2000); }} else { showMessage(`This tree seems depleted.`, 1500); target.isStump = true; target.regrowTimer = 0; target.totalResource = 0; } gathered = true; } else if (interactionResult.type === 'gatherTree' && currentTrees.includes(target) && target.isStump) { showMessage("It's just a stump.", 1500); gathered = true; } else if (interactionResult.type === 'gatherRock' && currentRocks.includes(target) && target.totalResource > 0) { addItemToInventory('stone', 1); target.totalResource -= 1; showMessage(`Mined stone. (${target.totalResource} left)`, 1500); gathered = true; } else if (interactionResult.type === 'gatherRock' && currentRocks.includes(target) && target.totalResource <= 0) { showMessage("This rock is depleted.", 1500); gathered = true; } else if (interactionResult.type === 'gatherShrub' && currentShrubs.includes(target) && !target.isStump) { addItemToInventory('wood', SHRUB_WOOD_YIELD); showMessage(`Cut shrub, got ${SHRUB_WOOD_YIELD} wood.`, 2000); target.isStump = true; target.regrowTimer = 0; target.stumpTimer = SHRUB_STUMP_DURATION; target.health = 0; gathered = true; } else if (interactionResult.type === 'gatherShrub' && currentShrubs.includes(target) && target.isStump) { showMessage("Already cut.", 1500); gathered = true; } else if (interactionResult.type === 'gatherDriftwood' && currentDriftwood.includes(target)) { const woodAmount = target.resourceAmount || 1; addItemToInventory('wood', woodAmount); showMessage(`Gathered driftwood, got ${woodAmount} wood.`, 2000); removeWorldObject('driftwoodPieces', target); gathered = true; } return gathered; }

    // --- Perform Interaction (Updated Fish Case) ---
    function performInteraction(interactionResult) { /* ... (code as provided in previous response, no wait message) ... */ console.log("Attempting interaction:", interactionResult); const currentPlayer = getPlayerState(); if (getIsPaused() || currentPlayer.isInsideShelter) { console.log(" Interaction blocked: Paused or Inside Shelter"); return; } const currentStats = getStatsState(); switch (interactionResult.type) { case 'addFuel': { const fire = interactionResult.target; console.log(" Interaction case: 'addFuel' for fire:", fire); const currentInventory = getInventoryState(); const currentSelectedSlot = getSelectedSlot(); const selectedItemWood = currentInventory[currentSelectedSlot]; console.log("  - Selected Item for Fuel:", selectedItemWood); if(selectedItemWood && selectedItemWood.item === 'wood' && selectedItemWood.count > 0){ console.log("  - Wood confirmed. Adding fuel..."); const fuelToAdd = Math.min(selectedItemWood.count, 10); if (typeof fire.fuel === 'undefined') fire.fuel = 0; if (typeof fire.maxFuel === 'undefined') fire.maxFuel = 100; if (typeof fire.fuelPerWood === 'undefined') fire.fuelPerWood = 5; fire.fuel = Math.min(fire.maxFuel, fire.fuel + fuelToAdd * fire.fuelPerWood); fire.isBurning = true; if (removeItemFromInventory('wood', fuelToAdd)) { console.log(`  - Removed ${fuelToAdd} wood.`); showMessage(`Added ${fuelToAdd} wood. Fuel: ${Math.ceil(fire.fuel)}/${fire.maxFuel}`, 2500); } else { console.error("  - FAILED to remove wood from inventory!"); showMessage("Error adding fuel (inventory issue?).", 2000); } } else { console.log("  - Condition failed: Not wood or count <= 0."); showMessage("Select wood to add fuel.", 2000); } } break; case 'usePurifier': currentStats.thirst = Math.min(MAX_STAT, currentStats.thirst + 40); currentStats.health = Math.min(MAX_STAT, currentStats.health + 2); updateStatsState(currentStats); showMessage("Used purifier. Drank clean water (+2 Health).", 2000); updateStatsUI(); break; case 'gatherTree': case 'gatherRock': case 'gatherShrub': case 'gatherDriftwood': performGatheringAction(interactionResult); break; case 'fish': { const playerForFish = getPlayerState(); const inventoryForFish = getInventoryState(); const hasRod = inventoryForFish.some(s => s && s.item === 'fishingRod'); if (!hasRod) { showMessage("Need a fishing rod.", 2000); break; } if (playerForFish.isFishing) { showMessage("Already fishing...", 1500); break; } if (playerForFish.fishingCooldown > 0) { break; } const isJumping = getFishAreJumping(); if (isJumping) { showMessage("Quick catch attempt!", 1500); const currentTime = getTimeState(); const fishChance = currentTime.isNight ? 0.9 : 0.7; if (Math.random() < fishChance) { if (addItemToInventory('fish', 1)) { showMessage(`Caught a fish! (Quick!)`, 2500); }} else { showMessage("Missed the jumping fish!", 2000); } playerForFish.fishingCooldown = FISHING_COOLDOWN; } else { playerForFish.isFishing = true; playerForFish.fishingTimer = 0; showMessage("Started fishing...", 2000); } } break; case 'drinkDirtyWater': currentStats.thirst = Math.min(MAX_STAT, currentStats.thirst + 15); if (Math.random() < 0.3) { currentStats.health = Math.max(0, currentStats.health - 10); showMessage("Drank dirty water. Felt unwell (-10 Health).", 2500); } else { showMessage("Drank dirty water. Risky...", 2000); } updateStatsState(currentStats); updateStatsUI(); break; case 'pickupShelter': const targetShelter = interactionResult.target; if (addItemToInventory('shelter', 1)) { removeWorldObject('shelters', targetShelter); showMessage("Picked up Shelter.", 2000); } else { showMessage("Cannot pick up shelter, inventory full!", 2500); } break; case 'none': break; default: console.warn("Unhandled interaction type:", interactionResult.type); } }

    function useSelectedItem() { /* ... (use item code unchanged) ... */ const currentPlayer = getPlayerState(); if (getIsPaused() || currentPlayer.isInsideShelter) return; const currentInventory = getInventoryState(); const currentSelectedSlot = getSelectedSlot(); const selected = currentInventory[currentSelectedSlot]; if (!selected || selected.item === 'none' || selected.count <= 0) return; const itemName = selected.item; const currentStats = getStatsState(); const { world: currentWorld, trees: currentTrees, rocks: currentRocks, shrubs: currentShrubs, driftwoodPieces: currentDriftwood, campfires: currentCampfires, shelters: currentShelters, waterFilters: currentFilters, signalFires: currentFires } = getWorldState(); if (resources[itemName] && (resources[itemName].restoresHunger || resources[itemName].heals)) { currentStats.hunger = Math.min(MAX_STAT, currentStats.hunger + (resources[itemName].restoresHunger || 0)); currentStats.health = Math.min(MAX_STAT, currentStats.health + (resources[itemName].heals || 0)); updateStatsState(currentStats); removeItemFromInventory(itemName, 1); showMessage(`Ate ${resources[itemName].name}. ${resources[itemName].heals > 0 ? `(+${resources[itemName].heals}H)` : ''}${resources[itemName].restoresHunger > 0 ? ` (+${resources[itemName].restoresHunger}Hu)` : ''}`, 2000); updateStatsUI(); return; } if (craftableItems[itemName] && craftableItems[itemName].placeable) { const itemData = craftableItems[itemName]; const placeW = itemData.width; const placeH = itemData.height; let placeX = currentPlayer.x + currentPlayer.width / 2 - placeW / 2; let placeY; const placementDist = TILE_SIZE * 0.3; switch(currentPlayer.direction) { case 'up': placeY = currentPlayer.y - placeH - placementDist; break; case 'down': placeY = currentPlayer.y + currentPlayer.height + placementDist; break; case 'left': placeX = currentPlayer.x - placeW - placementDist; placeY = currentPlayer.y + currentPlayer.height / 2 - placeH / 2; break; case 'right': placeX = currentPlayer.x + currentPlayer.width + placementDist; placeY = currentPlayer.y + currentPlayer.height / 2 - placeH / 2; break; default: placeY = currentPlayer.y + currentPlayer.height + placementDist; } let canPlace = true; const placeRect = { x: placeX, y: placeY, width: placeW, height: placeH }; const placeCenterX = placeX + placeW / 2; const placeCenterY = placeY + placeH / 2; const placeTileX = Math.floor(placeCenterX / TILE_SIZE); const placeTileY = Math.floor(placeCenterY / TILE_SIZE); const targetTileType = currentWorld[placeTileY]?.[placeTileX]; if (placeX < 0 || placeY < 0 || placeX + placeW > WORLD_WIDTH || placeY + placeH > WORLD_HEIGHT) { canPlace = false; showMessage("Cannot place outside the island bounds.", 2000); } if (canPlace && (targetTileType === TERRAIN_WATER || targetTileType === TERRAIN_OCEAN_WATER) && itemName !== 'waterPurifier') { canPlace = false; showMessage("Cannot place in water.", 2000); } if (canPlace) { const allObstacles = [ ...currentTrees.filter(t => !t.isStump), ...currentRocks, ...currentShrubs.filter(s => !s.isStump), ...currentDriftwood, ...currentCampfires, ...currentShelters, ...currentFilters, ...currentFires ]; for (const obj of allObstacles) if (checkCollision(placeRect.x, placeRect.y, placeRect.width, placeRect.height, obj.x, obj.y, obj.width, obj.height)) { canPlace = false; showMessage("Cannot place here (Obstacle).", 2000); break; } } if (canPlace && itemName === 'waterPurifier') { if (targetTileType !== TERRAIN_GRASS && targetTileType !== TERRAIN_SAND) { canPlace = false; showMessage("Purifier must be placed on land (Grass or Sand).", 2500); } if (canPlace) { let nearWaterSource = false; const checkRadiusTiles = 2; const minCheckX=Math.max(0,placeTileX-checkRadiusTiles),maxCheckX=Math.min(WORLD_WIDTH_TILES-1,placeTileX+checkRadiusTiles),minCheckY=Math.max(0,placeTileY-checkRadiusTiles),maxCheckY=Math.min(WORLD_HEIGHT_TILES-1,placeTileY+checkRadiusTiles); for(let ty=minCheckY; ty<=maxCheckY && !nearWaterSource; ty++){ for(let tx=minCheckX; tx<=maxCheckX && !nearWaterSource; tx++){ if(currentWorld[ty]?.[tx]===TERRAIN_WATER || currentWorld[ty]?.[tx]===TERRAIN_OCEAN_WATER){nearWaterSource=true;} else if(currentWorld[ty]?.[tx]===TERRAIN_SAND){const adj=[{x:tx,y:ty-1},{x:tx,y:ty+1},{x:tx-1,y:ty},{x:tx+1,y:ty}]; for(const a of adj){if(currentWorld[a.y]?.[a.x]===TERRAIN_WATER || currentWorld[a.y]?.[a.x]===TERRAIN_OCEAN_WATER){nearWaterSource=true;break;}}}}} if (!nearWaterSource) { canPlace = false; showMessage(`Place purifier closer to water.`, 2500); } } } else if (canPlace && targetTileType !== TERRAIN_GRASS) { const allowedOnSand = ['shelter', 'campfire', 'largeSignalFire']; if (!(allowedOnSand.includes(itemName) && targetTileType === TERRAIN_SAND)) { canPlace = false; showMessage(`Cannot place ${itemData.name} on ${targetTileType || 'water'}. Needs grass${allowedOnSand.includes(itemName) ? ' or sand' : ''}.`, 2500); } } if (canPlace) { const newObject = { x: placeX, y: placeY, width: placeW, height: placeH }; let objectType = null; if (itemData.isSignal) { objectType='signalFires'; newObject.isBurning = false; newObject.fuel = 0; newObject.maxFuel = 100; newObject.fuelPerWood = 5; newObject.burnRate = 0.5; } else if (itemName === 'campfire') { objectType='campfires'; } else if (itemName === 'shelter') { objectType='shelters'; } else if (itemName === 'waterPurifier') { objectType='waterFilters'; } if (objectType) { addWorldObject(objectType, newObject); removeItemFromInventory(itemName, 1); showMessage(`Placed ${itemData.name}.`, 2500); } else { showMessage("Cannot place this item type (Error).", 2000); } } return; } }
    function craftItem(event) { /* ... (craft item code unchanged) ... */ if (getIsPaused()) return; const button = event.target.closest('.craft-button'); const itemId = button?.dataset?.item; if (!itemId) return; const itemData = craftableItems[itemId]; if (!itemData) return; if (hasEnoughResources(itemData.requires)) { for (const resourceName in itemData.requires) { removeItemFromInventory(resourceName, itemData.requires[resourceName]); } addItemToInventory(itemId, 1); showMessage(`Crafted ${itemData.name}.`, 2500); updateCraftingUI(); } else { showMessage("Not enough resources.", 2000); } }


    // --- FROM leaderboard.js ---
    const LEADERBOARD_KEYS = { days: 'leaderboard_days', items: 'leaderboard_items', fish: 'leaderboard_fish' }; let leaderboardPanel = null; let lbDaysList = null; let lbItemsList = null; let lbFishList = null; let showLeaderboardTitleButton = null; let closeLeaderboardButton = null; let copyLeaderboardButton = null;
    function initializeLeaderboardUI() { /* ... (init code unchanged) ... */ leaderboardPanel = document.getElementById('leaderboard-panel'); lbDaysList = document.getElementById('lb-days'); lbItemsList = document.getElementById('lb-items'); lbFishList = document.getElementById('lb-fish'); showLeaderboardTitleButton = document.getElementById('show-leaderboard-button-title'); closeLeaderboardButton = document.getElementById('close-leaderboard'); copyLeaderboardButton = document.getElementById('copy-leaderboard-button'); if (showLeaderboardTitleButton) showLeaderboardTitleButton.addEventListener('click', displayLeaderboard); if (closeLeaderboardButton) closeLeaderboardButton.addEventListener('click', hideLeaderboard); if (copyLeaderboardButton) copyLeaderboardButton.addEventListener('click', handleCopyLeaderboard); }
    function loadLeaderboard(key) { try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : []; } catch (e) { console.error("Error loading leaderboard:", key, e); return []; } }
    function saveScoreToLeaderboard(key, playerName, scoreValue) { if (!playerName || scoreValue <= 0) return; const leaderboard = loadLeaderboard(key); const newScore = { name: playerName, score: scoreValue, date: new Date().toLocaleDateString() }; leaderboard.push(newScore); leaderboard.sort((a, b) => b.score - a.score); const trimmedLeaderboard = leaderboard.slice(0, LEADERBOARD_MAX_ENTRIES); try { localStorage.setItem(key, JSON.stringify(trimmedLeaderboard)); } catch (e) { console.error("Error saving leaderboard:", key, e); } }
    function doesScoreQualify(key, scoreValue) { if (scoreValue <= 0) return false; const leaderboard = loadLeaderboard(key); if (leaderboard.length < LEADERBOARD_MAX_ENTRIES) return true; return scoreValue > (leaderboard[leaderboard.length - 1]?.score || 0); }
    function checkAndSaveLeaderboardScores(finalStats) { /* ... (check/save code unchanged) ... */ const finalDays = finalStats.day; const finalItems = finalStats.totalItemsCollected; const finalFish = finalStats.fishCaught; let playerName = "Survivor"; const qualifiesDays = doesScoreQualify(LEADERBOARD_KEYS.days, finalDays); const qualifiesItems = doesScoreQualify(LEADERBOARD_KEYS.items, finalItems); const qualifiesFish = doesScoreQualify(LEADERBOARD_KEYS.fish, finalFish); if (qualifiesDays || qualifiesItems || qualifiesFish) { const nameInput = prompt(`New high score! Enter your name (max 15 chars):`, "Survivor"); if (nameInput) { playerName = nameInput.substring(0, 15).trim() || "Survivor"; if (qualifiesDays) saveScoreToLeaderboard(LEADERBOARD_KEYS.days, playerName, finalDays); if (qualifiesItems) saveScoreToLeaderboard(LEADERBOARD_KEYS.items, playerName, finalItems); if (qualifiesFish) saveScoreToLeaderboard(LEADERBOARD_KEYS.fish, playerName, finalFish); } else { console.log("Player cancelled name input for leaderboard."); }} }
    function displayLeaderboard() { /* ... (display code unchanged) ... */ if (!leaderboardPanel || !lbDaysList || !lbItemsList || !lbFishList) { console.error("Leaderboard UI elements not initialized correctly."); return; } const populateList = (listElement, data, unit) => { listElement.innerHTML = ''; if (data.length === 0) { listElement.innerHTML = '<li>No scores yet!</li>'; } else { data.forEach((entry, index) => { const li = document.createElement('li'); li.innerHTML = `<span class="rank">${index + 1}.</span> <span class="name">${entry.name}</span> <span class="score">${entry.score} ${unit}</span> <span class="date">${entry.date}</span>`; listElement.appendChild(li); }); }}; populateList(lbDaysList, loadLeaderboard(LEADERBOARD_KEYS.days), "Days"); populateList(lbItemsList, loadLeaderboard(LEADERBOARD_KEYS.items), "Items"); populateList(lbFishList, loadLeaderboard(LEADERBOARD_KEYS.fish), "Fish"); leaderboardPanel.style.display = 'flex'; }
    function hideLeaderboard() { /* ... (hide code unchanged) ... */ if (leaderboardPanel) leaderboardPanel.style.display = 'none'; }
    async function handleCopyLeaderboard() { /* ... (copy code unchanged) ... */ if (!copyLeaderboardButton) return; const originalButtonText = "Copy Results"; copyLeaderboardButton.disabled = true; copyLeaderboardButton.textContent = "Copying..."; try { const daysData = loadLeaderboard(LEADERBOARD_KEYS.days); const itemsData = loadLeaderboard(LEADERBOARD_KEYS.items); const fishData = loadLeaderboard(LEADERBOARD_KEYS.fish); let formattedString = "--- Survival Game Leaderboards ---\n\n"; const formatSection = (title, data, unit) => { let sectionString = `== ${title} ==\n`; if (data.length === 0) { sectionString += "(No scores yet)\n"; } else { data.forEach((entry, index) => { sectionString += `${index + 1}. ${entry.name} - ${entry.score} ${unit} (${entry.date || 'N/A'})\n`; }); } return sectionString + "\n"; }; formattedString += formatSection("Longest Survived", daysData, "Days"); formattedString += formatSection("Most Items Collected", itemsData, "Items"); formattedString += formatSection("Most Fish Caught", fishData, "Fish"); formattedString += "--------------------------------"; await navigator.clipboard.writeText(formattedString); copyLeaderboardButton.textContent = "Copied!"; console.log("Leaderboard copied to clipboard."); } catch (err) { console.error('Failed to copy leaderboard: ', err); copyLeaderboardButton.textContent = "Copy Failed"; } finally { setTimeout(() => { if (copyLeaderboardButton) { copyLeaderboardButton.textContent = originalButtonText; copyLeaderboardButton.disabled = false; }}, 2000); } }


// --- FROM main.js ---
    // The main entry point and orchestrator for the game.

    let canvas = null;
    let ctx = null;
    let gameContainer = null;
    let gameOverScreen = null;
    let gameOverTitle = null;
    let daysSurvivedText = null;
    let backgroundAudio = null;
    let titleScreen = null;
    let startButton = null;
    let restartButton = null;

    let gameStarted = false;
    let gameOver = false;
    let rescued = false;
    let isPaused = false;
    let player = {};
    let stats = {};
    let inventory = [];
    let selectedSlot = 0;
    let inventoryStartIndex = 0;
    let time = {};
    let keys = {};
    let hintFlags = {};
    let lastTime = 0;
    let currentInteractionTargetInfo = { type: 'none' };
    let fishAreJumping = false;
    let fishJumpingTimer = 0;
    let playerOnLandTimer = 0; // Timer for despawning shark

    // Shark State Object
    let shark = {
        active: false, x: 0, y: 0, targetX: 0, targetY: 0,
        speed: SHARK_SPEED,
        isChasing: false,
        isLingering: false, // <<< NEW: Flag for lingering state
        lingerTimer: 0,     // <<< NEW: Timer for lingering duration
        lastSeenPlayerX: 0, // <<< NEW: Store last known player pos when escape happens
        lastSeenPlayerY: 0, // <<< NEW: Store last known player pos when escape happens
        cooldownTimer: 0,
        dx:0, dy:0
    };

    // --- State Getters/Setters ---
    function getGameState() { return { gameStarted, gameOver, isPaused, rescued }; }
    function getIsPaused() { return isPaused; }
    function getIsGameOver() { return gameOver; }
    function getPlayerState() { return player; }
    function setPlayerState(newState) { player = newState; }
    function getStatsState() { return stats; }
    function updateStatsState(newStats) { stats = newStats; }
    function getInventoryState() { return inventory; }
    function setInventoryState(newState) { inventory = newState; }
    function getSelectedSlot() { return selectedSlot; }
    function setSelectedSlot(newSlot) { selectedSlot = newSlot; }
    function getInventoryStartIndex() { return inventoryStartIndex; }
    function setInventoryStartIndex(newIndex) { inventoryStartIndex = newIndex; }
    function getTimeState() { return time; }
    function getKeys() { return keys; }
    function getHintFlags() { return hintFlags; }
    function getFishAreJumping() { return fishAreJumping; }
    function getSharkState() { return shark; }


    // --- Initialization ---
    function initGame() { /* ... (init code unchanged) ... */ console.log("Script loaded, initializing game..."); canvas = document.getElementById('game-canvas'); if (!canvas) { console.error("Canvas element not found!"); return; } ctx = canvas.getContext('2d'); if (!ctx) { console.error("Could not get canvas context!"); return; } canvas.width = WORLD_WIDTH; canvas.height = WORLD_HEIGHT; gameContainer = document.getElementById('game-container'); gameOverScreen = document.getElementById('game-over'); gameOverTitle = document.getElementById('game-over-title'); daysSurvivedText = document.getElementById('days-survived'); backgroundAudio = document.getElementById('background-audio'); titleScreen = document.getElementById('title-screen'); startButton = document.getElementById('start-button'); restartButton = document.getElementById('restart-button'); initializeInventoryUI(); initializeGeneralUI(); initializeLeaderboardUI(); console.log("Preparing game."); prepareGame(); setupEventListeners(); generateCraftingButtons(); }
    function setupEventListeners() { /* ... (event listener code unchanged) ... */ document.addEventListener('keydown', handleKeyDown); document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; }); if(startButton) startButton.addEventListener('click', startGame); if(restartButton) restartButton.addEventListener('click', restartGame); if(canvas) canvas.addEventListener('click', handleCanvasClick); }
    function handleKeyDown(e) {
        const keyLower = e.key.toLowerCase();

        // Pause Handling
        if (keyLower === 'p') {
            if (gameStarted && !gameOver) { togglePause(); e.preventDefault(); }
            return;
        }
        if (isPaused) {
            if (keyLower === 'p') resumeGame();
            return;
        }

        // Set key state (do this early so other handlers can potentially read it if needed)
        keys[keyLower] = true;

        // Escape Key Handling
        if (keyLower === 'escape') {
            const helpPanelElem = document.getElementById('help-panel');
            const lbPanelElem = document.getElementById('leaderboard-panel');
            const craftPanelElem = document.getElementById('crafting-panel');
            if (helpPanelElem && helpPanelElem.style.display === 'flex') { hideHelpPanel(); e.preventDefault(); return; }
            if (lbPanelElem && lbPanelElem.style.display === 'flex') { hideLeaderboard(); e.preventDefault(); return; }
            if (craftPanelElem && craftPanelElem.style.display === 'flex') { closeCraftingMenu(); e.preventDefault(); return; }
            // Optionally: Pressing Escape could also cancel auto-walk
            // if (player.isAutoWalking) {
            //      console.log("[KeyDown] Cancelling Auto-Walk via Escape.");
            //      player.isAutoWalking = false; player.autoWalkTargetX = null; player.autoWalkTargetY = null; player.autoWalkTargetObject = null;
            //      showMessage("Stopped walking.", 1500); return;
            // }
        }

        // Block input if game not ready
        if (!gameStarted || gameOver) {
            return;
        }

        // --- NEW: Block most input if Auto-Walking ---
        // Allow only essential keys like 'P' (pause) or 'Escape' (handled above)
        if (player.isAutoWalking) {
             // Check if the pressed key is NOT pause or escape
             if (keyLower !== 'p' && keyLower !== 'escape') {
                 // Optionally allow 'E' or other keys to cancel?
                 // If not, just ignore other key presses during auto-walk
                 return;
             }
             // Allow pause/escape processing to continue if needed
        }
        // --- End Auto-Walk Block ---


        // 'E' Key Interaction Handling (Only if NOT auto-walking)
        if (keyLower === 'e') {
            if (!player.isInsideShelter) { // Can only interact if outside
                 performInteraction(currentInteractionTargetInfo);
            }
            // Note: 'E' to exit shelter was removed, click is used now.
            return; // Stop processing other keys after handling 'E'
        }

        // Block Movement Keys if Inside Shelter (Redundant if Auto-Walk block is active, but safe)
        if (player.isInsideShelter) {
            const moveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
            if (moveKeys.includes(keyLower)) {
                return;
            }
        }

        // --- Inventory Slot Selection --- (Allow even if auto-walking? Maybe not.)
        if (e.key >= '1' && e.key <= String(VISIBLE_INVENTORY_SLOTS)) {
             if (!player.isAutoWalking) { // Prevent slot change during auto-walk
                 const targetAbsoluteIndex = inventoryStartIndex + parseInt(e.key) - 1;
                 selectInventorySlot(targetAbsoluteIndex);
             }
            return;
        }

        // --- Crafting Menu Toggle ('C') --- (Allow even if auto-walking? Maybe not.)
        if (keyLower === 'c') {
             if (!player.isAutoWalking) { // Prevent opening crafting during auto-walk
                toggleCraftingMenu();
             }
            return;
        }

        // --- Use Selected Item ('Space') --- (Allow even if auto-walking? Probably not.)
        if (e.key === ' ') {
             if (!player.isAutoWalking) { // Prevent using item during auto-walk
                 e.preventDefault();
                 useSelectedItem();
             }
            return;
        }

        // If the key wasn't handled, `keys[keyLower] = true` remains for manual movement check
        // But `updatePlayerMovement` will ignore it if `isAutoWalking` is true.

    } // End handleKeyDown

      
    function handleCanvasClick(event) {
        // Debounce entry
        if (isProcessingClick) return;
        isProcessingClick = true;
        setTimeout(() => { isProcessingClick = false; }, 100);

        if (!gameStarted || gameOver || isPaused || !canvas) return;

        // Calculate click coordinates relative to canvas scale
        const rect = canvas.getBoundingClientRect();
        const scale = (rect.width && canvas.width) ? rect.width / canvas.width : 1;
        const clickX = (event.clientX - rect.left) / scale;
        const clickY = (event.clientY - rect.top) / scale;

        const { shelters: currentShelters } = getWorldState();
        let clickedShelterObject = null;

        // Check if click hit any valid shelter object
        for (const shelter of currentShelters) {
            if (shelter && typeof shelter.x === 'number' && typeof shelter.y === 'number' && shelter.width > 0 && shelter.height > 0) {
                if (checkCollision(clickX, clickY, 1, 1, shelter.x, shelter.y, shelter.width, shelter.height)) {
                    clickedShelterObject = shelter;
                    break;
                }
            }
        }

        // --- Logic based on whether a shelter was clicked ---
        if (clickedShelterObject) {
            // --- Clicked ON a shelter ---
            if (!player.isInsideShelter && !player.isAutoWalking) {
                 // Action: START Auto-Walk to Shelter
                 console.log("[Click Action] Starting Auto-Walk to shelter.");
                 player.isAutoWalking = true;
                 player.autoWalkTargetObject = clickedShelterObject;
                 // Calculate target position slightly below the shelter entrance visually
                 player.autoWalkTargetX = clickedShelterObject.x + clickedShelterObject.width / 2; // Center X
                 player.autoWalkTargetY = clickedShelterObject.y + clickedShelterObject.height - (player.height / 3); // Point near bottom edge
                 // Alternative: Target slightly below shelter footprint
                 // player.autoWalkTargetY = clickedShelterObject.y + clickedShelterObject.height + 5;

                 hideInteractionPrompt();
                 currentInteractionTargetInfo = { type: 'none' };
                 showMessage("Walking to shelter...", 2000);
                 updateTooltip();
                 return; // Stop further processing

            } else if (player.isInsideShelter === clickedShelterObject) {
                 // Action: Exit by clicking the *same* shelter again (Instant)
                 console.log("[Click Action] Exiting shelter (re-click).");
                 const exitedShelter = player.isInsideShelter;
                 player.isInsideShelter = false;
                 player.alpha = 1.0;
                 if(exitedShelter) player.y = exitedShelter.y + exitedShelter.height + 2; // Position below
                 showMessage("Exited shelter.", 2000);
                 hideInteractionPrompt();
                 currentInteractionTargetInfo = { type: 'none' };
                 updateTooltip();
                 return; // Stop further processing

            } else if (player.isInsideShelter && player.isInsideShelter !== clickedShelterObject) {
                 // Action: Switch Shelters (Instant)
                 console.log("[Click Action] Switching shelters.");
                 const exitedShelter = player.isInsideShelter;
                 if(exitedShelter) player.y = exitedShelter.y + exitedShelter.height + 2; // Position below old
                 player.isInsideShelter = clickedShelterObject; // Enter new state
                 player.alpha = SHELTER_ALPHA;
                 showMessage("Switched shelters.", 2000);
                 player.x = clickedShelterObject.x + clickedShelterObject.width / 2 - player.width / 2; // Center in new
                 player.y = clickedShelterObject.y + clickedShelterObject.height / 2 - player.height / 2;
                 hideInteractionPrompt();
                 currentInteractionTargetInfo = { type: 'none' };
                 updateTooltip();
                 return; // Stop further processing
            }
            // Implicitly ignore click if already auto-walking to this shelter

        } else {
             // --- Clicked OFF a shelter ---
            if (player.isInsideShelter) {
                // Action: Exit by clicking outside (Instant)
                console.log("[Click Action] Exiting shelter (click off).");
                const exitedShelter = player.isInsideShelter;
                player.isInsideShelter = false;
                player.alpha = 1.0;
                if(exitedShelter) player.y = exitedShelter.y + exitedShelter.height + 2; // Position below
                showMessage("Exited shelter.", 2000);
                hideInteractionPrompt();
                currentInteractionTargetInfo = { type: 'none' };
                updateTooltip();
                return;
            } else if (player.isAutoWalking) {
                 // Action: Cancel Auto-Walk by clicking elsewhere
                 console.log("[Click Action] Cancelling Auto-Walk.");
                 player.isAutoWalking = false;
                 player.autoWalkTargetX = null;
                 player.autoWalkTargetY = null;
                 player.autoWalkTargetObject = null;
                 showMessage("Stopped walking.", 1500);
                 return;
             }
             // Else: Clicked outside while already outside/not auto-walking - do nothing
        }
    } // End handleCanvasClick

    

    function prepareGame() { /* ... (prepare code unchanged) ... */ resetGameState(); if(titleScreen) titleScreen.style.display = 'flex'; if(gameOverScreen) gameOverScreen.style.display = 'none'; hideLeaderboard(); hideHelpPanel(); hidePausePopup(); }
    function startGame() { /* ... (start code unchanged) ... */ hideLeaderboard(); hidePausePopup(); console.log("startGame function called!"); if(titleScreen) titleScreen.style.display = 'none'; gameStarted = true; isPaused = false; gameOver = false; rescued = false; showMessage("Washed ashore... Need food, water, and shelter. Gather resources (E) and check crafting (C).", 6000); lastTime = 0; if (backgroundAudio && backgroundAudio.paused) { backgroundAudio.play().catch(e => console.error("Audio play failed:", e)); } requestAnimationFrame(gameLoop); }
    function restartGame() { /* ... (restart code unchanged) ... */ gameStarted = false; gameOver = false; isPaused = false; rescued = false; prepareGame(); }

    // --- Updated resetGameState ---
    function resetGameState() {
        gameStarted = false; gameOver = false; rescued = false; isPaused = false;
        const spawnPos = generateWorld();
        player = initializePlayer(spawnPos.x, spawnPos.y);
        player.isFishing = false; player.fishingTimer = 0; player.fishingCooldown = 0;
        player.shadeRegenMessageCooldown = 0; // <<< ADDED: Ensure reset here too

        stats = { health: MAX_STAT, hunger: MAX_STAT, thirst: MAX_STAT, day: 1, totalItemsCollected: 0, fishCaught: 0 };
        inventory = []; selectedSlot = 0; inventoryStartIndex = 0;
        time = { current: 0, dayLength: 120, isNight: false, dayStartFactor: 0.0, morningStartFactor: 0.15, afternoonStartFactor: 0.4, eveningStartFactor: 0.7, nightStartFactor: 0.85 };
        keys = {}; hintFlags = { firstStone: false, nightWarning: false, lowHealth: false, lowHunger: false, lowThirst: false, shelterPlaced: false, purifierPlaced: false };
        fishAreJumping = false; fishJumpingTimer = 0;
        lastTime = 0; currentInteractionTargetInfo = { type: 'none' };
        playerOnLandTimer = 0; // Reset timer

        // Reset shark state
        shark = {
            active: false, x: 0, y: 0, targetX: 0, targetY: 0,
            speed: SHARK_SPEED,
            isChasing: false,
            isLingering: false, // << RESET
            lingerTimer: 0,     // << RESET
            lastSeenPlayerX: 0, // << RESET
            lastSeenPlayerY: 0, // << RESET
            cooldownTimer: 0,
            dx:0, dy:0
        };

        // <<< ADDED: Reset fish animation state >>>
        jumpingFishAnimation = {
            active: false, x: 0, startY: 0, progress: 0,
            duration: 0.7, maxHeight: TILE_SIZE * 1.2
        };

        generateInventorySlots(); updateStatsUI(); updateDayNightIndicator(); closeCraftingMenu();
        hideInteractionPrompt(); hideTooltip();
        if (backgroundAudio && !backgroundAudio.paused) { backgroundAudio.pause(); backgroundAudio.currentTime = 0; }
        // Reset calculated shadows on trees if they persist (though world gen should handle this)
        getWorldState().trees.forEach(t => { t.currentShadow = null; t.isShadingPlayer = false; });
    }

    function togglePause() { /* ... (toggle code unchanged) ... */ if (isPaused) resumeGame(); else pauseGame(); }
    function pauseGame() { /* ... (pause code unchanged) ... */ if (isPaused || !gameStarted || gameOver) return; console.log("Pausing Game"); isPaused = true; showPausePopup(); if (backgroundAudio && !backgroundAudio.paused) backgroundAudio.pause(); hideTooltip(); hideInteractionPrompt(); }
    function resumeGame() { /* ... (resume code unchanged) ... */ if (!isPaused) return; console.log("Resuming Game"); isPaused = false; hidePausePopup(); if (gameStarted && !gameOver && backgroundAudio) { backgroundAudio.play().catch(error => console.warn("Audio resume failed:", error)); } requestAnimationFrame(() => { lastTime = performance.now(); requestAnimationFrame(gameLoop); }); }
    function goToMainMenu() { /* ... (main menu code unchanged) ... */ console.log("Returning to Main Menu..."); gameStarted = false; gameOver = false; isPaused = false; rescued = false; if (backgroundAudio && !backgroundAudio.paused) { backgroundAudio.pause(); backgroundAudio.currentTime = 0; } prepareGame(); }
    function triggerRescue() { /* ... (rescue code unchanged) ... */ if (gameOver) return; gameOver = true; rescued = true; if (backgroundAudio && !backgroundAudio.paused) backgroundAudio.pause(); checkAndSaveLeaderboardScores(stats); showMessage("You hear an airplane overhead! They've spotted your fire!", 5000); setTimeout(() => { if(gameOverTitle) { gameOverTitle.textContent = "Rescued!"; gameOverTitle.style.color = '#8cc751'; } if(daysSurvivedText) daysSurvivedText.innerHTML = `You survived for ${stats.day} days!<br>Collected ${stats.totalItemsCollected} items.<br>Caught ${stats.fishCaught} fish.`; if(gameOverScreen) gameOverScreen.style.display = 'flex'; setTimeout(displayLeaderboard, 1500); }, 4000); }

    // Reset fish animation state
    jumpingFishAnimation = {
        active: false, x: 0, startY: 0, progress: 0,
        duration: 0.7, maxHeight: TILE_SIZE * 1.2
    };

    // --- NEW Shark Attack Game Over ---
    function triggerSharkAttackGameOver() { /* ... (code as provided previously) ... */ if (gameOver) return; console.log("GAME OVER: Shark Attack!"); gameOver = true; rescued = false; if (backgroundAudio && !backgroundAudio.paused) backgroundAudio.pause(); checkAndSaveLeaderboardScores(stats); showMessage("Attacked by a shark!", 5000); if(gameOverTitle) { gameOverTitle.textContent = "Devoured!"; gameOverTitle.style.color = '#ff0000'; } if(daysSurvivedText) { daysSurvivedText.innerHTML = `You survived for ${stats.day} days... until the shark got you.<br>Collected ${stats.totalItemsCollected} items.<br>Caught ${stats.fishCaught} fish.`; } setTimeout(() => { if(gameOverScreen) gameOverScreen.style.display = 'flex'; setTimeout(displayLeaderboard, 1500); }, 1000); }

// --- Updated checkGameOver ---
function checkGameOver() {
    if (gameOver) return; // Already game over

    let gameOverReason = null;
    let deathCauseMessage = "";

    // Check which stat caused the game over
    if (stats.health <= 0) {
        gameOverReason = "health";
        deathCauseMessage = "Your health reached zero.";
    } else if (stats.hunger <= 0) {
        gameOverReason = "hunger";
        deathCauseMessage = "You succumbed to hunger.";
    } else if (stats.thirst <= 0) {
        gameOverReason = "thirst";
        deathCauseMessage = "You succumbed to thirst.";
    }

    // If any reason was found, trigger game over
    if (gameOverReason) {
        gameOver = true;
        rescued = false; // Ensure rescued flag is false
        if (backgroundAudio && !backgroundAudio.paused) backgroundAudio.pause();
        checkAndSaveLeaderboardScores(stats);

        let gameOverTitleText = "Game Over"; // Default title

        // Customize title based on reason
        switch(gameOverReason) {
            case "health": gameOverTitleText = "Died from Negligence"; break;
            case "hunger": gameOverTitleText = "Starved"; break;
            case "thirst": gameOverTitleText = "Dehydrated"; break;
        }


        if(gameOverTitle) {
            gameOverTitle.textContent = gameOverTitleText;
            gameOverTitle.style.color = '#ff4d4d'; // Keep red color
        }
        if(daysSurvivedText) {
            // Update the text to include the cause
            daysSurvivedText.innerHTML = `You survived for ${stats.day} days.<br>${deathCauseMessage}<br>Collected ${stats.totalItemsCollected} items.<br>Caught ${stats.fishCaught} fish.`;
        }
        if(gameOverScreen) {
            gameOverScreen.style.display = 'flex';
        }
        showMessage(deathCauseMessage, 4000); // Show the specific cause message
        setTimeout(displayLeaderboard, 1500); // Show leaderboard after a delay
    }
}

    // --- Helper Functions (Including Shark Helpers) ---
    function getDistanceToNearestLand(px, py) {
        const { world: currentWorld } = getWorldState();
        const startTileX = Math.floor(px / TILE_SIZE);
        const startTileY = Math.floor(py / TILE_SIZE);
        const maxSearchRadius = 20; // Increased radius slightly just in case

        // --- Check if starting point is already land ---
        const startTileType = currentWorld[startTileY]?.[startTileX];
        if (startTileType === TERRAIN_GRASS || startTileType === TERRAIN_SAND) {
            return 0; // Already on land
        }
        // --- If starting point is not water, something is wrong (or outside map), return large distance ---
         if (startTileType !== TERRAIN_WATER && startTileType !== TERRAIN_OCEAN_WATER) {
             // console.warn(`getDistanceToNearestLand called from non-water tile? Type: ${startTileType} at ${startTileX},${startTileY}`);
             return Infinity; // Not starting in valid water
         }


        // Perform expanding search outwards
        for (let r = 1; r <= maxSearchRadius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                // Check only the perimeter of the square defined by radius r
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // Skip interior points

                    const checkX = startTileX + dx;
                    const checkY = startTileY + dy;

                    // Check map bounds
                    if (checkX < 0 || checkX >= WORLD_WIDTH_TILES || checkY < 0 || checkY >= WORLD_HEIGHT_TILES) {
                        continue; // Skip checks outside the map
                    }

                    // --- Check if the neighboring tile is land ---
                    const tileType = currentWorld[checkY]?.[checkX];
                    if (tileType === TERRAIN_GRASS || tileType === TERRAIN_SAND) {
                        // Found land, calculate distance from original point (px, py) to the center of this land tile
                        const tileCenterX = checkX * TILE_SIZE + TILE_SIZE / 2;
                        const tileCenterY = checkY * TILE_SIZE + TILE_SIZE / 2;
                        return dist(px, py, tileCenterX, tileCenterY);
                    }
                }
            }
        }

        // If no land found within search radius, return Infinity
        // console.warn(`getDistanceToNearestLand: No land found within ${maxSearchRadius} tiles of ${px.toFixed(0)},${py.toFixed(0)}`);
        return Infinity;
    }
// MODIFIED: Finds random OCEAN water tile far from land
function findRandomDeepWaterTile(minDistanceTilesFromLand = SHARK_SPAWN_DISTANCE_TILES + 2) {
    const { world: currentWorld } = getWorldState();
    let attempts = 0;
    const maxAttempts = 200; // Increase attempts as ocean might be smaller %

    while (attempts < maxAttempts) {
        const tx = Math.floor(Math.random() * WORLD_WIDTH_TILES);
        const ty = Math.floor(Math.random() * WORLD_HEIGHT_TILES);

        // --- OCEAN WATER CHECK ---
        // Check if the random tile is specifically OCEAN water
        const tileType = currentWorld[ty]?.[tx];
        if (tileType === TERRAIN_OCEAN_WATER) { // << ONLY OCEAN
            const tileCenterX = tx * TILE_SIZE + TILE_SIZE / 2;
            const tileCenterY = ty * TILE_SIZE + TILE_SIZE / 2;

            // Check distance from this potential OCEAN tile to the nearest land
            if (getDistanceToNearestLand(tileCenterX, tileCenterY) > minDistanceTilesFromLand * TILE_SIZE) {
                // console.log(`findRandomDeepWaterTile found suitable OCEAN spot at ${tx},${ty}`); // Debug
                return { x: tileCenterX, y: tileCenterY }; // Found suitable OCEAN tile
            }
        }
        attempts++;
    }

    console.warn("Could not find OCEAN water tile far from land after", maxAttempts, "attempts. Trying world center ocean tile as fallback.");

     // Fallback: Try center explicitly - check if IT is ocean and far enough
     const centerTX = Math.floor(WORLD_WIDTH_TILES / 2);
     const centerTY = Math.floor(WORLD_HEIGHT_TILES / 2);
     if (currentWorld[centerTY]?.[centerTX] === TERRAIN_OCEAN_WATER) {
         const centerPX = centerTX * TILE_SIZE + TILE_SIZE / 2;
         const centerPY = centerTY * TILE_SIZE + TILE_SIZE / 2;
         if (getDistanceToNearestLand(centerPX, centerPY) > minDistanceTilesFromLand * TILE_SIZE) {
             console.log("Using center ocean tile as fallback.");
             return { x: centerPX, y: centerPY };
         }
     }

     console.error("CRITICAL: Could not find ANY suitable ocean tile for shark. Returning map center coordinate.");
     // Absolute fallback if center doesn't work either
    return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
}

    // --- Shark Logic Functions ---
    function updateSharkSpawning(deltaTime) {
        if (shark.active || gameOver || isPaused) {
            return;
        }

        const { world: currentWorld } = getWorldState();
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const playerTileX = Math.floor(playerCenterX / TILE_SIZE);
        const playerTileY = Math.floor(playerCenterY / TILE_SIZE);

        // Player must be specifically in OCEAN water
        const playerTileType = currentWorld[playerTileY]?.[playerTileX];
        if (playerTileType !== TERRAIN_OCEAN_WATER) {
            return; // Only spawn if player is in the ocean
        }

        // Check distance to nearest land
        const distanceToLand = getDistanceToNearestLand(playerCenterX, playerCenterY);
        const triggerDistance = SHARK_SPAWN_DISTANCE_TILES * TILE_SIZE;

        // Check if player is far enough from land
        if (distanceToLand > triggerDistance) {
            // Check probability
            if (Math.random() < SHARK_SPAWN_CHANCE) {
                console.log(`%cSHARK SPAWN TRIGGERED! (Player in OCEAN, Dist to land: ${distanceToLand.toFixed(1)} > ${triggerDistance})`, "color: red; font-weight: bold;");

                // --- Player-Centric Spawn Location Logic ---
                let spawnX = -1, spawnY = -1;
                let spawnAttempts = 0;
                const maxSpawnAttempts = 50; // Limit attempts to find a spot near player

                // Define spawn radius around the player (in pixels)
                const minSpawnRadius = SHARK_DETECTION_RANGE * 1.5; // Spawn outside detection range initially
                const maxSpawnRadius = minSpawnRadius * 1.8;      // But not excessively far

                while (spawnAttempts < maxSpawnAttempts && spawnX === -1) {
                    // Generate a random angle and distance within the desired radius
                    const angle = Math.random() * Math.PI * 2;
                    const radius = minSpawnRadius + Math.random() * (maxSpawnRadius - minSpawnRadius);

                    const potentialX = playerCenterX + Math.cos(angle) * radius;
                    const potentialY = playerCenterY + Math.sin(angle) * radius;

                    // Check bounds (ensure potential point is within the world)
                    if (potentialX < 0 || potentialX >= WORLD_WIDTH || potentialY < 0 || potentialY >= WORLD_HEIGHT) {
                        spawnAttempts++;
                        continue; // Skip if point is outside world
                    }

                    const potentialTileX = Math.floor(potentialX / TILE_SIZE);
                    const potentialTileY = Math.floor(potentialY / TILE_SIZE);
                    const potentialTileType = currentWorld[potentialTileY]?.[potentialTileX];

                    // Check if the potential spawn tile is OCEAN water
                    if (potentialTileType === TERRAIN_OCEAN_WATER) {
                        // Check if this ocean tile is ALSO far enough from land
                        const spawnDistToLand = getDistanceToNearestLand(potentialX, potentialY);
                        // Use a slightly lower threshold here, as player is already far out
                        const minSpawnLandDist = (SHARK_SPAWN_DISTANCE_TILES -1) * TILE_SIZE;

                        if (spawnDistToLand > minSpawnLandDist) {
                            // Valid spot found!
                            spawnX = potentialX;
                            spawnY = potentialY;
                            console.log(`Shark spawning near player at ${spawnX.toFixed(0)},${spawnY.toFixed(0)} (Dist: ${radius.toFixed(0)})`);
                        }
                    }
                    spawnAttempts++;
                } // End while loop

                // --- Fallback if no suitable spot near player is found ---
                if (spawnX === -1) {
                    console.warn("Could not find suitable OCEAN spot near player, using random deep water fallback.");
                    const fallbackPoint = findRandomDeepWaterTile(SHARK_SPAWN_DISTANCE_TILES + 1); // Use the original random finder
                     // Basic check if fallback worked
                     if (fallbackPoint.x === WORLD_WIDTH / 2 && fallbackPoint.y === WORLD_HEIGHT / 2 && currentWorld[Math.floor(fallbackPoint.y/TILE_SIZE)]?.[Math.floor(fallbackPoint.x/TILE_SIZE)] !== TERRAIN_OCEAN_WATER) {
                         console.error("CRITICAL: Fallback spawn failed. No shark spawned.");
                         return; // Abort if fallback is bad
                     }
                     spawnX = fallbackPoint.x;
                     spawnY = fallbackPoint.y;
                }
                // --- End Spawn Location Logic ---


                // Set shark state
                shark.active = true;
                shark.isChasing = false; // Start by patrolling towards player's area
                shark.cooldownTimer = 0; // No cooldown initially
                shark.x = spawnX;
                shark.y = spawnY;

                // Set initial patrol target towards the player's current area
                // (or a random point if using fallback)
                 if (spawnAttempts < maxSpawnAttempts) { // If spawned near player
                     // Target slightly AHEAD of the player initially? Or just player pos?
                     // Let's target player pos initially, detection will handle chase.
                     shark.targetX = playerCenterX;
                     shark.targetY = playerCenterY;
                 } else { // If used fallback random position
                     const patrolTarget = findRandomDeepWaterTile(); // Get another random deep point
                     shark.targetX = patrolTarget.x;
                     shark.targetY = patrolTarget.y;
                 }

                shark.dx = 0;
                shark.dy = 0;

                showMessage("You sense a large presence nearby in the OCEAN...", 3000);

            } // End random chance check
        } // End distance check
    }


    // Revised updateSharkBehavior - With Linger Logic
    function updateSharkBehavior(deltaTime) {
        if (!shark.active || gameOver || isPaused) {
            if (shark.active) shark.active = false;
            return;
        }

        // --- Cooldown and Linger Timers ---
        if (shark.cooldownTimer > 0) {
            shark.cooldownTimer -= deltaTime;
            if (shark.cooldownTimer < 0) shark.cooldownTimer = 0;
        }
        if (shark.isLingering && shark.lingerTimer > 0) {
            shark.lingerTimer -= deltaTime;
            if (shark.lingerTimer <= 0) {
                console.log("Shark finished lingering.");
                shark.isLingering = false;
                // Find a new random patrol point AFTER lingering
                const newTarget = findRandomDeepWaterTile();
                shark.targetX = newTarget.x;
                shark.targetY = newTarget.y;
            }
        }

        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const { world: currentWorld } = getWorldState();

        // Player Location Check
        const playerTileX = Math.floor(playerCenterX / TILE_SIZE);
        const playerTileY = Math.floor(playerCenterY / TILE_SIZE);
        const playerTileType = currentWorld[playerTileY]?.[playerTileX];
        const isPlayerInOcean = playerTileType === TERRAIN_OCEAN_WATER;
        const isPlayerSafe = !isPlayerInOcean;

        const distToPlayerSq = distSq(shark.x, shark.y, playerCenterX, playerCenterY);

        // --- State Logic ---
        if (shark.isChasing) {
            shark.targetX = playerCenterX; // Target player while chasing
            shark.targetY = playerCenterY;

            const loseSightRangeSq = (SHARK_DETECTION_RANGE * SHARK_LOSE_SIGHT_RANGE_MULTIPLIER) ** 2;

            // --- STOP Chasing Condition ---
            if (distToPlayerSq > loseSightRangeSq || isPlayerSafe) {
                const reason = distToPlayerSq > loseSightRangeSq ? "distance" : "player reached safe zone";
                console.log(`Shark stopped chasing player (${reason}).`);
                shark.isChasing = false;
                shark.cooldownTimer = SHARK_COOLDOWN; // Cooldown before re-detecting

                // --- START LINGERING ---
                if (isPlayerSafe) { // Only linger if player escaped to safety
                    console.log("Shark starting to linger near escape point.");
                    shark.isLingering = true;
                    shark.lingerTimer = 5.0 + Math.random() * 5.0; // Linger for 5-10 seconds
                    // Store where player was last seen (slightly offset into water maybe)
                    shark.lastSeenPlayerX = shark.targetX; // Use shark's last target (player pos)
                    shark.lastSeenPlayerY = shark.targetY;

                    // Set initial linger target near last seen pos but slightly random
                    const lingerRadius = TILE_SIZE * 3; // Patrol within this radius
                    const angle = Math.random() * Math.PI * 2;
                    shark.targetX = shark.lastSeenPlayerX + Math.cos(angle) * lingerRadius;
                    shark.targetY = shark.lastSeenPlayerY + Math.sin(angle) * lingerRadius;
                     // Simple bounds check for linger target
                     shark.targetX = Math.max(TILE_SIZE, Math.min(shark.targetX, WORLD_WIDTH - TILE_SIZE));
                     shark.targetY = Math.max(TILE_SIZE, Math.min(shark.targetY, WORLD_HEIGHT - TILE_SIZE));

                } else { // Lost sight due to distance, don't linger, just patrol randomly
                    shark.isLingering = false;
                    const newTarget = findRandomDeepWaterTile();
                    shark.targetX = newTarget.x;
                    shark.targetY = newTarget.y;
                }
                 // --- END LINGERING ---

            }
             // --- Attack Check (nested inside chasing) ---
             else { // Only check attack if STILL chasing
                 const attackRangeSq = SHARK_ATTACK_RANGE ** 2;
                 if (distSq(shark.x, shark.y, playerCenterX, playerCenterY) < attackRangeSq) {
                      const currentPlayerTileTypeAttack = currentWorld[playerTileY]?.[playerTileX];
                      if (currentPlayerTileTypeAttack === TERRAIN_OCEAN_WATER) {
                         console.log("%cShark Attack!", "color: red; font-size: 1.2em; font-weight: bold;");
                         triggerSharkAttackGameOver();
                         return;
                      } else {
                         console.log("Player reached safe zone AT MOMENT of attack, attack averted.");
                         // State transition (stop chasing, start lingering) handled by the main check above
                         // Ensure state is consistent if somehow missed
                         if (shark.isChasing) {
                              shark.isChasing = false;
                              shark.isLingering = true; // Start lingering even if attack missed due to last moment escape
                              shark.lingerTimer = 5.0 + Math.random() * 5.0;
                              shark.lastSeenPlayerX = playerCenterX;
                              shark.lastSeenPlayerY = playerCenterY;
                              // Set initial linger target
                               const lingerRadius = TILE_SIZE * 3;
                               const angle = Math.random() * Math.PI * 2;
                               shark.targetX = shark.lastSeenPlayerX + Math.cos(angle) * lingerRadius;
                               shark.targetY = shark.lastSeenPlayerY + Math.sin(angle) * lingerRadius;
                               shark.targetX = Math.max(TILE_SIZE, Math.min(shark.targetX, WORLD_WIDTH - TILE_SIZE));
                               shark.targetY = Math.max(TILE_SIZE, Math.min(shark.targetY, WORLD_HEIGHT - TILE_SIZE));

                              shark.cooldownTimer = SHARK_COOLDOWN; // Still apply cooldown
                         }
                      }
                 }
             } // End attack check block

        }
        // --- Lingering State ---
        else if (shark.isLingering) {
             // Check if player comes back into detection range WHILE lingering
             const detectionRangeSq = SHARK_DETECTION_RANGE ** 2;
             if (distToPlayerSq < detectionRangeSq && isPlayerInOcean && shark.cooldownTimer <= 0) {
                 console.log("Shark re-detected player while lingering! Resuming chase.");
                 shark.isLingering = false; // Stop lingering
                 shark.lingerTimer = 0;
                 shark.isChasing = true; // Start chasing again
                 shark.targetX = playerCenterX; // Target player
                 shark.targetY = playerCenterY;
             } else {
                 // Continue lingering patrol: If reached current linger target, pick a new one nearby
                 const distToLingerTargetSq = distSq(shark.x, shark.y, shark.targetX, shark.targetY);
                 if (distToLingerTargetSq < (TILE_SIZE * 1.5) ** 2) { // Increased threshold
                     const lingerRadius = TILE_SIZE * 4; // Slightly larger radius for next point
                     const angle = Math.random() * Math.PI * 2;
                     // New target point relative to the *original* escape point
                     shark.targetX = shark.lastSeenPlayerX + Math.cos(angle) * lingerRadius;
                     shark.targetY = shark.lastSeenPlayerY + Math.sin(angle) * lingerRadius;
                      // Simple bounds check
                      shark.targetX = Math.max(TILE_SIZE, Math.min(shark.targetX, WORLD_WIDTH - TILE_SIZE));
                      shark.targetY = Math.max(TILE_SIZE, Math.min(shark.targetY, WORLD_HEIGHT - TILE_SIZE));

                     // console.log(`Shark lingering, new target: ${shark.targetX.toFixed(0)},${shark.targetY.toFixed(0)}`); // Debug
                 }
                 // Movement target remains the current linger target point
             }
        }
        // --- Patrolling State (Not Chasing, Not Lingering) ---
        else {
             // Check conditions to START chasing
             const detectionRangeSq = SHARK_DETECTION_RANGE ** 2;
             if (distToPlayerSq < detectionRangeSq && shark.cooldownTimer <= 0 && isPlayerInOcean) {
                 console.log("%cShark detected player while patrolling! Starting chase.", "color: orange; font-weight: bold;");
                 shark.isChasing = true;
                 shark.targetX = playerCenterX;
                 shark.targetY = playerCenterY;
             } else { // Continue normal patrol
                 const distToPatrolTargetSq = distSq(shark.x, shark.y, shark.targetX, shark.targetY);
                 if (distToPatrolTargetSq < (TILE_SIZE * 0.5) ** 2) {
                    const newTarget = findRandomDeepWaterTile();
                    shark.targetX = newTarget.x;
                    shark.targetY = newTarget.y;
                 }
             }
        } // End State Logic

        // --- Movement (Applies to all states: chasing, lingering, patrolling) ---
        const targetX = shark.targetX; // Use the target set by the current state logic
        const targetY = shark.targetY;
        const dx = targetX - shark.x;
        const dy = targetY - shark.y;
        const distToTargetSq = dx * dx + dy * dy;
        const moveSpeed = shark.speed * deltaTime;

        if (distToTargetSq > moveSpeed * moveSpeed && distToTargetSq > 1) {
            const angle = Math.atan2(dy, dx);
            shark.dx = Math.cos(angle); shark.dy = Math.sin(angle);
            shark.x += shark.dx * moveSpeed; shark.y += shark.dy * moveSpeed;
        } else if (distToTargetSq > 1) {
            shark.x = targetX; shark.y = targetY;
            shark.dx = 0; shark.dy = 0;
        } else {
             shark.dx = 0; shark.dy = 0;
        }

        // --- Despawn Check ---
        if (isPlayerSafe) {
            playerOnLandTimer += deltaTime;
            // Despawn if player safe long enough AND shark is NOT chasing (allows lingering)
            if (playerOnLandTimer > SHARK_DESPAWN_LAND_TIME && !shark.isChasing) {
                 console.log("Player in safe zone long enough while shark patrolling/lingering, shark despawning.");
                 shark.active = false;
                 shark.isLingering = false; // Ensure linger state is off too
                 shark.lingerTimer = 0;
                 playerOnLandTimer = 0;
            }
        } else {
            playerOnLandTimer = 0; // Reset if player is in ocean
        }

        // --- Boundary Clamp ---
        shark.x = Math.max(-TILE_SIZE * 2, Math.min(shark.x, WORLD_WIDTH + TILE_SIZE * 2));
        shark.y = Math.max(-TILE_SIZE * 2, Math.min(shark.y, WORLD_HEIGHT + TILE_SIZE * 2));
    }


    function drawShark(ctx) {
        if (!shark.active) return;

        const { world: currentWorld } = getWorldState();
        const sharkTileX = Math.floor(shark.x / TILE_SIZE);
        const sharkTileY = Math.floor(shark.y / TILE_SIZE);

        // --- OCEAN WATER CHECK ---
        // Only draw if the shark's center is over OCEAN water tile
        const sharkTileType = currentWorld[sharkTileY]?.[sharkTileX];
        if (sharkTileType !== TERRAIN_OCEAN_WATER) { // << ONLY OCEAN
            return; // Don't draw shark if it's somehow over land/lake/out of bounds
        }

        // --- Drawing Code (remains the same) ---
        const finColor = '#607080';
        const finBaseWidth = TILE_SIZE * 0.6;
        const finHeight = TILE_SIZE * 0.7;
        const finTipOffset = finHeight * 0.1;
        const angle = (shark.dx === 0 && shark.dy === 0) ? -Math.PI / 2 : Math.atan2(shark.dy, shark.dx);

        ctx.save();
        ctx.translate(shark.x, shark.y);
        ctx.rotate(angle);
        ctx.fillStyle = finColor;
        ctx.beginPath();
        ctx.moveTo(-finHeight / 2 + finTipOffset, 0);
        ctx.lineTo(finHeight / 2, 0);
        ctx.lineTo(-finHeight / 2, -finBaseWidth / 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 220, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(-finHeight * 0.3, 0, finBaseWidth * 0.6, Math.PI * 0.6, Math.PI * 1.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-finHeight * 0.6, 0, finBaseWidth * 0.8, Math.PI * 0.7, Math.PI * 1.3);
        ctx.stroke();
        ctx.restore();
    }

    // --- NEW: Jumping Fish Animation Drawing Function ---
    function drawJumpingFish(ctx) {
        if (!jumpingFishAnimation.active) return;

        const anim = jumpingFishAnimation;
        const progress = anim.progress; // Value from 0 to 1

        // Calculate vertical position using a parabola: y = startY - 4 * H * x * (1-x)
        // where x is progress, H is maxHeight
        const arcHeight = 4 * anim.maxHeight * progress * (1 - progress);
        const currentY = anim.startY - arcHeight;

        // Fish appearance
        const fishWidth = TILE_SIZE * 0.6;
        const fishHeight = TILE_SIZE * 0.3;
        const fishColor = '#A0A0C0'; // Silvery blue/grey
        const fishDarkerColor = '#708090'; // Slate grey

        // Calculate rotation based on trajectory (simple approximation)
        // Angle goes from slightly up -> horizontal -> slightly down
        const angle = Math.PI * 0.2 * (1 - progress * 2); // Ranges from +0.2PI to -0.2PI

        ctx.save();
        ctx.translate(anim.x, currentY); // Move to fish's current animated position
        ctx.rotate(angle);

        // Draw fish body (ellipse)
        ctx.fillStyle = fishColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, fishWidth / 2, fishHeight / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw a simple fin/darker top
         ctx.fillStyle = fishDarkerColor;
         ctx.beginPath();
         ctx.ellipse(0, -fishHeight * 0.15, fishWidth / 2.5, fishHeight / 4, 0, 0, Math.PI * 2);
         ctx.fill();


        ctx.restore();

        // --- Splash Effect ---
        const splashMaxRadius = TILE_SIZE * 0.3;
        const splashColor = 'rgba(220, 235, 255, 0.6)'; // Light blue, semi-transparent

        // Splash on exit (early progress)
        if (progress > 0.05 && progress < 0.25) {
            const splashProgress = (progress - 0.05) / 0.2; // Scale 0 to 1
            const radius = splashMaxRadius * splashProgress;
            const alpha = 0.6 * (1 - splashProgress); // Fade out
            ctx.fillStyle = `rgba(220, 235, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(anim.x, anim.startY, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Splash on re-entry (late progress)
        if (progress > 0.75 && progress < 0.95) {
            const splashProgress = (progress - 0.75) / 0.2; // Scale 0 to 1
            const radius = splashMaxRadius * (1 - splashProgress); // Shrink in
            const alpha = 0.6 * splashProgress; // Fade in
            ctx.fillStyle = `rgba(220, 235, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(anim.x, anim.startY, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        // --- End Splash Effect ---
    }
    // --- END Jumping Fish Drawing -
      
    // --- Update Function ---
    function update(deltaTime) {
        // --- Pre-calculate Tree Shadows for this frame ---
        const currentWorldStateForShadows = getWorldState();
        const currentTimeForShadows = getTimeState();
        currentWorldStateForShadows.trees.forEach(tree => {
            tree.currentShadow = calculateTreeShadow(tree, currentTimeForShadows);
            // Add a flag to the tree if player is inside its specific shadow (used for shade check)
            if (tree.currentShadow && tree.currentShadow.exists) {
                const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
                const shadow = tree.currentShadow;
                const shadowBounds = { x: shadow.x - shadow.radiusX, y: shadow.y - shadow.radiusY, width: shadow.radiusX * 2, height: shadow.radiusY * 2 };
                tree.isShadingPlayer = false; // Reset flag
                if (checkCollision(playerRect.x, playerRect.y, playerRect.width, playerRect.height, shadowBounds.x, shadowBounds.y, shadowBounds.width, shadowBounds.height)) {
                    const playerCenterX = playerRect.x + playerRect.width / 2;
                    const playerCenterY = playerRect.y + playerRect.height / 2;
                    const dx = playerCenterX - shadow.x;
                    const dy = playerCenterY - shadow.y;
                    if (shadow.radiusX > 0 && shadow.radiusY > 0 && (((dx * dx) / (shadow.radiusX * shadow.radiusX)) + ((dy * dy) / (shadow.radiusY * shadow.radiusY)) <= 1)) {
                        tree.isShadingPlayer = true; // Set flag if player inside this specific shadow
                    } else if (dx === 0 && dy === 0) {
                            tree.isShadingPlayer = true;
                    }
                }
            } else {
                tree.isShadingPlayer = false; // No shadow exists
            }
        });
        // --- END Shadow Pre-calculation ---

    // --- Update Jumping Fish Animation Timer ---
    if (jumpingFishAnimation.active) {
        jumpingFishAnimation.progress += deltaTime / jumpingFishAnimation.duration;
        if (jumpingFishAnimation.progress >= 1) {
            jumpingFishAnimation.active = false; // Animation finished
            jumpingFishAnimation.progress = 0; // Reset progress
        }
    }
    // --- END Animation Timer Update ---


    // Update Time
    time.current += deltaTime;
    if (time.current >= time.dayLength) {
        time.current %= time.dayLength; stats.day++; hintFlags.nightWarning = false;
        showMessage(`Day ${stats.day} has begun.`);
    }
    const timeOfDayFactor = time.current / time.dayLength;
    time.isNight = timeOfDayFactor >= time.nightStartFactor || timeOfDayFactor < time.morningStartFactor;
    if (!hintFlags.nightWarning && timeOfDayFactor >= time.eveningStartFactor && timeOfDayFactor < time.nightStartFactor) { showMessage("Sun is setting. It might get cold...", 5000); hintFlags.nightWarning = true; } else if (timeOfDayFactor < time.eveningStartFactor) { hintFlags.nightWarning = false; }
    updateDayNightIndicator();

    // Update Player Stats (Uses pre-calculated shadows via isPlayerInShade)
    updateStats(deltaTime);

    // Decrement Fishing Cooldown
    if (player.fishingCooldown > 0) { player.fishingCooldown -= deltaTime; if (player.fishingCooldown < 0) player.fishingCooldown = 0; }

    // Update Player Movement
    updatePlayerMovement(deltaTime);

    // Handle Active Fishing Timer
    if (player.isFishing) {
        player.fishingTimer += deltaTime;
        if (player.fishingTimer >= FISHING_DURATION) {
            player.isFishing = false; player.fishingTimer = 0; player.fishingCooldown = FISHING_COOLDOWN;
            const currentTime = getTimeState(); const fishChance = currentTime.isNight ? 0.6 : 0.3;
            if (Math.random() < fishChance) { if (addItemToInventory('fish', 1)) { showMessage(`Caught a fish!${currentTime.isNight ? ' (Night!)' : ''}`, 2500); } } else { showMessage("Fishing... nothing biting.", 2000); }
            // updateStatsUI(); // UI updates in main loop
        }
    }

    // Handle Fish Jumping Event (Gameplay State & Animation Trigger)
    if (fishJumpingTimer > 0) {
        fishJumpingTimer -= deltaTime;
        if (fishJumpingTimer <= 0) {
            fishAreJumping = false; // Gameplay flag off
            fishJumpingTimer = 0;
        }
    } else { // Only check to start jumping if timer is not active
        if (!fishAreJumping && !player.isFishing && player.fishingCooldown <= 0) {
            if (Math.random() < FISH_JUMPING_CHANCE_PER_SECOND * deltaTime) {
                fishAreJumping = true; // Gameplay flag on
                fishJumpingTimer = FISH_JUMPING_DURATION;
                showMessage("Fish are jumping nearby!", 3000);

                // *** Trigger Visual Animation ***
                if (!jumpingFishAnimation.active) { // Only start if not already animating
                        const { world: currentWorld } = getWorldState();
                        let attempts = 0;
                        const maxAttempts = 30;
                        let foundSpot = false;
                        // Try to find a water spot near the player but not too close
                        while (attempts < maxAttempts && !foundSpot) {
                            const angle = Math.random() * Math.PI * 2;
                            const dist = TILE_SIZE * 2 + Math.random() * TILE_SIZE * 4; // 2-6 tiles away
                            const potentialX = player.x + player.width/2 + Math.cos(angle) * dist;
                            const potentialY = player.y + player.height/2 + Math.sin(angle) * dist;
                            const tileX = Math.floor(potentialX / TILE_SIZE);
                            const tileY = Math.floor(potentialY / TILE_SIZE);

                            if(potentialX > 0 && potentialX < WORLD_WIDTH && potentialY > 0 && potentialY < WORLD_HEIGHT &&
                                currentWorld[tileY]?.[tileX] === TERRAIN_WATER)
                            {
                                jumpingFishAnimation.active = true;
                                jumpingFishAnimation.x = potentialX;
                                // Use the top of the tile as the water surface Y
                                jumpingFishAnimation.startY = tileY * TILE_SIZE + TILE_SIZE * 0.8; // Slightly below tile top visually
                                jumpingFishAnimation.progress = 0; // Reset progress for new animation
                                foundSpot = true;
                            }
                            attempts++;
                        }
                        if(!foundSpot) console.log("Could not find spot for fish jump animation.");
                }
                // *** END Animation Trigger ***
            }
        }
    } // End Fish Jumping Logic

    // --- ADD LOGGING IMMEDIATELY AFTER MOVEMENT UPDATE ---
    const postMoveInteraction = peekInteractionTarget(); // Check target *after* potential move/collision handling
    console.log(`[Update End Frame] ShelterState=${!!player.isInsideShelter}. Interaction Target: ${postMoveInteraction.type}`); // DIAGNOSTIC LOG
    // --- END LOGGING ---

    // Update Interaction Prompt & Target Info
    const interactionResult = peekInteractionTarget();
    currentInteractionTargetInfo = interactionResult;
    let promptText = "";
    switch (interactionResult.type) {
        case 'addFuel':
            if (interactionResult.target && typeof interactionResult.target.fuel !== 'undefined' && typeof interactionResult.target.maxFuel !== 'undefined') { promptText = `Press E to Add Wood (Fuel: ${Math.ceil(interactionResult.target.fuel)}/${interactionResult.target.maxFuel})`; } else { promptText = `Press E to Add Wood (Fuel: ?/?)`; }
            break;
        case 'usePurifier': promptText = "Press E to Use Water Purifier"; break;
        case 'gatherTree':
                if (interactionResult.target && typeof interactionResult.target.totalResource !== 'undefined') { promptText = `Press E to Chop Tree (${Math.ceil(interactionResult.target.totalResource)} wood left)`; } else { promptText = `Press E to Chop Tree (? wood left)`; }
            break;
        case 'gatherRock':
                if (interactionResult.target && typeof interactionResult.target.totalResource !== 'undefined') { promptText = `Press E to Mine Rock (${Math.ceil(interactionResult.target.totalResource)} hits left)`; } else { promptText = `Press E to Mine Rock (? hits left)`; }
            break;
        case 'gatherShrub': promptText = "Press E to Cut Shrub"; break;
        case 'gatherDriftwood': const woodAmt = interactionResult.target?.resourceAmount || '?'; promptText = `Press E to Gather Driftwood (${woodAmt} wood)`; break;
        case 'fish':
            if (player.isFishing) { promptText = "Fishing..."; }
            else if (player.fishingCooldown > 0) { promptText = "Press E to Fish"; } // Removed cooldown display
            else { promptText = fishAreJumping ? "Press E to Fish (Fish Jumping!)" : "Press E to Fish"; } // Check gameplay flag
            break;
        case 'drinkDirtyWater': promptText = "Press E to Drink Dirty Water"; break;
        case 'pickupShelter': promptText = "Press E to Pick Up Shelter"; break;
        case 'none': default:
                if (interactionResult.type === 'none') { const playerCX = player.x + player.width / 2; const playerCY = player.y + player.height / 2; const selectedItem = inventory[selectedSlot]; const worldStateFallback = getWorldState(); if (!promptText && selectedItem && selectedItem.item === 'wood' && selectedItem.count > 0) { for (const fire of worldStateFallback.signalFires) { if (typeof fire.fuel !== 'undefined' && typeof fire.maxFuel !== 'undefined' && distSq(playerCX, playerCY, fire.x + fire.width / 2, fire.y + fire.height / 2) < player.interactionRange**2) { promptText = `Press E to Add Wood (Fuel: ${Math.ceil(fire.fuel)}/${fire.maxFuel})`; break; }}}}
                break;
    }
    if (promptText) { showInteractionPrompt(promptText); }
    else { hideInteractionPrompt(); }
    // --- Interaction prompt end ---

    // Update Resources (Regrowth and Spawning)
    const currentWorldState = getWorldState(); // Get fresh state if needed elsewhere
    const currentDayLength = getTimeState().dayLength;
    currentWorldState.trees.forEach(t => updateTree(t, deltaTime));
    currentWorldState.shrubs.forEach(s => updateShrub(s, deltaTime, currentDayLength));
    updateDriftwoodSpawning(deltaTime, currentDayLength);

    // Update Shark
    updateSharkSpawning(deltaTime); // Try to spawn if inactive
    updateSharkBehavior(deltaTime); // Update movement/chasing if active

    // Update Signal Fires & Check Rescue
    let anySignalFireActive = false;
    currentWorldState.signalFires.forEach(f => { if (updateSignalFire(f, deltaTime)) { anySignalFireActive = true; } });
    checkRescueChance(anySignalFireActive, deltaTime);

    // Check Game Over Condition (Health)
    checkGameOver(); // Checks for health <= 0
    } // End Update Function




      
// --- Render Function (Modified for Layering and Fish Anim) ---
function render() {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false; // Keep pixel art crisp

    const currentWorldState = getWorldState();
    const currentPlayerState = getPlayerState();
    const currentTimeState = getTimeState(); // Needed for drawing tree shadows

      
// --- Stage 1: Draw Background ---
    // drawBackgroundAndTerrain(ctx); // <<< OLD CALL
    drawBackgroundAndTerrain(ctx, time.current); // <<< NEW CALL - Pass current time

    

    // --- Stage 2: Draw "Ground Layer" Objects + Tree Trunks/Shadows ---
    const groundLayerEntities = [
        ...currentWorldState.driftwoodPieces,
        ...currentWorldState.rocks,
        ...currentWorldState.shrubs.filter(s => s.isStump && s.stumpTimer > 0), // Only visible stumps
        ...currentWorldState.campfires,
        ...currentWorldState.shelters,
        ...currentWorldState.waterFilters,
        ...currentWorldState.signalFires,
        ...currentWorldState.trees // Add all trees for trunk/shadow drawing
    ];
    if (!currentPlayerState.isInsideShelter) {
        currentPlayerState.sortY = currentPlayerState.y + currentPlayerState.height;
        groundLayerEntities.push(currentPlayerState);
    }
    groundLayerEntities.forEach(obj => { // Calculate sortY
        if (obj !== currentPlayerState) {
             if (currentWorldState.trees.includes(obj)) { obj.sortY = obj.y + obj.height; }
             else { obj.sortY = obj.y + (obj.height || TILE_SIZE); }
        }
    });
    groundLayerEntities.sort((a, b) => a.sortY - b.sortY); // Sort
    groundLayerEntities.forEach(obj => { // Draw
        if (obj === currentPlayerState) { drawPlayer(ctx, obj); }
        else if (currentWorldState.trees.includes(obj)) { drawTreeTrunkAndShadow(ctx, obj, currentTimeState); }
        else if (currentWorldState.rocks.includes(obj)) { drawRock(ctx, obj); }
        else if (currentWorldState.shrubs.includes(obj)) { drawShrub(ctx, obj); } // Stump only
        else if (currentWorldState.driftwoodPieces.includes(obj)) { drawDriftwood(ctx, obj); }
        else if (currentWorldState.campfires.includes(obj)) { drawCampfire(ctx, obj); }
        else if (currentWorldState.shelters.includes(obj)) { drawShelter(ctx, obj); }
        else if (currentWorldState.waterFilters.includes(obj)) { drawWaterPurifier(ctx, obj); }
        else if (currentWorldState.signalFires.includes(obj)) { drawSignalFire(ctx, obj); }
    });

    // --- Stage 3: Draw Shark (Over ground, under canopies/overlays) ---
    drawShark(ctx);

    // --- Stage 3.5: Draw Jumping Fish Animation --- <<< ADDED CALL
    drawJumpingFish(ctx);
    // --- END Fish Animation Call ---

    // --- Stage 4: Draw Tree Canopies and Living Shrubs (Rendered on top) ---
    const topLayerEntities = [
         ...currentWorldState.trees.filter(t => !t.isStump), // Living tree canopies
         ...currentWorldState.shrubs.filter(s => !s.isStump) // Living shrubs
    ];
     topLayerEntities.forEach(obj => { // Calculate sortY
          if (currentWorldState.trees.includes(obj)) { obj.sortY = obj.y + obj.height * 0.5; }
          else if (currentWorldState.shrubs.includes(obj)) { obj.sortY = obj.y + obj.height / 2; }
     });
    topLayerEntities.sort((a, b) => a.sortY - b.sortY); // Sort
    topLayerEntities.forEach(obj => { // Draw
         if (currentWorldState.trees.includes(obj)) { drawTreeCanopy(ctx, obj); }
         else if (currentWorldState.shrubs.includes(obj)) { drawShrub(ctx, obj); } // Living shrubs
    });

    // --- Stage 5: Draw Night Overlay ---
    if (time.isNight) {
        let darkness=0; const tod=time.current/time.dayLength; const nfidf=time.nightStartFactor-time.eveningStartFactor; const nfodf=time.morningStartFactor-time.dayStartFactor; const md=0.7; if(tod>=time.nightStartFactor||tod<time.dayStartFactor){darkness=md;}else if(tod>=time.eveningStartFactor){const p=(tod-time.eveningStartFactor)/nfidf;darkness=md*(1-Math.cos(p*Math.PI/2));}else if(tod<time.morningStartFactor){const p=(tod-time.dayStartFactor)/nfodf;darkness=md*Math.cos(p*Math.PI/2);}else{darkness=0;} darkness=Math.max(0,Math.min(md,darkness));
        ctx.fillStyle = `rgba(0, 0, 30, ${darkness})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
} // End Render Function

    // --- Game Loop ---
    function gameLoop(currentTime) {
        if (!gameStarted || gameOver) return;
        if (isPaused) { render(); requestAnimationFrame(gameLoop); return; } // Only render when paused
    
        if (lastTime === 0) lastTime = currentTime;
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        const clampedDeltaTime = Math.min(deltaTime, 0.1); // Prevent large jumps if tab loses focus
    
        // <<< ADD THIS LOG >>>
        // console.log(`[gameLoop Pre-Update] Global player.isInsideShelter: ${!!player.isInsideShelter}`);
    
        update(clampedDeltaTime); // Pass delta time to update logic
        render(); // Render the updated state
    
        requestAnimationFrame(gameLoop); // Continue the loop
    }

    // --- Start Initialization ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGame);
    } else {
        initGame();
    }

})(); // End of main IIFE


// --- Scaling Logic ---
(function() {
    const gameContainer = document.getElementById('game-container');
    const baseWidth = 1440;
    const baseHeight = 896;

    function resizeAndScaleGame() {
        if (!gameContainer) { console.error("Game container not found for scaling."); return; }
        // console.log(">>> [Simple Scaling] resizeAndScaleGame function STARTING <<<"); // Less verbose logging
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        // console.log(`[Simple Scaling] Viewport dimensions: ${viewportWidth}x${viewportHeight}`);
        const scaleX = viewportWidth / baseWidth;
        const scaleY = viewportHeight / baseHeight;
        const scale = Math.min(scaleX, scaleY);
        // console.log(`[Simple Scaling] Calculated container scale: ${scale}`);
        gameContainer.style.transform = `scale(${scale})`;
        // console.log(`[Simple Scaling] Applied transform: scale(${scale})`);
    }

    let resizeTimeout;
    function debouncedResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeAndScaleGame, 100); // Debounce resize events
    }

    function runInitialScale() {
         // console.log("[Simple Scaling] Attempting initial scale...");
         try {
             resizeAndScaleGame();
             // console.log("[Simple Scaling] Initial scale call successful.");
         } catch(e) {
             console.error("[Simple Scaling] Error calling initial scale:", e);
         }
    }

    // Ensure initial scaling happens correctly
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runInitialScale);
        // console.log("[Simple Scaling] DOMContentLoaded listener added.");
    } else {
        // Use a small timeout to ensure layout is stable after potential CSS loading
        setTimeout(runInitialScale, 50);
        // console.log("[Simple Scaling] DOM already loaded, scheduling initial scale.");
    }

    window.addEventListener('resize', debouncedResize);
    // console.log("[Simple Scaling] Resize event listener added.");

})();
// --- End Scaling Logic ---
