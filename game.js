"use strict";
// vim: sw=2 ts=2 expandtab smartindent ft=javascript

/* ENGINE
 *  [x] Camera
 *  [ ] Skybox
 *  [ ] Ambient Occlusion
 *
 *  [ ] 2D Physics
 *  [ ] Jump
 *
 *  [ ] Splitscreen
 *  [ ] State Cache
 * 
 *  [ ] Networking
 *  [ ] Chat
 *
 * SANDBOX
 *  [x] Break
 *  [x] Place
 *  [ ] Pick Up
 *
 *  [ ] Hotbar
 *  [ ] Numerals
 *
 *  [ ] Tree
 *  [ ] Sapling
 *
 *  [ ] Inventory
 *  [ ] Crafting Table
 *  [ ] Furnace
 *
 *  [ ] Item break speeds
 *  [ ] Chest
 *
 * DAY DREAM
 *  [ ] Grappling Hook
 *  [ ] World-in-a-Pot
 *  [ ] Pulleys
 */

const log = x => (console.log(x), x);
const VEC3_UP = [0, 1, 0];
const VERT_FLOATS = 7;
const SS_COLUMNS = 2048/16;

function lerp(v0, v1, t) { return (1 - t) * v0 + t * v1; }
function inv_lerp(min, max, p) { return (((p) - (min)) / ((max) - (min))); }
function ease_out_sine(x) {
  return Math.sin((x * Math.PI) / 2);
}
function ease_out_circ(x) {
  return Math.sqrt(1 - Math.pow(x - 1, 2));
}

function mat4_create() {
  let out = new Float32Array(16);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}
function mat4_transpose(out, a) {
  // If we are transposing ourselves we can skip a few steps but have to cache some values
  if (out === a) {
    let a01 = a[1],
      a02 = a[2],
      a03 = a[3];
    let a12 = a[6],
      a13 = a[7];
    let a23 = a[11];
    out[1] = a[4];
    out[2] = a[8];
    out[3] = a[12];
    out[4] = a01;
    out[6] = a[9];
    out[7] = a[13];
    out[8] = a02;
    out[9] = a12;
    out[11] = a[14];
    out[12] = a03;
    out[13] = a13;
    out[14] = a23;
  } else {
    out[0] = a[0];
    out[1] = a[4];
    out[2] = a[8];
    out[3] = a[12];
    out[4] = a[1];
    out[5] = a[5];
    out[6] = a[9];
    out[7] = a[13];
    out[8] = a[2];
    out[9] = a[6];
    out[10] = a[10];
    out[11] = a[14];
    out[12] = a[3];
    out[13] = a[7];
    out[14] = a[11];
    out[15] = a[15];
  }
  return out;
}
function mat4_invert(out, a) {
  let a00 = a[0],
    a01 = a[1],
    a02 = a[2],
    a03 = a[3];
  let a10 = a[4],
    a11 = a[5],
    a12 = a[6],
    a13 = a[7];
  let a20 = a[8],
    a21 = a[9],
    a22 = a[10],
    a23 = a[11];
  let a30 = a[12],
    a31 = a[13],
    a32 = a[14],
    a33 = a[15];
  let b00 = a00 * a11 - a01 * a10;
  let b01 = a00 * a12 - a02 * a10;
  let b02 = a00 * a13 - a03 * a10;
  let b03 = a01 * a12 - a02 * a11;
  let b04 = a01 * a13 - a03 * a11;
  let b05 = a02 * a13 - a03 * a12;
  let b06 = a20 * a31 - a21 * a30;
  let b07 = a20 * a32 - a22 * a30;
  let b08 = a20 * a33 - a23 * a30;
  let b09 = a21 * a32 - a22 * a31;
  let b10 = a21 * a33 - a23 * a31;
  let b11 = a22 * a33 - a23 * a32;
  // Calculate the determinant
  let det =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) {
    return null;
  }
  det = 1.0 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
