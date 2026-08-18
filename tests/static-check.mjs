import { existsSync, readFileSync } from 'node:fs';
const required=['dist/index.html','dist/assets','src/main.ts','src/character-visual.ts','README.md','start-local.bat','preview-build.bat','build-production.bat'];
for(const p of required)if(!existsSync(p))throw new Error(`Missing: ${p}`);
const html=readFileSync('dist/index.html','utf8');
if(/[A-Z]:\\|file:\/\//i.test(html))throw new Error('Absolute local path found in dist/index.html');
const code=readFileSync('src/main.ts','utf8');
for(const token of ['InstancedMesh','localStorage','visibilitychange','navigator.vibrate','attackRate','gateMask','chooseTarget','enemySpawnTimer','deviceHp','firstFightAt','limbMatrix','friendLimbs','enemyLimbs','medium','miniboss','enemyCrests','enemyCores','unitDefs','ownedUnits','selectedUnit','playVictoryJingle','updateMusic','settings.invert','randomizeField','makeObstacle','obstacles','coinMesh','awardCoins','coinTone','musicLoops','Array.from({length:100}','stageZones','SpecialId','specialGauge','specialDefs','ownedSpecials','summonSpecial','updateSpecialFx','updateBaseExplosion','advanceX','wanderTimer','TIME_LIMIT=180','timedOut','killUnit(hit,true,false)','横にスワイプして選択'])if(!code.includes(token))throw new Error(`Feature marker missing: ${token}`);
const visual=readFileSync('src/character-visual.ts','utf8');
for(const token of ['CharacterDefinition','ProceduralCharacterRenderer','MeshToonMaterial','CapsuleGeometry','swordTrail','spawnDeath','animPhase','InstancedMesh','HEAVY_CHARACTER','RUNNER_CHARACTER','KNIGHT_CHARACTER','RANGED_CHARACTER','CHARACTER_DEFINITIONS','shoulderScale','animationSpeed','visualType','FRIEND_VISUAL_ORDER'])if(!(code+visual).includes(token))throw new Error(`Visual marker missing: ${token}`);
console.log('Static checks passed.');

