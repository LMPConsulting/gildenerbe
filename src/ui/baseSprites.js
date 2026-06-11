// Programmatic pixel art for the Gildenerbe base view: buildings with visible
// growth tiers, wall segments, the gate, ground texture and small ambient
// props. Same warm palette family and grid convention as sprites.js — an
// entity drawn at (x, y, s) occupies a 16s × 16s box whose BOTTOM edge
// (row 16) is the ground line. Pure canvas, no DOM access.

const C = {
  ink:     '#1a140f', // outlines, dark openings
  shadow:  '#43301d', // deep warm shadow
  slate:   '#4f5160', // iron / anvil
  steel:   '#8a93a0',
  steelL:  '#c6cfd8',
  white:   '#f2f4ef', // glints
  gold:    '#d9a441', // thatch, trim, treasure
  goldD:   '#8a6120',
  leather: '#7a5230',
  blood:   '#c23a2c', // banners, flags
  bloodD:  '#6e1d16',
  bone:    '#ece3c4', // wax, dummy head
  moss:    '#4e7a38', // tree canopy
  mossD:   '#2f4c20',
  grass:   '#3d5a2a', // ground
  grassD:  '#314a21',
  grassL:  '#4d6c33',
  dirt:    '#5d4426', // plots, paths
  dirtD:   '#49351d',
  wood:    '#8a5e34', // hut walls, palisade
  woodD:   '#5e3f22',
  stone:   '#7d7468', // stone walls
  stoneD:  '#5a5249',
  stoneL:  '#a39a8b',
  roof:    '#a04a30', // shingle roofs
  roofD:   '#6e3220',
  flame:   '#e8902c', // torch fire
  flameY:  '#f2c14e', // lit windows, candles
  water:   '#1d4a5d',
};

function rect(ctx, x, y, gx, gy, w, h, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + gx * s, y + gy * s, w * s, h * s);
}
const px = (ctx, x, y, gx, gy, s, color) => rect(ctx, x, y, gx, gy, 1, 1, s, color);

