// Functional pixel sprites drawn programmatically (polished in Plan 6, juiced in the
// pixel-art pass). One grid cell = `s` device px. Sprites occupy a ~16-cell virtual
// grid; feet sit on row 15 so the bottom edge of the grid is the ground line.

// Cohesive ~16-colour fantasy palette shared by every sprite.
const C = {
  ink:     '#1a140f', // outlines, soles, eye slits
  shadow:  '#43301d', // deep warm shadow / dark leather
  slate:   '#4f5160', // armour shade / dark fur
  steel:   '#8a93a0', // armour mid
  steelL:  '#c6cfd8', // armour light / light fur
  white:   '#f2f4ef', // glints
  gold:    '#d9a441',
  goldD:   '#8a6120',
  leather: '#7a5230',
  skin:    '#e7b482',
  skinD:   '#b07a4e', // skin shade / sunlit hide
  blood:   '#c23a2c',
  bloodD:  '#6e1d16',
  fur:     '#8e8d95',
  bone:    '#ece3c4',
  moss:    '#4e7a38',
  mossD:   '#2f4c20',
};

function rect(ctx, x, y, gx, gy, w, h, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + gx * s, y + gy * s, w * s, h * s);
}
const px = (ctx, x, y, gx, gy, s, color) => rect(ctx, x, y, gx, gy, 1, 1, s, color);

// Knight facing right: raised sword, kite shield, crested helm. Lit from upper-left.
function drawHero(ctx, x, y, s) {
  // sword (right hand, blade up)
  rect(ctx, x, y, 11, 1, 1, 7, s, C.steelL);  // blade
  px(ctx, x, y, 11, 0, s, C.white);           // tip glint
  px(ctx, x, y, 11, 3, s, C.white);           // edge shine
  rect(ctx, x, y, 10, 8, 3, 1, s, C.gold);    // crossguard
  px(ctx, x, y, 11, 9, s, C.skin);            // hand
  px(ctx, x, y, 11, 10, s, C.leather);        // grip
  px(ctx, x, y, 11, 11, s, C.gold);           // pommel
  // shield (left arm)
  rect(ctx, x, y, 0, 5, 3, 1, s, C.steelL);   // top rim
  rect(ctx, x, y, 0, 6, 3, 4, s, C.leather);  // face
  rect(ctx, x, y, 0, 10, 3, 1, s, C.shadow);  // bottom rim
  px(ctx, x, y, 0, 6, s, C.steelL);           // edge light
  px(ctx, x, y, 1, 7, s, C.gold);             // boss
  px(ctx, x, y, 1, 8, s, C.goldD);            // boss shade
  // helmet
  rect(ctx, x, y, 6, 0, 2, 1, s, C.blood);    // crest
  rect(ctx, x, y, 4, 1, 5, 2, s, C.steelL);   // crown
  px(ctx, x, y, 7, 1, s, C.white);            // crown glint
  px(ctx, x, y, 4, 2, s, C.steel);            // rear shade
  rect(ctx, x, y, 4, 3, 2, 1, s, C.steel);    // rear of helm
  rect(ctx, x, y, 6, 3, 3, 1, s, C.ink);      // visor slit (front)
  px(ctx, x, y, 7, 3, s, C.skin);             // eye in the slit
  rect(ctx, x, y, 4, 4, 5, 1, s, C.steel);    // jaw guard
  px(ctx, x, y, 4, 4, s, C.slate);
  // torso + pauldrons
  rect(ctx, x, y, 2, 5, 2, 1, s, C.steelL);   // left pauldron
  rect(ctx, x, y, 9, 5, 2, 1, s, C.steelL);   // right pauldron
  px(ctx, x, y, 2, 6, s, C.slate);            // pauldron under-shade
  px(ctx, x, y, 10, 6, s, C.slate);
  rect(ctx, x, y, 4, 5, 5, 1, s, C.steel);    // upper chest
  rect(ctx, x, y, 3, 6, 7, 3, s, C.steel);    // breastplate
  rect(ctx, x, y, 3, 6, 1, 3, s, C.steelL);   // lit edge
  rect(ctx, x, y, 9, 6, 1, 3, s, C.slate);    // shaded edge
  px(ctx, x, y, 6, 7, s, C.gold);             // chest emblem
  rect(ctx, x, y, 3, 9, 7, 1, s, C.shadow);   // belt
  px(ctx, x, y, 6, 9, s, C.gold);             // buckle
  // legs + boots (grounded on row 15)
  rect(ctx, x, y, 3, 10, 7, 1, s, C.slate);   // tasset
  px(ctx, x, y, 3, 10, s, C.steel);
  rect(ctx, x, y, 4, 11, 2, 3, s, C.leather); // left leg
  rect(ctx, x, y, 5, 11, 1, 3, s, C.shadow);
  rect(ctx, x, y, 7, 11, 2, 3, s, C.leather); // right leg
  rect(ctx, x, y, 8, 11, 1, 3, s, C.shadow);
  rect(ctx, x, y, 4, 14, 3, 1, s, C.shadow);  // boots, toes forward
  rect(ctx, x, y, 4, 15, 3, 1, s, C.ink);
  rect(ctx, x, y, 7, 14, 3, 1, s, C.shadow);
  rect(ctx, x, y, 7, 15, 3, 1, s, C.ink);
}

