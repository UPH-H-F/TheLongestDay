// --- Constants ---
// !!!!! IMPORTANT: Replace 'spritesheet.png' with the actual path to YOUR spritesheet image !!!!!
const SPRITESHEET_SRC = 'spritesheet.png';
const TILE_SIZE = 32;
const WORLD_WIDTH_TILES = 25; // 800 / 32
const WORLD_HEIGHT_TILES = 19; // 608 / 32
const WORLD_WIDTH = WORLD_WIDTH_TILES * TILE_SIZE;
const WORLD_HEIGHT = WORLD_HEIGHT_TILES * TILE_SIZE;
const VISIBLE_INVENTORY_SLOTS = 5; // How many slots are visible at once
const MAX_INVENTORY_SIZE = 20; // Total capacity of the inventory
const MAX_STAT = 100;
const RESCUE_START_DAY = 4;
const BASE_RESCUE_CHANCE = 0.15;
const TREE_REGROW_DAYS = 365; // Long regrow time
const BAMBOO_REGROW_DAYS = 3;
const BAMBOO_HEALTH = 2;
const BAMBOO_WOOD_YIELD = 1;
const TERRAIN_GRASS = 'grass';
const TERRAIN_SAND = 'sand';
const TERRAIN_WATER = 'water'; // Added water terrain type
const FISHING_ZONE_Y_START = WORLD_HEIGHT_TILES * 0.7; // Relative Y, might need adjustment based on island shape
const MAX_PURIFIER_DIST_TO_EDGE = 60; // Distance check for purifier placement
const LEADERBOARD_MAX_ENTRIES = 10; // Leaderboard size // <<< ADDED FROM OLDER


// --- DOM Elements ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const gameContainer = document.getElementById('game-container');
const messageBox = document.getElementById('message-box');
const interactionPrompt = document.getElementById('interaction-prompt');
const tooltipArea = document.getElementById('tooltip-area');
const gameOverScreen = document.getElementById('game-over');
const gameOverTitle = document.getElementById('game-over-title');
const daysSurvivedText = document.getElementById('days-survived');
// === UPDATED Stats Panel References ===
const statsPanelElements = {
    healthBar: document.getElementById('health-bar-inner'),
    healthText: document.getElementById('health-text'),
    hungerBar: document.getElementById('hunger-bar-inner'),
    hungerText: document.getElementById('hunger-text'),
    thirstBar: document.getElementById('thirst-bar-inner'),
    thirstText: document.getElementById('thirst-text'),
    dayValue: document.getElementById('day-value'), // The number part of the day label
    dayBar: document.getElementById('day-bar-inner'), // The time-of-day progress bar
    dayText: document.getElementById('day-text')    // The text overlay for time (Morning/Night etc)
};
// === END UPDATED Stats Panel References ===
// Inventory DOM Elements
const inventorySlotsContainer = document.getElementById('inventory-slots-container');
const invNavLeftButton = document.getElementById('inv-nav-left');
const invNavRightButton = document.getElementById('inv-nav-right');
// === START LEADERBOARD DOM Elements === // <<< ADDED FROM OLDER
const leaderboardPanel = document.getElementById('leaderboard-panel'); // Reference to the hidden panel
const lbDaysList = document.getElementById('lb-days');
const lbItemsList = document.getElementById('lb-items');
const lbFishList = document.getElementById('lb-fish');
const showLeaderboardTitleButton = document.getElementById('show-leaderboard-button-title'); // Button on title screen
const closeLeaderboardButton = document.getElementById('close-leaderboard'); // Close button inside panel
// === END LEADERBOARD DOM Elements ===
// ===== ADDED AUDIO ELEMENT REFERENCE =====
const backgroundAudio = document.getElementById('background-audio');
// ***** START NEW HELP PANEL REFERENCES *****
const helpButton = document.getElementById('help-button');
const helpPanel = document.getElementById('help-panel');
const closeHelpButton = document.getElementById('close-help-panel');
// ***** END NEW HELP PANEL REFERENCES *****
// === PAUSE POPUP ELEMENTS ===
const pausePopup = document.getElementById('pause-popup');
const resumeButton = document.getElementById('resume-button');
const mainMenuButton = document.getElementById('main-menu-button'); // Main Menu Button


// --- Game State ---
let gameStarted = false;
let gameOver = false;
let rescued = false;
let isPaused = false; // PAUSE STATE
let player = {}; // Initialized in resetGameState
let stats = { // Expanded stats object - already had counters
    health: MAX_STAT, hunger: MAX_STAT, thirst: MAX_STAT, day: 1,
    totalItemsCollected: 0,
    fishCaught: 0
};
let inventory = []; // Will hold up to MAX_INVENTORY_SIZE items
let selectedSlot = 0; // Absolute index in the full inventory array
let inventoryStartIndex = 0; // Index of the first visible slot
// --- UPDATED Time Object ---
let time = {
    current: 0,         // Current time in seconds within the day
    dayLength: 120,     // Total seconds in a game day
    isNight: false,
    // Define thresholds as fractions of dayLength
    dayStartFactor: 0.0,   // 0% = Midnight (start of the cycle)
    morningStartFactor: 0.15, // 15% = Morning starts
    afternoonStartFactor: 0.4, // 40% = Afternoon starts
    eveningStartFactor: 0.7,  // 70% = Evening starts (night starts visually here)
    nightStartFactor: 0.85   // 85% = Deep night starts
};
let world = [];
let trees = []; let rocks = []; let bambooStands = [];
let campfires = []; let shelters = []; let waterFilters = []; let signalFires = [];
let keys = {}; let messageTimeout = null; let interactionTimeout = null; let tooltipTimeout = null;
let hintFlags = {};
let grassPatches = [];
let spritesheet = null; // To hold the loaded image object
let spritesheetLoaded = false; // Flag to check if loaded

// --- Resources & Crafting Definitions (with Sprite Coords) ---
// sx, sy: top-left corner of sprite in the sheet (in pixels)
// sw, sh: width and height of the sprite in the sheet (usually 16x16 for this pack)
const resources = {
    wood: { name: 'Wood', description: 'Basic building material.', sprite: { sx: 0, sy: 16, sw: 16, sh: 16 } },
    stone: { name: 'Stone', description: 'Sturdy material for tools.', sprite: { sx: 16, sy: 16, sw: 16, sh: 16 } },
    fish: { name: 'Fish', heals: 3, restoresHunger: 30, description: 'Eat (Space) for nourishment.', sprite: { sx: 32, sy: 16, sw: 16, sh: 16 } },
    // Add other resources here if they have sprites
};
const craftableItems = {
    axe: { name: 'Axe', requires: { wood: 5, stone: 2 }, description: 'Chops trees faster.', sprite: { sx: 0, sy: 32, sw: 16, sh: 16 } },
    fishingRod: { name: 'Fishing Rod', requires: { wood: 3 }, description: 'Enables fishing.', sprite: { sx: 16, sy: 32, sw: 16, sh: 16 } },
    // Placeable items usually don't need an inventory *icon* sprite, but you could add one if desired
    campfire: { name: 'Campfire', requires: { wood: 10, stone: 3 }, placeable: true, width: 48, height: 48, description: 'Place (Space) for light/warmth.', sprite: { sx: 16, sy: 0, sw: 16, sh: 16 } }, // Example: using fire sprite
    shelter: { name: 'Shelter', requires: { wood: 20 }, placeable: true, pickupable: true, width: 64, height: 48, description: 'Place (Space). Click to enter/exit. Press E nearby to pick up.', sprite: { sx: 0, sy: 64, sw: 16, sh: 16 } }, // Example: using house sprite // Added pickupable: true
    waterPurifier: { name: 'Water Purifier', requires: { wood: 8, stone: 5 }, placeable: true, width: 40, height: 40, description: `Place near sand/water edge. Interact (E) for water.`, sprite: { sx: 48, sy: 64, sw: 16, sh: 16 } }, // Example: using a chest sprite maybe?
    largeSignalFire: { name: 'Signal Fire', requires: { wood: 30, stone: 10 }, placeable: true, width: 64, height: 64, isSignal: true, description: 'Place & keep lit for rescue chance.', sprite: { sx: 16*6, sy: 0, sw: 16, sh: 16 } } // Example: Large fire / brazier?
};

// --- START Leaderboard Keys --- // <<< ADDED FROM OLDER
 const LEADERBOARD_KEYS = {
     days: 'leaderboard_days',
     items: 'leaderboard_items',
     fish: 'leaderboard_fish'
 };
 // --- END Leaderboard Keys ---

// --- Initialization ---
function initGame() {
     loadSpritesheet(); // Start loading the image
     setupEventListeners();
     generateCraftingButtons();
     prepareGame(); // prepareGame calls reset which will hide pause popup
     // Optionally set initial volume
     // backgroundAudio.volume = 0.5; // Set volume (0.0 to 1.0)
}

// --- Load Spritesheet ---
function loadSpritesheet() {
    spritesheet = new Image();
    spritesheet.onload = () => {
        spritesheetLoaded = true;
        console.log("Spritesheet loaded successfully.");
        // Regenerate inventory UI in case game started before sheet loaded
        if (gameStarted && !gameOver && !isPaused) { // Only update if game running
             updateInventoryUI();
        }
    };
    spritesheet.onerror = () => {
        console.error(`Failed to load spritesheet from ${SPRITESHEET_SRC}! Check path.`);
        showMessage(`Error: Could not load spritesheet '${SPRITESHEET_SRC}'. Game may not display correctly.`, 10000); // Show user-facing error
        spritesheetLoaded = false; // Ensure flag is false on error
    };
     // Check if SPRITESHEET_SRC is defined and not empty before setting src
     if (!SPRITESHEET_SRC) {
         console.error("SPRITESHEET_SRC constant is not defined or is empty!");
         showMessage("Error: Spritesheet source not defined. Cannot load graphics.", 10000);
         spritesheetLoaded = false;
         return; // Prevent setting src to undefined
     }
    spritesheet.src = SPRITESHEET_SRC;
}


function setupEventListeners() {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    document.getElementById('close-crafting').addEventListener('click', closeCraftingMenu);
    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('restart-button').addEventListener('click', restartGame);
    // === START LEADERBOARD LISTENERS === // <<< ADDED/MODIFIED FROM OLDER
    if (showLeaderboardTitleButton) showLeaderboardTitleButton.addEventListener('click', displayLeaderboard); // Use new button ID
    if (closeLeaderboardButton) closeLeaderboardButton.addEventListener('click', hideLeaderboard); // Use new button ID
    // === END LEADERBOARD LISTENERS ===
    invNavLeftButton.addEventListener('click', navigateInventoryLeft);
    invNavRightButton.addEventListener('click', navigateInventoryRight);
    canvas.addEventListener('click', handleCanvasClick);
    if (helpButton) helpButton.addEventListener('click', toggleHelpPanel);
    if (closeHelpButton) closeHelpButton.addEventListener('click', hideHelpPanel);

    // Listener for Resume Button
    resumeButton.addEventListener('click', resumeGame);

    // Listener for Main Menu Button
    mainMenuButton.addEventListener('click', goToMainMenu);
}

// ===== NEW HELPER FUNCTION: peekInteractionTarget =====
function peekInteractionTarget() {
    const iP = getInteractionPoint();
    const playerCX = player.x + player.width / 2;
    const playerCY = player.y + player.height / 2;
    const selectedItem = inventory[selectedSlot];

    // Priority 1: Use Placed Objects (Interaction Point near object center)
    if (selectedItem && selectedItem.item === 'wood' && selectedItem.count > 0) {
        for (const f of signalFires) {
            if (dist(iP.x, iP.y, f.x + f.width / 2, f.y + f.height / 2) < TILE_SIZE * 0.8) {
                return { type: 'addFuel', target: f };
            }
        }
    }
    for (const p of waterFilters) {
        if (dist(iP.x, iP.y, p.x + p.width / 2, p.y + p.height / 2) < TILE_SIZE * 0.8) {
            return { type: 'usePurifier', target: p };
        }
    }

    // Priority 2: Gather Resources (Interaction Point near resource center)
    const nearbyResources = [...trees.filter(t => t.health > 0), ...rocks.filter(r => r.health > 0), ...bambooStands.filter(b => b.health > 0)]
        .filter(r => dist(iP.x, iP.y, r.x + r.width / 2, r.y + r.height / 2) < player.interactionRange) // Check iP distance
        .sort((a, b) => dist(playerCX, playerCY, a.x + a.width / 2, a.y + a.height / 2) - dist(playerCX, playerCY, b.x + b.width / 2, b.y + b.height / 2)); // Sort by player distance

    if (nearbyResources.length > 0) {
        const target = nearbyResources[0];
        if (trees.includes(target)) return { type: 'gatherTree', target: target };
        if (rocks.includes(target)) return { type: 'gatherRock', target: target };
        if (bambooStands.includes(target)) return { type: 'gatherBamboo', target: target };
    }

    // Priority 3: Water Actions (Interaction Point near water tile)
    const iTX = Math.floor(iP.x / TILE_SIZE);
    const iTY = Math.floor(iP.y / TILE_SIZE);
    let isNearWater = world[iTY]?.[iTX] === TERRAIN_WATER;
    if (!isNearWater && world[iTY]?.[iTX]) {
        const adjacent = [{x: iTX, y: iTY - 1}, {x: iTX, y: iTY + 1}, {x: iTX - 1, y: iTY}, {x: iTX + 1, y: iTY}];
        for (const adj of adjacent) {
            if (world[adj.y]?.[adj.x] === TERRAIN_WATER) {
                isNearWater = true;
                break;
            }
        }
    }
    if (isNearWater) {
         // Check if near SAND as well for fishing vs drinking logic clarification
         let isOnSand = world[iTY]?.[iTX] === TERRAIN_SAND;
         if (!isOnSand) { // Check adjacent for sand if not directly on it
              const adjacentSand = [{x: iTX, y: iTY - 1}, {x: iTX, y: iTY + 1}, {x: iTX - 1, y: iTY}, {x: iTX + 1, y: iTY}];
              for (const adj of adjacentSand) {
                  if (world[adj.y]?.[adj.x] === TERRAIN_SAND) {
                      isOnSand = true;
                      break;
                  }
              }
         }

         const hasRod = inventory.some(s => s && s.item === 'fishingRod');
         // Prioritize fishing if possible and near sand, otherwise allow drinking
         if (hasRod && isOnSand) {
             return { type: 'fish' };
         } else {
             // Allow drinking even if not directly on sand, as long as near water
             return { type: 'drinkDirtyWater' };
         }
    }


    // Priority 4: Pick Up Shelter (Interaction Point near shelter center AND player near)
    for (const shelter of shelters) {
        const shelterCenterX = shelter.x + shelter.width / 2;
        const shelterCenterY = shelter.y + shelter.height / 2;
        if (dist(iP.x, iP.y, shelterCenterX, shelterCenterY) < TILE_SIZE * 1.2 &&
            dist(playerCX, playerCY, shelterCenterX, shelterCenterY) < player.interactionRange + TILE_SIZE) {
            const shelterDef = craftableItems['shelter'];
            if (shelterDef && shelterDef.pickupable) {
                return { type: 'pickupShelter', target: shelter };
            }
        }
    }

    return { type: 'none' };
}
// ===== END NEW HELPER FUNCTION =====