// Deterministic 2D hash in [0,1) — keeps textures stable across redraws.
function hash2(ix, iy) {
  let n = ix * 374761393 + iy * 668265263;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- small kit

function propDummy(ctx, x, y, gx, gy, s) { // Holzpuppe, 3 wide × 5 tall
  px(ctx, x, y, gx + 1, gy, s, C.bone);              // sack head
  rect(ctx, x, y, gx, gy + 1, 3, 1, s, C.wood);      // cross arms
  rect(ctx, x, y, gx + 1, gy + 1, 1, 4, s, C.woodD); // post
  px(ctx, x, y, gx + 1, gy + 2, s, C.leather);       // strapped torso
}

function propChest(ctx, x, y, gx, gy, s) { // Truhe, 3 wide × 3 tall
  rect(ctx, x, y, gx, gy, 3, 3, s, C.wood);
  rect(ctx, x, y, gx, gy, 3, 1, s, C.woodD);         // lid
  rect(ctx, x, y, gx, gy + 1, 3, 1, s, C.gold);      // band
  px(ctx, x, y, gx + 1, gy + 1, s, C.goldD);         // lock
}

function propAnvil(ctx, x, y, gx, gy, s) { // Amboss, 3 wide × 3 tall
  rect(ctx, x, y, gx, gy, 3, 1, s, C.slate);         // face + horn
  px(ctx, x, y, gx, gy, s, C.steel);                 // worn edge
  px(ctx, x, y, gx + 1, gy + 1, s, C.slate);         // waist
  rect(ctx, x, y, gx, gy + 2, 3, 1, s, C.shadow);    // wood block
}

function propGrave(ctx, x, y, gx, gy, s) { // Grabstein, 2 wide × 3 tall
  px(ctx, x, y, gx, gy, s, C.stoneL);                // rounded top
  rect(ctx, x, y, gx, gy + 1, 2, 2, s, C.stone);
  px(ctx, x, y, gx + 1, gy + 2, s, C.stoneD);
}

function propCandle(ctx, x, y, gx, gy, s, t) { // Kerze, flickers with t
  px(ctx, x, y, gx, gy + 1, s, C.bone);              // wax
  if (Math.floor((t || 0) / 240 + gx) % 4 !== 0) px(ctx, x, y, gx, gy, s, C.flameY);
}

function propBanner(ctx, x, y, gx, gy, s, len) { // hanging cloth
  rect(ctx, x, y, gx, gy, 1, len, s, C.blood);
  px(ctx, x, y, gx, gy + len - 1, s, C.bloodD);      // swallowtail shade
}

// ------------------------------------------------------------ growth tiers

// Level 0: empty plot — trampled dirt and a wooden sign promising a building.
function drawPlot(ctx, x, y, s) {
  rect(ctx, x, y, 3, 12, 10, 3, s, C.dirt);
  rect(ctx, x, y, 4, 11, 8, 1, s, C.dirt);
  rect(ctx, x, y, 4, 15, 8, 1, s, C.dirtD);
  px(ctx, x, y, 3, 12, s, C.dirtD);
  px(ctx, x, y, 12, 14, s, C.dirtD);
  px(ctx, x, y, 6, 13, s, C.stoneD);                 // pebbles
  px(ctx, x, y, 10, 12, s, C.stoneD);
  px(ctx, x, y, 4, 14, s, C.grassD);                 // weeds creeping back
  px(ctx, x, y, 11, 11, s, C.grassD);
  rect(ctx, x, y, 7, 8, 5, 3, s, C.wood);            // sign board
  rect(ctx, x, y, 7, 8, 5, 1, s, C.woodD);
  px(ctx, x, y, 8, 9, s, C.ink);                     // scrawled plan
  px(ctx, x, y, 10, 9, s, C.ink);
  rect(ctx, x, y, 9, 11, 1, 5, s, C.woodD);          // post
}

// Levels 1–2: small wooden hut with thatched roof; per-id marker out front.
function drawHut(ctx, x, y, s, id, level) {
  rect(ctx, x, y, 3, 15, 11, 1, s, C.grassD);        // ground shadow
  // thatch gable
  rect(ctx, x, y, 7, 4, 3, 1, s, C.goldD);
  rect(ctx, x, y, 6, 5, 5, 1, s, C.gold);
  rect(ctx, x, y, 5, 6, 7, 1, s, C.gold);
  rect(ctx, x, y, 4, 7, 9, 1, s, C.gold);
  rect(ctx, x, y, 4, 8, 10, 1, s, C.goldD);          // eave
  px(ctx, x, y, 6, 6, s, C.goldD);                   // straw texture
  px(ctx, x, y, 9, 7, s, C.goldD);
  // log walls
  rect(ctx, x, y, 4, 9, 9, 6, s, C.wood);
  rect(ctx, x, y, 12, 9, 1, 6, s, C.woodD);          // shaded side
  px(ctx, x, y, 5, 11, s, C.woodD);                  // log seams
  px(ctx, x, y, 8, 11, s, C.woodD);
  px(ctx, x, y, 11, 11, s, C.woodD);
  px(ctx, x, y, 6, 13, s, C.woodD);
  // door + lit window
  rect(ctx, x, y, 7, 11, 2, 4, s, C.woodD);
  rect(ctx, x, y, 7, 11, 2, 1, s, C.shadow);
  px(ctx, x, y, 8, 13, s, C.gold);                   // latch
  px(ctx, x, y, 5, 10, s, C.flameY);                 // window glow
  if (level >= 2) {
    rect(ctx, x, y, 11, 5, 2, 3, s, C.stone);        // chimney
    px(ctx, x, y, 11, 5, s, C.stoneL);
    px(ctx, x, y, 12, 3, s, C.steel);                // smoke wisps
    px(ctx, x, y, 13, 2, s, C.steelL);
    px(ctx, x, y, 11, 10, s, C.flameY);              // second window
  }
  // what this hut will become
  if (id === 'trainingshalle') propDummy(ctx, x, y, 1, 11, s);
  else if (id === 'schatzkammer') propChest(ctx, x, y, 1, 13, s);
  else if (id === 'waffenkammer') propAnvil(ctx, x, y, 1, 13, s);
  else if (id === 'heldengruft') propGrave(ctx, x, y, 1, 13, s);
  else if (id === 'gildenhalle') {                   // young guild raises its colours
    rect(ctx, x, y, 2, 8, 1, 8, s, C.woodD);
    rect(ctx, x, y, 3, 8, 2, 1, s, C.blood);
    px(ctx, x, y, 3, 9, s, C.bloodD);
  }
}

// Levels 3–5 (6+ ornate): stone building with id-specific roof and props.
function drawStone(ctx, x, y, s, id, level, t) {
  const gruft = id === 'heldengruft';
  rect(ctx, x, y, 2, 15, 13, 1, s, C.grassD);        // ground shadow
  // stone walls
  rect(ctx, x, y, 2, 9, 13, 6, s, C.stone);
  rect(ctx, x, y, 14, 9, 1, 6, s, C.stoneD);         // shaded edge
  rect(ctx, x, y, 2, 9, 13, 1, s, C.stoneL);         // lit top course
  px(ctx, x, y, 4, 11, s, C.stoneD);                 // masonry seams
  px(ctx, x, y, 8, 12, s, C.stoneD);
  px(ctx, x, y, 11, 11, s, C.stoneD);
  px(ctx, x, y, 5, 13, s, C.stoneD);
  px(ctx, x, y, 12, 13, s, C.stoneD);
  // id-specific roofline
  if (id === 'schatzkammer') {                       // goldene Kuppel
    rect(ctx, x, y, 7, 3, 3, 1, s, C.gold);
    rect(ctx, x, y, 5, 4, 7, 1, s, C.gold);
    rect(ctx, x, y, 4, 5, 9, 1, s, C.gold);
    rect(ctx, x, y, 3, 6, 11, 1, s, C.gold);
    rect(ctx, x, y, 3, 7, 11, 1, s, C.goldD);
    rect(ctx, x, y, 2, 8, 13, 1, s, C.goldD);        // base ring
    px(ctx, x, y, 5, 4, s, C.white);                 // glint
    px(ctx, x, y, 8, 2, s, C.gold);                  // finial
  } else if (gruft) {                                // mausoleum + obelisk
    rect(ctx, x, y, 4, 6, 9, 1, s, C.stone);
    rect(ctx, x, y, 3, 7, 11, 1, s, C.stoneL);       // cornice
    rect(ctx, x, y, 3, 8, 11, 1, s, C.stoneD);
    rect(ctx, x, y, 8, 3, 1, 3, s, C.stoneL);        // obelisk
    rect(ctx, x, y, 7, 4, 3, 1, s, C.stone);
  } else {                                           // red shingle gable
    rect(ctx, x, y, 7, 4, 3, 1, s, C.roofD);
    rect(ctx, x, y, 6, 5, 5, 1, s, C.roof);
    rect(ctx, x, y, 5, 6, 7, 1, s, C.roof);
    rect(ctx, x, y, 4, 7, 9, 1, s, C.roof);
    rect(ctx, x, y, 3, 8, 11, 1, s, C.roofD);        // eave
    px(ctx, x, y, 6, 6, s, C.roofD);                 // shingle texture
    px(ctx, x, y, 9, 7, s, C.roofD);
  }
  // door (the crypt gapes dark)
  if (gruft) {
    rect(ctx, x, y, 7, 10, 3, 5, s, C.ink);
    rect(ctx, x, y, 7, 10, 3, 1, s, C.stoneD);       // arch
  } else {
    rect(ctx, x, y, 7, 11, 3, 4, s, C.woodD);
    rect(ctx, x, y, 7, 11, 3, 1, s, C.shadow);
    px(ctx, x, y, 9, 13, s, C.gold);                 // handle
  }
  // windows: lit and doubled as the building grows
  px(ctx, x, y, 4, 11, s, level >= 4 && !gruft ? C.flameY : C.ink);
  if (level >= 4) px(ctx, x, y, 12, 11, s, gruft ? C.ink : C.flameY);
  if (level >= 5) {                                  // side annex
    rect(ctx, x, y, 0, 11, 2, 4, s, C.stone);
    rect(ctx, x, y, 0, 11, 2, 1, s, C.stoneL);
    rect(ctx, x, y, 0, 10, 2, 1, s, gruft ? C.stoneD : C.roofD);
  }
  // id props out front
  if (id === 'trainingshalle') {
    propBanner(ctx, x, y, 3, 9, s, 4);
    propDummy(ctx, x, y, 11, 11, s);
  } else if (id === 'schatzkammer') {
    propChest(ctx, x, y, 3, 13, s);
  } else if (id === 'waffenkammer') {
    rect(ctx, x, y, 7, 9, 3, 2, s, C.leather);       // shield emblem
    px(ctx, x, y, 8, 9, s, C.steelL);                // boss
    px(ctx, x, y, 8, 8, s, C.steelL);                // sword above
    propAnvil(ctx, x, y, 3, 13, s);
  } else if (gruft) {
    propGrave(ctx, x, y, 3, 13, s);
    propGrave(ctx, x, y, 12, 13, s);
    propCandle(ctx, x, y, 5, 14, s, t);
    propCandle(ctx, x, y, 10, 14, s, t);
  }
  // level 6+: ornate gold trim
  if (level >= 6) {
    for (let gx = 3; gx <= 13; gx += 2) px(ctx, x, y, gx, 8, s, C.gold);
    px(ctx, x, y, 2, 9, s, C.gold);
    px(ctx, x, y, 14, 9, s, C.gold);
    px(ctx, x, y, 2, 14, s, C.gold);
    px(ctx, x, y, 14, 14, s, C.gold);
    if (id === 'schatzkammer') px(ctx, x, y, 11, 4, s, C.white);
  }
}

// Levels 3+ Gildenhalle: großes Haupthaus — timbered hall with waving Fahne.
function drawGildenhalle(ctx, x, y, s, level, t) {
  rect(ctx, x, y, 1, 15, 14, 1, s, C.grassD);        // ground shadow
  // wide shingle roof
  rect(ctx, x, y, 7, 2, 3, 1, s, C.roofD);
  rect(ctx, x, y, 6, 3, 5, 1, s, C.roof);
  rect(ctx, x, y, 5, 4, 7, 1, s, C.roof);
  rect(ctx, x, y, 4, 5, 9, 1, s, C.roof);
  rect(ctx, x, y, 2, 6, 13, 1, s, C.roofD);          // long eave
  px(ctx, x, y, 7, 4, s, C.roofD);
  px(ctx, x, y, 10, 5, s, C.roofD);
  // timbered upper storey
  rect(ctx, x, y, 2, 7, 13, 3, s, C.wood);
  rect(ctx, x, y, 2, 7, 13, 1, s, C.woodD);          // beam
  rect(ctx, x, y, 14, 7, 1, 3, s, C.woodD);
  // upper windows light up as the hall grows
  const lit = level >= 5 ? 3 : level >= 4 ? 2 : 1;
  px(ctx, x, y, 4, 8, s, lit >= 2 ? C.flameY : C.ink);
  px(ctx, x, y, 8, 8, s, C.flameY);
  px(ctx, x, y, 12, 8, s, lit >= 3 ? C.flameY : C.ink);
  // stone ground floor
  rect(ctx, x, y, 2, 10, 13, 5, s, C.stone);
  rect(ctx, x, y, 14, 10, 1, 5, s, C.stoneD);
  px(ctx, x, y, 4, 12, s, C.stoneD);
  px(ctx, x, y, 12, 12, s, C.stoneD);
  // great double door + stone step
  rect(ctx, x, y, 6, 11, 5, 4, s, C.woodD);
  rect(ctx, x, y, 8, 11, 1, 4, s, C.shadow);         // split
  rect(ctx, x, y, 6, 11, 5, 1, s, C.shadow);
  px(ctx, x, y, 7, 13, s, C.gold);                   // handles
  px(ctx, x, y, 9, 13, s, C.gold);
  rect(ctx, x, y, 5, 15, 7, 1, s, C.stoneL);         // step
  // ridge pole + waving Fahne
  rect(ctx, x, y, 8, 0, 1, 2, s, C.woodD);
  const wave = Math.floor((t || 0) / 250) % 2;
  rect(ctx, x, y, 9, 0, 2, 1, s, C.blood);
  px(ctx, x, y, 11, wave ? 1 : 0, s, C.blood);       // tail flaps
  px(ctx, x, y, 9, 0, s, C.bloodD);
  // level 6+: gilded hall of legends
  if (level >= 6) {
    for (let gx = 2; gx <= 14; gx += 2) px(ctx, x, y, gx, 6, s, C.gold);
    px(ctx, x, y, 8, 2, s, C.gold);                  // gilded ridge
    propBanner(ctx, x, y, 3, 10, s, 3);              // facade banners
    propBanner(ctx, x, y, 13, 10, s, 3);
    px(ctx, x, y, 8, 0, s, C.gold);                  // pole finial
  }
}

// Wall segment, 16 cells wide; material follows the level:
// 0–1 palisade, 2–3 stone, 4+ crenellated (gilded spikes at 6+).
function drawMauer(ctx, x, y, level, s) {
  if (level <= 1) {
    for (let gx = 0; gx < 16; gx++) {
      rect(ctx, x, y, gx, 11, 1, 5, s, gx % 2 ? C.woodD : C.wood);
      if (gx % 2 === 0) px(ctx, x, y, gx, 10, s, C.woodD); // sharpened tips
    }
    rect(ctx, x, y, 0, 13, 16, 1, s, C.shadow);      // lashing beam
  } else if (level <= 3) {
    rect(ctx, x, y, 0, 10, 16, 6, s, C.stone);
    rect(ctx, x, y, 0, 10, 16, 1, s, C.stoneL);      // capstones
    for (let gx = 0; gx < 16; gx++) {
      px(ctx, x, y, gx, 12 + ((gx * 7) % 3), s, C.stoneD);
    }
  } else {
    rect(ctx, x, y, 0, 9, 16, 7, s, C.stone);
    rect(ctx, x, y, 0, 9, 16, 1, s, C.stoneL);       // wall walk
    for (let gx = 0; gx < 16; gx++) {
      if (gx % 4 < 2) {
        px(ctx, x, y, gx, 8, s, C.stone);            // merlons
        if (level >= 6 && gx % 4 === 0) px(ctx, x, y, gx, 7, s, C.gold);
      }
      px(ctx, x, y, gx, 11 + ((gx * 5) % 3), s, C.stoneD);
      if (gx % 8 === 4) px(ctx, x, y, gx, 12, s, C.ink); // arrow slits
    }
  }
}

// Gate, 16 cells wide, rises above the wall; material follows wall level.
function drawTor(ctx, x, y, level, s) {
  const stone = level >= 2;
  const tower = stone ? C.stone : C.wood;
  const towerD = stone ? C.stoneD : C.woodD;
  // flanking towers
  rect(ctx, x, y, 2, 7, 2, 9, s, tower);
  rect(ctx, x, y, 12, 7, 2, 9, s, tower);
  px(ctx, x, y, 3, 9, s, towerD);
  px(ctx, x, y, 12, 11, s, towerD);
  rect(ctx, x, y, 2, 7, 2, 1, s, stone ? C.stoneL : C.wood);
  rect(ctx, x, y, 12, 7, 2, 1, s, stone ? C.stoneL : C.wood);
  if (level >= 4) {
    px(ctx, x, y, 2, 6, s, C.stoneL);                // tower merlons
    px(ctx, x, y, 13, 6, s, C.stoneL);
    propBanner(ctx, x, y, 2, 9, s, 3);               // gate banners
    propBanner(ctx, x, y, 13, 9, s, 3);
  } else if (!stone) {
    px(ctx, x, y, 2, 6, s, C.woodD);                 // stake points
    px(ctx, x, y, 13, 6, s, C.woodD);
  }
  // lintel / arch
  rect(ctx, x, y, 4, 8, 8, 2, s, stone ? C.stone : C.woodD);
  rect(ctx, x, y, 4, 8, 8, 1, s, stone ? C.stoneL : C.wood);
  // heavy double doors
  rect(ctx, x, y, 4, 10, 8, 6, s, C.wood);
  rect(ctx, x, y, 8, 10, 1, 6, s, C.woodD);          // split
  rect(ctx, x, y, 4, 10, 8, 1, s, C.woodD);
  px(ctx, x, y, 5, 11, s, C.steel);                  // iron studs
  px(ctx, x, y, 10, 11, s, C.steel);
  px(ctx, x, y, 5, 14, s, C.steel);
  px(ctx, x, y, 10, 14, s, C.steel);
  if (level >= 6) {
    px(ctx, x, y, 8, 8, s, C.gold);                  // gilded keystone
    px(ctx, x, y, 2, 6, s, C.gold);
    px(ctx, x, y, 13, 6, s, C.gold);
  }
}

// ------------------------------------------------------------------ public

// Draw building `id` at growth `level` in the 16s box at (x, y).
// `t` (ms, optional) animates flags/candles cheaply.
export function drawBuilding(ctx, id, level, x, y, s, t = 0) {
  if (id === 'mauer') return drawMauer(ctx, x, y, level, s);
  if (id === 'tor') return drawTor(ctx, x, y, level, s);
  if (level <= 0) return drawPlot(ctx, x, y, s);
  if (level <= 2) return drawHut(ctx, x, y, s, id, level);
  if (id === 'gildenhalle') return drawGildenhalle(ctx, x, y, s, level, t);
  return drawStone(ctx, x, y, s, id, level, t);
}

// Fill (0,0)-(w,h) with grass plus deterministic tufts and dirt patches.
export function drawGround(ctx, w, h, s = 2) {
  ctx.fillStyle = C.grass;
  ctx.fillRect(0, 0, w, h);
  const cols = Math.ceil(w / s);
  const rows = Math.ceil(h / s);
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const r = hash2(ix, iy);
      if (r < 0.05) { ctx.fillStyle = C.grassD; ctx.fillRect(ix * s, iy * s, s, s); }
      else if (r < 0.08) { ctx.fillStyle = C.grassL; ctx.fillRect(ix * s, iy * s, s, s); }
      else if (r > 0.992) { ctx.fillStyle = C.dirt; ctx.fillRect(ix * s, iy * s, s * 2, s); }
      else if (r > 0.988) { ctx.fillStyle = C.dirtD; ctx.fillRect(ix * s, iy * s, s, s); }
    }
  }
}