// Dire wolf facing left. `elite` swaps to a darker coat, glowing eyes, mane spikes.
function drawWolf(ctx, x, y, s, elite) {
  const body = elite ? C.slate : C.fur;
  const lite = elite ? C.fur : C.steelL;
  const dark = elite ? C.ink : C.slate;
  // tail (swept up behind)
  rect(ctx, x, y, 14, 3, 1, 2, s, body);
  px(ctx, x, y, 15, 2, s, body);
  px(ctx, x, y, 15, 1, s, lite);              // tail tip
  // body
  rect(ctx, x, y, 3, 4, 11, 6, s, body);      // barrel
  rect(ctx, x, y, 4, 4, 3, 1, s, lite);       // shoulder highlight
  rect(ctx, x, y, 10, 4, 3, 1, s, lite);      // hip highlight
  rect(ctx, x, y, 3, 10, 11, 1, s, dark);     // belly shade
  if (elite) {                                // bristling mane spikes
    px(ctx, x, y, 4, 3, s, body); px(ctx, x, y, 6, 3, s, body);
    px(ctx, x, y, 8, 3, s, body); px(ctx, x, y, 10, 3, s, body);
    px(ctx, x, y, 8, 6, s, C.ink); px(ctx, x, y, 9, 7, s, C.ink); // old scar
  }
  // head (left)
  px(ctx, x, y, 1, 2, s, body);               // ears
  px(ctx, x, y, 3, 2, s, body);
  rect(ctx, x, y, 0, 3, 4, 3, s, body);       // skull + muzzle
  rect(ctx, x, y, 1, 3, 2, 1, s, lite);       // brow highlight
  px(ctx, x, y, 1, 4, s, C.blood);            // eye
  if (elite) px(ctx, x, y, 2, 4, s, C.blood); // wider burning eye
  px(ctx, x, y, 0, 5, s, C.ink);              // nose
  rect(ctx, x, y, 1, 6, 3, 1, s, dark);       // jaw
  px(ctx, x, y, 1, 6, s, C.bone);             // bared fang
  // legs (near pair in coat colour, far pair in shadow), paws on row 15
  rect(ctx, x, y, 6, 11, 1, 5, s, dark);      // far front
  rect(ctx, x, y, 13, 11, 1, 5, s, dark);     // far rear
  rect(ctx, x, y, 3, 11, 2, 4, s, body);      // near front
  rect(ctx, x, y, 2, 15, 3, 1, s, dark);      // front paw, toes left
  rect(ctx, x, y, 10, 11, 2, 4, s, body);     // near rear
  rect(ctx, x, y, 9, 15, 3, 1, s, dark);      // rear paw
}