// ===== NEW HELPER FUNCTION: performGatheringAction =====
function performGatheringAction(interactionResult) {
    if (!interactionResult || !interactionResult.target) return false;

    const target = interactionResult.target;
    let gathered = false;

    if (interactionResult.type === 'gatherTree' && trees.includes(target) && target.health > 0) {
        const hasAxe = inventory.some(s => s && s.item === 'axe');
        let damage = hasAxe ? 1 : 0.25;
        target.health -= damage;
        if (target.health <= 0) {
            addItemToInventory('wood', hasAxe ? 5 : 2);
            showMessage(`Chopped down tree, got ${hasAxe ? 5 : 2} wood.`, 2500);
            target.health = 0; target.regrowTimer = 0;
        } else {
            addItemToInventory('wood', 1);
            showMessage(`Chopped tree (${Math.ceil(target.health)} HP).`, 1500);
        }
        gathered = true;
    } else if (interactionResult.type === 'gatherRock' && rocks.includes(target) && target.health > 0) {
        const hasPickaxe = false; // Placeholder for potential future pickaxe
        let damage = hasPickaxe ? 1 : 0.2;
        target.health -= damage;
        if (target.health <= 0) {
            addItemToInventory('stone', 2);
            showMessage("Broke rock, got 2 stone.", 2500);
            if (!hintFlags.firstStone) { showMessage("Stone acquired! Useful for tools (Crafting 'C').", 4000); hintFlags.firstStone = true; }
            const rockIndex = rocks.findIndex(r => r === target);
            if (rockIndex > -1) rocks.splice(rockIndex, 1);
        } else {
            if (Math.random() < 0.5) {
                addItemToInventory('stone', 1);
                showMessage(`Mined rock, got 1 stone (${Math.ceil(target.health)} HP).`, 1500);
                if (!hintFlags.firstStone) { showMessage("Stone acquired! Useful for tools (Crafting 'C').", 4000); hintFlags.firstStone = true; }
            } else {
                showMessage(`Mining rock (${Math.ceil(target.health)} HP).`, 1000);
            }
        }
        gathered = true;
    } else if (interactionResult.type === 'gatherBamboo' && bambooStands.includes(target) && target.health > 0) {
        target.health = 0;
        addItemToInventory('wood', BAMBOO_WOOD_YIELD);
        showMessage(`Cut bamboo, got ${BAMBOO_WOOD_YIELD} wood.`, 2000);
        target.regrowTimer = 0;
        gathered = true;
    }
    return gathered;
}
// ===== END NEW HELPER FUNCTION =====


// ===== UPDATED handleKeyDown FUNCTION (Pause, Exit and Gather Logic + ESC for Panels) =====
function handleKeyDown(e) {
    const keyLower = e.key.toLowerCase();

    // --- PAUSE/RESUME Key ---
    if (keyLower === 'p') { // Use 'P' key to toggle pause
        // Only allow pausing if game is running and not over
        if (gameStarted && !gameOver) {
            togglePause();
            e.preventDefault(); // Prevent 'p' character input if needed
            return; // Handled pause toggle
        }
    }

    // --- If Paused, only allow unpausing ---
    if (isPaused) {
        // Allow 'P' to resume as well
        if (keyLower === 'p') {
             resumeGame();
        }
        // Prevent other keys from doing anything while paused
        return;
    }
    // --- End Pause Check ---


    keys[keyLower] = true; // Track the key being down if not paused

    // --- Panel Closing with ESC (keep this) ---
    if (keyLower === 'escape') {
        let panelClosed = false;
        // Check Help Panel
        if (helpPanel && helpPanel.style.display === 'flex') {
            hideHelpPanel();
            panelClosed = true;
        }
        // Check Leaderboard Panel // <<< ADDED CHECK FOR LEADERBOARD
        else if (leaderboardPanel && leaderboardPanel.style.display === 'flex') {
             hideLeaderboard();
             panelClosed = true;
         }
         // Check Crafting Panel
         else if (document.getElementById('crafting-panel').style.display === 'flex') {
             closeCraftingMenu();
             panelClosed = true;
         }

         if (panelClosed) {
            e.preventDefault(); // Prevent any default escape behavior
            return; // Action handled, no need to check other keys for this press
         }
         // Optional: Make Escape also pause the game if no other panels are open?
         // else if (gameStarted && !gameOver) {
         //     pauseGame();
         //     e.preventDefault();
         //     return;
         // }
    }
    // --- End Panel Closing ---


    // --- Rest of the game logic key checks (Run only if NOT paused) ---
    if (!gameStarted || gameOver) return; // Exit if game not running or over

    if (keyLower === 'e') {
        if (player.isInsideShelter) {
            // Player is INSIDE, check what's immediately outside
            const interactionTargetInfo = peekInteractionTarget(); // Use the helper

            const gatherableTypes = ['gatherTree', 'gatherRock', 'gatherBamboo'];

            if (gatherableTypes.includes(interactionTargetInfo.type)) {
                // --- EXIT AND GATHER ---
                const exitedShelter = player.isInsideShelter; // Store ref before clearing
                player.isInsideShelter = false;
                player.alpha = 1.0;
                if (exitedShelter) {
                     player.y = exitedShelter.y + exitedShelter.height - player.height / 2; // Push out
                }
                // Don't show exit message, the gather message will appear
                performGatheringAction(interactionTargetInfo);

            } else {
                // --- EXIT ONLY --- (Target is not resource or nothing)
                 const exitedShelter = player.isInsideShelter; // Store ref before clearing
                player.isInsideShelter = false;
                player.alpha = 1.0;
                if (exitedShelter) {
                     player.y = exitedShelter.y + exitedShelter.height - player.height / 2; // Push out
                }
                showMessage("Exited shelter.", 2000);
            }
            return; // Action handled (either exit or exit+gather)

        } else {
            // Player is OUTSIDE, interact normally
            interactWithWorld(); // This now uses peek and dispatches
            return;
        }
    }

    // --- Rest of the key handling (movement blocking, inventory, etc.) ---
    if (player.isInsideShelter) {
        const moveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
        if (moveKeys.includes(keyLower)) {
            return; // Block movement keys while inside
        }
    }

    // Handle inventory slot selection (1-5)
    if (e.key >= '1' && e.key <= String(VISIBLE_INVENTORY_SLOTS)) {
        const targetAbsoluteIndex = inventoryStartIndex + parseInt(e.key) - 1;
         if (targetAbsoluteIndex >= 0 && targetAbsoluteIndex < inventory.length) {
             selectInventorySlot(targetAbsoluteIndex);
         } else if (inventory.length > 0 && targetAbsoluteIndex >= inventory.length){
             selectInventorySlot(inventory.length - 1);
         } else if (inventory.length === 0) {
             selectInventorySlot(0);
         }
         return; // Prevent other actions if a number key was pressed
    }

    // Handle other keys
    if (keyLower === 'c') { toggleCraftingMenu(); }
    if (e.key === ' ') { // Use item with Spacebar
        e.preventDefault(); // Prevent spacebar scrolling the page
        useSelectedItem();
    }
}
// ===== END UPDATED handleKeyDown FUNCTION =====

// ===== UPDATED handleCanvasClick FUNCTION (with player push logic) =====
function handleCanvasClick(event) {
    if (!gameStarted || gameOver || isPaused) return; // Also prevent clicks when paused

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    let clickedShelter = false;
    let shelterFound = null;

    // Check if click hit a shelter
    for (const shelter of shelters) {
        if (checkCollision(clickX, clickY, 1, 1, shelter.x, shelter.y, shelter.width, shelter.height)) // Use checkCollision for point vs rect
        {
            clickedShelter = true;
            shelterFound = shelter;
            break;
        }
    }

    if (clickedShelter) {
        // Clicked on a shelter - Handles Enter/Exit
        if (!player.isInsideShelter) { // Enter if not already inside
            player.isInsideShelter = shelterFound; // Store reference to the shelter entered
            player.alpha = 0.4; // Make player semi-transparent
            showMessage("Entered shelter. Click outside or press E to exit.", 3000); // Updated click message
            // Snap player position slightly for visual cue (optional)
            player.x = shelterFound.x + shelterFound.width / 2 - player.width / 2;
            player.y = shelterFound.y + shelterFound.height / 2 - player.height / 2;
            hideInteractionPrompt(); // Hide other prompts when entering
        } else if (player.isInsideShelter === shelterFound) {
             // Clicked the same shelter they are already in - treat as exit
             const exitedShelter = player.isInsideShelter; // Store ref before clearing
             player.isInsideShelter = false;
             player.alpha = 1.0; // Restore full opacity

             // --- Push player slightly out of the shelter ---
             if(exitedShelter) {
                 player.y = exitedShelter.y + exitedShelter.height - player.height / 2; // Align bottom near shelter bottom edge
             }
             // --- End push ---

             showMessage("Exited shelter.", 2000);
        } else {
            // Clicked a *different* shelter while already inside one - exit current first
            const exitedShelter = player.isInsideShelter; // Store ref before clearing
            player.isInsideShelter = false;
            player.alpha = 1.0;

             // --- Push player slightly out of the *previous* shelter ---
             if(exitedShelter) {
                 player.y = exitedShelter.y + exitedShelter.height - player.height / 2; // Align bottom near shelter bottom edge
             }
             // --- End push ---

             showMessage("Exited previous shelter.", 1500);
             // Require a second click on the new shelter to enter it.
        }
    } else {
        // Clicked outside any shelter
        if (player.isInsideShelter) { // Exit if currently inside
             const exitedShelter = player.isInsideShelter; // Store ref before clearing
             player.isInsideShelter = false;
             player.alpha = 1.0; // Restore full opacity

             // --- Push player slightly out of the shelter ---
             if(exitedShelter) {
                 player.y = exitedShelter.y + exitedShelter.height - player.height / 2; // Align bottom near shelter bottom edge
             }
             // --- End push ---

             showMessage("Exited shelter.", 2000);
        }
    }
}
// ===== END UPDATED handleCanvasClick FUNCTION =====


// --- Modified Inventory Setup ---
function generateInventorySlots() {
    inventorySlotsContainer.innerHTML = ''; // Clear only the slots container
    for (let i = 0; i < VISIBLE_INVENTORY_SLOTS; i++) {
        const slot = document.createElement('div');
        slot.classList.add('inventory-slot');
        slot.dataset.visibleIndex = i; // Store the visible index (0-4)
        slot.addEventListener('click', (e) => {
            if (isPaused) return; // Prevent inventory clicks when paused
            // Allow clicking slots even if inside shelter
            const visibleIdx = parseInt(e.currentTarget.dataset.visibleIndex);
            const actualIndex = inventoryStartIndex + visibleIdx;
            if (actualIndex < inventory.length) {
               selectInventorySlot(actualIndex);
            }
            e.stopPropagation(); // Prevent inventory click from triggering canvas click (exit shelter)
        });
        inventorySlotsContainer.appendChild(slot);
    }
    updateInventoryUI(); // Initial population and button state update
}

function generateCraftingButtons() { const panel = document.getElementById('crafting-panel'); panel.querySelectorAll('.craft-button').forEach(btn => btn.remove()); for (const itemId in craftableItems) { const item = craftableItems[itemId]; const button = document.createElement('button'); button.classList.add('craft-button'); button.dataset.item = itemId; let reqText = Object.entries(item.requires).map(([res, count]) => `${resources[res]?.name || res}`).join(', '); button.innerHTML = `${item.name}<span class="craft-req">(${reqText})</span><span class="craft-req">${item.description}</span>`; button.addEventListener('click', craftItem); panel.insertBefore(button, document.getElementById('close-crafting')); } }

// ===== prepareGame FUNCTION =====
function prepareGame() {
    resetGameState(); // This now hides the pause popup and resets isPaused
    document.getElementById('title-screen').style.display = 'flex';
    gameOverScreen.style.display = 'none';
    // Leaderboard *panel* is hidden by default (display: none in CSS)
    // and also explicitly hidden in resetGameState.
    // The Leaderboard *button* on the title screen is visible due to CSS.
}
// ===== END prepareGame FUNCTION =====


function startGame() {
    hideLeaderboard(); // <<< ADDED: Ensure leaderboard is hidden on start
    hidePausePopup(); // Ensure pause popup is hidden on start
    console.log("startGame function called!");
    document.getElementById('title-screen').style.display = 'none';
    gameStarted = true;
    isPaused = false; // Ensure not paused on start
    gameOver = false; // Ensure not gameover
    rescued = false; // Ensure not rescued
    showMessage("Washed ashore... Need food, water, and shelter. Gather resources (E) and check crafting (C).", 6000);

    // Reset lastTime for the game loop
    lastTime = 0; // Let the game loop initialize it on the first frame

    // Start background audio
    if (backgroundAudio.paused) {
         backgroundAudio.play().catch(e => console.error("Audio play failed:", e));
    }

    // Start the game loop
    requestAnimationFrame(gameLoop); // *** Make sure the loop is started here ***
}

function restartGame() {
     // Ensure loop condition fails immediately and flags are correct
     gameStarted = false;
     gameOver = false;
     isPaused = false;
     rescued = false;
     prepareGame(); // This resets state and shows title
     // startGame will be called when the user clicks the button again
 }