function drawBaum(ctx, x, y, s) {
  rect(ctx, x, y, 5, 15, 7, 1, s, C.grassD);         // shadow
  rect(ctx, x, y, 7, 11, 2, 5, s, C.woodD);          // trunk
  px(ctx, x, y, 7, 11, s, C.wood);
  rect(ctx, x, y, 6, 3, 4, 1, s, C.moss);            // canopy
  rect(ctx, x, y, 5, 4, 6, 1, s, C.moss);
  rect(ctx, x, y, 4, 5, 8, 3, s, C.moss);
  rect(ctx, x, y, 5, 8, 7, 2, s, C.moss);
  rect(ctx, x, y, 6, 10, 5, 1, s, C.mossD);          // underside
  rect(ctx, x, y, 10, 5, 2, 3, s, C.mossD);          // shaded right
  px(ctx, x, y, 9, 8, s, C.mossD);
  px(ctx, x, y, 5, 4, s, C.grassL);                  // sunlit left
  px(ctx, x, y, 6, 5, s, C.grassL);
  px(ctx, x, y, 5, 6, s, C.grassL);
}

function drawFackel(ctx, x, y, s, t) {
  rect(ctx, x, y, 7, 9, 1, 7, s, C.woodD);           // pole
  px(ctx, x, y, 7, 9, s, C.wood);
  px(ctx, x, y, 7, 8, s, C.steel);                   // iron sconce
  ctx.fillStyle = 'rgba(232,144,44,0.14)';           // soft glow
  ctx.fillRect(x + 5 * s, y + 4 * s, 5 * s, 5 * s);
  const ph = Math.floor((t || 0) / 130) % 3;         // flicker phase
  px(ctx, x, y, 7, 7, s, C.flame);
  px(ctx, x, y, 7, 6, s, C.flameY);
  if (ph === 0) {
    px(ctx, x, y, 7, 5, s, C.flameY);
    px(ctx, x, y, 7, 4, s, C.flame);
  } else if (ph === 1) {
    px(ctx, x, y, 6, 5, s, C.flame);
  } else {
    px(ctx, x, y, 8, 5, s, C.flame);
    px(ctx, x, y, 7, 5, s, C.flameY);
  }
}