// Hooded cutthroat facing left: green hood, red scarf, raised dagger, bandolier.
function drawBandit(ctx, x, y, s) {
  // hood
  rect(ctx, x, y, 3, 0, 6, 3, s, C.mossD);    // hood base
  rect(ctx, x, y, 4, 0, 4, 1, s, C.moss);     // lit crown
  px(ctx, x, y, 9, 1, s, C.mossD);            // trailing point
  px(ctx, x, y, 10, 2, s, C.mossD);
  // face under the hood
  rect(ctx, x, y, 4, 2, 3, 1, s, C.skin);
  px(ctx, x, y, 6, 2, s, C.skinD);            // cheek shade
  px(ctx, x, y, 4, 2, s, C.ink);              // glaring eye
  rect(ctx, x, y, 4, 3, 3, 1, s, C.blood);    // scarf over the mouth
  px(ctx, x, y, 6, 3, s, C.bloodD);
  // tunic
  rect(ctx, x, y, 3, 4, 6, 5, s, C.moss);
  rect(ctx, x, y, 3, 4, 6, 1, s, C.leather);  // mantle collar
  rect(ctx, x, y, 8, 5, 1, 4, s, C.mossD);    // shaded back
  px(ctx, x, y, 4, 5, s, C.leather);          // bandolier strap
  px(ctx, x, y, 5, 6, s, C.leather);
  px(ctx, x, y, 6, 7, s, C.leather);
  px(ctx, x, y, 7, 8, s, C.leather);
  rect(ctx, x, y, 3, 9, 6, 1, s, C.shadow);   // belt
  px(ctx, x, y, 5, 9, s, C.gold);             // buckle
  // dagger arm (thrust toward the hero)
  rect(ctx, x, y, 2, 5, 1, 2, s, C.mossD);    // sleeve
  px(ctx, x, y, 1, 6, s, C.skin);             // hand
  px(ctx, x, y, 1, 5, s, C.steelL);           // blade
  px(ctx, x, y, 0, 4, s, C.steelL);
  px(ctx, x, y, 0, 3, s, C.white);            // point glint
  // legs + boots
  rect(ctx, x, y, 4, 10, 2, 4, s, C.leather);
  rect(ctx, x, y, 5, 10, 1, 4, s, C.shadow);
  rect(ctx, x, y, 7, 10, 2, 4, s, C.leather);
  rect(ctx, x, y, 8, 10, 1, 4, s, C.shadow);
  rect(ctx, x, y, 3, 14, 3, 1, s, C.shadow);  // boots, toes left
  rect(ctx, x, y, 3, 15, 3, 1, s, C.ink);
  rect(ctx, x, y, 6, 14, 3, 1, s, C.shadow);
  rect(ctx, x, y, 6, 15, 3, 1, s, C.ink);
}

// Bristleback boar facing left: low heavy body, pale tusks, stubby legs.
function drawBoar(ctx, x, y, s) {
  // bristle ridge
  px(ctx, x, y, 3, 5, s, C.shadow); px(ctx, x, y, 5, 5, s, C.shadow);
  px(ctx, x, y, 7, 5, s, C.shadow); px(ctx, x, y, 9, 5, s, C.shadow);
  px(ctx, x, y, 11, 5, s, C.shadow);
  rect(ctx, x, y, 2, 6, 12, 1, s, C.shadow);  // bristle band
  px(ctx, x, y, 1, 6, s, C.shadow);           // forehead bristles
  // body
  rect(ctx, x, y, 2, 7, 12, 6, s, C.leather);
  rect(ctx, x, y, 3, 7, 8, 1, s, C.skinD);    // sunlit back
  px(ctx, x, y, 3, 7, s, C.shadow);           // ear
  rect(ctx, x, y, 12, 8, 2, 5, s, C.shadow);  // shaded rump
  rect(ctx, x, y, 3, 12, 9, 1, s, C.shadow);  // belly shade
  // head + snout
  rect(ctx, x, y, 1, 7, 3, 5, s, C.leather);
  px(ctx, x, y, 2, 8, s, C.blood);            // mean little eye
  rect(ctx, x, y, 0, 9, 1, 3, s, C.skinD);    // snout
  px(ctx, x, y, 0, 10, s, C.ink);             // nostril
  rect(ctx, x, y, 1, 12, 2, 1, s, C.shadow);  // chin
  px(ctx, x, y, 0, 11, s, C.bone);            // big tusk
  px(ctx, x, y, 2, 12, s, C.bone);            // second tusk
  // curly tail
  px(ctx, x, y, 14, 6, s, C.leather);
  px(ctx, x, y, 15, 5, s, C.leather);
  px(ctx, x, y, 15, 4, s, C.shadow);
  // legs (near pair lit, far pair shadowed), hooves on row 15
  rect(ctx, x, y, 5, 13, 1, 3, s, C.shadow);  // far front
  rect(ctx, x, y, 12, 13, 1, 3, s, C.shadow); // far rear
  rect(ctx, x, y, 2, 13, 2, 2, s, C.leather); // near front
  rect(ctx, x, y, 2, 15, 2, 1, s, C.ink);     // hoof
  rect(ctx, x, y, 9, 13, 2, 2, s, C.leather); // near rear
  rect(ctx, x, y, 9, 15, 2, 1, s, C.ink);
}