// ===== resetGameState FUNCTION =====
function resetGameState() {
    gameStarted = false;
    gameOver = false;
    rescued = false;
    isPaused = false; // Reset pause state
    // Initialize player object here
     player = {
        x: WORLD_WIDTH / 2,
        y: WORLD_HEIGHT / 2,
        width: TILE_SIZE, // Use TILE_SIZE for consistency
        height: TILE_SIZE, // Use TILE_SIZE for consistency
        speed: 3, // Adjust this value to change movement speed (lower = slower, higher = faster)
        interactionRange: TILE_SIZE * 1.5, // Use TILE_SIZE base
        direction: 'down', // Initial facing direction
        isInsideShelter: false, // Initialize shelter flag (false means not inside)
        alpha: 1.0 // Visual transparency
    };
    // Reset stats including counters
    stats = {
        health: MAX_STAT, hunger: MAX_STAT, thirst: MAX_STAT, day: 1,
        totalItemsCollected: 0,
        fishCaught: 0
    };
    // Initialize empty inventory and reset view
    inventory = [];
    selectedSlot = 0;
    inventoryStartIndex = 0;
    time = { // Re-initialize time object fully
        current: 0,
        dayLength: 120,
        isNight: false,
        dayStartFactor: 0.0,
        morningStartFactor: 0.15,
        afternoonStartFactor: 0.4,
        eveningStartFactor: 0.7,
        nightStartFactor: 0.85
    };
    world = []; trees = []; rocks = []; bambooStands = [];
    campfires = []; shelters = []; waterFilters = []; signalFires = [];
    keys = {};
    grassPatches = []; // Reset grass patches
    hintFlags = { firstStone: false, nightWarning: false, lowHealth: false, lowHunger: false, lowThirst: false, shelterPlaced: false, purifierPlaced: false };
    generateWorld(); // Regenerate world (terrain, resources etc.)
    generateInventorySlots(); // Regenerate UI slots and apply initial state
    updateStatsUI(); // Call this *after* resetting stats
    updateDayNightIndicator();
    closeCraftingMenu(); hideInteractionPrompt(); hideTooltip();
    hideLeaderboard(); // <<< ADDED: Ensure leaderboard *panel* is hidden
    hideHelpPanel();
    hidePausePopup(); // Hide pause popup on reset
    clearTimeout(messageTimeout); messageBox.style.display = 'none';

    // Stop and reset background audio
    if (backgroundAudio && !backgroundAudio.paused) {
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0; // Reset to start
    }
}
// ===== END resetGameState FUNCTION =====


function generateGrassPatches() {
    grassPatches = []; // Clear any old patches
    const numPatches = 500; // Reduced slightly for potentially smaller grass area
    const patchSizeBase = TILE_SIZE / 3;
    for (let i = 0; i < numPatches; i++) {
        const tileX = Math.floor(Math.random() * WORLD_WIDTH_TILES);
        const tileY = Math.floor(Math.random() * WORLD_HEIGHT_TILES);
        // Ensure patch only generates on actual grass tiles within the world array
        if (world[tileY] && world[tileY][tileX] === TERRAIN_GRASS) {
            const px = tileX * TILE_SIZE + Math.random() * TILE_SIZE;
            const py = tileY * TILE_SIZE + Math.random() * TILE_SIZE;
            const patchW = patchSizeBase * (0.5 + Math.random());
            const patchH = patchSizeBase * (0.5 + Math.random());
            grassPatches.push({ x: px, y: py, w: patchW, h: patchH });
        }
    }
}

// ============================================
// ===== generateWorld FUNCTION =====
// ============================================
function generateWorld() {
    // 1. Initialize world grid with water
    world = Array(WORLD_HEIGHT_TILES).fill(0).map(() => Array(WORLD_WIDTH_TILES).fill(TERRAIN_WATER));

    // 2. Define island boundaries (adjust these for different shapes)
    const islandMarginX = 3; // Tiles from edge for water
    const islandMarginY = 2;
    const islandMinX = islandMarginX;
    const islandMaxX = WORLD_WIDTH_TILES - 1 - islandMarginX;
    const islandMinY = islandMarginY;
    const islandMaxY = WORLD_HEIGHT_TILES - 1 - islandMarginY;

    // 3. Create main island shape (irregular rectangle for now)
    for (let y = islandMinY; y <= islandMaxY; y++) {
        for (let x = islandMinX; x <= islandMaxX; x++) {
            // Add some randomness for a less perfect shape
            const noise = Math.random();
            if (noise < 0.95 || // Most tiles are land
                (x > islandMinX + 1 && x < islandMaxX - 1 && y > islandMinY + 1 && y < islandMaxY - 1)) // Inner core is always land
            {
                world[y][x] = TERRAIN_SAND; // Start with sand
            }
        }
    }

    // 4. Define grass area within the sand island
    const grassMargin = 2; // Tiles inside the sand border
    const grassMinX = islandMinX + grassMargin;
    const grassMaxX = islandMaxX - grassMargin;
    const grassMinY = islandMinY + grassMargin;
    const grassMaxY = islandMaxY - grassMargin;

    for (let y = grassMinY; y <= grassMaxY; y++) {
        for (let x = grassMinX; x <= grassMaxX; x++) {
            if (world[y]?.[x] === TERRAIN_SAND) { // Only convert existing sand to grass
                // Add slight randomness to grass edges
                const grassNoise = Math.random();
                if (grassNoise < 0.85 || (x > grassMinX + 1 && x < grassMaxX - 1 && y > grassMinY + 1 && y < grassMaxY - 1)) {
                   world[y][x] = TERRAIN_GRASS;
                }
            }
        }
    }

     // 5. Generate static grass patches on top of the grass terrain
    generateGrassPatches();

    // 6. Player Spawn (Ensure spawn on land, preferably grass)
    let spawnTileX = -1, spawnTileY = -1;
    let attempts = 0;
    while(attempts < 100 && (spawnTileX === -1 || world[spawnTileY]?.[spawnTileX] === TERRAIN_WATER)) {
        spawnTileX = Math.floor(grassMinX + Math.random() * (grassMaxX - grassMinX + 1));
        spawnTileY = Math.floor(grassMinY + Math.random() * (grassMaxY - grassMinY + 1));
        if (world[spawnTileY]?.[spawnTileX] === TERRAIN_GRASS) {
            break; // Found grass spawn
        }
         if (world[spawnTileY]?.[spawnTileX] === TERRAIN_SAND && attempts > 50) {
             break; // Accept sand spawn if grass fails
         }
        attempts++;
    }
     // Failsafe spawn if random placement failed
     if (spawnTileX === -1 || world[spawnTileY]?.[spawnTileX] === TERRAIN_WATER) {
         for (let y = islandMinY; y <= islandMaxY; y++) {
             for (let x = islandMinX; x <= islandMaxX; x++) {
                 if(world[y]?.[x] === TERRAIN_GRASS || world[y]?.[x] === TERRAIN_SAND) {
                     spawnTileX = x;
                     spawnTileY = y;
                     break;
                 }
             }
             if (spawnTileX !== -1) break;
         }
     }
     // Final Failsafe
     if (spawnTileX === -1) { spawnTileX = Math.floor(WORLD_WIDTH_TILES / 2); spawnTileY = Math.floor(WORLD_HEIGHT_TILES / 2); }

     player.x = spawnTileX * TILE_SIZE + TILE_SIZE / 2 - player.width / 2;
     player.y = spawnTileY * TILE_SIZE + TILE_SIZE / 2 - player.height / 2;


    // 7. Resource Placement (Ensure spawning on valid land tiles)
    const numTrees = 45; // Slightly fewer trees for potentially smaller land mass
    const numRocks = 8;
    const numBambooStands = 18;
    const treeRegrowTimeSeconds = TREE_REGROW_DAYS * time.dayLength;
    const bambooRegrowTimeSeconds = BAMBOO_REGROW_DAYS * time.dayLength;

    // Helper to check if a tile is valid land (grass or sand)
    const isLandTile = (tx, ty) => {
        const tileType = world[ty]?.[tx];
        return tileType === TERRAIN_GRASS || tileType === TERRAIN_SAND;
    };
     // Helper to check if a tile is grass
    const isGrassTile = (tx, ty) => world[ty]?.[tx] === TERRAIN_GRASS;

     // Modified canPlace to check for land tiles and avoid water
    const canPlace = (px, py, w, h, checkDist = 50) => {
         const tileX = Math.floor((px + w / 2) / TILE_SIZE);
         const tileY = Math.floor((py + h / 2) / TILE_SIZE);

         // MUST be on a land tile
         if (!isLandTile(tileX, tileY)) return false;
         // Resources like Trees/Bamboo typically only on Grass (Rocks might be ok on Sand)
         // Check if the current placement attempt is for a rock
         const isPlacingRock = (rocks.length < numRocks); // Simple check based on counts
         if (!isGrassTile(tileX, tileY) && !isPlacingRock) {
             return false; // Trees/Bamboo must be on grass
         }


         // Avoid spawning too close to the absolute edge of the map (might be water)
         if (tileX < 1 || tileX >= WORLD_WIDTH_TILES - 1 || tileY < 1 || tileY >= WORLD_HEIGHT_TILES - 1) return false;

         // Avoid spawning too close to player start
         const spawnPointX = player.x; const spawnPointY = player.y;
         if (dist(px + w/2, py + h/2, spawnPointX + player.width/2, spawnPointY + player.height/2) < TILE_SIZE * 4) return false; // Increased distance from spawn

         // Avoid spawning too close to other resources
         const allObstacles = [...trees, ...rocks, ...bambooStands];
         for (const obs of allObstacles) {
             // Slightly stricter check to avoid visual overlap
             if (checkCollision(px, py, w, h, obs.x, obs.y, obs.width, obs.height)) return false;
             if (dist(px + w/2, py + h/2, obs.x + obs.width/2, obs.y + obs.height/2) < TILE_SIZE * 1.1) return false; // Keep spacing check too
         }
         return true;
    }

    // Place Trees (Primarily on Grass)
    let treesPlaced = 0; attempts = 0;
    while(treesPlaced < numTrees && attempts < numTrees * 25) { // Increased attempts
        const treeW = TILE_SIZE * 1.5, treeH = TILE_SIZE * 2;
        // Try placing anywhere on the island first
        const tileX = Math.floor(islandMinX + Math.random() * (islandMaxX - islandMinX + 1));
        const tileY = Math.floor(islandMinY + Math.random() * (islandMaxY - islandMinY + 1));

        if (isGrassTile(tileX, tileY)) { // Prefer grass
            let x = tileX * TILE_SIZE + (Math.random() - 0.5) * TILE_SIZE * 0.5;
            let y = tileY * TILE_SIZE + (Math.random() - 0.5) * TILE_SIZE * 0.5;
            if (canPlace(x, y, treeW, treeH, TILE_SIZE * 1.5)) {
                trees.push({ x, y, width: treeW, height: treeH, health: 3, maxHealth: 3, regrowTimer: 0, regrowTime: treeRegrowTimeSeconds });
                treesPlaced++;
            }
        }
        attempts++;
    } if(treesPlaced < numTrees) console.warn(`Only placed ${treesPlaced}/${numTrees} trees.`);

     // Place Rocks (Can be on Grass or Sand, avoid water)
     let rocksPlaced = 0; attempts = 0;
     while(rocksPlaced < numRocks && attempts < numRocks * 40) { // Increased attempts
         const rockW = TILE_SIZE, rockH = TILE_SIZE;
         const tileX = Math.floor(islandMinX + Math.random() * (islandMaxX - islandMinX + 1));
         const tileY = Math.floor(islandMinY + Math.random() * (islandMaxY - islandMinY + 1));

         if (isLandTile(tileX, tileY)) { // Must be on land
             let x = tileX * TILE_SIZE + Math.random() * TILE_SIZE * 0.5;
             let y = tileY * TILE_SIZE + Math.random() * TILE_SIZE * 0.5;
             if (canPlace(x, y, rockW, rockH, TILE_SIZE * 1.5)) {
                 rocks.push({ x, y, width: rockW, height: rockH, health: 4, maxHealth: 4 });
                 rocksPlaced++;
             }
         }
         attempts++;
     } if(rocksPlaced < numRocks) console.warn(`Only placed ${rocksPlaced}/${numRocks} rocks.`);

     // Place Bamboo (Primarily on Grass)
      let bambooPlaced = 0; attempts = 0;
      while(bambooPlaced < numBambooStands && attempts < numBambooStands * 30) { // Increased attempts
          const bambooW = TILE_SIZE * 0.8, bambooH = TILE_SIZE * 1.2;
          const tileX = Math.floor(islandMinX + Math.random() * (islandMaxX - islandMinX + 1));
          const tileY = Math.floor(islandMinY + Math.random() * (islandMaxY - islandMinY + 1));

          if (isGrassTile(tileX, tileY)) { // Prefer grass
               let x = tileX * TILE_SIZE + Math.random() * TILE_SIZE * 0.5;
               let y = tileY * TILE_SIZE + Math.random() * TILE_SIZE * 0.5;
              if (canPlace(x, y, bambooW, bambooH, TILE_SIZE)) {
                  bambooStands.push({ x, y, width: bambooW, height: bambooH, health: BAMBOO_HEALTH, maxHealth: BAMBOO_HEALTH, regrowTimer: 0, regrowTime: bambooRegrowTimeSeconds });
                  bambooPlaced++;
              }
          }
          attempts++;
      } if(bambooPlaced < numBambooStands) console.warn(`Only placed ${bambooPlaced}/${numBambooStands} bamboo stands.`);
}
// ============================================
// === END generateWorld FUNCTION ===
// ============================================


// --- Game Loop ---
let lastTime = 0; // Keep this global

function gameLoop(currentTime) {
    // --- Exit conditions ---
    // Check if game is meant to be running at all
    if (!gameStarted) {
        // Game hasn't started or has been stopped (e.g., reset), don't continue loop
        return;
    }
     if (gameOver) {
         // Game is over, stop the loop (or just stop updating/rendering game elements)
         // For simplicity, we can just stop requesting new frames.
         return;
     }

    // --- Pause Handling ---
    if (isPaused) {
        // If paused, we *don't* update game logic (update())
        // We *do* keep rendering to show the static paused screen and popup
        render(); // Draw the last frame again (or a specific pause frame)
        // We *do* keep the loop going so it can detect unpausing
        requestAnimationFrame(gameLoop);
        return; // Exit the function here for this frame
    }

    // --- If not paused and game is running ---

    // Initialize or reset lastTime on the first frame *after* unpausing or starting
    // (Handled implicitly by resetting lastTime in resumeGame and startGame)
    if (lastTime === 0) { // Handle the very first frame after start
        lastTime = currentTime;
        requestAnimationFrame(gameLoop);
        return; // Skip update/render on the absolute first frame
    }


    // Calculate deltaTime based on the *last* valid frame time
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime; // Update lastTime for the *next* frame

    // Clamp deltaTime to prevent massive jumps if the tab was inactive
    // (Avoids player teleporting, stats plummeting instantly after lag)
    const MAX_DELTA_TIME = 0.1; // Allow max 100ms update step (adjust as needed)
    const clampedDeltaTime = Math.min(deltaTime, MAX_DELTA_TIME);

    // --- Update and Render ---
    update(clampedDeltaTime); // Update game state using the safe delta time
    render(); // Draw the new game state

    // Request the next frame
    requestAnimationFrame(gameLoop);
}