function drawBrunnen(ctx, x, y, s) {
  rect(ctx, x, y, 3, 15, 10, 1, s, C.grassD);        // shadow
  rect(ctx, x, y, 6, 6, 4, 1, s, C.roofD);           // little roof
  rect(ctx, x, y, 5, 7, 6, 1, s, C.roof);
  rect(ctx, x, y, 4, 8, 8, 1, s, C.roofD);
  rect(ctx, x, y, 4, 9, 1, 4, s, C.woodD);           // posts
  rect(ctx, x, y, 11, 9, 1, 4, s, C.woodD);
  px(ctx, x, y, 8, 9, s, C.ink);                     // rope
  px(ctx, x, y, 8, 10, s, C.ink);
  rect(ctx, x, y, 7, 11, 2, 1, s, C.wood);           // bucket
  rect(ctx, x, y, 4, 12, 8, 1, s, C.stoneL);         // rim
  rect(ctx, x, y, 4, 13, 8, 3, s, C.stone);          // ring
  px(ctx, x, y, 4, 14, s, C.stoneD);
  px(ctx, x, y, 11, 13, s, C.stoneD);
  rect(ctx, x, y, 6, 13, 4, 1, s, C.water);          // dark water
  px(ctx, x, y, 7, 13, s, C.steelL);                 // glimmer
}

// Small ambient props; `t` (ms, optional) makes the torch flicker.
export function drawProp(ctx, kind, x, y, s, t = 0) {
  if (kind === 'baum') return drawBaum(ctx, x, y, s);
  if (kind === 'fackel') return drawFackel(ctx, x, y, s, t);
  if (kind === 'brunnen') return drawBrunnen(ctx, x, y, s);
}
