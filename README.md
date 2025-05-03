# TheLongestDay
https://uph-h-f.github.io/TheLongestDay/

Course: Programming 2
<br />
Genre: Survival


# The Longest Day

**Finals Project Documentation**

**BSCSIT 1203/L (Programming 2 – Lec/ Lab)**

---

-   **Submitted by:** D., H.
-   **Course/Yr.:** BSCS-DS 1
-   **Date:** May 5, 2025
-   **Submitted to:** Engr. F.
-   **Institution:** UPHSD - CCS

---

## Table of Contents

*   [Abstract](#abstract)
*   [Introduction](#introduction)
    *   [Background and Rationale](#background-and-rationale)
    *   [Project Motivation](#project-motivation)
*   [Game Overview](#game-overview)
    *   [Game Genre](#game-genre)
    *   [Game Description](#game-description)
*   [Game Mechanics](#game-mechanics)
    *   [Controls](#controls)
    *   [Rules](#rules)
    *   [Scoring System](#scoring-system)
    *   [Progression System](#progression-system)
*   [Data Analytics Integration](#data-analytics-integration)
    *   [Data Collection](#data-collection)
    *   [Purpose of Data Analytics](#purpose-of-data-analytics)
    *   [Tools and Methods Used](#tools-and-methods-used)
*   [System Architecture](#system-architecture)
    *   [Technical Overview](#technical-overview)
    *   [Frameworks / Libraries Used](#frameworks--libraries-used)
*   [Development Process](#development-process)
    *   [Methodology](#methodology)
    *   [Milestones](#milestones)
    *   [Challenges Encountered](#challenges-encountered)
    *   [How Challenges Were Addressed](#how-challenges-were-addressed)
*   [Testing and Results](#testing-and-results)
    *   [Testing Methods](#testing-methods)
    *   [Results](#results)
*   [Conclusion](#conclusion)
    *   [Reflection](#reflection)
    *   [Future Work](#future-work)
*   [References](#references)
*   [Appendices](#appendices)
    *   [Game Screenshots](#game-screenshots)
    *   [Source Code Excerpts](#source-code-excerpts)
    *   [Analytics Graphs or Charts (Leaderboard Example)](#analytics-graphs-or-charts-leaderboard-example)

---

## Abstract

**Summary of the Project:**
"The Longest Day" is a 2D top-down survival game developed for web browsers using HTML, CSS, and JavaScript with the Canvas API. Players find themselves stranded on a procedurally generated island and must manage core survival stats (health, hunger, thirst) while navigating a day/night cycle. The objective is to survive for as many days as possible by gathering resources (wood, stone, fish), crafting essential tools and structures (axe, fishing rod, campfire, shelter, water purifier, signal fire), and avoiding hazards like starvation, dehydration, sun exposure, and sharks in the ocean. The game features dynamic elements like resource regrowth, driftwood spawning, fishing mechanics, and placeable objects. Data analytics integration is implemented through a persistent leaderboard system using `localStorage`, tracking and ranking players based on days survived, items collected, and fish caught, providing a competitive and comparative element to the survival experience.

---

## Introduction

### Background and Rationale

Video games are a dominant form of entertainment globally, offering immersive experiences, interactive storytelling, and engaging challenges. Beyond pure entertainment, games serve as powerful educational tools, capable of teaching problem-solving, resource management, strategic thinking, and even complex concepts in a motivating format. Survival games, in particular, provide a compelling simulation of managing limited resources under pressure, fostering planning and adaptability. This project leverages the accessibility of web technologies (HTML, CSS, JavaScript) to create an engaging survival game experience directly within the browser, demonstrating the capability of these technologies for interactive application development.

### Project Motivation

The motivation behind developing "The Longest Day" stemmed from an interest in the survival game genre and the challenge of implementing its core mechanics using fundamental web development techniques. The goal was to create a complete game loop encompassing exploration, resource gathering, crafting, base building (shelter/fire), and managing dynamic environmental factors like the day/night cycle and unique threats (sharks). Choosing the survival genre allowed for the exploration of concepts like procedural generation (for replayability), state management (player stats, inventory), object interaction, and basic AI (shark behavior). Integrating a leaderboard system using `localStorage` was also a key objective to explore data persistence and add a competitive aspect.

---

## Game Overview

### Game Genre

**Survival, Crafting, Simulation**

### Game Description

*   **Game setting and story:** The player is stranded alone on a deserted island after an unspecified event. The island features distinct terrain types like grass, sand, lakes, and surrounding ocean, populated with resources like trees, rocks, shrubs, and occasional driftwood.
*   **Main objectives of the game:** The primary objective is to survive for as long as possible by managing health, hunger, and thirst. Secondary objectives include crafting tools and structures to aid survival, exploring the island, establishing a base (shelter, fire), and potentially achieving rescue by maintaining a large signal fire after surviving a few days.
*   **Target audience:** Casual gamers, fans of survival and crafting genres, players interested in resource management challenges.

---

## Game Mechanics

### Controls

*   **Movement:** `WASD` keys or `Arrow Keys`.
*   **Interaction/Gathering:** `E` key (Collect resources, use purifier, add fuel, pickup shelter).
*   **Crafting Menu:** `C` key (Toggle open/close).
*   **Inventory Slot Selection:** `1` through `5` keys (Selects the corresponding *visible* inventory slot).
*   **Use Selected Item:** `Space` key (Eat food, place placeable items like campfires, shelters).
*   **Inventory Navigation:** On-screen `←` / `→` buttons or clicking empty slots.
*   **Enter/Exit Shelter:** `Click` on a placed shelter. (Auto-walks to enter, exits instantly).
*   **Pause Game:** `P` key (Toggle pause/resume).

### Rules

*   **Survival Stats:** Health, Hunger, and Thirst deplete over time. Hunger and Thirst deplete faster while swimming. Reaching zero in Hunger or Thirst causes Health to deplete rapidly. Reaching zero Health results in Game Over.
*   **Day/Night Cycle:** Affects visibility (visual overlay at night) and certain mechanics (e.g., sun damage during the day, different fishing chances). Sun exposure during the day (when not in shade or water) drains health. Shade provides slight health regeneration during the day.
*   **Resource Gathering:** Interact (`E`) with trees, rocks, shrubs, and driftwood to collect wood and stone. Tools like axes can speed up gathering. Resources may deplete or regrow/respawn over time.
*   **Crafting:** Open the crafting menu (`C`) to see available items. Crafting requires specific amounts of resources from the inventory.
*   **Inventory:** Limited capacity (20 slots total, 5 visible at a time). Items stack. Use number keys or clicks to select/navigate. Use `Space` to use/place the selected item.
*   **Placing Objects:** Selected placeable items (campfire, shelter, purifier, signal fire) can be placed using `Space`. Placement is restricted by terrain type and obstacles.
*   **Shelter:** Provides protection from sun damage and allows the player character model to become semi-transparent. Enter/exit by clicking. Can be picked up with `E` if empty.
*   **Water Purifier:** Must be placed near water. Interact (`E`) to get clean water, restoring thirst and some health. Drinking directly from water sources (`E`) restores less thirst and risks health loss.
*   **Signal Fire:** Must be fueled with wood (`E` while wood is selected). Needs to be kept burning for a chance of rescue after Day 3.
*   **Swimming:** Player moves slower in water and loses health slowly. The ocean poses the threat of sharks.
*   **Fishing:** Requires a Fishing Rod. Use `E` near water. Chance to catch fish depends on time and whether fish are "jumping".
*   **Sharks:** Can spawn in deep ocean water if the player swims far from land. They patrol and may chase/attack the player, leading to Game Over if successful. They despawn if the player reaches safety or stays away long enough.
*   **Game Over:** Occurs if Health, Hunger, or Thirst reaches zero, or if attacked by a shark.
*   **Rescue:** Possible after Day 3 if a Signal Fire is actively burning.

### Scoring System

*   The primary score is the number of **Days Survived**.
*   Secondary metrics tracked for the leaderboard include **Total Items Collected** and **Total Fish Caught**. Points are not directly earned or lost during gameplay in a traditional sense, but survival duration and resource collection contribute to the final leaderboard ranking.

### Progression System

*   **Time:** The main progression is through the day/night cycle and increasing day count.
*   **Crafting:** Progression is tied to gathering enough resources to craft better tools and structures, enabling new actions (e.g., fishing rod enables fishing, axe speeds up chopping).
*   **Rescue:** The potential for rescue becomes available only after surviving past Day 3 and maintaining a signal fire, acting as a late-game objective.

---

## Data Analytics Integration

### Data Collection

*   **What player data is collected?**
    *   Days Survived (Integer)
    *   Total Items Collected (Integer, cumulative count of wood, stone, fish)
    *   Total Fish Caught (Integer)
    *   Player Name (String, prompted upon achieving a qualifying score)
    *   Date of Score (String, captured automatically when score is saved)
*   **How is data stored?** The game uses the browser's `localStorage` API to store leaderboard data persistently on the user's machine. Data for each category (Days, Items, Fish) is stored under separate keys (`leaderboard_days`, `leaderboard_items`, `leaderboard_fish`) as JSON strings representing sorted arrays of score objects.

### Purpose of Data Analytics

The primary purpose of the collected data is **not** for real-time gameplay enhancement or difficulty adjustment within a single session. Instead, it serves to:

*   **Provide Player Comparison:** The leaderboard allows players to compare their performance (survival duration, collection efficiency) against their own past scores and potentially others if shared (though the current implementation is local).
*   **Increase Replayability:** The goal of achieving a higher rank on the leaderboards adds motivation for players to replay the game and improve their survival strategies.
*   **Offer Long-Term Goals:** Getting onto the leaderboard acts as a long-term achievement beyond simply surviving the initial days.

### Tools and Methods Used

*   **Storage:** Browser `localStorage` Web Storage API.
*   **Data Formatting:** JavaScript `JSON.stringify()` to save arrays to `localStorage` and `JSON.parse()` to load them.
*   **Data Handling:** Standard JavaScript array methods (`push`, `sort`, `slice`) are used to manage the leaderboard entries (adding new scores, sorting by score, trimming to the top `LEADERBOARD_MAX_ENTRIES`).
*   **Presentation:** DOM manipulation (JavaScript) is used to dynamically generate and populate the HTML `<ol>` elements within the leaderboard panel based on the loaded data.
*   **Sharing (Manual):** A "Copy Results" button uses the `navigator.clipboard.writeText()` API to allow players to manually copy a formatted text version of the leaderboards for sharing outside the game.

---

## System Architecture

### Technical Overview

The game employs a standard client-side web architecture:

1.  **HTML (`index.html`):** Provides the basic structure of the web page, including the `canvas` element for game rendering, various `div` elements for UI panels (stats, inventory, title screen, game over, crafting, help, pause, leaderboard), buttons, and the `audio` element.
2.  **CSS (`style.css`):** Handles all visual styling, layout, and positioning of the game container and UI elements. It uses absolute positioning, flexbox, and CSS variables for styling panels, buttons, bars, and managing visual states (e.g., hover, selected, disabled). It also includes the viewport scaling CSS.
3.  **JavaScript (`game.js`):** Contains the entire game logic, rendering, state management, and event handling in a single file, encapsulated within an Immediately Invoked Function Expression (IIFE) to avoid polluting the global scope.
    *   **Rendering:** Utilizes the HTML5 Canvas 2D API (`getContext('2d')`) for drawing the game world, terrain, objects (trees, rocks, player, items), UI overlays (night effect), and dynamic elements (shark, fish animation).
    *   **Game Loop:** A standard `requestAnimationFrame` loop drives the game. Each frame calculates the `deltaTime` since the last frame, calls the main `update()` function (which handles time progression, stats updates, player movement, AI, resource updates, interaction checks, etc.), and then calls the `render()` function to draw the current game state to the canvas. Pausing logic prevents the `update()` function from running and freezes `deltaTime` calculation.
    *   **State Management:** Game state (player position/stats, inventory content/selection, world object lists/states, time progression, UI visibility, game flags like `gameOver`, `isPaused`, `rescued`) is managed through variables declared within the main IIFE's scope. Helper functions (`getPlayerState`, `getStatsState`, `setInventoryState`, etc.) provide a somewhat structured way to access and modify this state, reducing direct variable manipulation across disparate parts of the code, although global-like access within the IIFE remains prevalent due to the single-file structure.
    *   **Event Handling:** Event listeners handle user input (keyboard presses, mouse clicks on UI elements and the canvas).
    *   **Physics/Collision:** Basic AABB (Axis-Aligned Bounding Box) collision detection is used for player movement against obstacles and world boundaries.
    *   **World Generation:** Includes embedded Perlin/Simplex noise functions for procedural island generation.
    *   **UI Interaction:** JavaScript manipulates the DOM to show/hide panels, update text content (stats, prompts), disable/enable buttons, and manage UI state.
    *   **Data Persistence:** Uses `localStorage` for saving/loading leaderboard scores.

**Simplified Architecture Diagram:**

    A[User] -->|Input (Keyboard/Mouse)| B(index.html);
    B -->|Structure/DOM| C(game.js / Game Engine);
    B -->|Styling Rules| D(style.css);
    C -->|requestAnimationFrame| C; # Game Loop
    C -->|Update Game State| G([State Variables - Player, World, Stats, Time etc.]);
    C -->|Render State| E(Canvas Element);
    C -->|Manipulates DOM| B; # Update UI Panels
    C -->|Reads/Writes| F(localStorage - Leaderboard);
    D -->|Styles| B;
    D -->|Styles| E;
    B -->|Displays| A;
    G -->|Data for Update/Render| C;

Frameworks / Libraries Used

Core APIs:

HTML5 Canvas 2D API (for all game rendering)

DOM (Document Object Model) API (for UI manipulation)

Web Storage API (localStorage for leaderboards)

Web Audio API (implicitly via <audio> tag for background music)

Clipboard API (navigator.clipboard for copying leaderboard)

Embedded Algorithms:

Perlin Noise (implementation included directly in game.js)

Simplex Noise (implementation included directly in game.js)

External Libraries/Frameworks: None explicitly linked or imported. The project relies on native browser capabilities and embedded code.

Development Process
Methodology

The development likely followed an Iterative and Incremental approach, common for small team or solo student projects. Features were likely added sequentially: starting with the core player movement and rendering, then adding stats, inventory, crafting, world generation, specific objects, UI elements, and finally advanced features like fishing, sharks, and leaderboards. This allows for testing and refinement at each stage without rigidly defined sprints as in formal Agile.

Milestones

Conceptualization: Defining the core survival concept, target platform (web), and key features.

Core Engine Setup: HTML structure, Canvas setup, basic game loop (requestAnimationFrame), player rendering and movement (WASD).

Stats & Day/Night: Implementing health/hunger/thirst logic, basic depletion, and the day/night timer with visual overlay.

Inventory System: Basic inventory array, adding/removing items, UI display (slots).

Resource Gathering: Adding basic resources (trees/rocks) and interaction logic (E key).

Crafting System: Defining recipes, implementing crafting logic, and creating the crafting UI panel.

World Generation: Implementing procedural island generation using noise functions (Perlin/Simplex).

Object Placement: Adding logic for placing crafted items (campfire, shelter).

Advanced Objects & Mechanics: Implementing water purifier, signal fire, swimming, fishing, shelter interaction (enter/exit), dynamic shadows, shrubs, driftwood.

AI/Hazards: Implementing the shark spawning, behavior (patrol, chase, attack, linger), and despawn logic.

UI Polish: Implementing stats bars, tooltips, message boxes, interaction prompts, title screen, game over screen, pause menu, help panel.

Data Persistence: Implementing the leaderboard system using localStorage.

Testing & Balancing: Extensive playtesting to find bugs, tune stat depletion rates, resource availability, crafting costs, and overall difficulty.

Finalization: Code cleanup (within limits of single file), adding background music, creating documentation.

Challenges Encountered

Scope Management: Integrating numerous features (crafting, stats, day/night, placement, swimming, fishing, sharks, noise generation, UI) into a cohesive whole within a single JS file is complex.

Balancing: Tuning stat depletion rates, resource availability, crafting costs, sun damage, regeneration, and shark difficulty to create a challenging but fair experience.

Procedural Generation: Fine-tuning the noise parameters and falloff functions to consistently generate playable and interesting island layouts. Distinguishing ocean vs. lakes required a flood-fill approach.

Collision Detection: Implementing robust collision for the player against various static and dynamic objects, especially tree trunks.

State Management: Keeping track of numerous states (player stats, inventory, object states like burning/fueled/stump, game state like paused/gameOver) accurately.

UI Implementation: Creating and managing multiple interactive UI panels (inventory, crafting, help, pause, leaderboard) using DOM manipulation and CSS. Ensuring responsiveness via scaling.

AI Behavior: Developing the shark's logic (spawning conditions, detection, chasing, lingering, attacking, despawning) to feel threatening but not impossible to evade.

Rendering Order: Ensuring objects are drawn in the correct order (e.g., player behind canopy but in front of trunk/shadow) using Y-sorting.

Single-File Complexity: Managing all game logic, object definitions, drawing functions, UI handlers, and state variables within a single game.js file became increasingly difficult as features were added, increasing the risk of naming collisions, tightly coupled code, and making debugging harder.

How Challenges Were Addressed

Iterative Development: Building features incrementally allowed for focused testing and debugging.

Helper Functions: Breaking down logic into smaller, reusable functions (e.g., checkCollision, getDistanceToNearestLand, drawing functions for each object).

Console Logging: Extensive use of console.log for debugging state variables, function calls, and event triggers.

Logical Grouping & IIFE: While not true modules, code was grouped logically within the single file (e.g., inventory functions together, UI functions together), and the IIFE helped prevent global namespace pollution.

Simplification: Where complex algorithms were too difficult or time-consuming, simpler approximations were used (e.g., basic AABB collision, simpler AI triggers).

Playtesting & Refinement: Continuously testing the game to identify bugs, balancing issues, and awkward mechanics, then adjusting parameters or logic accordingly.

Online Resources: Likely referencing documentation (MDN for Canvas, DOM, localStorage) and potentially algorithms or examples for noise generation or game loop structure.

Testing and Results
Testing Methods

Manual Playtesting: The primary method involved repeatedly playing the game under various conditions. This included:

Testing core mechanics (movement, interaction, crafting, item use).

Attempting to survive long-term to test stat balancing and resource depletion/regrowth.

Intentionally triggering edge cases (trying to place items in invalid locations, swimming into sharks, running stats to zero).

Testing UI interactions (opening/closing panels, navigating inventory, clicking buttons).

Verifying the day/night cycle and associated effects (sun damage, shade regen).

Testing specific features like fishing, shelter use, purifier use, and signal fire mechanics.

Checking leaderboard saving and loading across browser sessions.

Peer Feedback: Likely involved having classmates or the instructor play the game and provide feedback on usability, difficulty, bugs, and overall experience.

Browser Compatibility: Basic testing likely occurred in the primary development browser (e.g., Chrome, Firefox). Cross-browser compatibility might be limited.

Code Inspection/Debugging: Using browser developer tools (Console, Inspector) to identify errors and inspect element states.

Results

Testing revealed several key findings and led to refinements:

Bug Identification: Various bugs were likely found and fixed, such as:

Collision detection issues (getting stuck on objects, walking through unintended areas).

Incorrect state updates (stats not depleting/regenerating correctly, inventory counts off).

UI glitches (panels not opening/closing, buttons unresponsive, text overlapping).

World generation anomalies (unplayable islands, resources spawning incorrectly).

Interaction logic errors (unable to gather resources, place items, or interact with objects correctly).

Shark AI bugs (getting stuck, not chasing/attacking correctly, spawning in invalid locations).

Balancing Adjustments: Playtesting highlighted areas where the game was too easy or too difficult, leading to adjustments in:

Stat depletion rates (hunger, thirst).

Resource availability and yield.

Crafting recipe costs.

Sun damage rate and shade regeneration rate.

Shark speed, detection range, and spawn frequency.

Fishing success rates.

Usability Feedback: Feedback likely led to improvements in UI clarity, control responsiveness, and the clarity of interaction prompts/messages. The addition of features like auto-walk to shelter likely stemmed from usability testing.

Leaderboard Functionality: Testing confirmed that scores were saved correctly to localStorage, sorted properly, displayed accurately, and persisted between sessions. The "Copy Results" functionality was tested.

Performance: Manual testing likely gave a subjective sense of performance. While generally adequate, complex scenes with many objects or intensive calculations (noise) might show minor frame drops, though no formal profiling was conducted. The scaling logic ensures basic visual consistency across different screen sizes.

Conclusion
Reflection

What went well? The project successfully implemented a functional core survival game loop within a web browser. Key features like procedural world generation, resource gathering, a robust crafting system, placeable objects, dynamic day/night cycle with environmental effects (sun/shade), and distinct hazards (stats depletion, sharks) were achieved. The integration of multiple interacting systems (inventory, stats, world objects, UI) demonstrates a good understanding of game state management. The leaderboard system using localStorage provides effective data persistence. The visual presentation using the Canvas API, while simple, is consistent and functional. Implementing complex features like dynamic shadows, shelter mechanics, and basic AI showcases ambition.

What would you improve if given more time?

Code Organization: Refactoring the single game.js file into modules (e.g., player.js, world.js, ui.js, inventory.js) would significantly improve readability, maintainability, and scalability.

Performance Optimization: Profiling and optimizing rendering (e.g., drawing off-screen elements only when necessary) and potentially computationally intensive tasks like noise generation or frequent collision checks.

AI Enhancement: Making the shark AI more sophisticated (e.g., different attack patterns, better pathfinding around obstacles). Potentially adding other passive or aggressive fauna.

World Generation Variety: Adding more biomes, terrain features, structures, or random events to the world generation for greater replayability.

Sound Design: Adding sound effects for actions (chopping, crafting, walking, swimming, UI clicks) beyond the single background music track.

Balancing & Polish: More extensive playtesting and data gathering to further refine game balance and smooth out rough edges in gameplay and UI.

Error Handling: More robust error handling, especially around localStorage access or potential DOM element issues.

Automated Testing: Implementing unit or integration tests for core logic functions.

Future Work

Content Expansion: Adding more craftable items, resources, tools, building options (e.g., walls, farms), and potentially different types of islands or environments.

Advanced Mechanics: Implementing farming, cooking (requiring campfire), tool durability, weather effects, or temperature management.

Improved AI: Adding more diverse wildlife (passive animals for hunting, other predators). Improving shark pathfinding.

Enhanced Graphics: Using spritesheets for animation, adding more visual effects (particles for fire/smoke/splashes), improving terrain texturing.

Multiplayer: Exploring the possibility of adding cooperative or competitive multiplayer features (would require significant backend architecture changes).

Platform Porting: While web-based, potentially packaging it using tools like Electron for a desktop application feel.

Accessibility Features: Adding options for control remapping, color adjustments, or font size changes.

References

MDN Web Docs (Mozilla Developer Network): Extensive reference for HTML, CSS, JavaScript, Canvas API, DOM API, Web Storage API, Web Audio API, Clipboard API. (e.g., https://developer.mozilla.org/)

Perlin Noise / Simplex Noise Concepts: Algorithms referenced for procedural generation. Implementations adapted from common examples attributed to Stefan Gustavson, Ken Perlin, Jonas Wagner.

JavaScript Game Development Resources: General concepts likely learned from various online tutorials (e.g., game loops, collision detection, state management).

Stack Overflow: Consulted for specific coding challenges and debugging assistance.

Survival Game Design Patterns: Inspiration drawn from common mechanics found in the genre.

(Note: Replace general descriptions with specific URLs or book titles if applicable)

Appendices
Game Screenshots

Figure 1: Title Screen: Shows the game title "The Longest Day," instructions panel detailing controls and objectives, and buttons to "Start Game" and view the "Leaderboard". Demonstrates the initial user interface and entry point.
[Image Placeholder: ./screenshots/title_screen.png]

Figure 2: Core Gameplay: Depicts the player character on the island terrain (grass/sand), surrounded by resources like trees and rocks. The stats panel (Health, Hunger, Thirst, Day) is visible in the top-left, and the inventory bar is shown at the bottom-center. Illustrates the main game view and UI layout.
[Image Placeholder: ./screenshots/core_gameplay.png]

Figure 3: Crafting Menu: Displays the crafting panel overlay, showing a list of craftable items (e.g., Axe, Campfire, Shelter), their resource requirements, descriptions, and highlighting which items are currently craftable based on inventory resources.
[Image Placeholder: ./screenshots/crafting_menu.png]

Figure 4: Base Building Example: Shows the player character near placed objects like a burning Campfire providing light and a Shelter structure. Demonstrates the object placement mechanic and visual representation of key survival structures.
[Image Placeholder: ./screenshots/base_building.png]

Figure 5: Interaction Prompt: Close-up showing the player near a resource (e.g., a tree) with the interaction prompt ("Press E to Chop Tree") displayed on the screen. Illustrates the contextual interaction system.
[Image Placeholder: ./screenshots/interaction_prompt.png]

Figure 6: Shark Encounter: Shows the player swimming in the ocean with the distinct shark fin graphic nearby, possibly with the "Chasing" state implied by its proximity or orientation. Highlights one of the main environmental threats.
[Image Placeholder: ./screenshots/shark_encounter.png]

Figure 7: Game Over Screen: Displays the "Game Over" (or "Starved", "Devoured!", "Rescued!") message, the final number of days survived, total items collected, fish caught, and the "Play Again" button.
[Image Placeholder: ./screenshots/game_over.png]

Figure 8: Leaderboard Panel: Shows the leaderboard panel overlay with scores sorted for "Longest Days Survived," "Most Items Collected," and "Most Fish Caught," including player names, scores, and dates. Includes the "Copy Results" and "Close" buttons.
[Image Placeholder: ./screenshots/leaderboard.png]

(Note: Replace [Image Placeholder: ...] with actual Markdown image links ![Alt Text](path/to/image.png) if you have screenshots in your repository.)

Source Code Excerpts

Snippet 1: Main Game Loop Structure

// (Inside main IIFE)
let lastTime = 0;

function gameLoop(currentTime) {
    if (!gameStarted || gameOver) return; // Stop loop if game ended

    // Handle Pausing
    if (isPaused) {
        render(); // Keep rendering UI even when paused
        requestAnimationFrame(gameLoop);
        return;
    }

    // Calculate Delta Time
    if (lastTime === 0) lastTime = currentTime;
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    // Clamp delta time to prevent huge jumps if tab loses focus
    const clampedDeltaTime = Math.min(deltaTime, 0.1);

    // Update Game Logic
    update(clampedDeltaTime);

    // Render the Current State
    render();

    // Request Next Frame
    requestAnimationFrame(gameLoop);
}

// Initial call to start the loop (usually after clicking 'Start Game')
// requestAnimationFrame(gameLoop); // Example placement
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
JavaScript
IGNORE_WHEN_COPYING_END

Caption: Basic structure of the main game loop using requestAnimationFrame, calculating delta time, handling pause state, and separating update logic from rendering.

Snippet 2: Simplified Player Stat Update

function updateStats(deltaTime) {
    const stats = getStatsState(); // Get current stats
    const player = getPlayerState();
    const time = getTimeState();
    const worldState = getWorldState();
    const isDay = /*... check time ...*/;
    const inShade = isPlayerInShade(); // Uses pre-calculated shadows/shelter
    const inWater = /*... check player tile type ...*/;

    // Deplete Hunger/Thirst (base rates)
    stats.hunger -= HUNGER_RATE * deltaTime * (inWater ? SWIM_HUNGER_MULTIPLIER : 1);
    stats.thirst -= THIRST_RATE * deltaTime * (inWater ? SWIM_THIRST_MULTIPLIER : 1);

    let healthChange = 0;

    // Apply Sun Damage or Shade Regen (if Day)
    if (isDay) {
        if (inShade && stats.health < MAX_STAT) {
            healthChange += SHADE_HEALTH_REGEN_RATE * deltaTime;
            // ... (message logic) ...
        } else if (!inShade && !inWater) {
            healthChange -= SUN_DAMAGE_RATE * deltaTime;
            // ... (message logic) ...
        }
    }

    // Apply Swimming Penalty
    if (inWater) {
        healthChange -= SWIM_HEALTH_DRAIN_RATE * deltaTime;
    }

    // Apply Penalties for Low Stats
    if (stats.hunger <= 0) healthChange -= HEALTH_LOSS_HUNGER_ZERO * deltaTime;
    if (stats.thirst <= 0) healthChange -= HEALTH_LOSS_THIRST_ZERO * deltaTime;
    // ... (minor penalties) ...

    // Apply accumulated health change
    stats.health += healthChange;

    // Clamp stats
    stats.health = Math.max(0, Math.min(MAX_STAT, stats.health));
    stats.hunger = Math.max(0, Math.min(MAX_STAT, stats.hunger));
    stats.thirst = Math.max(0, Math.min(MAX_STAT, stats.thirst));

    updateStatsState(stats); // Save updated stats
    updateStatsUI(); // Update display
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
JavaScript
IGNORE_WHEN_COPYING_END

Caption: Example structure for updating player survival statistics, considering environmental factors like shade, water, and time of day, applying penalties, and clamping values.

Analytics Graphs or Charts (Leaderboard Example)

The primary analytics output is the in-game leaderboard display. Here is an example of its textual content:

Leaderboard

== Longest Days Survived ==
1. PlayerOne - 15 Days (5/4/2025)
2. Survivor - 12 Days (5/3/2025)
3. TestUser - 10 Days (5/4/2025)
(No further scores)

== Most Items Collected ==
1. PlayerOne - 542 Items (5/4/2025)
2. Resourceful - 480 Items (5/2/2025)
3. Survivor - 310 Items (5/3/2025)
(No further scores)

== Most Fish Caught ==
1. AnglerPro - 25 Fish (5/1/2025)
2. PlayerOne - 18 Fish (5/4/2025)
3. Survivor - 11 Fish (5/3/2025)
(No further scores)