// --- Update Functions ---
function update(deltaTime) {
    // This function ONLY runs if gameStarted is true, gameOver is false, AND isPaused is false
    updateTime(deltaTime);
    updatePlayerMovement(deltaTime);
    updateWorldInteractions(deltaTime); // Handle interaction prompts
    updateResources(deltaTime);
    updateStats(deltaTime);
    updateSignalFires(deltaTime);
    checkGameOver();
}

// ===== updateTime FUNCTION =====
function updateTime(deltaTime) {
    let previousDay = stats.day;
    time.current = (time.current + deltaTime);

    if (time.current >= time.dayLength) {
        time.current %= time.dayLength;
        stats.day++;
        hintFlags.nightWarning = false;
        showMessage(`Day ${stats.day} has begun.`);
    }

    const timeOfDayFactor = time.current / time.dayLength;

    // Determine if it's night for gameplay logic (stricter definition)
    time.isNight = timeOfDayFactor >= time.nightStartFactor || timeOfDayFactor < time.morningStartFactor; // Deep night or very early morning

    updateDayNightIndicator(); // Update the circle indicator
    updateStatsUI(); // Update the bars (including the day/time bar)

    // Issue night warning based on evening start
    if (!hintFlags.nightWarning && timeOfDayFactor >= time.eveningStartFactor && timeOfDayFactor < time.nightStartFactor) {
        showMessage("Sun is setting. It might get cold. Consider fire or shelter.", 5000);
        hintFlags.nightWarning = true;
    } else if (timeOfDayFactor < time.eveningStartFactor) {
        hintFlags.nightWarning = false; // Reset warning flag during the day
    }
}
// ===== END updateTime FUNCTION =====


function updatePlayerMovement(deltaTime) {
    if (player.isInsideShelter) return; // Don't move if inside shelter
    let dx = 0; let dy = 0;
    const currentSpeed = player.speed * TILE_SIZE * deltaTime;
    if (keys['w'] || keys['arrowup']) { dy -= currentSpeed; player.direction = 'up'; }
    if (keys['s'] || keys['arrowdown']) { dy += currentSpeed; player.direction = 'down'; }
    if (keys['a'] || keys['arrowleft']) { dx -= currentSpeed; player.direction = 'left'; }
    if (keys['d'] || keys['arrowright']) { dx += currentSpeed; player.direction = 'right'; }
    if (dx === 0 && dy === 0) return;

    let nextX = player.x + dx;
    let nextY = player.y + dy;

    // Basic World Boundary Check (keep player within canvas)
    if (nextX < 0) nextX = 0;
    if (nextY < 0) nextY = 0;
    if (nextX + player.width > WORLD_WIDTH) nextX = WORLD_WIDTH - player.width;
    if (nextY + player.height > WORLD_HEIGHT) nextY = WORLD_HEIGHT - player.height;

    // --- Collision Detection ---
    let collisionX = false;
    let collisionY = false;

    // 1. Terrain Collision (Water)
    const nextPlayerRect = { x: nextX, y: nextY, width: player.width, height: player.height };
    const cornerCheckMargin = TILE_SIZE * 0.2; // Check slightly inside corners

     // Check X movement collision
    const nextPlayerRectX = { x: nextX, y: player.y, width: player.width, height: player.height };
     const cornersX = [
         { x: nextPlayerRectX.x + cornerCheckMargin, y: nextPlayerRectX.y + cornerCheckMargin },
         { x: nextPlayerRectX.x + nextPlayerRectX.width - cornerCheckMargin, y: nextPlayerRectX.y + cornerCheckMargin },
         { x: nextPlayerRectX.x + cornerCheckMargin, y: nextPlayerRectX.y + nextPlayerRectX.height - cornerCheckMargin },
         { x: nextPlayerRectX.x + nextPlayerRectX.width - cornerCheckMargin, y: nextPlayerRectX.y + nextPlayerRectX.height - cornerCheckMargin }
     ];
    for (const corner of cornersX) {
        const tileX = Math.floor(corner.x / TILE_SIZE);
        const tileY = Math.floor(corner.y / TILE_SIZE);
        if (world[tileY]?.[tileX] === TERRAIN_WATER) {
            collisionX = true;
            // Snap back based on movement direction
            if (dx > 0) nextX = tileX * TILE_SIZE - player.width;
            else if (dx < 0) nextX = (tileX + 1) * TILE_SIZE;
            break;
        }
    }

     // Check Y movement collision
     const nextPlayerRectY = { x: player.x, y: nextY, width: player.width, height: player.height };
     const cornersY = [
          { x: nextPlayerRectY.x + cornerCheckMargin, y: nextPlayerRectY.y + cornerCheckMargin },
          { x: nextPlayerRectY.x + nextPlayerRectY.width - cornerCheckMargin, y: nextPlayerRectY.y + cornerCheckMargin },
          { x: nextPlayerRectY.x + cornerCheckMargin, y: nextPlayerRectY.y + nextPlayerRectY.height - cornerCheckMargin },
          { x: nextPlayerRectY.x + nextPlayerRectY.width - cornerCheckMargin, y: nextPlayerRectY.y + nextPlayerRectY.height - cornerCheckMargin }
     ];
    for (const corner of cornersY) {
        const tileX = Math.floor(corner.x / TILE_SIZE);
        const tileY = Math.floor(corner.y / TILE_SIZE);
         if (world[tileY]?.[tileX] === TERRAIN_WATER) {
            collisionY = true;
             // Snap back based on movement direction
            if (dy > 0) nextY = tileY * TILE_SIZE - player.height;
            else if (dy < 0) nextY = (tileY + 1) * TILE_SIZE;
            break;
        }
    }


    // 2. Obstacle Collision (Trees, Rocks, Placed Items - EXCLUDING shelters for movement)
    const obstacles = [ ...trees.filter(t => t.health > 0), ...rocks.filter(r => r.health > 0), ...bambooStands.filter(b => b.health > 0), ...campfires, ...waterFilters, ...signalFires ]; // Removed shelters from movement collision
    for (const obj of obstacles) {
        // Check X collision separately
        if (!collisionX && checkCollision(nextX, player.y, player.width, player.height, obj.x, obj.y, obj.width, obj.height)) {
            collisionX = true;
            // Adjust nextX based on collision side
            if (dx > 0) nextX = obj.x - player.width; // Moving right, hit left side of obstacle
            else if (dx < 0) nextX = obj.x + obj.width; // Moving left, hit right side of obstacle
        }
        // Check Y collision separately
        if (!collisionY && checkCollision(player.x, nextY, player.width, player.height, obj.x, obj.y, obj.width, obj.height)) {
            collisionY = true;
             // Adjust nextY based on collision side
            if (dy > 0) nextY = obj.y - player.height; // Moving down, hit top side of obstacle
            else if (dy < 0) nextY = obj.y + obj.height; // Moving up, hit bottom side of obstacle
        }
    }
     // Add shelter collision check separately AFTER other obstacles
     for (const shelter of shelters) {
         // Only collide if the player is NOT inside this specific shelter
         if (player.isInsideShelter !== shelter) {
              // Check X collision separately
              if (!collisionX && checkCollision(nextX, player.y, player.width, player.height, shelter.x, shelter.y, shelter.width, shelter.height)) {
                  collisionX = true;
                  if (dx > 0) nextX = shelter.x - player.width;
                  else if (dx < 0) nextX = shelter.x + shelter.width;
              }
              // Check Y collision separately
              if (!collisionY && checkCollision(player.x, nextY, player.width, player.height, shelter.x, shelter.y, shelter.width, shelter.height)) {
                  collisionY = true;
                  if (dy > 0) nextY = shelter.y - player.height;
                  else if (dy < 0) nextY = shelter.y + shelter.height;
              }
         }
    }


    // Final Boundary check after collision adjustments
    if (nextX < 0) nextX = 0;
    if (nextY < 0) nextY = 0;
    if (nextX + player.width > WORLD_WIDTH) nextX = WORLD_WIDTH - player.width;
    if (nextY + player.height > WORLD_HEIGHT) nextY = WORLD_HEIGHT - player.height;

    // Update player position if no collision occurred on that axis
    if (!collisionX) player.x = nextX;
    if (!collisionY) player.y = nextY;
}


// ==================================================
// ===== updateWorldInteractions FUNCTION =====
// ==================================================
// This function now only UPDATES the prompt based on peekInteractionTarget
function updateWorldInteractions(deltaTime) {
    if (player.isInsideShelter) {
         hideInteractionPrompt();
         return; // No prompts inside shelter
    }

    const interactionResult = peekInteractionTarget();
    let promptText = "";

    switch (interactionResult.type) {
        case 'addFuel':
            promptText = `Press E to Add Wood (Fuel: ${Math.ceil(interactionResult.target.fuel)}/${interactionResult.target.maxFuel})`;
            break;
        case 'usePurifier':
             promptText = "Press E to Use Water Purifier";
            break;
        case 'gatherTree':
            promptText = "Press E to Chop Tree";
            break;
        case 'gatherRock':
             promptText = "Press E to Mine Rock";
            break;
        case 'gatherBamboo':
             promptText = "Press E to Cut Bamboo";
            break;
        case 'fish':
            promptText = "Press E to Fish";
            break;
        case 'drinkDirtyWater':
            promptText = "Press E to Drink Dirty Water";
            break;
        case 'pickupShelter':
            promptText = "Press E to Pick Up Shelter";
            break;
        case 'none':
        default:
            // Check for signal fire refuel prompt separately if nothing else detected
             if (inventory[selectedSlot] && inventory[selectedSlot].item === 'wood' && inventory[selectedSlot].count > 0) {
                 for (const fire of signalFires) {
                      const fireCenterX = fire.x + fire.width / 2;
                      const fireCenterY = fire.y + fire.height / 2;
                      if (dist(player.x + player.width / 2, player.y + player.height / 2, fireCenterX, fireCenterY) < player.interactionRange + TILE_SIZE) { // Check player proximity
                          promptText = `Press E to Add Wood (Fuel: ${Math.ceil(fire.fuel)}/${fire.maxFuel})`;
                          break; // Found a fire to potentially refuel
                      }
                  }
             }
             break;
    }

    if (promptText) {
        showInteractionPrompt(promptText);
    } else {
        hideInteractionPrompt();
    }
}
// ==================================================
// === END updateWorldInteractions FUNCTION ===
// ==================================================

function updateResources(deltaTime) { trees.forEach(t => { if (t.health <= 0) { t.regrowTimer += deltaTime; if (t.regrowTimer >= t.regrowTime) { t.health = t.maxHealth; t.regrowTimer = 0; } } }); bambooStands.forEach(b => { if (b.health <= 0) { b.regrowTimer += deltaTime; if (b.regrowTimer >= b.regrowTime) { b.health = b.maxHealth; b.regrowTimer = 0; } } }); }
function updateStats(deltaTime) {
    const hR = 0.5, tR = 0.75; const sD = 2.0, dD = 2.5, nCD = 1.5; const shelterHungerFactor = 0.3; const shelterThirstFactor = 0.3;
    let currentHungerRate = hR; let currentThirstRate = tR; let coldDamageRate = nCD;
    const inS = !!player.isInsideShelter;
    if (inS) { currentHungerRate *= shelterHungerFactor; currentThirstRate *= shelterThirstFactor; coldDamageRate = 0; }
    stats.hunger -= currentHungerRate * deltaTime; stats.thirst -= currentThirstRate * deltaTime;
    let healthChange = 0;
    if(stats.hunger<30&&!hintFlags.lowHunger){showMessage("Feeling hungry. Find food.", 3000); hintFlags.lowHunger=true;} else if(stats.hunger>50)hintFlags.lowHunger=false;
    if(stats.thirst<30&&!hintFlags.lowThirst){showMessage("Very thirsty. Find water.", 3000); hintFlags.lowThirst=true;} else if(stats.thirst>50)hintFlags.lowThirst=false;
    if(stats.health<50&&!hintFlags.lowHealth){showMessage("Health is low!", 3000); hintFlags.lowHealth=true;} else if(stats.health>70)hintFlags.lowHealth=false;
    if(stats.hunger <= 0) healthChange -= sD * deltaTime; if(stats.thirst <= 0) healthChange -= dD * deltaTime;
    const nearCF = !inS && isPlayerNearObject(campfires, TILE_SIZE * 2.5); // Adjusted range check
    const nearSF = !inS && isPlayerNearObject(signalFires.filter(f => f.isBurning), TILE_SIZE * 3); // Adjusted range check
    if (time.isNight && !nearCF && !nearSF && !inS) { healthChange -= coldDamageRate * deltaTime; if(Math.random()<0.03*deltaTime)showMessage("Freezing! Find warmth!", 2000); }
    stats.health += healthChange;
    stats.hunger = Math.max(0, Math.min(MAX_STAT, stats.hunger)); stats.thirst = Math.max(0, Math.min(MAX_STAT, stats.thirst)); stats.health = Math.max(0, Math.min(MAX_STAT, stats.health));
    updateStatsUI(); // This now updates the bars too
}
function updateSignalFires(deltaTime) { let activeSF = false; signalFires.forEach(f => { if (f.isBurning) { f.fuel -= deltaTime * f.burnRate; if (f.fuel <= 0) { f.isBurning = false; f.fuel = 0; } else { activeSF = true; } } }); if (stats.day >= RESCUE_START_DAY && activeSF && !gameOver) { const chance = BASE_RESCUE_CHANCE * deltaTime / time.dayLength; if (Math.random() < chance) { triggerRescue(); } } }