const _scratch = mat4_create();
function mat4_from_zyx_rotation(out, x, y, z) {
  mat4_from_z_rotation(out, z);

  mat4_from_y_rotation(scratch, y);
  mat4_mul(out, out, scratch);

  mat4_from_x_rotation(scratch, x);
  mat4_mul(out, out, scratch);

  return out;
}
function mat4_from_x_rotation(out, rad) {
  let s = Math.sin(rad);
  let c = Math.cos(rad);
  // Perform axis-specific matrix multiplication
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = c;
  out[6] = s;
  out[7] = 0;
  out[8] = 0;
  out[9] = -s;
  out[10] = c;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function mat4_from_y_rotation(out, rad) {
  let s = Math.sin(rad);
  let c = Math.cos(rad);
  // Perform axis-specific matrix multiplication
  out[0] = c;
  out[1] = 0;
  out[2] = -s;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = s;
  out[9] = 0;
  out[10] = c;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function mat4_from_z_rotation(out, rad) {
  let s = Math.sin(rad);
  let c = Math.cos(rad);
  // Perform axis-specific matrix multiplication
  out[0] = c;
  out[1] = s;
  out[2] = 0;
  out[3] = 0;
  out[4] = -s;
  out[5] = c;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function mat4_from_translation(out, v) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = v[0];
  out[13] = v[1];
  out[14] = v[2];
  out[15] = 1;
  return out;
}
function mat4_from_scaling(out, v) {
  out[0] = v[0];
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = v[1];
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = v[2];
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function mat4_mul(out, a, b) {
  let a00 = a[0],
    a01 = a[1],
    a02 = a[2],
    a03 = a[3];
  let a10 = a[4],
    a11 = a[5],
    a12 = a[6],
    a13 = a[7];
  let a20 = a[8],
    a21 = a[9],
    a22 = a[10],
    a23 = a[11];
  let a30 = a[12],
    a31 = a[13],
    a32 = a[14],
    a33 = a[15];
  // Cache only the current line of the second matrix
  let b0 = b[0],
    b1 = b[1],
    b2 = b[2],
    b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
function mat4_target_to(out, eye, target, up=VEC3_UP) {
  let eyex = eye[0],
    eyey = eye[1],
    eyez = eye[2],
    upx = up[0],
    upy = up[1],
    upz = up[2];
  let z0 = eyex - target[0],
    z1 = eyey - target[1],
    z2 = eyez - target[2];
  let len = z0 * z0 + z1 * z1 + z2 * z2;
  if (len > 0) {
    len = 1 / Math.sqrt(len);
    z0 *= len;
    z1 *= len;
    z2 *= len;
  }
  let x0 = upy * z2 - upz * z1,
    x1 = upz * z0 - upx * z2,
    x2 = upx * z1 - upy * z0;
  len = x0 * x0 + x1 * x1 + x2 * x2;
  if (len > 0) {
    len = 1 / Math.sqrt(len);
    x0 *= len;
    x1 *= len;
    x2 *= len;
  }
  out[0] = x0;
  out[1] = x1;
  out[2] = x2;
  out[3] = 0;
  out[4] = z1 * x2 - z2 * x1;
  out[5] = z2 * x0 - z0 * x2;
  out[6] = z0 * x1 - z1 * x0;
  out[7] = 0;
  out[8] = z0;
  out[9] = z1;
  out[10] = z2;
  out[11] = 0;
  out[12] = eyex;
  out[13] = eyey;
  out[14] = eyez;
  out[15] = 1;
  return out;
}
function mat4_transform_vec4(out, a, m) {
  let x = a[0],
    y = a[1],
    z = a[2],
    w = a[3];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
  return out;
}
function mat4_perspective(out, fovy, aspect, near, far) {
  let f = 1.0 / Math.tan(fovy / 2),
    nf;
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[15] = 0;
  if (far != null && far !== Infinity) {
    nf = 1 / (near - far);
    out[10] = (far + near) * nf;
    out[14] = 2 * far * near * nf;
  } else {
    out[10] = -1;
    out[14] = -2 * near;
  }
  return out;
}
function mat4_ortho(out, left, right, bottom, top, near, far) {
  let lr = 1 / (left - right);
  let bt = 1 / (bottom - top);
  let nf = 1 / (near - far);
  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 2 * nf;
  out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;
  return out;
}



function cross3(x, y) {
  return [
    x[1] * y[2] - y[1] * x[2],
    x[2] * y[0] - y[2] * x[0],
    x[0] * y[1] - y[0] * x[1]
  ];
}
function dot(x, y) {
  return (x[0]*y[0] + x[1]*y[1] + x[2]*y[2]);
}
function norm(vec) {
  const mag = Math.sqrt(dot(vec, vec));
  if (mag > 0) {
    vec[0] /= mag;
    vec[1] /= mag;
    vec[2] /= mag;
  }
  return vec;
}
function mag3(vec) { return Math.sqrt(dot(vec, vec)); }
function add3(l, r) {
  return [l[0] + r[0],
          l[1] + r[1],
          l[2] + r[2]];
}
function sub3(l, r) {
  return [l[0] - r[0],
          l[1] - r[1],
          l[2] - r[2]];
}
function mul3_f(v, f) {
  return [v[0] * f, v[1] * f, v[2] * f];
}
function ray_to_plane_t(p, v, n, d) {
  const denom = dot(n, v);
  if (Math.abs(denom) <= 0.0001) return;

  const t = -(dot(n, p) + d) / dot(n, v);
  if (t <= 0.0001) return;

  return t;// add3(p, mul3_f(v, t));
}

let _id = 0;
const ID_BLOCK_NONE     = _id++;
const ID_BLOCK_DIRT     = _id++;
const ID_BLOCK_STONE    = _id++;
const ID_BLOCK_WOOD     = _id++;
const ID_BLOCK_STAIRS   = _id++;
const ID_BLOCK_GRASS    = _id++;
const ID_BLOCK_GLASS    = _id++;
const ID_BLOCK_FLOWER0  = _id++;
const ID_BLOCK_FLOWER1  = _id++;
const ID_BLOCK_FLOWER2  = _id++;
const ID_BLOCK_SAPLING  = _id++;
const ID_BLOCK_LOG      = _id++;
const ID_BLOCK_LEAVES   = _id++;
const ID_BLOCK_BREAKING = _id; _id += 10;
const ID_BLOCK_LAST = _id-1;

const ID_ITEM_BONEMEAL  = _id++;
const ID_ITEM_T0_SPADE = _id++;
const ID_ITEM_T0_PICK   = _id++;
const ID_ITEM_T0_AXE    = _id++;

const FIELD_OF_VIEW = 75 / 180 * Math.PI;

const MAP_SIZE = 16;
const map_index = (x, y, z) => x*MAP_SIZE*MAP_SIZE + y*MAP_SIZE + z;

function id_to_tex_num(block_id) {
  const topped       = (_top, rest) => [rest, _top, rest, rest, rest, rest];
  const top_n_bottom = (_top, rest) => [rest, _top, rest, rest, _top, rest];

  let tex_offset = 0;
  if (block_id == ID_ITEM_BONEMEAL  ) tex_offset = SS_COLUMNS*11 + 31;
  if (block_id == ID_ITEM_T0_SPADE  ) tex_offset = SS_COLUMNS*5 + 16;
  if (block_id == ID_ITEM_T0_PICK   ) tex_offset = SS_COLUMNS*6 + 16;
  if (block_id == ID_ITEM_T0_AXE    ) tex_offset = SS_COLUMNS*7 + 16;
  if (block_id == ID_BLOCK_WOOD     ) tex_offset = 4;
  if (block_id == ID_BLOCK_STAIRS   ) tex_offset = 4;
  if (block_id == ID_BLOCK_GRASS    ) tex_offset = topped(0, 2);
  if (block_id == ID_BLOCK_DIRT     ) tex_offset = 2;
  if (block_id == ID_BLOCK_STONE    ) tex_offset = 1;
  if (block_id == ID_BLOCK_GLASS    ) tex_offset = 3*SS_COLUMNS + 1;
  if (block_id == ID_BLOCK_FLOWER0  ) tex_offset = 12;
  if (block_id == ID_BLOCK_FLOWER1  ) tex_offset = 13;
  if (block_id == ID_BLOCK_FLOWER2  ) tex_offset = 2*SS_COLUMNS + 7;
  if (block_id == ID_BLOCK_SAPLING  ) tex_offset = 15;
  if (block_id == ID_BLOCK_LOG      ) tex_offset = top_n_bottom(SS_COLUMNS*1 + 5, SS_COLUMNS*1 + 4);
  if (block_id == ID_BLOCK_LEAVES   ) tex_offset = 3*SS_COLUMNS + 4;
  const bdelta = block_id - ID_BLOCK_BREAKING;
  if (bdelta < 10 && bdelta >= 0) tex_offset = SS_COLUMNS*15 + bdelta;

  return tex_offset;
}

let state = {
  tick: 0,
  pos:      [0, 3.1, 6],
  last_pos: [0, 3.1, 6],
  inv: {
    items: [...Array(9)].fill(0),
    held_i: 0,
  },
  items: [
    { pos: [2.5, 1.2, 3.5], id: ID_BLOCK_WOOD , amount: 1 },
    { pos: [4.5, 1.2, 3.5], id: ID_BLOCK_GRASS, amount: 1 },
    { pos: [6.5, 1.2, 3.5], id: ID_BLOCK_DIRT , amount: 1 },
  ],
  map: new Uint8Array(MAP_SIZE * MAP_SIZE * MAP_SIZE),
  cam: { yaw_deg: 130, pitch_deg: -20 },
  keysdown: {},
  mousedown: 0,
  /* ticks for physics, timestamps for animations */
  mining:  { ts_start: Date.now(), ts_end: Date.now(), block_coord: undefined },
  using:   { ts_start: Date.now(), ts_end: Date.now() },
  jumping: { tick_start:        0, tick_end:        0, tick_grounded: 0 },
};
state.inv.items[0] = { id: ID_ITEM_T0_SPADE, amount: 1 };
state.inv.items[1] = { id: ID_ITEM_T0_PICK, amount: 1 };
state.inv.items[2] = { id: ID_ITEM_T0_AXE, amount: 1 };
state.inv.items[3] = { id: ID_ITEM_BONEMEAL, amount: 10 };
state.inv.items[4] = { id: ID_BLOCK_SAPLING, amount: 10 };
state.inv.items[5] = { id: ID_BLOCK_STAIRS, amount: 20 };

for (let t_x = 0; t_x < (MAP_SIZE-0); t_x++) 
  for (let t_z = 0; t_z < (MAP_SIZE-0); t_z++) {
    const t_y = 0;

    const top_i = map_index(t_x, t_y+1, t_z);
    if (Math.random() < ( 8/(MAP_SIZE*MAP_SIZE)))
      state.map[top_i] = (Math.random() < 0.5) ? ID_BLOCK_FLOWER0 : ID_BLOCK_FLOWER1;
    if (Math.random() < (16/(MAP_SIZE*MAP_SIZE)))
      state.map[top_i] = ID_BLOCK_FLOWER2;

    state.map[map_index(t_x, t_y, t_z)] = ID_BLOCK_GRASS;
  }
for (let t_x = 0; t_x < (MAP_SIZE-0); t_x++) 
  for (let t_y = 0; t_y < (MAP_SIZE-0); t_y++) {
    const t_z = 0;
    state.map[map_index(t_x, t_y, t_z)] = ID_BLOCK_STONE;
  }
{
  let t_x = 3;
  let t_y = 1;
  let t_z = 1;
  state.map[map_index(t_x, t_y, t_z)] = ID_BLOCK_STAIRS;
}
function place_tree(t_x, t_y, t_z) {
  const height = 4 + (Math.random() < 0.4) +
                     (Math.random() < 0.3);

  for (let i = 0; i < height; i++)
    state.map[map_index(t_x, t_y++, t_z)] = ID_BLOCK_LOG;
  t_y -= 2;

  const heart = [t_x, t_y, t_z];
  const all = 0.3*Math.random();
  const rng = () => 0.1*Math.random() + all;

  for (let q_x = 0; q_x < 5; q_x++) 
    for (let q_y = 0; q_y < 5; q_y++)
      for (let q_z = 0; q_z < 5; q_z++) {
        const p = [
          2-q_x,
          2-q_y,
          2-q_z
        ];
        const scaled = [p[0], p[1]+2, p[2]];
        if (mag3(scaled) > 2.15 + rng()) continue;

        p[1] += 2;
        const index = map_index(...add3(p, heart));
        if (state.map[index] != ID_BLOCK_NONE) continue;
        state.map[index] = ID_BLOCK_LEAVES;
      }
}
// place_tree(10, 1, 3);

/* used for player & particle vs. world collision */
function pin_to_empty(ent) {
  ent.last_pos ??= [...ent.pos];

  const new_pos = [...ent.pos];
  const pos = [...ent.last_pos];

  let hit = [0, 0, 0];
  for (let i = 0; i < 3; i++) {

    const coord = [...pos];
    coord[i] = new_pos[i];
    const new_block = [Math.floor(coord[0]),
                       Math.floor(coord[1]),
                       Math.floor(coord[2])];
    const index = map_index(new_block[0], new_block[1], new_block[2]);

    let hard = 1;
    const   delta = new_pos[i] - pos[i];
    if (state.map[index] == ID_BLOCK_NONE)    hard = 0;
    if (state.map[index] == ID_BLOCK_SAPLING) hard = 0;
    if (state.map[index] == ID_BLOCK_FLOWER0) hard = 0;
    if (state.map[index] == ID_BLOCK_FLOWER1) hard = 0;
    if (state.map[index] == ID_BLOCK_FLOWER2) hard = 0;
    if (state.map[index] == ID_BLOCK_STAIRS) {
      /*  i == 0 && delta < 0 */
      const x_frac = new_pos[0] - new_block[0] + 0.2;
      const y_frac = new_pos[1] - new_block[1];
      const ramp = y_frac > x_frac;
      if (ramp) hard = 0;
    }

    if (!hard) pos[i] = new_pos[i];
    else hit[i] = 1;
  }
  ent.pos      = [...pos];
  ent.last_pos = [...pos];

  return (hit[0] || hit[1] || hit[2]) ? hit : false;
}

function ray_to_map(ray_origin, ray_direction) {
  const ret = {
    impact: [0, 0, 0],
    side: undefined,
    dir: undefined,

    index: undefined,
    last_index: undefined,

    coord: [0, 0, 0],
    last_coord: [0, 0, 0],
  };

  // calculate distances to axis boundries and direction of discrete DDA steps
  const map = [Math.floor(ray_origin[0]),
               Math.floor(ray_origin[1]),
               Math.floor(ray_origin[2]) ];
  const deltaDist = [0, 0, 0];
  const step = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const x = (ray_direction[0] / ray_direction[i]);
    const y = (ray_direction[1] / ray_direction[i]);
    const z = (ray_direction[2] / ray_direction[i]);
    deltaDist[i] = Math.sqrt(x*x + y*y + z*z);
    if (ray_direction[i] < 0) {
      step[i] = -1;
      ret.impact[i] = (ray_origin[i] - map[i]) * deltaDist[i];
    } else {
      step[i] = 1;
      ret.impact[i] = (map[i] + 1 - ray_origin[i]) * deltaDist[i];
    }
  }

  // perform "DDA"
  while (true) {

    // determine what side dimension should be incremented
    ret.side = 0;
    for (let i = 1; i < 3; ++i)
      if (ret.impact[ret.side] > ret.impact[i])
        ret.side = i;
    ret.dir = step[ret.side];

    ret.impact[ret.side] += deltaDist[ret.side];
    map[ret.side] += step[ret.side];
    if (map[ret.side] <  0       ||
        map[ret.side] >= MAP_SIZE)
      break; // out of bounds

    // sample volume data at calculated position and make collision calculations
    ret.last_index = ret.index;
    ret.index = map[0]*MAP_SIZE*MAP_SIZE + map[1]*MAP_SIZE + map[2];

    ret.last_coord = ret.coord;
    ret.coord = [map[0], map[1], map[2]];

    // closest voxel is found, no more work to be done
    if (state.map[ret.index]) return ret;
  }

  ret.index = ret.coord = undefined;
  return ret;
}

window.onmousedown = e => {
  if (!document.pointerLockElement) return;
  if (e.button == 0) state.mousedown = 1;

  const i = state.inv;
  if (e.button == 2 && i.items[i.held_i]) {
    e.preventDefault();

    const cast = ray_to_map(cam_eye(), cam_looking());

    if (cast.coord) {
      /* use up x1 of held item */ 
      const consume = () => {
        state.using.ts_start = Date.now();
        state.using.ts_end   = Date.now() + 350;

        held.amount--;
        if (held.amount == 0)
          i.items[i.held_i] = 0;
      };

      const p = [...cast.coord];

      const held = i.items[i.held_i];
      if (held.id <= ID_BLOCK_LAST) {
        p[cast.side] -= cast.dir;
        const dst_index = p[0]*MAP_SIZE*MAP_SIZE + p[1]*MAP_SIZE + p[2];
        state.map[dst_index] = held.id;

        consume();
      } else {
        if (held.id == ID_ITEM_BONEMEAL) {
          const src_index = p[0]*MAP_SIZE*MAP_SIZE + p[1]*MAP_SIZE + p[2];
          const under_index = p[0]*MAP_SIZE*MAP_SIZE + (p[1] - 1)*MAP_SIZE + p[2];
          const on_sap = state.map[src_index] == ID_BLOCK_SAPLING;
          const on_dirt = state.map[src_index] == ID_BLOCK_DIRT  ||
                          state.map[src_index] == ID_BLOCK_GRASS  ;
          const over_dirt = state.map[under_index] == ID_BLOCK_DIRT  ||
                            state.map[under_index] == ID_BLOCK_GRASS  ;
          if (on_sap && over_dirt) {
            place_tree(...cast.coord);
            consume();
          } else if (on_dirt || over_dirt) {
            if (over_dirt) p[1] -= 1;

            /* place flowers */
            const min_x = p[0] - 1, max_x = p[0] + 1;
            const min_z = p[2] - 1, max_z = p[2] + 1;
            for (let ox = 0; ox <= (max_x-min_x); ox++)  {
              for (let oz = 0; oz <= (max_z-min_z); oz++) {
                const top_i = map_index(min_x + ox, p[1]+1, min_z + oz);

                if (state.map[top_i] != ID_BLOCK_NONE) continue;
                if (Math.random() < (3/(3*3)))
                  state.map[top_i] = (Math.random() < 0.5) ? ID_BLOCK_FLOWER0 : ID_BLOCK_FLOWER1;
                if (Math.random() < (5/(3*3)))
                  state.map[top_i] = ID_BLOCK_FLOWER2;
              }
            }

            consume();
          }
        }
      }
    }
  }
}
window.onmouseup = e => {
  if (!document.pointerLockElement) return;
  if (e.button == 0) state.mousedown = 0;

  state.mining = { block_coord: undefined, ts_start: Date.now(), ts_end: Date.now() };
}
window.onmousemove = e => {
  if (!document.pointerLockElement) return;

  /* used to roll back superfluous cam movement emitted on pointerlockchange (see handler) */ 
  state.last_cam = {...state.cam};

  const dy = e.movementY * 0.35;
  const dx = e.movementX * 0.35;
  state.cam.pitch_deg = Math.max(-89, Math.min(89, state.cam.pitch_deg - dy));
  state.cam.yaw_deg = (state.cam.yaw_deg - dx) % 360;
};
document.onpointerlockchange = () => {
  if (!document.pointerLockElement)
    state.cam = {...state.last_cam};
};
window.onkeydown = e => {
  state.keysdown[e.code] = 1;

  if (e.code == 'Space')
    if (state.tick > state.jumping.tick_end && state.jumping.grounded) {
      state.jumping.tick_end = state.tick + 0.3*SEC_IN_TICKS;
      state.jumping.tick_start = state.tick;
      state.jumping.grounded = 0;
    }

  const digit = parseInt(e.code['Digit'.length]);
  if (digit) state.inv.held_i = digit-1;
}
window.onkeyup   = e => state.keysdown[e.code] = 0;
function cam_eye() {
  return add3(state.pos, mul3_f(VEC3_UP, 1.8));
}
function cam_looking() {
  const yaw_sin   = Math.sin(state.cam.yaw_deg   / 180 * Math.PI);
  const yaw_cos   = Math.cos(state.cam.yaw_deg   / 180 * Math.PI);
  const pitch_sin = Math.sin(state.cam.pitch_deg / 180 * Math.PI);
  const pitch_cos = Math.cos(state.cam.pitch_deg / 180 * Math.PI);

  const looking = [
    yaw_sin * pitch_cos,
    pitch_sin,
    yaw_cos * pitch_cos,
  ];
  return looking;
}
function cam_view_proj(canvas) {
  const proj = mat4_create();

  if (0)
    mat4_ortho(proj, -5.0, 5.0, -5.0, 5.0, -1.0, 100);

  if (1) mat4_perspective(
    proj,
    FIELD_OF_VIEW,
    canvas.clientWidth / canvas.clientHeight,
    0.005,
    100
  );
  
  const eye = cam_eye();
  const view = mat4_create();
  mat4_target_to(view, eye, add3(cam_looking(), eye));
  mat4_invert(view, view);

  mat4_mul(proj, proj, view);
  return proj;
}

function draw_scene(gl, program_info, geo) {
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.clearColor(0.2, 0.3, 0.4, 1.0);
  gl.clearDepth(1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  state.items = state.items.filter(item => {
    if (mag3(sub3(item.pos, state.pos)) < 1.5) {

      /* find place for item in inventory */
      (() => {
        for (const i in state.inv.items)
          if (state.inv.items[i].id == item.id) {
            state.inv.items[i].amount += item.amount;
            return;
          }
        for (const i in state.inv.items)
          if (!state.inv.items[i]) {
            state.inv.items[i] = item;
            return;
          }
      })();

      return false;
    }
    return true;
  });

  gl.bindBuffer(gl.ARRAY_BUFFER, geo.gpu_position);
  {
    gl.vertexAttribPointer(
      /* index         */ program_info.attrib_locations.a_vpos,
      /* numComponents */ 4,
      /* type          */ gl.FLOAT,
      /* normalize     */ false,
      /* stride        */ VERT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      /* offset        */ 0
    );
    gl.enableVertexAttribArray(program_info.attrib_locations.a_vpos);
  }
  {
    gl.vertexAttribPointer(
      /* index         */ program_info.attrib_locations.a_uv,
      /* numComponents */ 2,
      /* type          */ gl.FLOAT,
      /* normalize     */ false,
      /* stride        */ VERT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      /* offset        */           4 * Float32Array.BYTES_PER_ELEMENT
    );
    gl.enableVertexAttribArray(program_info.attrib_locations.a_uv);
  }
  {
    gl.vertexAttribPointer(
      /* index         */ program_info.attrib_locations.a_tex_i,
      /* numComponents */ 1,
      /* type          */ gl.UNSIGNED_BYTE,
      /* normalize     */ false,
      /* stride        */ VERT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      /* offset        */           6 * Float32Array.BYTES_PER_ELEMENT,
    );
    gl.enableVertexAttribArray(program_info.attrib_locations.a_tex_i);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.gpu_indices);
  gl.useProgram(program_info.program);

  {
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, geo.idxs_used, type, offset);
  }
}

function init_shader_program(gl) {
  const vs_source = `
    attribute vec4 a_vpos;
    attribute vec2 a_uv;
    attribute vec2 a_tex_i;

    varying lowp vec4 v_color;
    varying lowp vec2 v_texcoord;

    void main(void) {
      gl_Position = a_vpos;
      v_texcoord = a_uv;

      v_color = vec4(1.0);
      if (mod(floor(a_tex_i.x / 1.0), 2.0) == 1.0)
        v_color.x -= 0.2,
        v_color.y -= 0.2,
        v_color.z -= 0.2;
      if (mod(floor(a_tex_i.x / 2.0), 2.0) == 1.0)
        v_color.xyz = mix(
          vec3(0.412, 0.765, 0.314) + 0.1,
          vec3(0.196, 0.549, 0.235) + 0.1,
          0.01
        );
      // if (mod(a_tex_i.z, 2.0) == 1.0) {
      //   gl_Position.z -= 0.001;
      // }

    }
  `;
  const fs_source = `
    varying lowp vec4 v_color;
    varying lowp vec2 v_texcoord;

    uniform sampler2D u_tex;

    void main(void) {
      gl_FragColor = v_color * texture2D(u_tex, v_texcoord);
      if (gl_FragColor.a == 0.0) discard;
    }
  `;

  function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(
        `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`
      );

    return shader;
  }

  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vs_source);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fs_source);

  const shader_program = gl.createProgram();
  gl.attachShader(shader_program, vertexShader);
  gl.attachShader(shader_program, fragmentShader);
  gl.linkProgram(shader_program);

  if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS))
    throw new Error(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        shader_program
      )}`
    );

  return shader_program;
}

function gl_upload_image(gl, image, i) {
  // Create a texture.
  const texture = gl.createTexture();
 
  // make unit 0 the active texture unit
  // (i.e, the unit all other texture commands will affect.)
  gl.activeTexture(gl.TEXTURE0 + i);
 
  // Bind texture to 'texture unit '0' 2D bind point
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // const ext = gl.getExtension('EXT_texture_filter_anisotropic');
  // const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
  // gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
 
  // Set the parameters so we don't need mips and so we're not filtering
  // and we don't repeat
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  // Upload the image into the texture.
  const mipLevel = 0;               // the largest mip
  const internalFormat = gl.RGBA;   // format we want in the texture
  const srcFormat = gl.RGBA;        // format of data we are supplying
  const srcType = gl.UNSIGNED_BYTE  // type of data we are supplying
  gl.texImage2D(gl.TEXTURE_2D,
                mipLevel,
                internalFormat,
                srcFormat,
                srcType,
                image);

  gl.generateMipmap(gl.TEXTURE_2D);
}

const letter_widths = [...Array(16*16)].fill(6);
const SPRITESHEET_SIZE = SS_COLUMNS*16;
let spritesheet, ss_ctx;
async function ss_sprite(gl) {

  const terrain = new Image(); terrain.src = './terrain.png';
  const  hotbar = new Image();  hotbar.src = './hotbar.png' ;
  const   items = new Image();   items.src = './items.png'  ;
  const    font = new Image();    font.src = './font.png'   ;
  const     sky = new Image();     sky.src = './sky.png'    ;
  await Promise.all([
    new Promise(res => terrain.onload = res),
    new Promise(res =>  hotbar.onload = res),
    new Promise(res =>   items.onload = res),
    new Promise(res =>    font.onload = res),
    new Promise(res =>     sky.onload = res),
  ]);

  if (spritesheet == undefined) {
    spritesheet = document.createElement("canvas");
    spritesheet.width = spritesheet.height = SPRITESHEET_SIZE;
    ss_ctx = spritesheet.getContext("2d");
    ss_ctx.msImageSmoothingEnabled     = false;
    ss_ctx.mozImageSmoothingEnabled    = false;
    ss_ctx.webkitImageSmoothingEnabled = false;
    ss_ctx.imageSmoothingEnabled       = false;
  }

  ss_ctx.drawImage(font, 0, 0);
  const font_imgd = ss_ctx.getImageData(0, 0, 128, 128);
  const font_px = font_imgd.data;

  for (const i in letter_widths) {
    const ltr_x = i % 16;
    const ltr_y = Math.floor(i / 16);

    let width = 0;
    for (let x = 0; x < 8; x++) {
      let hit = 0;
      for (let y = 0; y < 8; y++) {
        hit ||= +!!font_px[((ltr_y*8 + y)*128 + (ltr_x*8 + x))*4+3];
      }
      if (!hit) break;
      width++;
    }

    // let out = '';
    // for (let y = 0; y < 8; y++) {
    //   for (let x = 0; x < 8; x++) {
    //     out += +!!font_px[((ltr_y*8 + y)*128 + (ltr_x*8 + x))*4+3];
    //   }
    //   out += '\n';
    // }
    // console.log(out, String.fromCharCode(i), width);
    letter_widths[i] = 1+width;
  }
  letter_widths[' '.charCodeAt(0)] = 5;
  ss_ctx.clearRect(0, 0, spritesheet.width, spritesheet.height);

  // const str = "surprisingly okay with that";
  // for (const i in str) {
  //   const chr = str[i];
  //   console.log(chr, letter_widths[chr.charCodeAt(0)]);
  // }

  const w = terrain. width;
  const h = terrain.height;
  ss_ctx.drawImage(terrain, 0, 0,   terrain.width, terrain.height);
  ss_ctx.drawImage( hotbar, w, h,   terrain.width, terrain.height);
  ss_ctx.drawImage(  items, w, 0,   terrain.width, terrain.height);
  ss_ctx.drawImage(   font, 0, h,   terrain.width, terrain.height);
  ss_ctx.drawImage(    sky, 0, h*2,     sky.width,     sky.height);
  gl_upload_image(gl, spritesheet, 0);
}

const SEC_IN_TICKS = 60;
function tick() {
  state.tick++;

  if ((state.tick % (SEC_IN_TICKS/2)) == 0) {
    const pending = [];

    for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
      for (let t_y = 0; t_y < MAP_SIZE; t_y++) 
        for (let t_z = 0; t_z < MAP_SIZE; t_z++) {
          const index = t_x*MAP_SIZE*MAP_SIZE + t_y*MAP_SIZE + t_z;
          let block_id = state.map[index];
          if (block_id == ID_BLOCK_LEAVES) {
            let decay = 1;
            for (let o_x = -2; o_x <= 2; o_x++) 
              for (let o_y = -2; o_y <= 2; o_y++) 
                for (let o_z = -2; o_z <= 2; o_z++) {
                  const nbr_index = map_index(o_x + t_x, o_y + t_y, o_z + t_z);
                  if (state.map[nbr_index] == ID_BLOCK_LOG) decay = 0;
                }

            if (decay && (Math.random() < 0.1)) pending.push(index);
          }
        }
    for (const index of pending)
      state.map[index] = ID_BLOCK_NONE;
  }

  for (const i of state.items) {
    i.vel ??= 0;

    i.vel -= 0.09/SEC_IN_TICKS;
    i.pos[1] += i.vel;
    if (pin_to_empty(i)) i.vel = 0;
  }

  let jumping_off = 0;
  {
    const elapsed = state.tick - state.jumping.tick_start;
    if (elapsed > 0 && elapsed < 0.08*SEC_IN_TICKS)
      state.vel += 2.0/SEC_IN_TICKS;
    if (elapsed > 0 && elapsed < 0.10*SEC_IN_TICKS)
      jumping_off = 1;
  }
  {
    state.tick_start_move ??= 0;
    state.vel ??= 0;
    state.delta ??= [0, 0, 0];

    state.vel -= 0.35/SEC_IN_TICKS;
    state.pos[1] += state.vel;

    if (state.jumping.grounded || jumping_off) {
      const fwd = cam_looking(); fwd[1] = 0; norm(fwd);
      const side = cross3(VEC3_UP, fwd);

      let delta = [0, 0, 0];
      let move = 0;
      if (state.keysdown['KeyW']) move = 1, delta = add3(delta, mul3_f( fwd,  0.1));
      if (state.keysdown['KeyS']) move = 1, delta = add3(delta, mul3_f( fwd, -0.1));
      if (state.keysdown['KeyA']) move = 1, delta = add3(delta, mul3_f(side,  0.1));
      if (state.keysdown['KeyD']) move = 1, delta = add3(delta, mul3_f(side, -0.1));

      let t = 0;
      const elapsed = state.tick - state.tick_start_move - 1;
      if (elapsed > 0) t = ease_out_circ(Math.min(1, elapsed / (0.1*SEC_IN_TICKS)));

      if (!move) state.tick_start_move = state.tick;

      if (!move) {
        let grounded_t = (state.tick - state.jumping.tick_grounded) / (0.1*SEC_IN_TICKS);
        grounded_t = ease_out_circ(grounded_t);
        if (grounded_t < 1)
          delta = mul3_f(state.delta, 0.1*grounded_t);
      }

      delta = mul3_f(delta, t);
      state.pos = add3(state.pos, delta);
      state.delta = mul3_f(state.delta, 0.9);
      state.delta = add3(state.delta, delta);

      /* stairs hack (works good) */
      for (let i = 0; i <= 2; i++) {
        const block = [Math.floor(state.pos[0]),
                       Math.floor(state.pos[1] + 0.01*i),
                       Math.floor(state.pos[2])];
        const last_index = map_index(block[0], block[1], block[2]);

        if (state.map[last_index] == ID_BLOCK_STAIRS) {
          console.log("khgmg");

          if (delta[0] > 0.06) {
            state.pos[1] += 0.1;
            state.vel += 3.75/SEC_IN_TICKS;
            state.jumping.tick_end = state.tick + 0.2*SEC_IN_TICKS;
            state.tick_start_move = state.tick;
          }
          else if (Math.abs(delta[0]) > 0.01) {
            state.pos[1] += 0.04;
          }
          if (delta[0] < -0.04) {
            state.jumping.tick_end = state.tick + 0.2*SEC_IN_TICKS;
            state.vel += 3.75/SEC_IN_TICKS;
          }
          break;
        }
      }

      // const temp = { pos: [...state.pos], last_pos: [...state.last_pos] };
      // temp.pos[1] += 1.8;
      // console.log(pin_to_empty(temp));
      // state.pos[0] = temp.pos[0];
      // state.pos[2] = temp.pos[2];

    } else {
      state.pos[0] += state.delta[0]*0.1;
      state.pos[2] += state.delta[2]*0.1;
    }

    const last_pos = [...state.last_pos]
    let hit = pin_to_empty(state)

    const grounded_before = state.jumping.grounded;
    state.jumping.grounded = 0;
    if (hit) {
      if (hit[0]) state.delta[0] *= 0.8;
      if (hit[2]) state.delta[2] *= 0.8;

      if (hit[1]) {
        state.vel = 0;
        state.jumping.grounded = 1;
        if (!grounded_before)
          state.jumping.tick_grounded = state.tick;
      }
    }

  }
}

(async () => {
  const canvas = document.getElementById("p1");
  const gl = canvas.getContext("webgl", { antialias: false });

  if (gl === null) alert(
    "Unable to initialize WebGL. Your browser or machine may not support it."
  );

  const shader_program = init_shader_program(gl);

  const program_info = {
    program: shader_program,
    attrib_locations: {
      a_vpos:  gl.getAttribLocation(shader_program, "a_vpos"),
      a_uv:    gl.getAttribLocation(shader_program, "a_uv"),
      a_tex_i: gl.getAttribLocation(shader_program, "a_tex_i"),
    },
    uniform_locations: {},
  };

  // const img = new ImageData(256, 256);
  // for (let x = 0; x < 256; x++)
  //   for (let y = 0; y < 256; y++)
  //     img.data[(y*256 + x)*4 + 0] = (x/64^y/64)%2 * 255,
  //     img.data[(y*256 + x)*4 + 1] = (x/64^y/64)%2,
  //     img.data[(y*256 + x)*4 + 2] = (x/64^y/64)%2,
  //     img.data[(y*256 + x)*4 + 3] = (x/64^y/64)%2 * 255;
  // gl_upload_image(gl, img, 0);
  await ss_sprite(gl);

  let geo = {
    gpu_position: gl.createBuffer(),
    cpu_position: new Float32Array(VERT_FLOATS * 1 << 16),
    gpu_indices: gl.createBuffer(),
    cpu_indices: new Uint16Array(1 << 16),
    vrts_used: 0,
    idxs_used: 0
  };
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.gpu_indices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.cpu_indices, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, geo.gpu_position);
  gl.bufferData(gl.ARRAY_BUFFER, geo.cpu_position, gl.DYNAMIC_DRAW);

  canvas.addEventListener("click", () => {
    canvas.requestPointerLock({
      unadjustedMovement: true
    });
  });

  (window.onresize = () => {
    gl.viewport(
      0,
      0,
      canvas.width = window.innerWidth,
      canvas.height = window.innerHeight
    );
  })();

  // Draw the scene repeatedly
  let last, tick_acc = 0;;
  requestAnimationFrame(function render(now) {
    requestAnimationFrame(render);

    let dt = 0;
    if (last != undefined) dt = now - last;
    last = now;
    if (dt > 1000 * 5) dt = 0;

    tick_acc += dt;
    while (tick_acc >= 1000/SEC_IN_TICKS) {
      tick_acc -= 1000/SEC_IN_TICKS;
      tick();
    }

    if (0) {
      canvas.hidden = true;
      document.body.appendChild(spritesheet);
      spritesheet.style.position = 'absolute';
      spritesheet.style['top'] = '0px';
      spritesheet.style['left'] = '0px';
      document.body.style.background = 'black';
    }

    {
      let vrt_i = 0;
      let idx_i = 0;

      const default_mat = mat4_from_translation(mat4_create(), [0.5, 0.5, 0.5]);
      const default_view_proj = cam_view_proj(gl.canvas);
      const models = {
        cube: {
          dark_after_vert: 3*4*3,
          positions: new Float32Array([
            1, 1, 1,   0, 1, 1,   0, 0, 1,   1, 0, 1,   // Front face
            0, 1, 1,   1, 1, 1,   1, 1, 0,   0, 1, 0,   // Top face
            1, 1, 0,   1, 1, 1,   1, 0, 1,   1, 0, 0,   // Right face
            0, 1, 0,   1, 1, 0,   1, 0, 0,   0, 0, 0,   // Back face
            1, 0, 0,   1, 0, 1,   0, 0, 1,   0, 0, 0,   // Bottom face
            0, 1, 1,   0, 1, 0,   0, 0, 0,   0, 0, 1,   // Left face
          ].map(x => lerp(-0.0012, 1.0012, x))),
          // ]),
          indices: [
             0,  1,  2,  0,  2,  3, // front
             4,  5,  6,  4,  6,  7, // back
             8,  9, 10,  8, 10, 11, // top
            12, 13, 14, 12, 14, 15, // bottom
            16, 17, 18, 16, 18, 19, // right
            20, 21, 22, 20, 22, 23, // left
          ]
        },
        stairs: {
          dark_after_vert: 3*4*6,
          positions: new Float32Array([
            0.0, 0.5, 1.0,   0.0, 0.5, 0.0,   0.0, 0.0, 0.0,   0.0, 0.0, 1.0,   // Front face
            0.5, 1.0, 1.0,   0.5, 1.0, 0.0,   0.5, 0.5, 0.0,   0.5, 0.5, 1.0,   // Front face
            0.5, 1.0, 0.0,   0.5, 1.0, 1.0,   1.0, 1.0, 1.0,   1.0, 1.0, 0.0,   // Top face
            0.0, 0.5, 0.0,   0.0, 0.5, 1.0,   0.5, 0.5, 1.0,   0.5, 0.5, 0.0,   // Top face
            1.0, 1.0, 1.0,   0.5, 1.0, 1.0,   0.5, 0.5, 1.0,   1.0, 0.5, 1.0,   // Right face
            1.0, 0.5, 1.0,   0.0, 0.5, 1.0,   0.0, 0.0, 1.0,   1.0, 0.0, 1.0,   // Right face
                                                                            
            1.0, 1.0, 0.0,   1.0, 1.0, 1.0,   1.0, 0.0, 1.0,   1.0, 0.0, 0.0,   // Back face
            1.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 0.0,   1.0, 0.0, 0.0,   // Bottom face
            0.5, 1.0, 0.0,   1.0, 1.0, 0.0,   1.0, 0.5, 0.0,   0.5, 0.5, 0.0,   // Left face
            0.0, 0.5, 0.0,   1.0, 0.5, 0.0,   1.0, 0.0, 0.0,   0.0, 0.0, 0.0,   // Left face

          ].map(x => lerp(-0.0012, 1.0012, x))),
          // ]),
          indices: [
             0,  1,  2,  0,  2,  3, // front
             4,  5,  6,  4,  6,  7, // back
             8,  9, 10,  8, 10, 11, // top
            12, 13, 14, 12, 14, 15, // bottom
            16, 17, 18, 16, 18, 19, // right
            20, 21, 22, 20, 22, 23, // left
            24, 25, 26, 24, 26, 27, // right
            28, 29, 30, 28, 30, 31, // left
            32, 33, 34, 32, 34, 35, // left
            36, 37, 38, 36, 38, 39, // left
          ]
        },
        x: {
          dark_after_vert: 3*4*1,
          positions: new Float32Array([
            1, 1, 0.5,   0, 1, 0.5,    0, 0, 0.5,  1, 0, 0.5,    // Front face
            0.5, 1, 0,   0.5, 1, 1,   0.5, 0, 1,    0.5, 0, 0,   // Right face
          ]),
          indices: [
             0,  1,  2,  0,  2,  3, // front
             4,  5,  6,  4,  6,  7, // right
          ]
        },
        item: {
          positions: new Float32Array([
            0.5, 1, 0,   0.5, 1, 1,   0.5, 0, 1,    0.5, 0, 0,   // Right face
          ]),
          indices: [
             0,  1,  2,  0,  2,  3, // front
          ]
        },
      };
      function place_cube(t_x, t_y, t_z, tex_offset, opts={}) {
        const { dark_after_vert, positions, indices } = opts.model ?? models.cube;
        const tile_idx_i = vrt_i / VERT_FLOATS;

        for (let i = 0; i < positions.length; i += 3) {
          const face_i = Math.floor(i/3/4);
          const tex = tex_offset[face_i] ?? tex_offset;
          if (tex == -1) continue;

          const x = positions[i + 0] - 0.5;
          const y = positions[i + 1] - 0.5;
          const z = positions[i + 2] - 0.5;
          const p = [x, y, z, 1];
          mat4_transform_vec4(p, p, opts.mat ?? default_mat);

          const q = [p[0] + t_x, p[1] + t_y, p[2] + t_z, 1];
          mat4_transform_vec4(q, q, opts.view_proj ?? default_view_proj);

          geo.cpu_position[vrt_i++] = q[0];
          geo.cpu_position[vrt_i++] = q[1];
          geo.cpu_position[vrt_i++] = q[2];
          geo.cpu_position[vrt_i++] = q[3];

          let corner_x, corner_y;
          if ((i/3)%4 == 0) corner_x = 0, corner_y = 0;
          if ((i/3)%4 == 1) corner_x = 1, corner_y = 0;
          if ((i/3)%4 == 2) corner_x = 1, corner_y = 1;
          if ((i/3)%4 == 3) corner_x = 0, corner_y = 1;
          const u =           (tex % SS_COLUMNS) + corner_x*(opts.tex_size_x ?? 1);
          const v = Math.floor(tex / SS_COLUMNS) + corner_y*(opts.tex_size_y ?? 1);
          geo.cpu_position[vrt_i++] = u / SS_COLUMNS;
          geo.cpu_position[vrt_i++] = v / SS_COLUMNS;

          const u8_cast = new Uint8Array(
            geo.cpu_position.buffer,
            Float32Array.BYTES_PER_ELEMENT * vrt_i++
          );
          const darken = opts.darken ?? (i >= dark_after_vert);
          const biomed = ((opts.biomed && opts.biomed[face_i]) ?? opts.biomed) ?? 0;
          u8_cast[0] = (darken << 0) | (biomed << 1);
        }

        for (const i_o of indices)
          geo.cpu_indices[idx_i++] = tile_idx_i+i_o;
      }
      function place_ui_quad(ortho, quad_x, quad_y, quad_w, quad_h, tex_offset, opts={}) {
        const tile_idx_i = vrt_i / VERT_FLOATS;

        const positions = new Float32Array(   // Front face 
          [ 0, 1, 1,   1, 1, 1,   1, 0, 1,   0, 0, 1]
        );
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i + 0]*quad_w + quad_x;
          const y = positions[i + 1]*quad_h + quad_y;
          const z = positions[i + 2];
          const p = [x, y, z, 1];
          // mat4_from_translation(_scratch, [0, 0, 0]);

          mat4_transform_vec4(p, p, ortho);

          geo.cpu_position[vrt_i++] = p[0];
          geo.cpu_position[vrt_i++] = p[1];
          geo.cpu_position[vrt_i++] = opts.z ?? 0.75;
          geo.cpu_position[vrt_i++] = 1.00;

          if (opts.corner_uvs != undefined) {
            geo.cpu_position[vrt_i++] = opts.corner_uvs[(i/3)%4].u;
            geo.cpu_position[vrt_i++] = opts.corner_uvs[(i/3)%4].v;
          } else {
            let corner_x, corner_y;
            if ((i/3)%4 == 0) corner_x = 0, corner_y = 0;
            if ((i/3)%4 == 1) corner_x = 1, corner_y = 0;
            if ((i/3)%4 == 2) corner_x = 1, corner_y = 1;
            if ((i/3)%4 == 3) corner_x = 0, corner_y = 1;
            let u =           (tex_offset % SS_COLUMNS) + corner_x*(opts.tex_size_x ?? 1);
            let v = Math.floor(tex_offset / SS_COLUMNS) + corner_y*(opts.tex_size_y ?? 1);
            geo.cpu_position[vrt_i++] = u / SS_COLUMNS;
            geo.cpu_position[vrt_i++] = v / SS_COLUMNS;
          }

          const u8_cast = new Uint8Array(
            geo.cpu_position.buffer,
            Float32Array.BYTES_PER_ELEMENT * vrt_i++
          );
          const darken = opts.darken ?? 0;
          const biomed = 0;
          u8_cast[0] = (darken << 0) | (biomed << 1);
        }

        for (const i_o of [
           0,  1,  2,  0,  2,  3, // front
        ])
          geo.cpu_indices[idx_i++] = tile_idx_i+i_o;
      }
      function place_block(t_x, t_y, t_z, block_id, opts={}) {
        const topped = (_top, rest) => [rest, _top, rest, rest, rest, rest];

        if (block_id == ID_BLOCK_FLOWER0) opts.model = models.x;
        if (block_id == ID_BLOCK_FLOWER1) opts.model = models.x;
        if (block_id == ID_BLOCK_FLOWER2) opts.model = models.x, opts.biomed = 1;
        if (block_id == ID_BLOCK_SAPLING) opts.model = models.x;
        if (block_id == ID_BLOCK_STAIRS)  opts.model = models.stairs;

        if (block_id == ID_BLOCK_GRASS) opts.biomed = topped(1, 0);
        if (block_id > ID_BLOCK_LAST) opts.model = models.item;

        const tex_offset = id_to_tex_num(block_id);
        if (block_id == ID_BLOCK_LEAVES) opts.biomed = 1;

        place_cube(t_x, t_y, t_z, tex_offset, opts);
        if (block_id == ID_BLOCK_GRASS) {
          opts.biomed = 1;
          place_cube(t_x, t_y, t_z, topped(-1, SS_COLUMNS*2 + 6), opts);
        }
      }


      /* update mining (removing/changing block as necessary) */
      const cast = ray_to_map(cam_eye(), cam_looking());
      if (cast.coord && cast.coord+'' == state.mining.block_coord+'') {
        if (state.mining.ts_end < Date.now()) {
          const p = [...state.mining.block_coord];
          const index = p[0]*MAP_SIZE*MAP_SIZE + p[1]*MAP_SIZE + p[2];
          state.items.push({ pos: add3(p, [0.5, 0.2, 0.5]), id: state.map[index], amount: 1 });
          state.map[index] = 0;
        }
      } else {
        state.mining = { block_coord: undefined, ts_start: Date.now(), ts_end: Date.now() };
      }
      {
        const { block_coord, ts_end } = state.mining;
        if ((state.mousedown)                                 &&
            (block_coord == undefined || ts_end < Date.now()) &&
            (cast.coord != undefined)
        ) {
          state.mining.block_coord = cast.coord;
          state.mining.ts_start = Date.now();

          const held_id = state.inv.items[state.inv.held_i].id;

          const p = [...state.mining.block_coord];
          const index = p[0]*MAP_SIZE*MAP_SIZE + p[1]*MAP_SIZE + p[2];
          const block_id = state.map[index];

          let mine_time = 2500;
          if (block_id == ID_BLOCK_LEAVES ) mine_time = 950;
          if (block_id == ID_BLOCK_FLOWER0) mine_time = 350;
          if (block_id == ID_BLOCK_FLOWER1) mine_time = 350;
          if (block_id == ID_BLOCK_FLOWER2) mine_time = 350;
          if (block_id == ID_BLOCK_SAPLING) mine_time = 350;
          if (held_id == ID_ITEM_T0_PICK  && block_id == ID_BLOCK_STONE ) mine_time =  950;
          if (held_id == ID_ITEM_T0_SPADE && block_id == ID_BLOCK_DIRT  ) mine_time =  750;
          if (held_id == ID_ITEM_T0_SPADE && block_id == ID_BLOCK_GRASS ) mine_time =  800;
          if (held_id == ID_ITEM_T0_AXE   && block_id == ID_BLOCK_LOG   ) mine_time =  850;
          if (held_id == ID_ITEM_T0_AXE   && block_id == ID_BLOCK_LEAVES) mine_time =  750;
          if (held_id == ID_ITEM_T0_AXE   && block_id == ID_BLOCK_WOOD  ) mine_time =  650;
          if (held_id == ID_ITEM_T0_AXE   && block_id == ID_BLOCK_STAIRS) mine_time =  650;

          state.mining.ts_end = Date.now() + mine_time;
        }
      }

      {
        /* removing block being mined before rendering map */
        let mining_index = undefined;
        let mining_block_type = undefined;
        if (state.mining.block_coord) {
          const p = state.mining.block_coord;
          mining_index = p[0]*MAP_SIZE*MAP_SIZE + p[1]*MAP_SIZE + p[2];

          mining_block_type = state.map[mining_index];
          state.map[mining_index] = 0;
        }

        for (let t_x = 0; t_x < (MAP_SIZE-0); t_x++) 
          for (let t_y = 0; t_y < (MAP_SIZE-0); t_y++) 
            for (let t_z = 0; t_z < (MAP_SIZE-0); t_z++) {
              const index = t_x*MAP_SIZE*MAP_SIZE + t_y*MAP_SIZE + t_z;
              let block_id = state.map[index];
              if (block_id != ID_BLOCK_NONE   &&  
                  block_id != ID_BLOCK_LEAVES )
                place_block(t_x, t_y, t_z, block_id);
            }
        /* undo "removing block being mined before rendering map" */
        if (mining_index)
          state.map[mining_index] = mining_block_type;
      }

      /* render indicator of what block you are looking at */
      if (cast.index != undefined                  &&
          cast.index <  MAP_SIZE*MAP_SIZE*MAP_SIZE &&
          cast.index >= 0                          &&
          !state.mousedown
      ) {
        const p = [...cast.coord];
        const thickness = 0.04;
        p[cast.side] -= cast.dir*0.5;

        const scale = [1, 1, 1];
        scale[cast.side] = 0.004;
        const mat = mat4_from_translation(mat4_create(), [0.5, 0.5, 0.5]);
        mat[0]  = scale[0];
        mat[5]  = scale[1];
        mat[10] = scale[2];
        place_block(...p, ID_BLOCK_GLASS, { darken: 0, mat, transparent: 1 });
      }
      
      const view_proj = mat4_create();
      const hotbar_size = 45*4 + 2;
      const ui_w = canvas.width /4;
      const ui_h = canvas.height/4;
      const offset = Math.floor((hotbar_size - ui_w)/2);
      mat4_ortho(
        view_proj,
        offset + 0, offset + ui_w,
                 0,          ui_h,
        0, 1
      );

      const ui_cube = (x, y, id) => {
        const mat       = mat4_create();
        mat4_mul(mat, mat, mat4_from_translation(_scratch, [x + 8, y + 8, -0.00001]));
        mat4_mul(mat, mat, mat4_from_scaling    (_scratch, [  9.5,   9.5,  0.00001]));
        mat4_mul(mat, mat, mat4_from_x_rotation (_scratch, Math.PI/5));
        mat4_mul(mat, mat, mat4_from_y_rotation (_scratch, Math.PI/4));

        place_block(0, 0, 0, id, { view_proj, mat });
      }

      /* skybox */
      {
        let view;
        if (1) {
          const eye = cam_eye();
          view = mat4_create();
          mat4_target_to(view, [0, 0, 0], cam_looking());
          mat4_invert(view, view);
        } else {
          view = mat4_create();
          mat4_target_to(view, [0, 0, 0], norm([0, 0, 1]));
          mat4_invert(view, view);
        }

        const SKYBOX_SIZE = 10_000;

        const proj = mat4_create();
        if (0) mat4_ortho(proj, -1.0, 1.0, -1.0, 1.0, -0.0, 100);
        else {
          mat4_perspective(
            proj,
            FIELD_OF_VIEW,
            canvas.clientWidth / canvas.clientHeight,
            0.1,
            SKYBOX_SIZE
          )
        }

        mat4_mul(proj, proj, view);
        const view_proj = proj;
        const mat = mat4_from_scaling(mat4_create(), [SKYBOX_SIZE, SKYBOX_SIZE, SKYBOX_SIZE]);
        place_cube(0, 0, 0, [
            32*SS_COLUMNS + 64,
            32*SS_COLUMNS + 32, // top
            64*SS_COLUMNS + 64,
            64*SS_COLUMNS + 32,
            32*SS_COLUMNS + 0,  // bottom
            64*SS_COLUMNS + 0,
        ], { tex_size_x: 512/16, tex_size_y: 512/16, view_proj, mat, darken: 0 });
      }

      {
        /* removing block being mined before rendering map */
        let mining_index = undefined;
        let mining_block_type = undefined;
        if (state.mining.block_coord) {
          const p = state.mining.block_coord;
          mining_index = p[0]*MAP_SIZE*MAP_SIZE + p[1]*MAP_SIZE + p[2];

          mining_block_type = state.map[mining_index];
          state.map[mining_index] = 0;
        }

        for (let t_x = 0; t_x < (MAP_SIZE-0); t_x++) 
          for (let t_y = 0; t_y < (MAP_SIZE-0); t_y++) 
            for (let t_z = 0; t_z < (MAP_SIZE-0); t_z++) {
              const index = t_x*MAP_SIZE*MAP_SIZE + t_y*MAP_SIZE + t_z;
              let block_id = state.map[index];
              if (block_id == ID_BLOCK_LEAVES)
                place_block(t_x, t_y, t_z, block_id);
            }
        /* undo "removing block being mined before rendering map" */
        if (mining_index)
          state.map[mining_index] = mining_block_type;

        /* render block being mined with animation */
        if (mining_index && mining_block_type) {
          let t = inv_lerp(state.mining.ts_start, state.mining.ts_end, Date.now());
          t = Math.min(1, t);
          t = ease_out_sine(t);
          if (t < 0.98) place_block(...state.mining.block_coord, mining_block_type);
          const stage = Math.floor(lerp(0, 9, t));
          place_block(...state.mining.block_coord, ID_BLOCK_BREAKING + stage);
        }
      }

      for (const { pos, id } of state.items) {
        const mat = mat4_from_y_rotation(mat4_create(), Date.now()/1000);
        mat4_mul(mat, mat, mat4_from_translation(mat4_create(), [0.0, 0.5, 0.0]));
        mat4_mul(mat, mat, mat4_from_scaling(mat4_create(), [0.3, 0.3, 0.3]));
        place_block(...pos, id, { mat });
      }

      /* show item in hand */
      if (state.inv.items[state.inv.held_i]) {
        const item_id = state.inv.items[state.inv.held_i].id;

        const proj = mat4_create();
        const aspect = canvas.clientWidth / canvas.clientHeight;
        mat4_perspective(
          proj,
          45 / 180 * Math.PI,
          aspect,
          1.0,
          100_000
        );
        const view_proj = proj;

        let swing_rot = 0;
        let scale = 0.4;

        if (item_id == ID_ITEM_T0_SPADE) scale = 0.8, swing_rot = -90;
        if (item_id == ID_ITEM_T0_PICK ) scale = 0.8, swing_rot = -20;
        if (item_id == ID_ITEM_T0_AXE  ) scale = 0.8, swing_rot = -20;

        if (state.mining.ts_end > Date.now()) {

          let t = inv_lerp(state.mining.ts_start, state.mining.ts_end, Date.now());
          t = Math.min(1, 8*(1 - 2*Math.abs(0.5 - t)));

          swing_rot += 20*t*Math.cos(Date.now() * 0.03);
        }

        if (state.using.ts_end > Date.now()) {
          let t = inv_lerp(state.using.ts_start, state.using.ts_end, Date.now());
          t = (1 - 2.2*Math.abs(0.5 - t));
          t = ease_out_sine(t);
          swing_rot -= 40*t;
        }

        const mat = mat4_from_translation(mat4_create(), [aspect*0.55, -0.425, -1.85]);
        mat4_mul(mat, mat, mat4_from_y_rotation(_scratch,        40 / 180 * Math.PI));
        mat4_mul(mat, mat, mat4_from_x_rotation(_scratch, swing_rot / 180 * Math.PI));
        mat4_mul(mat, mat, mat4_from_scaling(_scratch, [scale, scale, scale]));

        place_block(0, 0, 0, item_id, { no_view_proj: 1, mat, view_proj });
      }

      const ui_str = (str, x, y, size, opts={}) => {
        let cursor = 0;
        for (const i in str) {
          const chr = str[i];
          const code = chr.charCodeAt(0);
          const code_x = code % 16;
          const code_y = Math.floor(code / 16);

          const tex = SS_COLUMNS*(code_y + 16) + code_x;
          place_ui_quad(
            view_proj,
            x + size*cursor, y,
            size, size,
            tex,
            opts
          );
          cursor += letter_widths[code]/8;
        }
        return cursor;
      };

      /* hotbar bg tex */
      {
        const size = 21;
        const slot = 16*SS_COLUMNS + 16;

        const size_x = hotbar_size;
        const opts = { tex_size_x: size_x/16, tex_size_y: size/16, z: -0.9997 };
        place_ui_quad(view_proj, 0, 2, size_x, size, slot, opts);
      }

      /* hotbar items preview */
      for (let i = 0; i < 9; i++) {
        const itm = state.inv.items[i];
        if (itm) {
          const id = state.inv.items[i].id;
          const item_tex = id_to_tex_num(id);

          const x = 3 + i*20;
          if (id <= ID_BLOCK_LAST)
            ui_cube(x, 4, id);
          else
            place_ui_quad(view_proj, x, 4, 16, 16, item_tex, { z: -0.9998 });

          if (itm.amount > 1)
            ui_str(""+itm.amount, x, 4, 8, { z: -1.0 });
        }
      }

      /* selected slot tex */
      {
        const x = 0;
        const size = 25;
        const slot = 17*SS_COLUMNS + 16;

        const quad_x = state.inv.held_i*20 - 1;
        const opts = {
          tex_size_x: size/16,
          tex_size_y: size/16,
          corner_uvs: [
            {u: 0.125        , v: 0.13525390625},
            {u: 0.13720703125, v: 0.13525390625},
            {u: 0.13720703125, v: 0.1474609375 },
            {u: 0.125        , v: 0.1474609375 }
          ],
          z: -0.9999
        };
        place_ui_quad(view_proj, quad_x, 0, size, size, slot, opts);
      }

        // if (state.inv.items[i]) {
        //   const id = state.inv.items[i].id;
        //   if (id <= ID_BLOCK_LAST)
        //     ui_cube(x, 0, id);
        //   else {
        //     const item_size = size * (12/16);
        //     const item_pad = (size - item_size)/2;
        //     place_ui_quad(
        //       view_proj,
        //       x + item_pad,
        //       0 + item_pad,
        //       item_size, item_size,
        //       SS_COLUMNS*11 + 31,
        //       { transparent, darken }
        //     );
        //   }
        // }

      // Create a buffer for the square's positions.
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.gpu_position);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, geo.cpu_position);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.gpu_indices);
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, geo.cpu_indices);

      geo.vrts_used = vrt_i;
      geo.idxs_used = idx_i;
    }

    draw_scene(gl, program_info, geo);
  });
})();
