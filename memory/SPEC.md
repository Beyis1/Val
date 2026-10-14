# VAL Aim — Spec
Browser 3D Valorant aim trainer (single user, no login). Turkish UI with EN toggle.

## Standing user rules (must keep)
- Study the existing architecture before changing anything; never rewrite working systems; verify every feature in the real game.
- Reference feel: ishoutu.cn/aim + kingdomarchives.com/modelviewer (FP camera, weapon placement). Don't copy unlicensed files.
- Simple / flat visuals for UI art (no AI-looking imagery). No Market in main menu. No match/round announcer sounds (victory, defeat, spike, round start).
- Defaults: sens 0.1 @ 1600 DPI (DPI = reference only), crosshair code `0;P;o;1;d;1;f;0;0b;0;1b;0` (white dot).

## Assets
- Maps: 11 Valorant maps (.blend from user's Drive) converted offline -> `frontend/public/maps/<id>/{visual.glb, collision.glb, meta.json, minimap.png, thumb.jpg}`. Plus `sandbox` (procedural floor, built from editable props).
- Kingdom Archives: FP arms (29 agents, `public/ka/fp`), weapons + skins (`public/ka/weapons`), FP/GN weapon clips (`public/ka/fpanim`), rig constraints (`rig.json`), spike. Announcer files removed.
- Skin collection is curated in `public/ka/manifest.json`: only Battle Pass or upgradeable skins (data: valorant-api.com skins + contracts, script in /app/.work). Each skin has `tier` ("bp"|"upgrade") and `levels` (original level names, shown as info only — only level 1 assets exist).
- Built-in scenarios: `backend/seed_data/builtin_scenarios.json` (insert-if-missing). 40 = 39 generated (gen_builtins.py) + hand-added `b-sandbox-arena` (re-add if regenerating).

## Backend (/api)
scenarios CRUD (+ `props: Prop[]` editable boxes) + /scenarios/{id}/favorite; records POST/GET + /records/summary; settings GET/PUT (free-form blob); weapon-models (GridFS GLB upload/get/delete).

## Frontend
Routes: / (Workshop), /favorites, /records, /settings, /updates, /editor[/:id], /play/:id.
- Engine `src/game/engine.ts` (three + three-mesh-bvh): capsule physics + step-up, player spawn snapped to floor (groundY raycast), Valorant damage bands + headshot one-taps (e.g. Vandal 160 head vs 150 HP), deterministic spray. Bots = user's training-bot robot (`public/models/trainingbot.stl`, binary STL despite original .glb name; `src/game/trainingBot.ts` keeps one of the two figures, Y-up, 1.85 m, box-projected panel texture + gunmetal/red-visor paint); invisible hitboxes fitted to the model per height band (head / body+arms / legs; fallback = visible box body if the file fails), feet snapped to floor, hit flash, single-death guard, optional respawn (pre-aim). Tracers from on-screen muzzle to real impact. Props merged into the collision BVH.
- Viewmodel `src/game/viewmodel.ts`: weapon on R_WeaponPoint; arm pose = AK IdlePose (long guns) / BasePistol hold (sidearms + knife); rest transform solved so the weapon lands on a canonical screen pose (POSES); left hand CCD-IK onto weapon's Left_Hand_Target; GN clips animate gun parts. Procedural layer in engine loop: equip raise, reload dip (+IK release), recoil kick, inspect (Y), knife slash, mouse sway, bob. Works for all 29 agents (verified numerically).
- Audio `src/game/audio.ts`: procedural per-weapon fire voices (no weapon sound files exist in project), categories WeaponFire/Reload/Equip/HitConfirm/Headshot/KillConfirm/WeaponSkinAudio (skin table empty -> default voice), reload cues timed to reload progress, positional bot shots, master + sfx volumes.
- Esc menu `components/PauseMenu.tsx`: resume, settings, controls, training, main menu, quit. Buy menu (B) = weapons + shields with stat bars. Settings: resolution (screen-supported list, safe fallback to native), display mode (fullscreen / borderless / windowed via Fullscreen API), effects toggle, sfx volume, respawn toggle. Settings migration `defaultsVersion` (v3).
- Editor: bots, spawn, spike site, props (B place, RMB select, G move, X delete, inspector size/yaw/color); Sandbox map option.
Debug: `window.__engine`, `window.__updateSettings`; localStorage `valaim.noLockCheck` skips pointer-lock pause (automation only), `vmPose` overrides viewmodel pose.