// --- START LEADERBOARD FUNCTIONS --- // <<< ADDED FROM OLDER
function loadLeaderboard(key) {
     try {
         const data = localStorage.getItem(key);
         return data ? JSON.parse(data) : [];
     } catch (e) {
         console.error("Error loading leaderboard:", key, e);
         return []; // Return empty array on error
     }
 }

 function saveScoreToLeaderboard(key, playerName, scoreValue) {
     if (!playerName || scoreValue <= 0) return; // Don't save invalid entries
     const leaderboard = loadLeaderboard(key);
     const newScore = {
         name: playerName,
         score: scoreValue,
         date: new Date().toLocaleDateString() // Add a date stamp
     };
     leaderboard.push(newScore);
     // Sort descending (highest score first)
     leaderboard.sort((a, b) => b.score - a.score);
     // Keep only the top N entries
     const trimmedLeaderboard = leaderboard.slice(0, LEADERBOARD_MAX_ENTRIES);
     try {
         localStorage.setItem(key, JSON.stringify(trimmedLeaderboard));
     } catch (e) {
         console.error("Error saving leaderboard:", key, e);
         // Maybe show a message to the user?
         // showMessage("Could not save leaderboard score (Storage Error).", 4000);
     }
 }

 function doesScoreQualify(key, scoreValue) {
     if (scoreValue <= 0) return false; // Score must be positive
     const leaderboard = loadLeaderboard(key);
     // If leaderboard isn't full, any score qualifies
     if (leaderboard.length < LEADERBOARD_MAX_ENTRIES) {
         return true;
     }
     // If full, check if new score is higher than the lowest score
     return scoreValue > (leaderboard[leaderboard.length - 1]?.score || 0);
 }

 function checkAndSaveLeaderboardScores() {
     const finalDays = stats.day;
     const finalItems = stats.totalItemsCollected;
     const finalFish = stats.fishCaught;
     let playerName = "Survivor"; // Default name
     let promptedForName = false;

     // Check if any score qualifies for any category
     const qualifiesDays = doesScoreQualify(LEADERBOARD_KEYS.days, finalDays);
     const qualifiesItems = doesScoreQualify(LEADERBOARD_KEYS.items, finalItems);
     const qualifiesFish = doesScoreQualify(LEADERBOARD_KEYS.fish, finalFish);

     if (qualifiesDays || qualifiesItems || qualifiesFish) {
         const nameInput = prompt(`New high score! Enter your name (max 15 chars):`, "Survivor");
         if (nameInput) { // User didn't cancel prompt
             playerName = nameInput.substring(0, 15).trim() || "Survivor"; // Limit length and trim whitespace
             promptedForName = true;

             // Save scores for categories where player qualified
             if (qualifiesDays) saveScoreToLeaderboard(LEADERBOARD_KEYS.days, playerName, finalDays);
             if (qualifiesItems) saveScoreToLeaderboard(LEADERBOARD_KEYS.items, playerName, finalItems);
             if (qualifiesFish) saveScoreToLeaderboard(LEADERBOARD_KEYS.fish, playerName, finalFish);

         } else {
             console.log("Player cancelled name input for leaderboard.");
             // Optionally save with default name even if cancelled? Or don't save at all. Current behaviour: don't save if cancelled.
         }
     }
     // No need to display leaderboard here automatically, handled in gameOver/rescue functions
 }

// ===== displayLeaderboard FUNCTION =====
// >>> This function shows the leaderboard *panel* <<<
function displayLeaderboard() {
     if (isPaused) return; // Don't show leaderboard if paused

     // Populates and shows the leaderboard panel
    const populateList = (listElement, data, unit) => {
        listElement.innerHTML = ''; // Clear previous entries
        if (data.length === 0) {
            listElement.innerHTML = '<li>No scores yet!</li>';
        } else {
            data.forEach((entry, index) => {
                const li = document.createElement('li');
                // Use innerHTML to easily add styled spans
                li.innerHTML = `<span class="rank">${index + 1}.</span> <span class="name">${entry.name}</span> <span class="score">${entry.score} ${unit}</span> <span class="date">${entry.date}</span>`;
                listElement.appendChild(li);
            });
        }
    };
    // Populate all sections
    populateList(lbDaysList, loadLeaderboard(LEADERBOARD_KEYS.days), "Days");
    populateList(lbItemsList, loadLeaderboard(LEADERBOARD_KEYS.items), "Items");
    populateList(lbFishList, loadLeaderboard(LEADERBOARD_KEYS.fish), "Fish");

    leaderboardPanel.style.display = 'flex'; // Makes the panel visible
}
// ===== END displayLeaderboard FUNCTION =====


// ===== hideLeaderboard FUNCTION =====
// >>> This function hides the leaderboard *panel* <<<
function hideLeaderboard() {
    console.log("Hiding leaderboard panel..."); // Add log for debugging
     if (leaderboardPanel) leaderboardPanel.style.display = 'none'; // Hides the panel
}
// ===== END hideLeaderboard FUNCTION =====
// --- END LEADERBOARD FUNCTIONS ---


// --- Game End Functions ---

// ===== triggerRescue FUNCTION (Modified to show leaderboard) =====
function triggerRescue() {
    if (gameOver) return;
    // gameStarted = false; // Setting gameOver is enough to stop the loop's updates
    gameOver = true; // Signal game end
    rescued = true;

    // Stop background audio
    if (backgroundAudio && !backgroundAudio.paused) {
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0;
    }

    checkAndSaveLeaderboardScores(); // Save scores first
    showMessage("You hear an airplane overhead! They've spotted your fire!", 5000);
    setTimeout(() => {
        gameOverTitle.textContent = "Rescued!";
        gameOverTitle.style.color = '#8cc751';
        daysSurvivedText.innerHTML = `You survived for ${stats.day} days!<br>Collected ${stats.totalItemsCollected} items.<br>Caught ${stats.fishCaught} fish.`;
        gameOverScreen.style.display = 'flex'; // Show game over screen

         // ***** Show leaderboard *panel* after showing rescue screen *****
        setTimeout(() => {
            displayLeaderboard(); // Show leaderboard panel after game over/rescue message appears
        }, 1500); // Delay showing leaderboard slightly

    }, 4000); // Delay for rescue message
}
// ===== END triggerRescue FUNCTION =====

// ===== checkGameOver FUNCTION (Modified to show leaderboard) =====
function checkGameOver() {
    if (!gameOver && stats.health <= 0) {
        // gameStarted = false; // Setting gameOver is enough to stop the loop's updates
        gameOver = true; // Signal game end

        // Stop background audio
        if (backgroundAudio && !backgroundAudio.paused) {
            backgroundAudio.pause();
            backgroundAudio.currentTime = 0;
        }

        checkAndSaveLeaderboardScores(); // Save scores first
        gameOverTitle.textContent = "Game Over";
        gameOverTitle.style.color = '#ff4d4d';
        daysSurvivedText.innerHTML = `You survived for ${stats.day} days.<br>Collected ${stats.totalItemsCollected} items.<br>Caught ${stats.fishCaught} fish.`;
        gameOverScreen.style.display = 'flex'; // Show game over screen
        showMessage("You didn't survive...", 3000); // Shorten message duration slightly

        // ***** Show leaderboard *panel* after showing game over screen *****
        setTimeout(() => {
            displayLeaderboard(); // Show leaderboard panel after game over/rescue message appears
        }, 1500); // Delay showing leaderboard slightly
    }
}
// ===== END checkGameOver FUNCTION =====


// --- Interaction & Actions ---

// ===== interactWithWorld FUNCTION =====
function interactWithWorld() {
    // Called by handleKeyDown when player is OUTSIDE shelter
    if (gameOver || player.isInsideShelter || isPaused) return; // Prevent interaction when paused

    const interactionResult = peekInteractionTarget(); // Find what to interact with

    switch (interactionResult.type) {
        case 'addFuel':
            const f = interactionResult.target;
            const selectedItem = inventory[selectedSlot]; // Need this check here too
            if(selectedItem && selectedItem.item==='wood'&&selectedItem.count>0){
                const fuelToAdd = Math.min(selectedItem.count, 10); // Add up to 10 wood at a time
                f.fuel = Math.min(f.maxFuel, f.fuel + fuelToAdd * f.fuelPerWood);
                f.isBurning = true; // Ensure it's burning when fuel is added
                removeItemFromInventory('wood', fuelToAdd);
                showMessage(`Added ${fuelToAdd} wood. Fuel: ${Math.ceil(f.fuel)}/${f.maxFuel}`, 2500);
            } else {
                showMessage("Select wood to add fuel.", 2000);
            }
            break;
        case 'usePurifier':
            stats.thirst = Math.min(MAX_STAT, stats.thirst + 40);
            stats.health = Math.min(MAX_STAT, stats.health + 2); // Small health boost from hydration
            showMessage("Used purifier. Drank clean water (+2 Health).", 2000);
            updateStatsUI();
            break;
        case 'gatherTree':
        case 'gatherRock':
        case 'gatherBamboo':
            performGatheringAction(interactionResult); // Call the helper
            break;
        case 'fish':
            const hasRod = inventory.some(s => s && s.item === 'fishingRod'); // Need check here too
            if (hasRod) {
                const fishChance = time.isNight ? 0.9 : 0.4; // Higher chance at night
                if (Math.random() < fishChance) {
                    if (addItemToInventory('fish', 1)) { // addItemToInventory increments stats.fishCaught now
                        showMessage(`Caught a fish!${time.isNight ? ' (Night!)' : ''}`, 2500);
                     }
                 } else {
                     showMessage("Fishing... no luck.", 2000);
                 }
                 // No need to manually update stats here, addItem handles it
                 updateStatsUI(); // Update UI after potential catch/stat change
             } else {
                 showMessage("Need a fishing rod.", 2000);
             }
            break;
        case 'drinkDirtyWater':
             stats.thirst = Math.min(MAX_STAT, stats.thirst + 15); // Less thirst quench
             if (Math.random() < 0.3) { // 30% chance of getting sick
                 stats.health = Math.max(0, stats.health - 10);
                 showMessage("Drank dirty water. Felt unwell (-10 Health).", 2500);
             } else {
                 showMessage("Drank dirty water. Risky...", 2000);
             }
             updateStatsUI();
            break;
        case 'pickupShelter':
             const targetShelter = interactionResult.target;
             if (addItemToInventory('shelter', 1)) {
                 const index = shelters.indexOf(targetShelter);
                 if (index > -1) { shelters.splice(index, 1); }
                 showMessage("Picked up Shelter.", 2000);
             } else {
                 showMessage("Cannot pick up shelter, inventory full!", 2500);
             }
            break;
        case 'none':
            // showMessage("Nothing to interact with here.", 1000); // Optional feedback
            break;
    }
}
// ===== END interactWithWorld FUNCTION =====


function useSelectedItem() {
     if (gameOver || player.isInsideShelter || isPaused) return; // Prevent using items while inside shelter or paused
     const selected = inventory[selectedSlot];
     if (!selected || selected.item === 'none' || selected.count <= 0) return;
     const itemName = selected.item;

     // 1. Consumable Items (Food)
     if (resources[itemName] && (resources[itemName].restoresHunger || resources[itemName].heals)) {
         stats.hunger = Math.min(MAX_STAT, stats.hunger + (resources[itemName].restoresHunger || 0));
         stats.health = Math.min(MAX_STAT, stats.health + (resources[itemName].heals || 0));
         removeItemFromInventory(itemName, 1);
         showMessage(`Ate ${resources[itemName].name}. ${resources[itemName].heals > 0 ? `(+${resources[itemName].heals}H)` : ''}`, 2000);
         updateStatsUI();
         return; // Action completed
     }

     // 2. Placeable Items
      if (craftableItems[itemName] && craftableItems[itemName].placeable) {
         const itemData = craftableItems[itemName];
         const placeW = itemData.width;
         const placeH = itemData.height;

         // Determine placement position based on player facing direction
         let placeX = player.x + player.width / 2 - placeW / 2; // Center horizontally initially
         let placeY;
         const placementDist = TILE_SIZE * 0.3; // How far in front to place

         switch(player.direction) {
             case 'up':    placeY = player.y - placeH - placementDist; break;
             case 'down':  placeY = player.y + player.height + placementDist; break;
             case 'left':  placeX = player.x - placeW - placementDist; placeY = player.y + player.height / 2 - placeH / 2; break;
             case 'right': placeX = player.x + player.width + placementDist; placeY = player.y + player.height / 2 - placeH / 2; break;
             default:      placeY = player.y + player.height + placementDist; // Default to down
         }

         let canPlace = true;
         const placeRect = { x: placeX, y: placeY, width: placeW, height: placeH };
         const placeCenterX = placeX + placeW / 2;
         const placeCenterY = placeY + placeH / 2;
         const placeTileX = Math.floor(placeCenterX / TILE_SIZE);
         const placeTileY = Math.floor(placeCenterY / TILE_SIZE);
         const targetTileType = world[placeTileY]?.[placeTileX];

         // --- Placement Rules ---
         // General: Cannot place outside world bounds
         if (placeX < 0 || placeY < 0 || placeX + placeW > WORLD_WIDTH || placeY + placeH > WORLD_HEIGHT) {
             showMessage("Cannot place outside the island bounds.", 2000);
             canPlace = false;
         }
         // General: Cannot place in Water
         if (canPlace && targetTileType === TERRAIN_WATER) {
              showMessage("Cannot place in water.", 2000);
              canPlace = false;
         }
         // General: Cannot place if colliding with existing objects (including other shelters now)
         if (canPlace) {
             const allObstacles = [...trees.filter(t => t.health > 0), ...rocks.filter(r => r.health > 0), ...bambooStands.filter(b => b.health > 0), ...campfires, ...shelters, ...waterFilters, ...signalFires, player]; // Include player
             for (const obj of allObstacles) {
                 if (checkCollision(placeRect.x, placeRect.y, placeRect.width, placeRect.height, obj.x, obj.y, obj.width, obj.height)) {
                     showMessage("Cannot place here (Obstacle).", 2000);
                     canPlace = false;
                     break;
                 }
             }
         }
         // Specific: Water Purifier Rules
         if (canPlace && itemName === 'waterPurifier') {
             if (targetTileType !== TERRAIN_GRASS && targetTileType !== TERRAIN_SAND) {
                 showMessage("Purifier must be placed on land (Grass or Sand).", 2500);
                 canPlace = false;
             }
             if (canPlace) {
                 let nearWaterSource = false;
                 const checkRadiusTiles = 2;
                 const minCheckX = Math.max(0, placeTileX - checkRadiusTiles);
                 const maxCheckX = Math.min(WORLD_WIDTH_TILES - 1, placeTileX + checkRadiusTiles);
                 const minCheckY = Math.max(0, placeTileY - checkRadiusTiles);
                 const maxCheckY = Math.min(WORLD_HEIGHT_TILES - 1, placeTileY + checkRadiusTiles);
                 for (let ty = minCheckY; ty <= maxCheckY; ty++) { for (let tx = minCheckX; tx <= maxCheckX; tx++) { if (world[ty]?.[tx] === TERRAIN_WATER) { nearWaterSource = true; break; } if (world[ty]?.[tx] === TERRAIN_SAND) { const adj = [{x:tx, y:ty-1}, {x:tx, y:ty+1}, {x:tx-1, y:ty}, {x:tx+1, y:ty}]; for(const a of adj) { if(world[a.y]?.[a.x] === TERRAIN_WATER) { nearWaterSource = true; break; } } } if (nearWaterSource) break; } if (nearWaterSource) break; }
                 if (!nearWaterSource) { showMessage(`Place purifier closer to water.`, 2500); canPlace = false; }
             }
         }
          // Specific: Most other items require Grass (allow shelter, campfire, signal on sand)
         else if (canPlace && targetTileType !== TERRAIN_GRASS) {
              const allowedOnSand = ['shelter', 'campfire', 'largeSignalFire'];
              if (!allowedOnSand.includes(itemName) || targetTileType !== TERRAIN_SAND) {
                   showMessage(`Cannot place ${itemData.name} on ${targetTileType || 'water'}. Needs grass${allowedOnSand.includes(itemName) ? ' or sand' : ''}.`, 2000);
                   canPlace = false;
              }
         }

         // --- Execute Placement ---
         if (canPlace) {
             const newObject = { x: placeX, y: placeY, width: placeW, height: placeH };
             let itemPlaced = false;

             if (itemData.isSignal) { newObject.isBurning = false; newObject.fuel = 0; newObject.maxFuel = 100; newObject.fuelPerWood = 5; newObject.burnRate = 0.5; signalFires.push(newObject); itemPlaced = true; }
             else if (itemName === 'campfire') { campfires.push(newObject); itemPlaced = true; }
             else if (itemName === 'shelter') { shelters.push(newObject); itemPlaced = true; if (!hintFlags.shelterPlaced) { showMessage("Shelter placed! Click to enter/exit. Press E nearby to pick up.", 4000); hintFlags.shelterPlaced = true; } } // Updated hint
             else if (itemName === 'waterPurifier') { waterFilters.push(newObject); itemPlaced = true; if (!hintFlags.purifierPlaced) { showMessage("Purifier placed! Interact (E) for clean water.", 5000); hintFlags.purifierPlaced = true; } }

             if (itemPlaced) {
                 removeItemFromInventory(itemName, 1);
                 showMessage(`Placed ${itemData.name}.`, 2500);
             } else {
                 showMessage("Cannot place this item type (Error).", 2000);
             }
         }
         return; // Explicit return after attempting placement
     }
 }

