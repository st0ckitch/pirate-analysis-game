# Sprint Voyage Design System

Design system for a 3D browser game in which a wooden explorer boat sails a jungle river, driven by Jira ticket and sprint status. Visual direction comes from the supplied reference screenshot (`uploads/pasted-1793688381603-0.png`): a stylized, painterly jungle scene with saturated greens, teal water, blue sky, warm rock and wood, and a coral accent.

"Sprint Voyage" is a working title; no brand name, logo or Jira branding was supplied, so none is drawn. Type is plain text wherever a mark would go.

## Sources
- Reference image: `uploads/pasted-1793688381603-0.png`
- Brief: Jira-linked 3D game, simple ship movement, all elements 3D, menu UI/UX plus in-game system with a task scale, progress bar and moving ship.
- Choices: wooden boat/raft; ship travels left to right with one waypoint per status (To Do → In Progress → In Review → Done); ticket size shown as crates sized by story points; screens are Main menu, Sprint select, HUD, Ticket detail; fonts are rounded display + clean sans; static click-through kits.

## Game model
- **Ship position** = story-point-weighted average stage index of all sprint tickets (0 to 3). Moving any ticket forward sails the ship toward the next buoy.
- **Progress bar** = done story points / total story points.
- **Crate size** = story points (1, 2, 3, 5, 8, 13 → 44, 52, 60, 74, 90, 108px).
- **Status colours**: To Do stone, In Progress water, In Review sun, Done leaf, Blocked coral.

## Content fundamentals
- Short, friendly, nautical-adventure verbs: "Set Sail", "Choose your voyage", "Move to In Review", "Unlocks after Sprint 14".
- Sentence case for body, Title Case for buttons and screen titles. Small caps labels (uppercase, wide tracking) only for taglines and card actions.
- Addresses the player as "you"; Jira content (ticket keys, titles, descriptions) is shown verbatim and never rewritten.
- No emoji. Numbers are the main decoration: points, counts, "18 / 34 pts".

## Visual foundations
- **Colour**: leaf greens (primary), teal water and sky blues (cool surfaces), parchment and wood (panels, crates, ship), one coral accent for blockers and the sail flag, sun yellow for the current waypoint and selection, emerald glow for magic highlights. All defined in oklch in `tokens/colors.css`. Whites are warm parchment, text is deep jungle ink (`--ink-900`), never pure black.
- **Type**: Fredoka (rounded, playful) for titles, buttons, numbers and ticket keys; Figtree for descriptions and metadata. HUD text is never below 14px. Both are Google Fonts substitutes; no font files were supplied.
- **Backgrounds**: the live game scene is a 3D render. Until renders exist, a CSS sky, hills and river gradient with a diagonal stripe overlay and a monospace caption marks where it goes. Menus sit directly over the scene; there are no flat page backgrounds.
- **3D depth recipe** (every interactive surface): a hard 4 to 6px "thickness" edge in a darker shade, a soft green-tinted ground shadow, and a 2px white top highlight. Tubes (progress, river) use an inset shadow instead.
- **Corners**: large and rounded. Pills for buttons, badges and tubes; 22px for panels and boards; 8px for crates.
- **Borders**: 3px wood trim on panels and boards; none on buttons (the edge does the work).
- **Cards/panels**: parchment gradient, 3px wood border, 3px inner parchment ring, wooden tab title. Glass tone (dark ink at 58%, 8px blur, hairline white border) only for HUD over the scene.
- **Hover/press**: hover lifts 2 to 4px; press squashes down by the edge height and the edge collapses to 1px. Cards lift 4px with a bounce.
- **Motion**: bouncy `cubic-bezier(0.34, 1.56, 0.64, 1)` for UI pops and fills, soft-out for ship travel (1.4s). Ship rocks continuously (`dsBob`). New crates drop in (`dsDrop`).
- **Transparency/blur**: only on glass HUD panels and modal scrim.
- **Imagery vibe**: warm light, saturated greens, cool water, soft cel shading.
- **Layout**: HUD is fixed to a 1280x720 stage: sprint progress top-left, controls top-right, cargo and stage track in a bottom panel.

## Iconography
Rounded, 2.5px-stroke line icons from Lucide (paths inlined in `components/core/Icon.jsx`). Lucide is a substitute; no icon set was supplied. No emoji, no icon font. Illustration is not drawn; the ship is built from simple CSS shapes as a stand-in for the 3D model.

## Index
- `styles.css` imports `tokens/colors.css`, `typography.css`, `spacing.css` (spacing, radii, depth shadows), `motion.css` (easing, keyframes).
- `components/core`: Icon, Button, IconButton, Badge, Panel.
- `components/hud`: ProgressBar, ShipMarker, StageTrack, TaskCrate.
- `components/menu`: TicketCard, SprintCard.
- `guidelines/`: foundation specimen cards.
- `ui_kits/sprint-voyage/`: clickable kit (Main menu → Sprints → HUD; tap a crate for the ticket card; "Simulate Jira update" moves the ship).
- `ds-global.js`: helper that exposes the component bundle as `window.DS` for cards and kits.
- Intentional addition: `Icon` (needed to wrap the Lucide glyphs).
