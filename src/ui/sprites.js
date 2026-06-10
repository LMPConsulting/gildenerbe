// Functional pixel sprites drawn programmatically (polished in Plan 6).
// One grid cell = `s` device px. Sprites occupy a ~16-cell virtual grid.

const C = {
  dark: '#1c1a17', steel: '#9aa0a6', steelL: '#cfd4d9', gold: '#c8a04a',
  brown: '#6b4a2b', brownD: '#3e2c1a', skin: '#e0b88a', red: '#b03636',
  wolf: '#9d9d9d', wolfL: '#c7c7c7', furK: '#2f2c29', bone: '#e8e2cc', green: '#3a7d44',
};

function rect(ctx, x, y, gx, gy, w, h, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + gx * s, y + gy * s, w * s, h * s);
}
const px = (ctx, x, y, gx, gy, s, color) => rect(ctx, x, y, gx, gy, 1, 1, s, color);

function drawHero(ctx, x, y, s) {
  rect(ctx, x, y, 4, 1, 4, 3, s, C.steelL);   // helmet
  px(ctx, x, y, 4, 2, s, C.dark); px(ctx, x, y, 7, 2, s, C.dark);
  rect(ctx, x, y, 5, 2, 2, 1, s, C.skin);     // visor slit
  rect(ctx, x, y, 3, 4, 6, 5, s, C.steel);    // torso
  rect(ctx, x, y, 3, 4, 6, 1, s, C.steelL);   // shoulder highlight
  rect(ctx, x, y, 4, 9, 2, 5, s, C.brownD);   // legs
  rect(ctx, x, y, 6, 9, 2, 5, s, C.brownD);
  rect(ctx, x, y, 9, 0, 1, 9, s, C.gold);     // sword blade (raised right)
  rect(ctx, x, y, 8, 8, 3, 1, s, C.brown);    // hilt
}

function drawWolf(ctx, x, y, s, dark) {
  const body = dark ? C.furK : C.wolf;
  const light = dark ? C.wolf : C.wolfL;
  rect(ctx, x, y, 2, 4, 8, 4, s, body);       // body (facing left)
  rect(ctx, x, y, 2, 4, 8, 1, s, light);      // back highlight
  rect(ctx, x, y, 0, 3, 3, 3, s, body);       // head
  px(ctx, x, y, 0, 2, s, body); px(ctx, x, y, 2, 2, s, body); // ears
  px(ctx, x, y, 1, 4, s, C.red);              // eye
  rect(ctx, x, y, 2, 8, 1, 3, s, body);       // legs
  rect(ctx, x, y, 5, 8, 1, 3, s, body);
  rect(ctx, x, y, 8, 8, 1, 3, s, body);
  rect(ctx, x, y, 9, 3, 2, 1, s, body);       // tail
}

function drawBandit(ctx, x, y, s) {
  rect(ctx, x, y, 4, 0, 5, 4, s, C.brownD);   // hood
  rect(ctx, x, y, 4, 2, 3, 2, s, C.skin);     // face
  px(ctx, x, y, 4, 2, s, C.red);              // eye
  rect(ctx, x, y, 3, 4, 6, 5, s, C.green);    // tunic
  rect(ctx, x, y, 3, 4, 6, 1, s, C.brown);    // collar
  rect(ctx, x, y, 4, 9, 2, 5, s, C.brownD);   // legs
  rect(ctx, x, y, 6, 9, 2, 5, s, C.brownD);
  rect(ctx, x, y, 1, 5, 2, 1, s, C.steelL);   // dagger
}

function drawBoar(ctx, x, y, s) {
  rect(ctx, x, y, 2, 4, 9, 5, s, C.brown);    // body
  rect(ctx, x, y, 2, 4, 9, 1, s, C.brownD);   // bristles
  rect(ctx, x, y, 0, 5, 3, 4, s, C.brownD);   // head
  px(ctx, x, y, 1, 6, s, C.red);              // eye
  px(ctx, x, y, 0, 8, s, C.bone);             // tusk
  rect(ctx, x, y, 3, 9, 1, 2, s, C.brownD);   // legs
  rect(ctx, x, y, 6, 9, 1, 2, s, C.brownD);
  rect(ctx, x, y, 9, 9, 1, 2, s, C.brownD);
}

function drawKrell(ctx, x, y, s) {
  rect(ctx, x, y, 4, 0, 6, 4, s, C.brownD);   // helm/hair
  rect(ctx, x, y, 5, 2, 4, 3, s, C.skin);     // face
  px(ctx, x, y, 5, 3, s, C.red); px(ctx, x, y, 8, 3, s, C.red); // eyes
  rect(ctx, x, y, 3, 5, 8, 7, s, C.steel);    // big torso
  rect(ctx, x, y, 3, 5, 8, 1, s, C.red);      // sash
  rect(ctx, x, y, 4, 12, 3, 4, s, C.brownD);  // legs
  rect(ctx, x, y, 7, 12, 3, 4, s, C.brownD);
  rect(ctx, x, y, 0, 4, 2, 2, s, C.steelL);   // mace head
  rect(ctx, x, y, 2, 5, 3, 1, s, C.brown);    // handle
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