function craftItem(event) {
     if (gameOver || isPaused) return; // Prevent crafting when paused
     const button = event.target.closest('.craft-button'); const itemId = button.dataset.item; const itemData = craftableItems[itemId]; if (!itemData) return;
     if (hasEnoughResources(itemData.requires)) { for (const resourceName in itemData.requires) { removeItemFromInventory(resourceName, itemData.requires[resourceName]); } addItemToInventory(itemId, 1); showMessage(`Crafted ${itemData.name}.`, 2500); updateCraftingUI(); } else { showMessage("Not enough resources.", 2000); }
 }

// --- Inventory Management (Updated) ---
function addItemToInventory(itemName, count) {
     if (count <= 0) return false; let addedSuccessfully = false;
     // First, try stacking with existing items
     for (let i = 0; i < inventory.length; i++) { if (inventory[i] && inventory[i].item === itemName) { inventory[i].count += count; addedSuccessfully = true; break; } }
      // If not stacked, try finding an empty slot ('none' or null/undefined)
     if (!addedSuccessfully) { for (let i = 0; i < inventory.length; i++) { if (!inventory[i] || inventory[i].item === 'none') { inventory[i] = { item: itemName, count: count }; addedSuccessfully = true; break; } } }
     // If no empty slots, add a new slot if not full
     if (!addedSuccessfully && inventory.length < MAX_INVENTORY_SIZE) { inventory.push({ item: itemName, count: count }); addedSuccessfully = true; }

     if (addedSuccessfully) {
         // Ensure inventory doesn't exceed max size conceptually (shouldn't happen with checks above)
         if (inventory.length > MAX_INVENTORY_SIZE) {
             console.warn("Inventory exceeded max size - trimming.");
             inventory = inventory.slice(0, MAX_INVENTORY_SIZE);
             if(selectedSlot >= inventory.length) selectedSlot = Math.max(0, inventory.length - 1);
         }
         updateInventoryUI(); updateCraftingUI();
         // Increment collection stats only for base resources
         // <<< MODIFIED TO INCREMENT FISH COUNT HERE >>>
         if (resources[itemName] && (itemName === 'wood' || itemName === 'stone' || itemName === 'fish')) { // Check if it's a basic resource
              stats.totalItemsCollected += count;
              if(itemName === 'fish') stats.fishCaught += count; // Increment fish count specifically
         }
         return true;
      } else { showMessage("Inventory is full!", 2000); return false; }
 }

 function removeItemFromInventory(itemName, count) {
     if (count <= 0) return false;
     let remainingToRemove = count;
     let itemFound = false; // Track if we found the item at all

     // Iterate backwards to handle removing entire slots correctly
     for (let i = inventory.length - 1; i >= 0; i--) {
         if (inventory[i] && inventory[i].item === itemName) {
             itemFound = true;
             let amountToRemoveFromSlot = Math.min(remainingToRemove, inventory[i].count);
             inventory[i].count -= amountToRemoveFromSlot;
             remainingToRemove -= amountToRemoveFromSlot;

             if (inventory[i].count <= 0) {
                 // Adjust selected slot BEFORE removing the item if it was selected
                 if (selectedSlot === i) {
                     // Try selecting the previous valid slot
                     let newSelection = i - 1;
                     while (newSelection >= 0 && (!inventory[newSelection] || inventory[newSelection].item === 'none')) {
                         newSelection--;
                     }
                     // If no previous valid slot, try the next one
                     if (newSelection < 0) {
                         newSelection = i + 1; // Start checking from the position *after* the removed slot
                         // Need to account for the splice that will happen
                         // The loop below will check slots from the new 'i' position onwards
                     }
                     // If still no valid slot (inventory might become empty), select 0
                     // We need to check validity *after* splice, so set a flag or re-evaluate selection later.
                     // For now, tentatively select the best candidate index.
                     selectedSlot = Math.max(0, newSelection); // Select best guess for now
                 }
                 inventory.splice(i, 1); // Use splice to completely remove the empty slot
                 // If we spliced before the selected slot, decrement the selected slot index
                 if (i < selectedSlot) {
                    selectedSlot--;
                 }

             }
             if (remainingToRemove <= 0) { break; } // Exit loop if all items removed
         }
     }

    // After potentially removing items and splicing, re-validate the selected slot
     if (inventory.length === 0) {
         selectedSlot = 0; // Select slot 0 if inventory is empty
     } else {
         selectedSlot = Math.max(0, Math.min(selectedSlot, inventory.length - 1)); // Clamp to valid range
         // Ensure the selected slot actually *has* an item if possible
         if (!inventory[selectedSlot] || inventory[selectedSlot].item === 'none') {
            const firstValid = inventory.findIndex(slot => slot && slot.item !== 'none');
            selectedSlot = (firstValid >= 0) ? firstValid : 0; // Select first valid or 0 if none
         }
     }


     if (remainingToRemove > 0 && itemFound) { console.warn(`Could not remove the full required ${count} of ${itemName}. Removed ${count - remainingToRemove}.`); }
     else if (remainingToRemove > 0 && !itemFound) { console.warn(`Could not remove ${count} of ${itemName}, item not found.`); updateInventoryUI(); return false; }

     updateInventoryUI();
     updateCraftingUI();
     return true;
 }

 function countItem(itemName) { let total = 0; for(const slot of inventory) { if(slot && slot.item === itemName) { total += slot.count; } } return total; }
 function hasEnoughResources(requirements) { return Object.entries(requirements).every(([res, reqCount]) => countItem(res) >= reqCount); }

// --- Inventory Navigation ---
function navigateInventoryLeft() {
    if (isPaused) return; // Prevent inventory nav when paused
    if (inventoryStartIndex > 0) {
        inventoryStartIndex--;
        // If selected slot is now out of view to the right, adjust it
        if (selectedSlot >= inventoryStartIndex + VISIBLE_INVENTORY_SLOTS) {
           selectInventorySlot(inventoryStartIndex + VISIBLE_INVENTORY_SLOTS - 1);
        }
        updateInventoryUI();
    }
}
function navigateInventoryRight() {
     if (isPaused) return; // Prevent inventory nav when paused
     // Allow navigating right only if there are more items *beyond* the current view
     if (inventoryStartIndex + VISIBLE_INVENTORY_SLOTS < inventory.length) {
        inventoryStartIndex++;
         // If selected slot is now out of view to the left, adjust it
        if (selectedSlot < inventoryStartIndex) {
            selectInventorySlot(inventoryStartIndex);
        }
        updateInventoryUI();
    }
}

// ===== UI Update Function for Stats Bars =====
function updateStatsUI() {
    // Basic check to avoid errors if elements aren't found
    if (!statsPanelElements.healthBar) return;

    const healthPercent = (stats.health / MAX_STAT) * 100;
    const hungerPercent = (stats.hunger / MAX_STAT) * 100;
    const thirstPercent = (stats.thirst / MAX_STAT) * 100;
    const dayPercent = (time.current / time.dayLength) * 100;
    const timeOfDayFactor = time.current / time.dayLength; // Re-calculate for text

    // Update Health Bar
    statsPanelElements.healthBar.style.width = `${Math.max(0, healthPercent)}%`;
    statsPanelElements.healthText.textContent = `${Math.floor(stats.health)}/${MAX_STAT}`;

    // Update Hunger Bar
    statsPanelElements.hungerBar.style.width = `${Math.max(0, hungerPercent)}%`;
    statsPanelElements.hungerText.textContent = `${Math.floor(stats.hunger)}/${MAX_STAT}`;

    // Update Thirst Bar
    statsPanelElements.thirstBar.style.width = `${Math.max(0, thirstPercent)}%`;
    statsPanelElements.thirstText.textContent = `${Math.floor(stats.thirst)}/${MAX_STAT}`;

    // Update Day Bar and Text
    statsPanelElements.dayValue.textContent = stats.day; // The day number
    statsPanelElements.dayBar.style.width = `${Math.max(0, dayPercent)}%`;

    // Update Time of Day Text
    let timeText = "Night"; // Default
    if (timeOfDayFactor >= time.dayStartFactor && timeOfDayFactor < time.morningStartFactor) timeText = "Dawn";
    else if (timeOfDayFactor >= time.morningStartFactor && timeOfDayFactor < time.afternoonStartFactor) timeText = "Morning";
    else if (timeOfDayFactor >= time.afternoonStartFactor && timeOfDayFactor < time.eveningStartFactor) timeText = "Afternoon";
    else if (timeOfDayFactor >= time.eveningStartFactor && timeOfDayFactor < time.nightStartFactor) timeText = "Evening";
    // else it remains "Night"

    statsPanelElements.dayText.textContent = timeText;
}
// ===== END UI Update Function for Stats Bars =====


function updateInventoryUI() {
    const slots = inventorySlotsContainer.querySelectorAll('.inventory-slot');
    const currentInventorySize = inventory.length; // Use array length

    slots.forEach((slot, index) => {
        const actualIndex = inventoryStartIndex + index;
        slot.innerHTML = ''; // Clear previous content
        slot.classList.remove('selected', 'no-sprite');
        slot.style.backgroundImage = 'none';
        slot.style.backgroundPosition = '';
        slot.dataset.item = 'none'; // Default to none
        slot.dataset.actualIndex = actualIndex;

        if (actualIndex < currentInventorySize && inventory[actualIndex] && inventory[actualIndex].item !== 'none') {
            const itemData = inventory[actualIndex];
            const itemDef = craftableItems[itemData.item] || resources[itemData.item];
            const displayName = itemDef?.name || itemData.item;

            slot.dataset.item = itemData.item; // Set the item name

            if (spritesheetLoaded && itemDef && itemDef.sprite) {
                 slot.style.backgroundImage = `url('${SPRITESHEET_SRC}')`;
                 const bgPosX = -itemDef.sprite.sx + 'px';
                 const bgPosY = -itemDef.sprite.sy + 'px';
                 slot.style.backgroundPosition = `${bgPosX} ${bgPosY}`;
            } else {
                 slot.classList.add('no-sprite');
                 const nameSpan = document.createElement('span');
                 nameSpan.classList.add('inventory-item-name');
                 nameSpan.textContent = displayName;
                 slot.appendChild(nameSpan);
            }
            if (itemData.count > 0) { // Only show count if > 0
                const countSpan = document.createElement('span');
                countSpan.classList.add('inventory-count');
                countSpan.textContent = `x${itemData.count}`;
                slot.appendChild(countSpan);
            }
            if (actualIndex === selectedSlot) { slot.classList.add('selected'); }
        } else {
            // Explicitly mark empty/non-existent slots
            slot.classList.add('no-sprite'); // Ensure no background image remnant
            slot.dataset.item = 'none';
             // Remove selected class if the slot index is now out of bounds or empty
             if (actualIndex === selectedSlot) {
                 slot.classList.remove('selected');
             }
        }
    });

    // Update navigation button states based on potential vs actual items
    invNavLeftButton.disabled = (inventoryStartIndex <= 0);
     // Disable right button if the start index + visible slots reaches/exceeds the actual number of items
     invNavRightButton.disabled = (inventoryStartIndex + VISIBLE_INVENTORY_SLOTS >= inventory.length);

    updateTooltip();
}


// Selects based on the absolute index in the inventory array
function selectInventorySlot(absoluteIndex) {
     if (isPaused) return; // Prevent selection when paused
     const currentInventorySize = inventory.length;

     // Handle empty inventory - always select 0, which will be visually empty
     if (currentInventorySize === 0) {
         selectedSlot = 0;
         inventoryStartIndex = 0; // Ensure view resets
         updateInventoryUI();
         return;
     }

     // Clamp the requested index to valid range [0, inventory.length - 1]
     absoluteIndex = Math.max(0, Math.min(absoluteIndex, currentInventorySize - 1));

     // Check if the (now validated) target slot exists and has an item
     // Allow selecting even if count is 0, but maybe visually indicate differently? For now, just select.
     if (inventory[absoluteIndex] && inventory[absoluteIndex].item !== 'none') {
         selectedSlot = absoluteIndex;
         // Adjust visible range if necessary
         if (selectedSlot < inventoryStartIndex) {
             inventoryStartIndex = selectedSlot; // Scroll left to show the newly selected slot
         } else if (selectedSlot >= inventoryStartIndex + VISIBLE_INVENTORY_SLOTS) {
             inventoryStartIndex = selectedSlot - VISIBLE_INVENTORY_SLOTS + 1; // Scroll right
         }
        // Don't call updateInventoryUI here - let the caller handle it if needed, prevents potential loops
     }
     // Always update UI after selection attempt to reflect the change or lack thereof
      updateInventoryUI();
}