// Warboss Krell: horned helm, spiked pauldrons, war-paint sash, spiked maul.
function drawKrell(ctx, x, y, s) {
  // maul (his right, toward the hero)
  rect(ctx, x, y, 0, 2, 3, 3, s, C.slate);    // head
  px(ctx, x, y, 1, 3, s, C.steel);            // band
  px(ctx, x, y, 1, 1, s, C.steelL);           // top spike
  px(ctx, x, y, 0, 2, s, C.steelL);           // corner glint
  rect(ctx, x, y, 1, 5, 1, 5, s, C.leather);  // shaft
  // horned helm
  px(ctx, x, y, 3, 0, s, C.bone);  px(ctx, x, y, 3, 1, s, C.bone);   // left horn
  px(ctx, x, y, 11, 0, s, C.bone); px(ctx, x, y, 11, 1, s, C.bone);  // right horn
  rect(ctx, x, y, 4, 1, 7, 1, s, C.steel);
  rect(ctx, x, y, 4, 2, 7, 1, s, C.slate);
  // face
  rect(ctx, x, y, 5, 3, 5, 1, s, C.skin);
  px(ctx, x, y, 6, 3, s, C.blood);            // burning eyes
  px(ctx, x, y, 8, 3, s, C.blood);
  // pauldrons + chest
  rect(ctx, x, y, 2, 5, 3, 2, s, C.steel);    // left pauldron
  rect(ctx, x, y, 10, 5, 3, 2, s, C.steel);   // right pauldron
  px(ctx, x, y, 2, 4, s, C.steelL);           // shoulder spikes
  px(ctx, x, y, 12, 4, s, C.steelL);
  px(ctx, x, y, 3, 5, s, C.steelL);           // pauldron highlights
  px(ctx, x, y, 11, 5, s, C.steelL);
  rect(ctx, x, y, 5, 5, 5, 6, s, C.steel);    // breastplate
  rect(ctx, x, y, 5, 6, 1, 4, s, C.steelL);   // lit edge
  rect(ctx, x, y, 9, 6, 1, 4, s, C.slate);    // shaded edge
  // beard over the chest
  rect(ctx, x, y, 5, 4, 5, 1, s, C.shadow);
  px(ctx, x, y, 6, 5, s, C.shadow);           // braids
  px(ctx, x, y, 8, 5, s, C.shadow);
  // war-paint sash
  px(ctx, x, y, 8, 6, s, C.blood); px(ctx, x, y, 7, 7, s, C.blood);
  px(ctx, x, y, 6, 8, s, C.blood); px(ctx, x, y, 5, 9, s, C.blood);
  rect(ctx, x, y, 5, 10, 5, 1, s, C.slate);   // gut plate
  // arms
  rect(ctx, x, y, 2, 7, 2, 2, s, C.skin);     // maul arm
  px(ctx, x, y, 3, 8, s, C.skinD);
  px(ctx, x, y, 1, 8, s, C.skin);             // fist on the shaft
  rect(ctx, x, y, 11, 7, 2, 2, s, C.skin);    // off arm
  px(ctx, x, y, 12, 8, s, C.skinD);
  px(ctx, x, y, 12, 9, s, C.skinD);           // clenched fist
  // belt + legs
  rect(ctx, x, y, 4, 11, 7, 1, s, C.shadow);
  px(ctx, x, y, 7, 11, s, C.bone);            // skull buckle
  rect(ctx, x, y, 4, 12, 3, 3, s, C.shadow);
  rect(ctx, x, y, 8, 12, 3, 3, s, C.shadow);
  px(ctx, x, y, 5, 12, s, C.steel);           // knee studs
  px(ctx, x, y, 9, 12, s, C.steel);
  rect(ctx, x, y, 3, 15, 4, 1, s, C.ink);     // boots, toes forward
  rect(ctx, x, y, 8, 15, 3, 1, s, C.ink);
}

export function drawSprite(ctx, key, x, y, s = 5) {
  switch (key) {
    case 'hero': return drawHero(ctx, x, y, s);
    case 'wolf': return drawWolf(ctx, x, y, s, false);
    case 'wolf_elite': return drawWolf(ctx, x, y, s, true);
    case 'bandit': return drawBandit(ctx, x, y, s);
    case 'boar': return drawBoar(ctx, x, y, s);
    case 'krell': return drawKrell(ctx, x, y, s);
    default: return drawWolf(ctx, x, y, s, false);
  }
}

export const SPRITE_GRID = 16;