function toggleCraftingMenu() { if (isPaused) return; const panel = document.getElementById('crafting-panel'); const isVisible = panel.style.display === 'flex'; panel.style.display = isVisible ? 'none' : 'flex'; if (!isVisible) { updateCraftingUI(); } }
function closeCraftingMenu() { document.getElementById('crafting-panel').style.display = 'none'; }
function updateCraftingUI() { if (document.getElementById('crafting-panel').style.display !== 'flex') return; const buttons = document.querySelectorAll('#crafting-panel .craft-button'); buttons.forEach(button => { const itemId = button.dataset.item; const itemData = craftableItems[itemId]; if (itemData) { button.disabled = !hasEnoughResources(itemData.requires); } }); }
function updateDayNightIndicator() {
     const ind = document.getElementById('day-night-indicator');
     const timeOfDayFactor = time.current / time.dayLength;
     let bgColor;
     if (timeOfDayFactor >= time.nightStartFactor || timeOfDayFactor < time.morningStartFactor) {
         bgColor = 'linear-gradient(to bottom, #1a1a4a, #00001a)'; // Night
         ind.style.boxShadow = '0 0 10px rgba(50, 50, 100, 0.7)';
     } else if (timeOfDayFactor >= time.eveningStartFactor) {
          bgColor = 'linear-gradient(to bottom, #483D8B, #8A2BE2)'; // Evening/Sunset
         ind.style.boxShadow = '0 0 10px rgba(138, 43, 226, 0.6)';
     } else if (timeOfDayFactor >= time.afternoonStartFactor) {
          bgColor = 'linear-gradient(to bottom, #87CEEB, #4682B4)'; // Afternoon/Day
          ind.style.boxShadow = '0 0 10px rgba(135, 206, 235, 0.7)';
     } else { // Morning
         bgColor = 'linear-gradient(to bottom, #FFD700, #FFA500)'; // Morning/Sunrise
          ind.style.boxShadow = '0 0 10px rgba(255, 165, 0, 0.6)';
     }
     ind.style.background = bgColor;
 }

// --- Message & Hint Display ---
function showMessage(message, duration = 3000) { messageBox.textContent = message; messageBox.style.display = 'block'; clearTimeout(messageTimeout); messageTimeout = setTimeout(() => { messageBox.style.display = 'none'; }, duration); }
function showInteractionPrompt(message) { if(isPaused) return; interactionPrompt.textContent = message; interactionPrompt.style.display = 'block'; clearTimeout(interactionTimeout); interactionTimeout = setTimeout(hideInteractionPrompt, 100); } // Shortened timeout
function hideInteractionPrompt() { interactionPrompt.style.display = 'none'; }
function updateTooltip() {
     if (isPaused) { hideTooltip(); return; } // Hide tooltip when paused
     const selected = inventory[selectedSlot]; let tooltipText = "";
     if (selected && selected.item !== 'none' && selected.count > 0) { // Only show tooltip for items with count > 0
         const itemDef = craftableItems[selected.item] || resources[selected.item];
         if (itemDef) { tooltipText = `${itemDef.name || selected.item}: ${itemDef.description || 'A useful item.'}`; }
         else { tooltipText = selected.item; } // Fallback for items not in definitions
     }
     if (tooltipText) { tooltipArea.textContent = tooltipText; tooltipArea.style.display = 'block'; }
     else { hideTooltip(); }
 }
function hideTooltip() { tooltipArea.style.display = 'none'; }

// ***** START NEW HELP PANEL FUNCTIONS *****
function showHelpPanel() {
     if (isPaused) return; // Don't show help if paused (or pause first?)
     if (helpPanel) helpPanel.style.display = 'flex';
}

function hideHelpPanel() {
    if (helpPanel) helpPanel.style.display = 'none';
}

function toggleHelpPanel() {
     if (isPaused) return; // Don't toggle if paused
    if (helpPanel) {
        if (helpPanel.style.display === 'none' || helpPanel.style.display === '') {
            showHelpPanel();
        } else {
            hideHelpPanel();
        }
    }
}
// ***** END NEW HELP PANEL FUNCTIONS *****

// --- PAUSE / RESUME FUNCTIONS ---
function pauseGame() {
    if (isPaused || !gameStarted || gameOver) return; // Don't pause if not running or already paused

    console.log("Pausing Game");
    isPaused = true;
    pausePopup.style.display = 'flex'; // Show the pause popup

    // Pause audio
    if (backgroundAudio && !backgroundAudio.paused) {
        backgroundAudio.pause();
    }
    hideTooltip(); // Hide tooltip when paused
    hideInteractionPrompt(); // Hide interaction prompt

    // The gameLoop will now skip the update() step automatically
}

function resumeGame() {
    if (!isPaused) return; // Don't resume if not paused

    console.log("Resuming Game");
    isPaused = false;
    pausePopup.style.display = 'none'; // Hide the pause popup

    // Resume audio only if game is still in a playable state
     if (gameStarted && !gameOver && backgroundAudio) {
         backgroundAudio.play().catch(error => {
             console.warn("Audio resume failed (likely user interaction needed):", error);
             // Optionally show a message to the user that audio needs interaction
         });
     }

    // CRITICAL: Reset lastTime to prevent deltaTime spike AFTER resuming
    // Schedule the reset for slightly after resuming to let the browser catch up
     requestAnimationFrame(() => {
        lastTime = performance.now();
    });
    // Re-kick the loop if it somehow stopped (it shouldn't with current logic, but safe)
    requestAnimationFrame(gameLoop);
}


function togglePause() {
    if (isPaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

function hidePausePopup() { // Helper function used in reset
    if (pausePopup) pausePopup.style.display = 'none';
}
// --- END PAUSE / RESUME ---

// --- MAIN MENU FUNCTION ---
function goToMainMenu() {
    console.log("Returning to Main Menu...");

    // Explicitly stop the game loop and audio, reset flags
    gameStarted = false;
    gameOver = false;
    isPaused = false;
    rescued = false;

    // Stop and reset audio (prepareGame also does this via resetGameState, but explicit here is fine)
    if (backgroundAudio && !backgroundAudio.paused) {
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0;
    }

    // Call prepareGame - this handles resetting state and showing the title screen
    prepareGame();
}
// --- END MAIN MENU FUNCTION ---


// --- Rendering ---
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false; // Ensure pixel art is crisp
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;

    drawBackgroundAndTerrain(ctx);

     const objectsToDraw = [
         ...trees.filter(t => t.health > 0),
         ...rocks.filter(r => r.health > 0),
         ...bambooStands.filter(b => b.health > 0),
         ...campfires,
         ...shelters,
         ...waterFilters,
         ...signalFires,
         ...trees.filter(t => t.health <= 0).map(t => ({ ...t, isStump: true, type: 'tree' })),
         ...bambooStands.filter(b => b.health <= 0).map(b => ({ ...b, isStump: true, type: 'bamboo' })),
         player // Draw player last among sorted items unless inside shelter
     ];

    // Don't draw player if they are inside shelter (they are drawn conceptually *within* it)
    const finalObjectsToDraw = objectsToDraw.filter(obj => obj !== player || !player.isInsideShelter);


    finalObjectsToDraw.sort((a, b) => (a.y + (a.height || TILE_SIZE)) - (b.y + (b.height || TILE_SIZE)));

     finalObjectsToDraw.forEach(obj => {
         if (obj === player) {
             drawPlayer(ctx, player); // Draw player if not inside shelter
         } else if (obj.type === 'tree' && obj.isStump) { drawTree(ctx, obj); } // Tree Stump
         else if (trees.includes(obj)) { drawTree(ctx, obj); } // Living Tree
         else if (rocks.includes(obj)) { drawRock(ctx, obj); } // Rock
         else if (obj.type === 'bamboo' && obj.isStump) { drawBamboo(ctx, obj); } // Bamboo Stump
         else if (bambooStands.includes(obj)) { drawBamboo(ctx, obj); } // Living Bamboo
         else if (campfires.includes(obj)) { drawCampfire(ctx, obj); }
         else if (shelters.includes(obj)) { drawShelter(ctx, obj); } // Draw shelter
         else if (waterFilters.includes(obj)) { drawWaterPurifier(ctx, obj); }
         else if (signalFires.includes(obj)) { drawSignalFire(ctx, obj); }
     });


    // Night Overlay
    if (time.isNight) { // Use the stricter isNight for overlay darkness
        let darkness = 0;
        const timeOfDay = time.current / time.dayLength;
        // Define fade durations based on factors
        const nightFadeInDurationFactor = time.nightStartFactor - time.eveningStartFactor;
        const nightFadeOutDurationFactor = time.morningStartFactor - time.dayStartFactor;
        const maxDarkness = 0.7;

        if (timeOfDay >= time.nightStartFactor || timeOfDay < time.dayStartFactor) { // Deep night or before dawn starts fading
            darkness = maxDarkness;
        } else if (timeOfDay >= time.eveningStartFactor) { // Evening fade in
             // darkness = Math.min(maxDarkness, ((timeOfDay - time.eveningStartFactor) / nightFadeInDurationFactor) * maxDarkness);
             // Smoother fade using cosine interpolation
             const progress = (timeOfDay - time.eveningStartFactor) / nightFadeInDurationFactor;
             darkness = maxDarkness * (1 - Math.cos(progress * Math.PI / 2));

        } else if (timeOfDay < time.morningStartFactor) { // Dawn fade out
             // darkness = Math.max(0, maxDarkness - (((timeOfDay - time.dayStartFactor) / nightFadeOutDurationFactor) * maxDarkness));
             // Smoother fade out
              const progress = (timeOfDay - time.dayStartFactor) / nightFadeOutDurationFactor;
              darkness = maxDarkness * Math.cos(progress * Math.PI / 2);
        } else { // Daytime
            darkness = 0;
        }

        darkness = Math.max(0, Math.min(maxDarkness, darkness)); // Clamp darkness value

        ctx.fillStyle = `rgba(0, 0, 30, ${darkness})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

 // --- Specific Drawing Functions ---

 // ============================================
 // ===== drawBackgroundAndTerrain FUNCTION ====
 // ============================================
 function drawBackgroundAndTerrain(ctx) {
     const grassColor = '#8cc751';
     const sandColor = '#F4A460';
     const waterColor = '#3399FF'; // Water color
     const darkGrassColor = '#7bb540'; // For patches

     // 1. Draw Base Terrain Tiles
     for (let y = 0; y < WORLD_HEIGHT_TILES; y++) {
         for (let x = 0; x < WORLD_WIDTH_TILES; x++) {
             let tileColor;
             switch (world[y]?.[x]) {
                 case TERRAIN_GRASS: tileColor = grassColor; break;
                 case TERRAIN_SAND: tileColor = sandColor; break;
                 case TERRAIN_WATER: tileColor = waterColor; break;
                 default: tileColor = waterColor; // Default to water if undefined
             }
             ctx.fillStyle = tileColor;
             ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
         }
     }

     // 2. Draw Grass Patches (only on grass tiles)
     ctx.fillStyle = darkGrassColor;
     for (const patch of grassPatches) {
         ctx.fillRect(patch.x, patch.y, patch.w, patch.h);
     }
 }
 // ============================================
 // === END drawBackgroundAndTerrain FUNCTION ===
 // ============================================


 function drawTree(ctx, obj) {
     // Stump drawing
     if (obj.isStump) {
         ctx.fillStyle = '#8B4513'; // Darker brown for stump
         ctx.fillRect(obj.x + obj.width * 0.3, obj.y + obj.height * 0.7, obj.width * 0.4, obj.height * 0.3);
     }
     // Living Tree drawing
     else {
         const trunkColor = '#8B4513'; const trunkShadow = '#5C4033'; const leavesColor = '#228B22'; const leavesShadow = '#1A6A1A';
         const trunkWidth = obj.width * 0.3; const trunkHeight = obj.height * 0.5; const trunkX = obj.x + (obj.width - trunkWidth) / 2; const trunkY = obj.y + obj.height - trunkHeight;
         ctx.fillStyle = trunkShadow; ctx.fillRect(trunkX + trunkWidth * 0.7, trunkY, trunkWidth * 0.3, trunkHeight);
         ctx.fillStyle = trunkColor; ctx.fillRect(trunkX, trunkY, trunkWidth, trunkHeight);
         const leavesHeight = obj.height * 0.65; const leavesY = obj.y; const leavesCenterX = obj.x + obj.width / 2; const leavesRadius = obj.width / 2 * 1.1;
         ctx.fillStyle = leavesShadow; ctx.beginPath(); ctx.ellipse(leavesCenterX, leavesY + leavesHeight * 0.6, leavesRadius * 0.8, leavesHeight * 0.4, 0, Math.PI * 0.1, Math.PI * 1.9); ctx.fill();
         ctx.fillStyle = leavesColor; ctx.beginPath(); ctx.ellipse(leavesCenterX, leavesY + leavesHeight / 2, leavesRadius, leavesHeight / 2, 0, 0, Math.PI * 2); ctx.fill();
     }
 }
 function drawRock(ctx, obj) {
     const baseColor = '#808080'; const shadowColor = '#606060'; const highlightColor = '#A0A0A0';
     ctx.fillStyle = baseColor; ctx.beginPath(); ctx.moveTo(obj.x + obj.width * 0.1, obj.y + obj.height * 0.9); ctx.lineTo(obj.x + obj.width * 0.2, obj.y + obj.height * 0.2); ctx.lineTo(obj.x + obj.width * 0.8, obj.y + obj.height * 0.1); ctx.lineTo(obj.x + obj.width * 0.9, obj.y + obj.height * 0.8); ctx.closePath(); ctx.fill();
     ctx.fillStyle = shadowColor; ctx.beginPath(); ctx.moveTo(obj.x + obj.width * 0.1, obj.y + obj.height * 0.9); ctx.lineTo(obj.x + obj.width * 0.5, obj.y + obj.height * 0.5); ctx.lineTo(obj.x + obj.width * 0.9, obj.y + obj.height * 0.8); ctx.closePath(); ctx.fill();
     ctx.fillStyle = highlightColor; ctx.beginPath(); ctx.moveTo(obj.x + obj.width * 0.2, obj.y + obj.height * 0.2); ctx.lineTo(obj.x + obj.width * 0.8, obj.y + obj.height * 0.1); ctx.lineTo(obj.x + obj.width * 0.5, obj.y + obj.height * 0.5); ctx.closePath(); ctx.fill();
 }
 function drawBamboo(ctx, obj) {
      const stalkColor = '#55A63A'; const shadowColor = '#387D2A'; const stumpColor = '#C1A875';
      if (obj.isStump) {
          ctx.fillStyle = stumpColor; ctx.beginPath(); ctx.moveTo(obj.x, obj.y + obj.height); ctx.lineTo(obj.x + obj.width * 0.2, obj.y + obj.height * 0.8); ctx.lineTo(obj.x + obj.width * 0.5, obj.y + obj.height * 0.9); ctx.lineTo(obj.x + obj.width * 0.8, obj.y + obj.height * 0.85); ctx.lineTo(obj.x + obj.width, obj.y + obj.height); ctx.closePath(); ctx.fill();
      } else {
          const numStalks = 3; const stalkWidth = obj.width / (numStalks + 1); const spacing = stalkWidth * 0.3;
          for (let i = 0; i < numStalks; i++) {
              const stalkX = obj.x + spacing + i * (stalkWidth + spacing); const stalkHeight = obj.height * (0.8 + Math.random() * 0.2); const stalkY = obj.y + obj.height - stalkHeight;
              ctx.fillStyle = stalkColor; ctx.fillRect(stalkX, stalkY, stalkWidth, stalkHeight);
              ctx.fillStyle = shadowColor; const nodeHeight = stalkHeight / 8; for (let j = 0; j < 5; j++) { ctx.fillRect(stalkX, stalkY + j * stalkHeight / 5, stalkWidth, nodeHeight); } ctx.fillRect(stalkX + stalkWidth * 0.7, stalkY, stalkWidth * 0.3, stalkHeight);
          }
      }
 }
 function drawPlayer(ctx, p) {
     // Don't draw if inside shelter - handled in main render loop now
     // if (p.isInsideShelter) return;

     ctx.save(); ctx.globalAlpha = p.alpha; // Use player alpha for transparency
     const skinColor = '#F0C8A0'; const hairColor = '#5B3A29'; const shirtColor = '#4682B4'; const pantsColor = '#3B5323'; const eyeColor = '#000000'; const shoeColor = '#8B4513';
     const headSize = p.width * 0.6; const headX = p.x + (p.width - headSize) / 2; const headY = p.y; const bodyWidth = p.width * 0.8; const bodyHeight = p.height * 0.5; const bodyX = p.x + (p.width - bodyWidth) / 2; const bodyY = headY + headSize * 0.8; const legHeight = p.height * 0.3; const legWidth = bodyWidth / 2 * 0.8; const legY = bodyY + bodyHeight * 0.9;
     ctx.fillStyle = pantsColor; ctx.fillRect(bodyX, legY, legWidth, legHeight); ctx.fillRect(bodyX + bodyWidth - legWidth, legY, legWidth, legHeight);
     ctx.fillStyle = shoeColor; const shoeHeight = legHeight * 0.3; ctx.fillRect(bodyX, legY + legHeight - shoeHeight, legWidth, shoeHeight); ctx.fillRect(bodyX + bodyWidth - legWidth, legY + legHeight - shoeHeight, legWidth, shoeHeight);
     ctx.fillStyle = shirtColor; ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
     ctx.fillStyle = skinColor; ctx.fillRect(headX, headY, headSize, headSize);
     ctx.fillStyle = hairColor; ctx.fillRect(headX, headY, headSize, headSize * 0.3);
     if (p.direction === 'left') { ctx.fillRect(headX, headY + headSize * 0.2, headSize * 0.2, headSize * 0.5); } else if (p.direction === 'right') { ctx.fillRect(headX + headSize * 0.8, headY + headSize * 0.2, headSize * 0.2, headSize * 0.5); } else if (p.direction === 'down') { ctx.fillRect(headX + headSize * 0.1, headY + headSize * 0.3, headSize * 0.8, headSize * 0.2); }
     ctx.fillStyle = eyeColor; const eyeY = headY + headSize * 0.4; const eyeSize = 2;
     if (p.direction === 'down') { ctx.fillRect(headX + headSize * 0.25, eyeY, eyeSize, eyeSize); ctx.fillRect(headX + headSize * 0.65, eyeY, eyeSize, eyeSize); } else if (p.direction === 'left') { ctx.fillRect(headX + headSize * 0.25, eyeY, eyeSize, eyeSize); } else if (p.direction === 'right') { ctx.fillRect(headX + headSize * 0.65, eyeY, eyeSize, eyeSize); }
     const armWidth = bodyWidth * 0.15; const armHeight = bodyHeight * 0.8; const armY = bodyY + bodyHeight * 0.1; ctx.fillStyle = skinColor;
     if (p.direction === 'down' || p.direction === 'up') { ctx.fillRect(bodyX - armWidth, armY, armWidth, armHeight); ctx.fillRect(bodyX + bodyWidth, armY, armWidth, armHeight); } else if (p.direction === 'left') { ctx.fillRect(bodyX + bodyWidth * 0.1, armY, armWidth, armHeight); } else if (p.direction === 'right') { ctx.fillRect(bodyX + bodyWidth * 0.75 , armY, armWidth, armHeight); }
     ctx.restore();
 }
 function drawCampfire(ctx, obj) {
     const stoneColor = '#696969'; const woodColor = '#A0522D'; const fireColor1 = '#FFA500'; const fireColor2 = '#FF8C00'; const fireColor3 = '#FF6347';
     const baseRadius = obj.width * 0.4; const centerX = obj.x + obj.width / 2; const centerY = obj.y + obj.height * 0.7;
     ctx.fillStyle = stoneColor; ctx.beginPath(); ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2); ctx.fill();
     ctx.fillStyle = woodColor; ctx.fillRect(centerX - baseRadius * 0.6, centerY - baseRadius * 0.2, baseRadius * 1.2, baseRadius * 0.4); ctx.fillRect(centerX - baseRadius * 0.2, centerY - baseRadius * 0.6, baseRadius * 0.4, baseRadius * 1.2);
     const fireHeightBase = obj.height * 0.7; const fireWidthBase = obj.width * 0.6; const fireBottomY = obj.y + obj.height * 0.3;
     for (let i = 0; i < 3; i++) { const flickerX = (Math.random() - 0.5) * fireWidthBase * 0.3; const flickerY = Math.random() * fireHeightBase * 0.2; const flickerW = fireWidthBase * (0.6 + Math.random() * 0.4); const flickerH = fireHeightBase * (0.7 + Math.random() * 0.3); let fireColor = fireColor1; const randColor = Math.random(); if (randColor > 0.66) fireColor = fireColor3; else if (randColor > 0.33) fireColor = fireColor2; ctx.fillStyle = fireColor; ctx.beginPath(); ctx.ellipse(centerX + flickerX, fireBottomY + flickerH / 2 - flickerY, flickerW / 2, flickerH / 2, 0, 0, Math.PI * 2); ctx.fill(); }
 }
 function drawShelter(ctx, obj) {
     const wallColor = '#A0522D'; const roofColor = '#8B7355'; const frameColor = '#5C4033'; const floorColor = '#D2B48C';
     ctx.fillStyle = floorColor; ctx.fillRect(obj.x, obj.y + obj.height * 0.85, obj.width, obj.height * 0.15);
     ctx.fillStyle = wallColor; ctx.fillRect(obj.x + obj.width * 0.1, obj.y + obj.height * 0.2, obj.width * 0.8, obj.height * 0.65);
     ctx.fillStyle = roofColor; ctx.beginPath(); ctx.moveTo(obj.x, obj.y + obj.height * 0.3); ctx.lineTo(obj.x + obj.width / 2, obj.y); ctx.lineTo(obj.x + obj.width, obj.y + obj.height * 0.3); ctx.lineTo(obj.x + obj.width * 0.9, obj.y + obj.height * 0.85); ctx.lineTo(obj.x + obj.width * 0.1, obj.y + obj.height * 0.85); ctx.closePath(); ctx.fill();
     ctx.strokeStyle = frameColor; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(obj.x, obj.y + obj.height * 0.3); ctx.lineTo(obj.x + obj.width / 2, obj.y); ctx.lineTo(obj.x + obj.width, obj.y + obj.height * 0.3); ctx.stroke(); ctx.strokeRect(obj.x + obj.width * 0.3, obj.y + obj.height * 0.4, obj.width * 0.4, obj.height * 0.45);
 }

 function drawWaterPurifier(ctx, obj) {
    const x = obj.x; const y = obj.y; const w = obj.width; const h = obj.height;
    const stoneColor = '#888c8d'; const stoneShadow = '#65696a'; const woodColor = '#8B4513'; const woodShadow = '#5C4033'; const waterColor = '#60a5fa'; const charcoalColor = '#333'; const sandColor = '#D2B48C';
    ctx.fillStyle = stoneShadow; ctx.fillRect(x + w * 0.1, y + h * 0.75, w * 0.3, h * 0.25); ctx.fillRect(x + w * 0.6, y + h * 0.8, w * 0.35, h * 0.2);
    ctx.fillStyle = stoneColor; ctx.fillRect(x + w * 0.15, y + h * 0.7, w * 0.28, h * 0.25); ctx.fillRect(x + w * 0.55, y + h * 0.75, w * 0.33, h * 0.2); ctx.fillRect(x + w * 0.35, y + h * 0.65, w * 0.3, h * 0.28);
    const containerY = y + h * 0.1; const containerH = h * 0.55; ctx.fillStyle = woodShadow; ctx.fillRect(x, containerY + containerH * 0.1, w, containerH * 0.9);
    ctx.fillStyle = woodColor; ctx.fillRect(x + w * 0.05, containerY, w * 0.9, containerH); ctx.fillStyle = woodShadow; ctx.fillRect(x + w * 0.15, containerY + h * 0.05, w * 0.7, h * 0.1);
    const layerYStart = containerY + h * 0.15; const layerHeight = h * 0.12; ctx.fillStyle = charcoalColor; ctx.fillRect(x + w * 0.15, layerYStart, w * 0.7, layerHeight); ctx.fillStyle = sandColor; ctx.fillRect(x + w * 0.15, layerYStart + layerHeight, w * 0.7, layerHeight * 0.8);
    ctx.fillStyle = waterColor; ctx.globalAlpha = 0.7; ctx.fillRect(x + w * 0.15, containerY + h * 0.05, w * 0.7, h * 0.1); ctx.globalAlpha = 1.0;
    ctx.fillStyle = woodShadow; ctx.beginPath(); ctx.moveTo(x + w * 0.4, y + h * 0.8); ctx.lineTo(x + w * 0.45, y + h * 0.95); ctx.lineTo(x + w * 0.55, y + h * 0.95); ctx.lineTo(x + w * 0.6, y + h * 0.8); ctx.closePath(); ctx.fill();
 }

 function drawSignalFire(ctx, obj) {
     const stoneColor = '#696969'; const woodColor = '#A0522D'; const fireColor1 = '#FFA500'; const fireColor2 = '#FF8C00'; const fireColor3 = '#FF6347'; const smokeColor = 'rgba(100, 100, 100, 0.5)';
     ctx.fillStyle = stoneColor; const baseHeight = obj.height * 0.4; ctx.fillRect(obj.x, obj.y + obj.height - baseHeight, obj.width, baseHeight); ctx.fillStyle = '#505050'; ctx.fillRect(obj.x + obj.width * 0.1, obj.y + obj.height - baseHeight * 0.8, obj.width*0.8, baseHeight * 0.2); ctx.fillRect(obj.x + obj.width * 0.3, obj.y + obj.height - baseHeight * 0.4, obj.width*0.4, baseHeight * 0.2);
     ctx.fillStyle = woodColor; const woodPileY = obj.y + obj.height * 0.3; const woodPileH = obj.height * 0.3; ctx.fillRect(obj.x + obj.width * 0.1, woodPileY, obj.width * 0.8, woodPileH); ctx.fillRect(obj.x + obj.width * 0.3, woodPileY - woodPileH*0.4, obj.width * 0.4, woodPileH*1.2);
     if (obj.isBurning) {
         const fireHeightBase = obj.height * 0.6; const fireWidthBase = obj.width * 0.7; const fireBottomY = obj.y + obj.height * 0.1; const centerX = obj.x + obj.width / 2;
         for (let i = 0; i < 4; i++) { const flickerX = (Math.random() - 0.5) * fireWidthBase * 0.4; const flickerY = Math.random() * fireHeightBase * 0.3; const flickerW = fireWidthBase * (0.5 + Math.random() * 0.5); const flickerH = fireHeightBase * (0.8 + Math.random() * 0.4); let fireColor = fireColor1; const randColor = Math.random(); if (randColor > 0.66) fireColor = fireColor3; else if (randColor > 0.33) fireColor = fireColor2; ctx.fillStyle = fireColor; ctx.beginPath(); ctx.ellipse(centerX + flickerX, fireBottomY + flickerH / 2 - flickerY, flickerW / 2, flickerH / 2, Math.PI * (1.4 + Math.random()*0.2), 0, Math.PI * 2); ctx.fill(); }
         ctx.fillStyle = smokeColor; for (let i = 0; i < 5; i++) { const smokeX = centerX + (Math.random() - 0.5) * obj.width * 0.5; const smokeY = obj.y - i * 10 - Math.random() * 15; const smokeRadius = obj.width * 0.1 + Math.random() * obj.width * 0.15; ctx.beginPath(); ctx.arc(smokeX, smokeY, smokeRadius, 0, Math.PI * 2); ctx.fill(); }
     } else { ctx.fillStyle = '#444'; ctx.fillRect(obj.x + obj.width * 0.2, woodPileY + woodPileH * 0.5, obj.width * 0.6, woodPileH * 0.3); }
 }

// --- Helper Functions ---
function checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) { return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2; }
function dist(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); }
function isPlayerNearObject(objectList, maxDistance, targetX = player.x + player.width / 2, targetY = player.y + player.height / 2) { for (const obj of objectList) { if (dist(targetX, targetY, obj.x + obj.width / 2, obj.y + obj.height / 2) < maxDistance) return true; } return false; }

// Modified Interaction Point: Offset based on direction
function getInteractionPoint() {
     let ix = player.x + player.width / 2;
     let iy = player.y + player.height / 2;
     const reach = TILE_SIZE * 0.6; // How far the interaction point projects

     switch (player.direction) {
         case 'up': iy -= reach; break;
         case 'down': iy += reach + (player.height / 2); break; // Project further down
         case 'left': ix -= reach; break;
         case 'right': ix += reach; break;
     }
     // Clamp interaction point within world bounds (optional, but good practice)
     ix = Math.max(0, Math.min(WORLD_WIDTH - 1, ix));
     iy = Math.max(0, Math.min(WORLD_HEIGHT - 1, iy));

     return { x: ix, y: iy };
 }


// --- Start Initialization ---
// Call initGame directly, the 'defer' attribute in the HTML's script tag
// ensures the DOM is ready before this script executes.
console.log("Script loaded, initializing game...");
initGame();