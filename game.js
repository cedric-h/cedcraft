"use strict";
// vim: sw=2 ts=2 expandtab smartindent ft=javascript

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
function ease_out_expo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}
function ease_in_expo(x) {
  return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
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
const ID_BLOCK_ORE_T2   = _id++;
const ID_BLOCK_ORE_COAL = _id++;
const ID_BLOCK_COBBLE   = _id++;
const ID_BLOCK_WOOD     = _id++;
const ID_BLOCK_TABLE    = _id++;
const ID_BLOCK_FURNACE0 = _id++;
const ID_BLOCK_FURNACE1 = _id++;
const ID_BLOCK_STAIRS   = _id++;
const ID_BLOCK_WATER    = _id++;
const ID_BLOCK_GRASS    = _id++;
const ID_BLOCK_GLASS    = _id++;
const ID_BLOCK_TORCH    = _id++;
const ID_BLOCK_FLOWER0  = _id++;
const ID_BLOCK_FLOWER1  = _id++;
const ID_BLOCK_FLOWER2  = _id++;
const ID_BLOCK_SAPLING  = _id++;
const ID_BLOCK_LOG      = _id++;
const ID_BLOCK_LEAVES   = _id++;
const ID_BLOCK_BREAKING = _id; _id += 10;
const ID_BLOCK_LAST = _id-1;

const ID_ITEM_BONEMEAL  = _id++;
const ID_ITEM_COAL      = _id++;
const ID_ITEM_STICK     = _id++;
const ID_ITEM_T2_INGOT  = _id++;
const ID_ITEM_T0_SPADE  = _id++;
const ID_ITEM_T0_PICK   = _id++;
const ID_ITEM_T0_AXE    = _id++;
const ID_ITEM_T1_SPADE  = _id++;
const ID_ITEM_T1_PICK   = _id++;
const ID_ITEM_T1_AXE    = _id++;

/* stack 'em up BABY */
const ITEM_STACK_SIZE = [...Array(_id)].fill(65);
ITEM_STACK_SIZE[ID_BLOCK_FURNACE0] = 1;
ITEM_STACK_SIZE[ID_ITEM_T0_SPADE ] = 1;
ITEM_STACK_SIZE[ID_ITEM_T0_PICK  ] = 1;
ITEM_STACK_SIZE[ID_ITEM_T0_AXE   ] = 1;
ITEM_STACK_SIZE[ID_ITEM_T1_SPADE ] = 1;
ITEM_STACK_SIZE[ID_ITEM_T1_PICK  ] = 1;
ITEM_STACK_SIZE[ID_ITEM_T1_AXE   ] = 1;

const ITEM_STOCK_DURABILITY = [...Array(_id)];
ITEM_STOCK_DURABILITY[ID_ITEM_T0_SPADE] = 59;
ITEM_STOCK_DURABILITY[ID_ITEM_T0_PICK ] = 59;
ITEM_STOCK_DURABILITY[ID_ITEM_T0_AXE  ] = 59;
ITEM_STOCK_DURABILITY[ID_ITEM_T1_SPADE] = 131;
ITEM_STOCK_DURABILITY[ID_ITEM_T1_PICK ] = 131;
ITEM_STOCK_DURABILITY[ID_ITEM_T1_AXE  ] = 131;

/* "perfect" voxels are completely opaque and fill completely */
const VOXEL_PERFECT = [...Array(_id)].fill(0);
VOXEL_PERFECT[ID_BLOCK_DIRT    ] = 1;
VOXEL_PERFECT[ID_BLOCK_STONE   ] = 1;
VOXEL_PERFECT[ID_BLOCK_ORE_T2  ] = 1;
VOXEL_PERFECT[ID_BLOCK_ORE_COAL] = 1;
VOXEL_PERFECT[ID_BLOCK_COBBLE  ] = 1;
VOXEL_PERFECT[ID_BLOCK_WOOD    ] = 1;
VOXEL_PERFECT[ID_BLOCK_TABLE   ] = 1;
VOXEL_PERFECT[ID_BLOCK_FURNACE0] = 1;
VOXEL_PERFECT[ID_BLOCK_FURNACE1] = 1;
VOXEL_PERFECT[ID_BLOCK_GRASS   ] = 1;
// VOXEL_PERFECT[ID_BLOCK_LOG     ] = 1;
VOXEL_PERFECT[ID_BLOCK_LEAVES  ] = 1; /* for now */

/* marks textures as needing multiplication by biome color */
const TEX_BIOMED = Array();
TEX_BIOMED[id_to_tex_num(ID_BLOCK_GRASS  )[1]] = 1;
TEX_BIOMED[id_to_tex_num(ID_BLOCK_FLOWER2)[0]] = 1;
TEX_BIOMED[id_to_tex_num(ID_BLOCK_LEAVES )[0]] = 1;

const VOXEL_RENDER_STAGE = [...Array(_id)].fill(0);
VOXEL_RENDER_STAGE[ID_BLOCK_WATER   ] = 2;
VOXEL_RENDER_STAGE[ID_BLOCK_NONE    ] = 2;

const FIELD_OF_VIEW = 75 / 180 * Math.PI;

const MAP_SIZE = 16;
const MAX_HEIGHT = 64;
const MAX_LIGHT = 8;

function id_to_tex_num(block_id) {
  const topped       = (_top, rest, btm=_top) => [rest, _top, rest, rest, btm, rest];
  const xyz = (x, y, z) => [x, y, z, x, y, z];
  const all = tex => [tex, tex, tex, tex, tex, tex];

  let tex_offset = 0;
  if (block_id == ID_ITEM_BONEMEAL  ) tex_offset = SS_COLUMNS*11 + 31;
  if (block_id == ID_ITEM_COAL      ) tex_offset = SS_COLUMNS*0 + 16+7;
  if (block_id == ID_ITEM_STICK     ) tex_offset = SS_COLUMNS*3 + 16+5;
  if (block_id == ID_ITEM_T2_INGOT  ) tex_offset = SS_COLUMNS*1 + 16+7;
  if (block_id == ID_ITEM_T0_SPADE  ) tex_offset = SS_COLUMNS*5 + 16;
  if (block_id == ID_ITEM_T0_PICK   ) tex_offset = SS_COLUMNS*6 + 16;
  if (block_id == ID_ITEM_T0_AXE    ) tex_offset = SS_COLUMNS*7 + 16;
  if (block_id == ID_ITEM_T1_SPADE  ) tex_offset = SS_COLUMNS*5 + 16+1;
  if (block_id == ID_ITEM_T1_PICK   ) tex_offset = SS_COLUMNS*6 + 16+1;
  if (block_id == ID_ITEM_T1_AXE    ) tex_offset = SS_COLUMNS*7 + 16+1;
  if (block_id == ID_BLOCK_WOOD     ) tex_offset = all(4);
  if (block_id == ID_BLOCK_TABLE    ) tex_offset = xyz(SS_COLUMNS*3 + 11,
                                                       SS_COLUMNS*2 + 11,
                                                       SS_COLUMNS*3 + 12);
  if (block_id == ID_BLOCK_FURNACE0 ) tex_offset = xyz(SS_COLUMNS*2 + 12,
                                                       SS_COLUMNS*3 + 14,
                                                       SS_COLUMNS*2 + 13);
  if (block_id == ID_BLOCK_FURNACE1 ) tex_offset = xyz(SS_COLUMNS*3 + 13,
                                                       SS_COLUMNS*3 + 14,
                                                       SS_COLUMNS*2 + 13);
  if (block_id == ID_BLOCK_STAIRS   ) tex_offset = 4;
  if (block_id == ID_BLOCK_WATER    ) tex_offset = all(14);
  if (block_id == ID_BLOCK_GRASS    ) tex_offset = topped(0, 2, 2);
  if (block_id == ID_BLOCK_DIRT     ) tex_offset = all(2);
  if (block_id == ID_BLOCK_STONE    ) tex_offset = all(1);
  if (block_id == ID_BLOCK_ORE_T2   ) tex_offset = all(SS_COLUMNS*2 + 1);
  if (block_id == ID_BLOCK_ORE_COAL ) tex_offset = all(SS_COLUMNS*2 + 2);
  if (block_id == ID_BLOCK_COBBLE   ) tex_offset = all(SS_COLUMNS);
  if (block_id == ID_BLOCK_GLASS    ) tex_offset = all(3*SS_COLUMNS + 1);
  if (block_id == ID_BLOCK_TORCH    ) tex_offset = all(5*SS_COLUMNS);
  if (block_id == ID_BLOCK_FLOWER0  ) tex_offset = all(12);
  if (block_id == ID_BLOCK_FLOWER1  ) tex_offset = all(13);
  if (block_id == ID_BLOCK_FLOWER2  ) tex_offset = all(2*SS_COLUMNS + 7);
  if (block_id == ID_BLOCK_SAPLING  ) tex_offset = all(15);
  if (block_id == ID_BLOCK_LOG      ) tex_offset = topped(SS_COLUMNS*1 + 5, SS_COLUMNS*1 + 4);
  if (block_id == ID_BLOCK_LEAVES   ) tex_offset = all(3*SS_COLUMNS + 5);
  const bdelta = block_id - ID_BLOCK_BREAKING;
  if (bdelta < 10 && bdelta >= 0) tex_offset = all(SS_COLUMNS*15 + bdelta);

  return tex_offset;
}

const SCREEN_WORLD      = 0;
const SCREEN_INV        = 1;
const SCREEN_TABLE      = 2;
const SCREEN_FURNACE    = 3;
const SCREEN_CHAT       = 4;

const LIGHT_SRC_NONE  = 0;
const LIGHT_SRC_SUN   = 1;
const LIGHT_SRC_TORCH = 2;

/* where crafting table, etc. store items */
const SLOTS_INV = 9*4;
const SLOTS_SCRATCH = 9 + 1 + 1;

const FURNACE_INDEX_FUEL  = 0;
const FURNACE_INDEX_COOK  = 1;
const FURNACE_INDEX_OUT   = 2;
const FURNACE_INDEX_COUNT = 3;

let state = {
  view_dist: 3,

  tick: 0,
  screen: SCREEN_WORLD,
  screen_block_coord: 0,

  inv: {
    items: [...Array(SLOTS_INV + SLOTS_SCRATCH)].fill(0),
    held_i: 0,
  },

  chat: [
    { msg: "CEDCRAFT version 0.0.3 \"rybek\"", ts_in: Date.now() + 1600, ts_out: Date.now() + 10_600 },
    { msg: "<tab> for inventory",  ts_in: Date.now() + 1700, ts_out: Date.now() + 10_700 },
    { msg: "/help for cmd list",   ts_in: Date.now() + 1800, ts_out: undefined           }
  ],

  chunks: {},

  items: [
    { pos: [2.5, 1.2, 3.5], id: ID_BLOCK_WOOD , amount: 1 },
    { pos: [4.5, 1.2, 3.5], id: ID_BLOCK_GRASS, amount: 1 },
    { pos: [6.5, 1.2, 3.5], id: ID_BLOCK_DIRT , amount: 1 },
  ],
  zombies: [
    // { pos: [2.5, 1.2, 3.5] },
    // { pos: [4.5, 1.2, 3.5] },
    // { pos: [6.5, 1.2, 3.5] },
  ],

  cam:      { yaw_deg: 130, pitch_deg: -20 },
  last_cam: { yaw_deg: 130, pitch_deg: -20 },
  pos:      [0, 43.1, 6],
  last_pos: [0, 43.1, 6],

  keysdown: {},
  mousedown:          0,
  mousedown_right:    0,
  ts_mousedown_right: Date.now(),
  mouseclick_double:  0,
  mouseclick:         0,
  mousepos: { x: 0, y: 0 },

  /* ticks for physics, timestamps for animations */
  mining:  { ts_start: Date.now(), ts_end: Date.now(), block_coord: undefined, tool_inv_i: undefined },
  using:   { ts_start: Date.now(), ts_end: Date.now() },
  jumping: { tick_start:        0, tick_end:        0, tick_grounded: 0 },
};
state.inv.items[0] = { id: ID_ITEM_T1_SPADE, amount: 1  };
state.inv.items[1] = { id: ID_ITEM_T1_PICK , amount: 1  };
state.inv.items[2] = { id: ID_ITEM_T1_AXE  , amount: 1  };
state.inv.items[3] = { id: ID_ITEM_BONEMEAL, amount: 10 };
state.inv.items[4] = { id: ID_BLOCK_SAPLING, amount: 10 };
state.inv.items[5] = { id: ID_ITEM_T1_PICK , amount: 1 };
state.inv.items[6] = { id: ID_ITEM_T1_PICK , amount: 1 };

const saves_db = (() => {
  let _db;
  const _db_load = new Promise(res => {
    const req = indexedDB.open("cedcraft_data", 1);
    req.onupgradeneeded = () => {
      const db = event.target.result;
      db.createObjectStore("saves", { keyPath: "save_name" });
    };
    req.onsuccess = e => {
      _db = e.target.result;
      res(e.target.result);
    }
  });
  return async () => (_db ?? await _db_load);
})();

const saves_put = save_name => new Promise(async res => {
  const chunks = {};
  for (const chunk_key in state.chunks) {
    const chunk = state.chunks[chunk_key];

    const genned = (chunk.genned == CHUNK_GEN_DONE) ? CHUNK_GEN_DONE : CHUNK_GEN_NO;
    chunks[chunk_key] = { ...chunk, genned, geo: undefined, light: undefined };
  }
  (await saves_db())
    .transaction(["saves"], "readwrite")
    .objectStore("saves")
    .put({ ...state, chunks, save_name })
    .onsuccess = res;
});

const saves_load = save_name => new Promise(async res => {
  (await saves_db())
    .transaction(["saves"])
    .objectStore("saves")
    .get(save_name)
    .onsuccess = e => {
      if (e.target.result == undefined) {
        res("no such save");
        return;
      }

      const { keysdown } = state;
      state = e.target.result;
      state.keysdown = keysdown;

      for (const chunk_key in state.chunks) {
        const chunk = state.chunks[chunk_key]; 
        chunk.light = new Uint8Array(MAP_SIZE*MAP_SIZE*MAX_HEIGHT);
        chunk.dirty = 1;
      }
      light_recalc();
      res();
    };
});

const saves_list = () => new Promise(async res => {
  (await saves_db())
    .transaction(["saves"])
    .objectStore("saves")
    .getAllKeys()
    .onsuccess = e => res(e.target.result);
});

const CHUNK_GEN_NO         = 0;
const CHUNK_GEN_WIP        = 1; /* no blocks yet, chunk gen requested */
const CHUNK_GEN_DONE       = 3;

const modulo = (n, d) => ((n % d) + d) % d;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const map_index = (x, y, z) => modulo(x, MAP_SIZE)    *MAP_SIZE*MAX_HEIGHT +
                               clamp(y, 0, MAX_HEIGHT)*MAP_SIZE +
                               modulo(z, MAP_SIZE);
function *map_chunks_near(pos, range=state.view_dist) {
  const c_x = Math.floor(pos[0] / MAP_SIZE);
  const c_z = Math.floor(pos[2] / MAP_SIZE);

  for (let o_x = -range; o_x <= range; o_x++)
    for (let o_z = -range; o_z <= range; o_z++)
      yield (c_x+o_x) + ',' + (c_z+o_z);
}
const map_chunk_add = (x, y, z) => {
  const c_x = Math.floor(x / MAP_SIZE);
  const c_z = Math.floor(z / MAP_SIZE);
  const chunk_key = c_x + ',' + c_z;

  state.chunks[chunk_key] = {
    chunk_key,
    genned: CHUNK_GEN_NO,
    dirty: true,
    incidentals: false,
    x: c_x*MAP_SIZE,
    z: c_z*MAP_SIZE,
    map: new Uint8Array(MAP_SIZE * MAX_HEIGHT * MAP_SIZE),
    light_src: new Uint8Array(MAP_SIZE * MAX_HEIGHT * MAP_SIZE).fill(MAX_LIGHT),
    light:     new Uint8Array(MAP_SIZE * MAX_HEIGHT * MAP_SIZE),
    data: {}, /* same indices as map, has extra data tailored to map id */
  };

  /* non-existent lookups must be expensive, or maybe this serves as
   * an allocation hint. either way, profiler (seems to) like having it */
  for (let i = 0; i < MAP_SIZE * MAX_HEIGHT * MAP_SIZE; i++)
    state.chunks[chunk_key].data[i] = undefined;

  return state.chunks[chunk_key];
}
const map_chunk = (x, y, z) => {
  const c_x = Math.floor(x / MAP_SIZE);
  const c_z = Math.floor(z / MAP_SIZE);
  const chunk_key = c_x + ',' + c_z;
  return state.chunks[chunk_key];
}
const map_get  = (x, y, z   ) =>  map_chunk(x, y, z).map [map_index(x, y, z)];
const map_data = (x, y, z   ) =>  map_chunk(x, y, z).data[map_index(x, y, z)] ??= {};
const map_light_set     = (x, y, z, v) => map_chunk(x, y, z).light    [map_index(x, y, z)] = v;
const map_light         = (x, y, z   ) => map_chunk(x, y, z).light    [map_index(x, y, z)];
const map_light_src_set = (x, y, z, v) => map_chunk(x, y, z).light_src[map_index(x, y, z)] = v;
const map_light_src     = (x, y, z   ) => map_chunk(x, y, z).light_src[map_index(x, y, z)];
const map_set  = (x, y, z, v) => {
  const chunk = map_chunk(x, y, z);
  const v_before = chunk.map[map_index(x, y, z)];
  chunk.map[map_index(x, y, z)] = v;

  const clear_v_before = VOXEL_RENDER_STAGE[v_before] == 2;
  const clear_v        = VOXEL_RENDER_STAGE[v       ] == 2;
  if (v_before != v && !(clear_v_before && clear_v))
    chunk.dirty = 1;
};

function state_drop(i, amt) {
  const itms = state.inv.items;
  if (itms[i] != 0) {
    const id = itms[i].id;
    const vel = mul3_f(cam_looking(), 0.12);
    const dir = norm(add3(cam_looking(), [Math.random()*0.1, 1, Math.random()*0.1]));
    const pos = add3(state.pos, mul3_f(dir, 1.5));
    const amount = Math.min(itms[i].amount, amt ?? itms[i].amount);
    state.items.push({ vel, pos, id, amount });

    itms[i].amount -= amount;
    if (itms[i].amount == 0)
      itms[i] = 0;
  }
}

function place_tree(t_x, t_y, t_z) {
  const height = 4 + (Math.random() < 0.4) +
                     (Math.random() < 0.3);

  for (let i = 0; i < height; i++)
    map_set(t_x, t_y++, t_z, ID_BLOCK_LOG);
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
        {
          const [x, y, z] = add3(p, heart);
          if (map_get(x, y, z) != ID_BLOCK_NONE) continue;
          map_set(x, y, z, ID_BLOCK_LEAVES);
        }
      }
}

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
    const exists = map_chunk(new_block[0], new_block[1], new_block[2]);
    const md = exists ? map_data(new_block[0], new_block[1], new_block[2]) : {};
    const block = exists ? map_get(new_block[0], new_block[1], new_block[2]) : ID_BLOCK_STONE;

    let hard = 1;
    const   delta = new_pos[i] - pos[i];
    if (block == ID_BLOCK_NONE)    hard = 0;
    if (block == ID_BLOCK_SAPLING) hard = 0;
    if (block == ID_BLOCK_TORCH  ) hard = 0;
    if (block == ID_BLOCK_FLOWER0) hard = 0;
    if (block == ID_BLOCK_FLOWER1) hard = 0;
    if (block == ID_BLOCK_FLOWER2) hard = 0;
    if (block == ID_BLOCK_STAIRS) {
      /*  i == 0 && delta < 0 */

      if (md && md.axis) {
        const stair_i = (md.axis[0] != 0) ? 0 : 2;
        const neg = md.axis[stair_i] < 0;

        const delta = new_pos[stair_i] - new_block[stair_i];
        const x_frac = neg ? (1 - delta) : delta;

        const y_frac = new_pos[1] - new_block[1];
        const ramp = y_frac > (x_frac + 0.2);
        if (ramp) hard = 0;
      }
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

    coord: [0, 0, 0],
    last_coord: [0, 0, 0],
  };

  // calculate distances to axis boundaries and direction of discrete DDA steps
  const map = [Math.floor(ray_origin[0]),
               Math.floor(ray_origin[1]),
               Math.floor(ray_origin[2]) ];
  const delta_dist = [0, 0, 0];
  const step = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const x = (ray_direction[0] / ray_direction[i]);
    const y = (ray_direction[1] / ray_direction[i]);
    const z = (ray_direction[2] / ray_direction[i]);
    delta_dist[i] = Math.sqrt(x*x + y*y + z*z);
    if (ray_direction[i] < 0) {
      step[i] = -1;
      ret.impact[i] = (ray_origin[i] - map[i]) * delta_dist[i];
    } else {
      step[i] = 1;
      ret.impact[i] = (map[i] + 1 - ray_origin[i]) * delta_dist[i];
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

    ret.impact[ret.side] += delta_dist[ret.side];
    map[ret.side] += step[ret.side];

    /* out of bounds */
    if (map[1] >= MAX_HEIGHT || map[1] < 0) break;
    if (map_chunk(map[0], map[1], map[2]) == undefined) break;

    // sample volume data at calculated position and make collision calculations
    ret.last_coord = ret.coord;
    ret.coord = [map[0], map[1], map[2]];

    // closest voxel is found, no more work to be done
    const vox = map_get(map[0], map[1], map[2]);
    if (vox != ID_BLOCK_NONE && vox != ID_BLOCK_WATER) return ret;
  }

  ret.coord = undefined;
  return ret;
}

window.ondblclick = e => state.mouseclick_double = 1;
window.oncontextmenu = e => { e.preventDefault(); return false; };
window.onmousedown = e => {
  if (e.button == 0) state.mousedown = state.mouseclick = 1;

  if (e.button == 2 && state.screen != SCREEN_WORLD) {
    e.preventDefault();
    state.mousedown_right = 1;
    state.ts_mousedown_right = Date.now();
    return false;
  }

  if (state.screen == SCREEN_WORLD)
    document
      .getElementById("p1")
      .requestPointerLock({ unadjustedMovement: true });

  e.preventDefault();

  if (!document.pointerLockElement) return;

  const cast = ray_to_map(cam_eye(), cam_looking());
  if (cast.coord == undefined) return;
  const p = [...cast.coord];

  const i = state.inv;
  if (e.button == 2 && state.screen == SCREEN_WORLD) {
    const block = map_get(p[0], p[1], p[2]);

    if (block == ID_BLOCK_TABLE) {
      state.screen = SCREEN_TABLE;
      state.screen_block_coord = p;
      document.exitPointerLock();
      return;
    }
    if (block == ID_BLOCK_FURNACE0 ||
        block == ID_BLOCK_FURNACE1) {
      state.screen = SCREEN_FURNACE;
      state.screen_block_coord = p;
      document.exitPointerLock();
      return;
    }
  }

  if (e.button == 2 && state.screen == SCREEN_WORLD && i.items[i.held_i]) {
    if (cast.coord) {
      /* use up x1 of held item */ 
      const consume = () => {
        state.using.ts_start = Date.now();
        state.using.ts_end   = Date.now() + 350;

        held.amount--;
        if (held.amount == 0)
          i.items[i.held_i] = 0;
      };

      const held = i.items[i.held_i];
      if (held.id <= ID_BLOCK_LAST) {
        /* place block */
        p[cast.side] -= cast.dir;
        map_set(p[0], p[1], p[2], held.id);

        let axised = 0;
        let mirrored = 0;
        let flattened = 0;
        if (held.id == ID_BLOCK_LOG   ) axised = mirrored = 1;
        if (held.id == ID_BLOCK_STAIRS) axised = flattened = 1;
        if (axised) {
          const center = add3(p, [0.5, 0.5, 0.5]);
          const delta = sub3(state.pos, center);

          let best_i = 0;
          for (let i = 1; i <= 2; i++) {
            if (flattened && i == 1) continue;
            if (Math.abs(delta[best_i]) < Math.abs(delta[i]))
              best_i = i;
          }

          const axis = [0, 0, 0];
          axis[best_i] = Math.sign(delta[best_i]);

          if (mirrored)
            axis[0] = Math.abs(axis[0]),
            axis[1] = Math.abs(axis[1]),
            axis[2] = Math.abs(axis[2]);

          map_data(p[0], p[1], p[2]).axis = axis;
        }

        consume();
      } else {
        if (held.id == ID_ITEM_BONEMEAL) {
          /* grow shit */
          const src_block = map_get(p[0], p[1], p[2]);
          const under_block = map_get(p[0], p[1] - 1, p[2]);
          const on_sap = src_block == ID_BLOCK_SAPLING;
          const on_dirt = src_block == ID_BLOCK_DIRT  ||
                          src_block == ID_BLOCK_GRASS  ;
          const over_dirt = under_block == ID_BLOCK_DIRT  ||
                            under_block == ID_BLOCK_GRASS  ;
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
                const top_x = min_x + ox;
                const top_y = p[1] + 1;
                const top_z = min_z + oz;

                if (map_get(top_x, top_y, top_z) != ID_BLOCK_NONE) continue;

                let on_top;
                {
                  if (Math.random() < (3/(3*3)))
                    on_top = (Math.random() < 0.5) ? ID_BLOCK_FLOWER0 : ID_BLOCK_FLOWER1;
                  if (Math.random() < (5/(3*3)))
                    on_top = ID_BLOCK_FLOWER2;
                }
                if (on_top) map_set(top_x, top_y, top_z, on_top);
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
  if (e.button == 2) state.mousedown_right = 0;
  if (e.button == 0) state.mousedown = 0;

  // if (!document.pointerLockElement) return;
  state.mining = { block_coord: undefined, ts_start: Date.now(), ts_end: Date.now() };
}
window.onmousemove = e => {
  if (!document.pointerLockElement) {
    state.mousepos.x = e.pageX;
    state.mousepos.y = e.pageY;
    return;
  }

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
  if (document.pointerLockElement && state.screen != SCREEN_CHAT)
    state.keysdown[e.code] = 1;

  if (state.screen == SCREEN_WORLD && e.code == 'Slash') {
    document.exitPointerLock();
    state.chat_input = "/";
    state.screen = SCREEN_CHAT;
    return;
  }
  if (state.screen == SCREEN_CHAT) {
    if (e.code == 'Enter') {
      const cmd = state.chat_input.split(' ');
      const dflt = { ts_in: Date.now(), ts_out: Date.now()+8000 };
      state.chat.push({ msg: state.chat_input, ...dflt });
      dflt.ts_in += 1; /* sorting */
      dflt.ts_out += 600;

      if (cmd[0] == '/') {
        state.chat.pop();
      }

      else if (cmd[0] == '/help') {
        state.chat.push({ msg: ' "/load" - see list of saves', ...dflt });
        state.chat.push({ msg: ' "/load [name]" - load given save', ...dflt });
        state.chat.push({ msg: ' "/save [as]" - save with given name', ...dflt });
      }

      else if (cmd[0] == "/load") {
        if (cmd.length == 1) {
          state.chat.push({ msg: "listing saves", ...dflt });
          saves_list(cmd[1]).then(saves => {
            const dflt = { ts_in: Date.now()+2, ts_out: Date.now()+8600 };
            state.chat.push({ msg: `found ${saves.length} saves`, ...dflt });
            for (const save_name of saves)
              state.chat.push({ msg: ` - "${save_name}"`, ...dflt });
          });
        }
        else if (cmd.length == 2) {
          state.chat.push({ msg: `loading ${cmd[1]} ...`, ...dflt });
          saves_load(cmd[1]).then(msg => {
            const dflt = { ts_in: Date.now()+2, ts_out: Date.now()+8600 };
            if (msg)
              state.chat.push({ msg, ...dflt });
            else
              state.chat.push({ msg: "loaded " + cmd[1], ...dflt });
          });
        }
        else if (cmd.length > 2) {
          state.chat.push({ msg: "load takes one parameter (save name) or none", ...dflt });
        }
      }

      else if (cmd[0] == '/save') {
        if (cmd.length == 2) {
          state.chat.push({ msg: `saving world as ${cmd[1]}...`, ...dflt });
          saves_put(cmd[1]).then(() => {
            const dflt = { ts_in: Date.now()+2, ts_out: Date.now()+8600 };
            state.chat.push({ msg: "world saved as " + cmd[1], ...dflt });
          });
        }
        else
          state.chat.push({ msg: "save takes one parameter (save name)", ...dflt });
      }

      /* unknown */
      else
        state.chat.push({ msg: `unknown command "${cmd}"`, ...dflt });

      document.getElementById("p1").requestPointerLock({ unadjustedMovement: true });
      state.screen = SCREEN_WORLD;
    } else if (e.key.length == 1) {
      state.chat_input += e.key;
      return;
    } else if (e.key == "Backspace") {
      state.chat_input = state.chat_input.substr(0, state.chat_input.length - 1);
    }
  }

  if (e.code == 'Tab') {
    e.preventDefault();

    if (!document.pointerLockElement) {
      document.getElementById("p1").requestPointerLock({ unadjustedMovement: true });
      state.screen = SCREEN_WORLD;

      for (let i = 0; i < SLOTS_SCRATCH; i++)
        state_drop(SLOTS_INV + i);

    } else if (document.pointerLockElement) {
      document.exitPointerLock();
      state.screen = SCREEN_INV;
    }
  }

  if (e.ctrlKey && e.key == 's') {
    saves_put("cedtopia");
    e.preventDefault();
  }
  if (e.ctrlKey && e.key == 'd') {
    e.preventDefault();
    saves_load("cedtopia");
  }

  if (e.code == "KeyQ") state_drop(state.inv.held_i, 1);

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
function cam_view_proj() {
  const proj = mat4_create();

  if (0)
    mat4_ortho(proj, -5.0, 5.0, -5.0, 5.0, -1.0, 100);

  if (1) mat4_perspective(
    proj,
    FIELD_OF_VIEW,
    window.innerWidth / window.innerHeight,
    0.005,
    100
  );
  
  let eye = cam_eye();
  /* don't let eye get too close to block */
  {
    const eye_p = [Math.floor(eye[0]),
                   Math.floor(eye[1]),
                   Math.floor(eye[2])];
    const center = [eye_p[0] + 0.5,
                    eye_p[1] + 0.5,
                    eye_p[2] + 0.5];
    const delta = sub3(eye, center);

    for (let axis = 0; axis < 3; axis++) {
      const dir = Math.sign(delta[axis]);
      const p = [...eye_p];
      p[axis] += dir;

      let mag = Math.abs(delta[axis])
      if (map_get(p[0], p[1], p[2]) != ID_BLOCK_NONE)
        mag = Math.min(0.45, mag);
      center[axis] += dir * mag;
    }

    eye = center;
  }

  const view = mat4_create();
  mat4_target_to(view, eye, add3(cam_looking(), eye));
  mat4_invert(view, view);

  mat4_mul(proj, proj, view);
  return proj;
}

function geo_draw(geo, gl, program_info, u_mvp) {
  const glbuf_pos     = geo.gpu_position;
  const glbuf_indices = geo.gpu_indices;
  const idxs_used     = geo.idx_i;

  gl.bindBuffer(gl.ARRAY_BUFFER, glbuf_pos);
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
      /* numComponents */ 2,
      /* type          */ gl.UNSIGNED_BYTE,
      /* normalize     */ false,
      /* stride        */ VERT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      /* offset        */           6 * Float32Array.BYTES_PER_ELEMENT,
    );
    gl.enableVertexAttribArray(program_info.attrib_locations.a_tex_i);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glbuf_indices);
  gl.useProgram(program_info.program);

  gl.uniformMatrix4fv(
    program_info.uniform_locations.u_mvp,
    false,
    u_mvp
  );

  {
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, idxs_used, type, offset);
  }
}

function init_shader_program(gl) {
  const vs_source = `
    attribute vec4 a_vpos;
    attribute vec2 a_uv;
    attribute vec2 a_tex_i;

    uniform mat4 u_mvp;

    varying lowp vec4 v_color;
    varying lowp vec2 v_texcoord;

    void main(void) {
      gl_Position = u_mvp * a_vpos;
      v_texcoord = a_uv;

      float light = a_tex_i.x / 255.0;
      bool biomed = mod(floor(a_tex_i.y / 1.0), 2.0) == 1.0;
      bool cleary = mod(floor(a_tex_i.y / 2.0), 2.0) == 1.0;

      v_color = vec4(1.0);
      if (biomed)
        v_color.xyz = mix(
          vec3(0.412, 0.765, 0.314) + 0.1,
          vec3(0.196, 0.549, 0.235) + 0.1,
          0.1
        );
      v_color.xyz *= light;

      if (cleary)
        v_color.a -= 0.8;

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
  const furnace = new Image(); furnace.src = './furnace.png';
  const  hotbar = new Image();  hotbar.src = './hotbar.png' ;
  const  zombie = new Image();  zombie.src = './zombie.png' ;
  const   items = new Image();   items.src = './items.png'  ;
  const   table = new Image();   table.src = './table.png'  ;
  const    font = new Image();    font.src = './font.png'   ;
  const     sky = new Image();     sky.src = './sky.png'    ;
  const     inv = new Image();     inv.src = './inv.png'    ;
  await Promise.all([
    new Promise(res => terrain.onload = res),
    new Promise(res => furnace.onload = res),
    new Promise(res =>  hotbar.onload = res),
    new Promise(res =>  zombie.onload = res),
    new Promise(res =>   items.onload = res),
    new Promise(res =>   table.onload = res),
    new Promise(res =>    font.onload = res),
    new Promise(res =>     sky.onload = res),
    new Promise(res =>     inv.onload = res),
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
      let hit = false;
      for (let y = 0; y < 8; y++) {
        hit ||= !!font_px[((ltr_y*8 + y)*128 + (ltr_x*8 + x))*4+3];
      }
      if (hit) width = x+1;
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
  ss_ctx.drawImage(terrain, 0    , 0    , terrain.width, terrain.height);
  ss_ctx.drawImage(furnace, w*4  , 0    , terrain.width, terrain.height);
  ss_ctx.drawImage( hotbar, w    , h    , terrain.width, terrain.height);
  ss_ctx.drawImage( zombie, w*1.5, h*1.5,  zombie.width,  zombie.height);
  ss_ctx.drawImage(  items, w    , 0    , terrain.width, terrain.height);
  ss_ctx.drawImage(  table, w*3  , 0    , terrain.width, terrain.height);
  ss_ctx.drawImage(   font, 0    , h    , terrain.width, terrain.height);
  ss_ctx.drawImage(    sky, 0    , h*2  ,     sky.width,     sky.height);
  ss_ctx.drawImage(    inv, w*2  , 0    , terrain.width, terrain.height);

  /* generate translucent white hover-selector tex */
  {
    const tex_o = SS_COLUMNS*11 + 24;
    const u =           (tex_o % SS_COLUMNS) / SS_COLUMNS * SPRITESHEET_SIZE;
    const v = Math.floor(tex_o / SS_COLUMNS) / SS_COLUMNS * SPRITESHEET_SIZE;
    ss_ctx.globalAlpha = 0.2;
    ss_ctx.fillStyle = "white";
    ss_ctx.fillRect(u, v, 16, 16);
    ss_ctx.globalAlpha = 1.0;
  }

  /* generate item durability bar texture */
  for (let i = 0; i < 16; i++) {
    const tex_o = SS_COLUMNS*11 + 23;
    const u =           (tex_o % SS_COLUMNS) / SS_COLUMNS * SPRITESHEET_SIZE;
    const v = Math.floor(tex_o / SS_COLUMNS) / SS_COLUMNS * SPRITESHEET_SIZE;
    const hue = (i - 1)/15 * 120;
    ss_ctx.fillStyle = (i == 0) ? 'black' : `hsl(${hue}, 90%, 60%)`;
    ss_ctx.fillRect(u + i, v, 1, i ? i : 16);
  }

  gl_upload_image(gl, spritesheet, 0);
}

function tick_light_src(chunk, __x, __y, __z) {
  const chunk_index = map_index(__x, __y, __z);
  if (VOXEL_PERFECT[chunk.map[chunk_index]] &&
      chunk.map[chunk_index] != ID_BLOCK_FURNACE1 &&
      chunk.map[chunk_index] != ID_BLOCK_FURNACE0
  ) return;

  let light = 0;
  if (__y == (MAX_HEIGHT-1))
    light = LIGHT_SRC_SUN;
  else if (chunk.map[chunk_index] == ID_BLOCK_FURNACE1)
    light = LIGHT_SRC_TORCH;
  else if (chunk.map[chunk_index] == ID_BLOCK_TORCH)
    light = LIGHT_SRC_TORCH;
  else {
    const above_i = map_index(__x, __y+1, __z);
    const above_light = VOXEL_PERFECT[chunk.map[above_i]] ? 0 : chunk.light_src[above_i];
    if (above_light == LIGHT_SRC_SUN)
      light = above_light;
  }

  if (chunk.light_src[chunk_index] != light) {
    chunk.light_src[chunk_index] = light;
    return 1;
  }
  return 0;
}

const SEC_IN_TICKS = 60;
const light_worker = new Worker("light_worker.js");
const worldgen_worker = new Worker("worldgen_worker.js");
function tick() {
  const pending_map_set = []; 
  const pending_height_set = []; 
  let pending_light_set = []; 

  for (const chunk_key of map_chunks_near(state.pos, 1)) {
    const chunk = state.chunks[chunk_key];
    if (chunk == undefined) continue;

    const __y = MAX_HEIGHT - 1 - (state.tick % MAX_HEIGHT);

    let any_change = 0;
    for (let __x = 0; __x < MAP_SIZE; __x++) 
      for (let __z = 0; __z < MAP_SIZE; __z++) {
        if (tick_light_src(chunk, __x, __y, __z))
          any_change = 1;
      }
    if (any_change) {
      for (let __y = 0; __y < MAX_HEIGHT; __y++) 
        for (let __x = 0; __x < MAP_SIZE; __x++) 
          for (let __z = 0; __z < MAP_SIZE; __z++)
            tick_light_src(chunk, __x, MAX_HEIGHT -1 - __y, __z);

      const { x, z, light_src } = chunk;
      light_worker.postMessage({ chunk: { key: chunk_key, x, z, light_src } });
      light_worker.postMessage({ compute: 1, around: state.pos });
    }
  }
  state.tick++;

  for (const chunk_key of map_chunks_near(state.pos, 1)) {
    const chunk = state.chunks[chunk_key];
    if (chunk == undefined) continue;

    const __y = MAX_HEIGHT - 1 - (state.tick % MAX_HEIGHT);

    for (let __x = 0; __x < MAP_SIZE; __x++) 
      for (let __z = 0; __z < MAP_SIZE; __z++) {

        const chunk_index = map_index(__x, __y, __z);
        let block_id = chunk.map[chunk_index];
        if (block_id == ID_BLOCK_NONE) continue;

        const t_x = __x + chunk.x;
        const t_y = __y;
        const t_z = __z + chunk.z;

        if (block_id == ID_BLOCK_WATER) {
          map_data(t_x, t_y, t_z).height ??= 5;
          const height = map_data(t_x, t_y, t_z).height;
          const under = map_get(t_x, t_y-1, t_z) != ID_BLOCK_NONE &&
                        map_get(t_x, t_y-1, t_z) != ID_BLOCK_WATER;

          if (height != 1 && under)
            for (let i = 0; i < 4; i++) {
              const n_x = t_x + nbrs[i][0];
              const n_y = t_y;
              const n_z = t_z + nbrs[i][1];
              const nbr = map_get(n_x, n_y, n_z);

              let spread = false;
              if (nbr == ID_BLOCK_FLOWER0) spread = 1;
              if (nbr == ID_BLOCK_FLOWER1) spread = 1;
              if (nbr == ID_BLOCK_FLOWER2) spread = 1;
              if (nbr == ID_BLOCK_NONE   ) spread = 1;

              if (spread) {
                pending_height_set.push([n_x, n_y, n_z, height-1]);
                pending_map_set.push([n_x, n_y, n_z, ID_BLOCK_WATER]);
              }
            }
          if (!under) {
            pending_height_set.push([t_x, t_y-1, t_z, 5]);
            pending_map_set.push([t_x, t_y-1, t_z, ID_BLOCK_WATER]);
          }
        }

        if (block_id == ID_BLOCK_FLOWER0 ||
            block_id == ID_BLOCK_FLOWER1 ||
            block_id == ID_BLOCK_FLOWER2
        ) {
          const under = chunk.map[map_index(__x, __y-1, __z)];
          if (!(under == ID_BLOCK_DIRT || under == ID_BLOCK_GRASS))
            pending_map_set.push([t_x, t_y, t_z, ID_BLOCK_NONE]);
        }

        if (block_id == ID_BLOCK_GRASS && Math.random() < 0.04) {
          const over = chunk.map[map_index(__x, __y+1, __z)];
          if (VOXEL_PERFECT[over])
            pending_map_set.push([t_x, t_y, t_z, ID_BLOCK_DIRT]);
          else {
            const w_x = t_x + Math.round(lerp(-1.5, 1.5, Math.random()));
            const w_y = t_y;
            const w_z = t_z + Math.round(lerp(-1.5, 1.5, Math.random()));
            if (
              map_chunk(w_x, w_y, w_z) &&
              map_get(w_x, w_y, w_z) == ID_BLOCK_DIRT &&
              !VOXEL_PERFECT[map_get(w_x, w_y+1, w_z)]
            )
              pending_map_set.push([w_x, w_y, w_z, ID_BLOCK_GRASS]);
          }
        }

        if (block_id == ID_BLOCK_LEAVES) {
          let decay = 1;
          for (let o_x = -2; o_x <= 2; o_x++) 
            for (let o_y = -2; o_y <= 2; o_y++) 
              for (let o_z = -2; o_z <= 2; o_z++) {
                if (!map_chunk(o_x + t_x, o_y + t_y, o_z + t_z)) continue;
                const nbr = map_get(o_x + t_x, o_y + t_y, o_z + t_z);
                if (nbr == ID_BLOCK_LOG) decay = 0;
              }

          if (decay && (Math.random() < 0.1))
            pending_map_set.push([t_x, t_y, t_z, ID_BLOCK_NONE]);
        }

        if (
          block_id == ID_BLOCK_FURNACE0 ||
          block_id == ID_BLOCK_FURNACE1
        ) {
          const burn_look_ticks = SEC_IN_TICKS; 

          map_data(t_x, t_y, t_z).furnace ??= {
            inv:             [...Array(3)].fill(0),
            tick_burn_end:   state.tick - burn_look_ticks,
            tick_cook_end:   state.tick - burn_look_ticks,
            tick_burn_start: state.tick - burn_look_ticks,
            tick_cook_start: state.tick - burn_look_ticks,
            id_cook_out:     undefined,
          };
          const md = map_data(t_x, t_y, t_z).furnace;

          const furnace_inv = md.inv;
          let cooking = state.tick < md.tick_cook_end;
          let burning = state.tick < md.tick_burn_end;
          let burning_look = state.tick < (md.tick_burn_end + burn_look_ticks);

          let would_cook_out = undefined;
          if (furnace_inv[FURNACE_INDEX_COOK].id == ID_BLOCK_COBBLE) would_cook_out = ID_BLOCK_STONE;
          if (furnace_inv[FURNACE_INDEX_COOK].id == ID_BLOCK_LOG   ) would_cook_out = ID_ITEM_COAL;
          if (furnace_inv[FURNACE_INDEX_COOK].id == ID_BLOCK_ORE_T2) would_cook_out = ID_ITEM_T2_INGOT;

          let would_burn_for = undefined;
          if (furnace_inv[FURNACE_INDEX_FUEL].id == ID_BLOCK_LOG    ) would_burn_for = 1.0;
          if (furnace_inv[FURNACE_INDEX_FUEL].id == ID_ITEM_COAL    ) would_burn_for = 3.0;
          if (furnace_inv[FURNACE_INDEX_FUEL].id == ID_BLOCK_WOOD   ) would_burn_for = 0.5;
          if (furnace_inv[FURNACE_INDEX_FUEL].id == ID_BLOCK_SAPLING) would_burn_for = 0.1;
          would_burn_for = Math.floor(SEC_IN_TICKS*would_burn_for);

          if (md.id_cook_out && md.tick_cook_end <= state.tick) {
            if (furnace_inv[FURNACE_INDEX_OUT] == 0)
              furnace_inv[FURNACE_INDEX_OUT] = { amount: 1, id: md.id_cook_out };
            else
              furnace_inv[FURNACE_INDEX_OUT].amount++;
            md.id_cook_out = undefined;
          }

          map_set(t_x, t_y, t_z, burning_look ? ID_BLOCK_FURNACE1 : ID_BLOCK_FURNACE0);

          const out_slot_ready = (
            furnace_inv[FURNACE_INDEX_OUT] == 0 ||
            would_cook_out == furnace_inv[FURNACE_INDEX_OUT].id
          );

          if (
            !burning       &&
            would_cook_out &&
            would_burn_for &&
            out_slot_ready
          ) {
            burning = 1;

            furnace_inv[FURNACE_INDEX_FUEL].amount--;
            if (furnace_inv[FURNACE_INDEX_FUEL].amount == 0)
              furnace_inv[FURNACE_INDEX_FUEL] = 0;

            md.tick_burn_start = state.tick;
            md.tick_burn_end   = state.tick + would_burn_for;
          }

          if (burning && !cooking && out_slot_ready && would_cook_out) {
            cooking = 1;

            furnace_inv[FURNACE_INDEX_COOK].amount--;
            if (furnace_inv[FURNACE_INDEX_COOK].amount == 0)
              furnace_inv[FURNACE_INDEX_COOK] = 0;

            md.id_cook_out = would_cook_out;
            md.tick_cook_start = state.tick;
            md.tick_cook_end   = state.tick + SEC_IN_TICKS;
          }
        }
      }
  }
  pending_map_set.forEach(([x, y, z, v]) => map_set(x, y, z, v));
  pending_height_set.forEach(([x, y, z, v]) => map_data(x, y, z, v).height = v);
  pending_light_set.forEach(([x, y, z, v]) => {
    if (map_light(x, y, z) != v) {
      map_light_set(x, y, z, v);
      map_chunk(x, y, z).dirty = 1;
    }
  });

  /* apply gravity to items */
  for (const i of state.items) {
    i.vel ??= [0, 0, 0];

    i.vel[1] -= 0.35/SEC_IN_TICKS;
    i.pos = add3(i.pos, i.vel);

    let hit = pin_to_empty(i);
    if (hit) {
      i.vel[0] *= 0.9;
      if (hit[1]) i.vel[1]  = 0;
      i.vel[2] *= 0.9;
    }
  }

  /* filter out items that get close to the player */
  state.items = state.items.filter(item => {
    if (mag3(sub3(item.pos, state.pos)) < 1.5) {

      /* find place for item in inventory */
      for (let j = 0; j < item.amount; j++)
        (() => {
          for (const i in state.inv.items)
            if (
              state.inv.items[i].id == item.id &&
              state.inv.items[i].amount < ITEM_STACK_SIZE[item.id]
            ) {
              state.inv.items[i].amount++;
              return;
            }
          for (const i in state.inv.items)
            if (!state.inv.items[i]) {
              state.inv.items[i] = { id: item.id, amount: 1 };
              return;
            }
        })();

      return false;
    }
    return true;
  });

  /* update zombies */
  let z_i = 0;
  for (const z of state.zombies) {
    z_i++;

    let target = [0, z.pos[1], 0];
    {
      const dist = mag3(sub3([state.pos[0], 0, state.pos[2]],
                             [    z.pos[0], 0,     z.pos[2]]));

      /* fuzz target slightly to distribute enemies in ring around player */
      let ring_size = dist * 0.3;
      if (ring_size < 2.0) ring_size = 2.0;

      /* golden ratio should give us evenish ring distribution around target */
      const GOLDEN_RATIO = 1.61803;
      target[0] = state.pos[0] + Math.cos(GOLDEN_RATIO*z_i) * ring_size
      target[2] = state.pos[2] + Math.sin(GOLDEN_RATIO*z_i) * ring_size
    }
    const delta = sub3(target, z.pos);
    const delta_mag = mag3(delta);
    let speed = 0.04;
    if (delta_mag < 2.0)
      speed *= inv_lerp(1.1, 2.0, delta_mag);
    z.pos = add3(z.pos, mul3_f(norm(delta), speed));

    z.vel ??= 0;
    z.vel -= 0.09/SEC_IN_TICKS;
    z.pos[1] += z.vel;
    if (pin_to_empty(z)) z.vel = 0;
  }

  /* player movement */
  {
    let jumping_off = 0;
    {
      const elapsed = state.tick - state.jumping.tick_start;
      if (elapsed > 0 && elapsed < 0.08*SEC_IN_TICKS)
        state.vel += 2.0/SEC_IN_TICKS;
      if (elapsed > 0 && elapsed < 0.10*SEC_IN_TICKS)
        jumping_off = 1;
    }

    state.tick_start_move ??= 0;
    state.vel ??= 0;
    state.delta ??= [0, 0, 0];

    state.vel -= 0.35/SEC_IN_TICKS;
    state.pos[1] += state.vel;

    {
      const grounded = state.jumping.grounded || jumping_off;
      const fwd = cam_looking(); fwd[1] = 0; norm(fwd);
      const side = cross3(VEC3_UP, fwd);

      /* 0..0.1 instead of 0..1 simply for legacy reasons */
      let delta = [0, 0, 0];
      let move = 0;
      if (state.keysdown['KeyW']) move = 1, delta = add3(delta, mul3_f( fwd,  0.1));
      if (state.keysdown['KeyS']) move = 1, delta = add3(delta, mul3_f( fwd, -0.1));
      if (state.keysdown['KeyA']) move = 1, delta = add3(delta, mul3_f(side,  0.1));
      if (state.keysdown['KeyD']) move = 1, delta = add3(delta, mul3_f(side, -0.1));

      /* movement starts slow */
      let t = 0;
      let delta_t = 0;
      if (!grounded) {
        delta_t = 0.1;

        t = 0.25;
      } else {
        delta_t = 0.05;

        const elapsed = state.tick - state.tick_start_move - 1;
        if (elapsed > 0) t = ease_out_circ(Math.min(1, elapsed / (0.1*SEC_IN_TICKS)));

        if (!move) state.tick_start_move = state.tick;

        /* slower if you've just hit the ground */
        if (!move) {
          let grounded_t = (state.tick - state.jumping.tick_grounded) / (0.1*SEC_IN_TICKS);
          grounded_t = ease_out_circ(grounded_t);
          if (grounded_t < 1)
            delta = mul3_f(state.delta, 0.1*grounded_t);
        }
      }
      state.pos[0] += state.delta[0]*delta_t;
      state.pos[2] += state.delta[2]*delta_t;

      delta = mul3_f(delta, t);
      state.pos = add3(state.pos, delta);
      if (grounded) state.delta = mul3_f(state.delta, (grounded) ? 0.8 : 0.5);
      if (grounded) state.delta = add3(state.delta, delta);

      /* stairs hack (works goodish) */
      if (grounded) for (let i = 0; i <= 2; i++) {
        const block = [Math.floor(state.pos[0]),
                       Math.floor(state.pos[1] + 0.01*i),
                       Math.floor(state.pos[2])];
        const last_block = map_get(block[0], block[1], block[2]);
        const md = map_data(block[0], block[1], block[2]);

        if (md && md.axis && last_block == ID_BLOCK_STAIRS) {
          const delta_i = (md.axis[0] != 0) ? 0 : 2;
          const push = Math.sign(md.axis[delta_i]) * delta[delta_i];

          if (push > 0.06) {
            state.pos[1] += 0.1;
            state.vel += 3.75/SEC_IN_TICKS;
            state.jumping.tick_end = state.tick + 0.2*SEC_IN_TICKS;
            state.tick_start_move = state.tick;
          }
          else if (Math.abs(push) > 0.01) {
            state.pos[1] += 0.04;
          }

          if (push < -0.04) {
            state.jumping.tick_end = state.tick + 0.2*SEC_IN_TICKS;
            state.vel += 3.75/SEC_IN_TICKS;
          }
          break;
        }
      }

    }

    /* for not going through walls head-high */
    for (let offset = 0.8; offset < 2; offset += 1.0) {
      const temp = { pos: [...state.pos], last_pos: [...state.last_pos] };
      temp.pos     [1] += offset;
      temp.last_pos[1] += offset;
      pin_to_empty(temp);

      state.pos[0] = temp.pos[0];
      state.pos[2] = temp.pos[2];
    }
    /* y - no last pos (for bumping ya head) */
    {
      const offset = 1.8;
      const temp = { pos: [...state.pos], last_pos: [...state.last_pos] };
      temp.pos     [1] += offset;
      pin_to_empty(temp);

      state.pos[0] = temp.pos[0];
      state.pos[2] = temp.pos[2];

      state.pos[1] = temp.pos[1] - offset;
    }

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

const {
  geo_cube,
  geo_mob_part,
  geo_ui_quad,
  geo_block,
} = (() => {
  const default_mat = mat4_from_translation(mat4_create(), [0.5, 0.5, 0.5]);
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
      dark_after_vert: 1e9,
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
    item: {
      positions: new Float32Array([
        0.5, 1, 0,   0.5, 1, 1,   0.5, 0, 1,    0.5, 0, 0,   // Right face
      ]),
      indices: [
         0,  1,  2,  0,  2,  3, // front
      ]
    },
  };
  const faces = models.faces = [ [], [], [] ];
  for (let x = -1; x <= 1; x += 2) {
    faces[0][x < 0] = { positions: new Float32Array(3 * 4) };
    faces[0][x < 0].indices = new Float32Array([0,  1,  2,  0,  2,  3]);

    let i = 0;
    const rest = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    for (const [y, z] of rest) 
      faces[0][x < 0].positions[i++] = inv_lerp(-1, 1, x),
      faces[0][x < 0].positions[i++] = inv_lerp(-1, 1, y),
      faces[0][x < 0].positions[i++] = inv_lerp(-1, 1, z);

    faces[0][x < 0].positions_copy = new Float32Array(faces[0][x < 0].positions);
  }
  for (let y = -1; y <= 1; y += 2) {
    faces[1][y < 0] = { positions: new Float32Array(3 * 4) };
    faces[1][y < 0].indices = new Float32Array([0,  1,  2,  0,  2,  3]);

    let i = 0;
    const rest = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    for (const [x, z] of rest) 
      faces[1][y < 0].positions[i++] = inv_lerp(-1, 1, x),
      faces[1][y < 0].positions[i++] = inv_lerp(-1, 1, y),
      faces[1][y < 0].positions[i++] = inv_lerp(-1, 1, z);

    faces[1][y < 0].positions_copy = new Float32Array(faces[1][y < 0].positions);
  }
  for (let z = -1; z <= 1; z += 2) {
    faces[2][z < 0] = { positions: new Float32Array(3 * 4) };
    faces[2][z < 0].indices = new Float32Array([0,  1,  2,  0,  2,  3]);

    let i = 0;
    const rest = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    for (const [x, y] of rest) 
      faces[2][z < 0].positions[i++] = inv_lerp(-1, 1, x),
      faces[2][z < 0].positions[i++] = inv_lerp(-1, 1, y),
      faces[2][z < 0].positions[i++] = inv_lerp(-1, 1, z);

    faces[2][z < 0].positions_copy = new Float32Array(faces[2][z < 0].positions);
  }

  function geo_cube(geo, t_x, t_y, t_z, tex_offset, opts={}) {
    const u8_cast = new Uint8Array(geo.cpu_position.buffer);
    const { dark_after_vert, positions, indices } = opts.model ?? models.cube;
    const tile_idx_i = geo.vrt_i / VERT_FLOATS;

    const GRID_SIZE = SS_COLUMNS * (opts.subgrid ?? 1);
    const recip_GRID_SIZE = 1/GRID_SIZE; /* because the profiler says so */

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
      mat4_transform_vec4(q, q, opts.view_proj ?? geo.default_view_proj);

      geo.cpu_position[geo.vrt_i++] = q[0];
      geo.cpu_position[geo.vrt_i++] = q[1];
      geo.cpu_position[geo.vrt_i++] = q[2];
      geo.cpu_position[geo.vrt_i++] = q[3];

      let corner_x, corner_y;
      if ((i/3)%4 == 0) corner_x = 0, corner_y = 0;
      if ((i/3)%4 == 1) corner_x = 1, corner_y = 0;
      if ((i/3)%4 == 2) corner_x = 1, corner_y = 1;
      if ((i/3)%4 == 3) corner_x = 0, corner_y = 1;
      let tex_size_x = opts.tex_size_x;
      let tex_size_y = opts.tex_size_y;
      tex_size_x = Array.isArray(tex_size_x) ? tex_size_x[face_i] : (tex_size_x ?? 1);
      tex_size_y = Array.isArray(tex_size_y) ? tex_size_y[face_i] : (tex_size_y ?? 1);
      const u =   (tex % GRID_SIZE) + corner_x*tex_size_x;
      const v = ~~(tex * recip_GRID_SIZE) + corner_y*tex_size_y;
      geo.cpu_position[geo.vrt_i++] = u * recip_GRID_SIZE;
      geo.cpu_position[geo.vrt_i++] = v * recip_GRID_SIZE;

      let darken = (1 - (opts.darken ?? (i >= dark_after_vert))*0.2)*255 
      if (opts.world_light)
        darken = lerp(0.15, 1, ease_out_sine(map_light(t_x, t_y, t_z) / MAX_LIGHT))*255;
      const biomed = ((opts.biomed && opts.biomed[face_i]) ?? opts.biomed) ?? 0;
      const cleary = opts.cleary ?? 0;
      const u8_i = Float32Array.BYTES_PER_ELEMENT * geo.vrt_i;
      geo.vrt_i += 1;
      u8_cast[u8_i] = darken;
      u8_cast[u8_i+1] = (biomed << 0) | (cleary << 1);
    }

    for (const i_o of indices)
      geo.cpu_indices[geo.idx_i++] = tile_idx_i+i_o;
  }

  function geo_ui_quad(geo, ortho, quad_x, quad_y, quad_w, quad_h, tex_offset, opts={}) {
    const tile_idx_i = geo.vrt_i / VERT_FLOATS;

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

      geo.cpu_position[geo.vrt_i++] = p[0];
      geo.cpu_position[geo.vrt_i++] = p[1];
      geo.cpu_position[geo.vrt_i++] = opts.z ?? 0.75;
      geo.cpu_position[geo.vrt_i++] = 1.00;

      if (opts.corner_uvs != undefined) {
        geo.cpu_position[geo.vrt_i++] = opts.corner_uvs[(i/3)%4].u;
        geo.cpu_position[geo.vrt_i++] = opts.corner_uvs[(i/3)%4].v;
      } else {
        let corner_x, corner_y;
        if ((i/3)%4 == 0) corner_x = 0, corner_y = 0;
        if ((i/3)%4 == 1) corner_x = 1, corner_y = 0;
        if ((i/3)%4 == 2) corner_x = 1, corner_y = 1;
        if ((i/3)%4 == 3) corner_x = 0, corner_y = 1;
        let u =           (tex_offset % SS_COLUMNS) + corner_x*(opts.tex_size_x ?? 1);
        let v = Math.floor(tex_offset / SS_COLUMNS) + corner_y*(opts.tex_size_y ?? 1);
        geo.cpu_position[geo.vrt_i++] = u / SS_COLUMNS;
        geo.cpu_position[geo.vrt_i++] = v / SS_COLUMNS;
      }

      const u8_cast = new Uint8Array(
        geo.cpu_position.buffer,
        Float32Array.BYTES_PER_ELEMENT * geo.vrt_i
      );
      geo.vrt_i += 1;
      const darken = opts.darken ?? 0;
      const biomed = 0;
      u8_cast[0] = (1 - darken*0.2)*255;
      u8_cast[1] = (biomed << 0);
    }

    for (const i_o of [
       0,  1,  2,  0,  2,  3, // front
    ])
      geo.cpu_indices[geo.idx_i++] = tile_idx_i+i_o;
  }

  const _mat = mat4_create();
  function geo_mob_part(geo, mat, tx, ty, scaling, opts={}) {
    const tex = [0, 0, 0, 0, 0];
    const tsx = [0, 0, 0, 0, 0];
    const tsy = [0, 0, 0, 0, 0];
    const FRONT  = 0; const BACK   = 3;
    const TOP    = 1; const BOTTOM = 4;
    const RIGHT  = 2; const LEFT   = 5;
    tsx[FRONT]  = tsx[BACK]   = Math.abs(scaling[0]);
    tsy[FRONT]  = tsy[BACK]   = Math.abs(scaling[1]);
    tsx[TOP]    = tsx[BOTTOM] = Math.abs(scaling[0]);
    tsy[TOP]    = tsy[BOTTOM] = Math.abs(scaling[2]);
    tsx[RIGHT]  = tsx[LEFT]   = Math.abs(scaling[2]);
    tsy[RIGHT]  = tsy[LEFT]   = Math.abs(scaling[1]);

    tex[FRONT]  = 4*SS_COLUMNS*(ty + tsy[TOP]) + (tx + tsx[RIGHT]);
    tex[TOP]    = 4*SS_COLUMNS*(ty           ) + (tx + tsx[RIGHT]);
    tex[RIGHT]  = 4*SS_COLUMNS*(ty + tsy[TOP]) + (tx);
    tex[BACK]   = 4*SS_COLUMNS*(ty + tsy[TOP]) + (tx + tsx[RIGHT] + tsx[FRONT] + tsx[LEFT]);
    tex[BOTTOM] = 4*SS_COLUMNS*(ty           ) + (tx + tsx[RIGHT] + tsx[FRONT]);
    tex[LEFT]   = 4*SS_COLUMNS*(ty + tsy[TOP]) + (tx + tsx[RIGHT] + tsx[FRONT]);

    mat4_mul(_mat, mat, mat4_from_scaling(mat4_create(), mul3_f(scaling, 0.25)));
    opts.mat        = _mat;
    opts.subgrid    = 4;
    opts.tex_size_x = tsx;
    opts.tex_size_y = tsy;
    geo_cube(geo, 0, 0, 0, tex, opts);
  }
  
  function geo_block(geo, t_x, t_y, t_z, block_id, opts={}) {
    const topped = (_top, rest, btm=_top) => [rest, _top, rest, rest, btm, rest];

    if ((opts.block_data      != undefined) &&
        (opts.block_data.axis != undefined) &&
        (block_id == ID_BLOCK_LOG || block_id == ID_BLOCK_STAIRS)) {
      let x, y, z;

      if (block_id == ID_BLOCK_LOG) {
        /* orthogonal bases for a matrix to point "axis" up */
        y = opts.block_data.axis;
        x = [...y];
        {
          let temp = x[2];
          x[2] = x[1];
          x[1] = x[0];
          x[0] = temp;
        }
        z = cross3(y, x);
      }
      if (block_id == ID_BLOCK_STAIRS) {
        y = [0, 1, 0];
        x = opts.block_data.axis;
        z = cross3(y, x);
      }

      const mat = mat4_from_translation(mat4_create(), [0.5, 0.5, 0.5]);
      mat[0+0] = x[0];
      mat[0+1] = x[1];
      mat[0+2] = x[2];
      mat[0+3] = mat[0+3];
      mat[4+0] = y[0];
      mat[4+1] = y[1];
      mat[4+2] = y[2];
      mat[4+3] = mat[4+3];
      mat[8+0] = z[0];
      mat[8+1] = z[1];
      mat[8+2] = z[2];
      mat[8+3] = mat[8+3];
      opts.mat = mat;
    }

    if (block_id == ID_BLOCK_TORCH  ) opts.model = models.x;
    if (block_id == ID_BLOCK_FLOWER0) opts.model = models.x;
    if (block_id == ID_BLOCK_FLOWER1) opts.model = models.x;
    if (block_id == ID_BLOCK_FLOWER2) opts.model = models.x, opts.biomed = 1;
    if (block_id == ID_BLOCK_SAPLING) opts.model = models.x;
    if (block_id == ID_BLOCK_STAIRS ) opts.model = models.stairs;

    if (block_id == ID_BLOCK_GRASS) opts.biomed = topped(1, 0, 0);
    if (block_id > ID_BLOCK_LAST) opts.model = models.item;

    const tex_offset = id_to_tex_num(block_id);
    if (block_id == ID_BLOCK_LEAVES) opts.biomed = 1;

    if (block_id == ID_BLOCK_WATER) {
      const delta = sub3(cam_eye(), [t_x, t_y, t_z]);
      const height = map_data(t_x, t_y, t_z).height;
      opts.cleary = 1;

      const axes = [0, 1, 2].sort((a, b) => Math.abs(delta[b]) - Math.abs(delta[a]));

      for (const i of axes) {
        const nbr_p = [t_x, t_y, t_z];
        nbr_p[i] += Math.sign(delta[i]);
        const nbr_height = map_data(nbr_p[0], nbr_p[1], nbr_p[2]).height;
        const nbr = map_get(nbr_p[0], nbr_p[1], nbr_p[2]);

        if (nbr == ID_BLOCK_WATER && nbr_height == height)
          continue;

        opts.darken = 0;
        if (i != 1) opts.darken = 1;

        opts.model = models.faces[i][delta[i] < 0];
        const src = opts.model.positions_copy;
        const dst = opts.model.positions;

        const t = height / 5;
        dst[(3*0)+1] = Math.sign(src[(3*0)+1])*t;
        dst[(3*1)+1] = Math.sign(src[(3*1)+1])*t;
        dst[(3*2)+1] = Math.sign(src[(3*2)+1])*t;
        dst[(3*3)+1] = Math.sign(src[(3*3)+1])*t;
        geo_cube(geo, t_x, t_y, t_z, tex_offset, opts);
      }
      return;
    }

    geo_cube(geo, t_x, t_y, t_z, tex_offset, opts);
    if (block_id == ID_BLOCK_GRASS) {
      opts.biomed = [1, 1, 1, 1, 0, 1];
      geo_cube(geo, t_x, t_y, t_z, topped(-1, SS_COLUMNS*2 + 6, -1), opts);
    }
  }

  return {
    geo_cube,
    geo_mob_part,
    geo_ui_quad,
    geo_block,
  };
})();

function geo_create(gl, vbuf_size, ibuf_size, default_view_proj=mat4_create()) {
  const geo = {
    default_view_proj,
    gpu_position: gl.createBuffer(),
    cpu_position: new Float32Array(vbuf_size),
    gpu_indices: gl.createBuffer(),
    cpu_indices: new Uint16Array(ibuf_size),
    vrt_i: 0,
    idx_i: 0
  };
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.gpu_indices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.cpu_indices, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, geo.gpu_position);
  gl.bufferData(gl.ARRAY_BUFFER, geo.cpu_position, gl.DYNAMIC_DRAW);

  return geo;
}

function geo_sync(geo, gl) {
  // Create a buffer for the square's positions.
  gl.bindBuffer(gl.ARRAY_BUFFER, geo.gpu_position);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, geo.cpu_position);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.gpu_indices);
  gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, geo.cpu_indices);

  if (geo.idx_i > geo.cpu_indices.length) throw new Error('idx oom');
  if (geo.vrt_i > geo.cpu_position.length) throw new Error('vrt oom');
  geo.cpu_indices.fill(0);
  // geo.cpu_position.fill(0);
}

function mining() {
  const cast = ray_to_map(cam_eye(), cam_looking());

  /* break block if tool & block are the same, otherwise reset mining */
  if (
    cast.coord &&
    cast.coord+'' == state.mining.block_coord+'' &&
    state.mining.tool_inv_i == state.inv.held_i
  ) {
    if (state.mining.ts_end < Date.now()) {
      do {
        const p = state.mining.block_coord;

        const held_itm = state.inv.items[state.inv.held_i];
        const held_id = held_itm.id;

        const mined = map_get(p[0], p[1], p[2]);
        let out = mined;
        let amount = 1;
        if (mined == ID_BLOCK_FLOWER2 ) out = ID_BLOCK_NONE;
        if (mined == ID_BLOCK_LEAVES  ) out = ID_BLOCK_NONE;
        if (mined == ID_BLOCK_GRASS   ) out = ID_BLOCK_DIRT;
        if (mined == ID_BLOCK_FURNACE1) out = ID_BLOCK_FURNACE0;
        if (mined == ID_BLOCK_STONE   ) out = ID_BLOCK_COBBLE;
        const holds_pick = held_id == ID_ITEM_T0_PICK ||
                           held_id == ID_ITEM_T1_PICK;
        if (mined == ID_BLOCK_ORE_T2   && !holds_pick) out = ID_BLOCK_NONE;
        if (mined == ID_BLOCK_ORE_COAL && !holds_pick) out = ID_BLOCK_NONE;
        if (mined == ID_BLOCK_STONE    && !holds_pick) out = ID_BLOCK_NONE;
        if (mined == ID_BLOCK_COBBLE   && !holds_pick) out = ID_BLOCK_NONE;

        if (mined == ID_BLOCK_ORE_COAL && holds_pick)
          out = ID_ITEM_COAL, amount += Math.floor(1.25*Math.random());
        
        if (ITEM_STOCK_DURABILITY[held_id] != undefined) {
          held_itm.durability ??= ITEM_STOCK_DURABILITY[held_id];
          held_itm.durability--;
          if (held_itm.durability == 0)
            state.inv.items[state.inv.held_i] = 0;
        }

        const vel = [Math.cos(Date.now() * 0.017)*0.05,
                     0,
                     Math.sin(Date.now() * 0.017)*0.05];
        if (out) state.items.push({ vel, pos: add3(p, [0.5, 0.2, 0.5]), id: out, amount });
        map_set(p[0], p[1], p[2], ID_BLOCK_NONE);

        if (mined == ID_BLOCK_FURNACE0) {
          let scratch_i = state.inv.items.length - SLOTS_SCRATCH;
          for (let i = 0; i < FURNACE_INDEX_COUNT; i++)
            itms[scratch_i] = furnace_inv[i], state_drop(scratch_i);
        }
        for (const key in map_data(p[0], p[1], p[2]))
          delete map_data(p[0], p[1], p[2])[key];

      } while(false);
    }
  } else {
    state.mining = { tool_inv_i: undefined,
                     block_coord: undefined,
                     ts_start: Date.now(),
                     ts_end: Date.now() };
  }

  /* if the mosue is down and you're looking at something, begin mining */
  {
    const { block_coord, ts_end } = state.mining;
    if ((state.mousedown)                                 &&
        (state.screen == SCREEN_WORLD)                    &&
        (block_coord == undefined || ts_end < Date.now()) &&
        (cast.coord != undefined)
    ) {
      state.mining.block_coord = cast.coord;
      state.mining.tool_inv_i = state.inv.held_i;
      state.mining.ts_start = Date.now();

      const held_id = state.inv.items[state.inv.held_i].id;

      const p = [...state.mining.block_coord];
      const block_id = map_get(p[0], p[1], p[2]);

      let mine_time = 2500;
      if (block_id == ID_BLOCK_LEAVES ) mine_time = 950;
      if (block_id == ID_BLOCK_TORCH  ) mine_time = 350;
      if (block_id == ID_BLOCK_FLOWER0) mine_time = 350;
      if (block_id == ID_BLOCK_FLOWER1) mine_time = 350;
      if (block_id == ID_BLOCK_FLOWER2) mine_time = 350;
      if (block_id == ID_BLOCK_SAPLING) mine_time = 350;
      if (block_id == ID_BLOCK_STONE   ) mine_time = 9000;
      if (block_id == ID_BLOCK_ORE_T2  ) mine_time = 10000;
      if (block_id == ID_BLOCK_ORE_COAL) mine_time = 10000;
      if (block_id == ID_BLOCK_FURNACE0) mine_time = 10000;
      if (block_id == ID_BLOCK_FURNACE1) mine_time = 10000;
      const holds_spade = held_id == ID_ITEM_T0_SPADE ||
                          held_id == ID_ITEM_T1_SPADE;
      const holds_pick = held_id == ID_ITEM_T0_PICK ||
                         held_id == ID_ITEM_T1_PICK;
      const holds_axe = held_id == ID_ITEM_T0_AXE ||
                        held_id == ID_ITEM_T1_AXE;
      const time_mult = { 
        [ID_ITEM_T0_SPADE]: 1.2,
        [ID_ITEM_T0_PICK]: 1.2,
        [ID_ITEM_T0_AXE]: 1.2,
        [ID_ITEM_T1_SPADE]: 0.9,
        [ID_ITEM_T1_PICK]: 0.9,
        [ID_ITEM_T1_AXE]: 0.9,
      };
      if (holds_pick  && block_id == ID_BLOCK_STONE    ) mine_time =  950*time_mult[held_id];
      if (holds_pick  && block_id == ID_BLOCK_ORE_COAL ) mine_time =  950*time_mult[held_id];
      if (holds_pick  && block_id == ID_BLOCK_ORE_T2   ) mine_time = 1450*time_mult[held_id];
      if (holds_pick  && block_id == ID_BLOCK_COBBLE   ) mine_time = 1000*time_mult[held_id];
      if (holds_pick  && block_id == ID_BLOCK_FURNACE0 ) mine_time = 2000*time_mult[held_id];
      if (holds_pick  && block_id == ID_BLOCK_FURNACE1 ) mine_time = 2000*time_mult[held_id];
      if (holds_spade && block_id == ID_BLOCK_DIRT     ) mine_time =  750*time_mult[held_id];
      if (holds_spade && block_id == ID_BLOCK_GRASS    ) mine_time =  800*time_mult[held_id];
      if (holds_axe   && block_id == ID_BLOCK_LOG      ) mine_time =  850*time_mult[held_id];
      if (holds_axe   && block_id == ID_BLOCK_LEAVES   ) mine_time =  750*time_mult[held_id];
      if (holds_axe   && block_id == ID_BLOCK_WOOD     ) mine_time =  650*time_mult[held_id];
      if (holds_axe   && block_id == ID_BLOCK_TABLE    ) mine_time =  650*time_mult[held_id];
      if (holds_axe   && block_id == ID_BLOCK_STAIRS   ) mine_time =  650*time_mult[held_id];

      state.mining.ts_end = Date.now() + mine_time;
    }
  }

}

function geo_chunk(geo, chunk) {
  const u8_cast = new Uint8Array(geo.cpu_position.buffer);

  const GRID_SIZE = SS_COLUMNS;
  const recip_GRID_SIZE = 1/SS_COLUMNS;

  const positions = new Float32Array([ 1, 1, 0,   0, 1, 0,   0, 0, 0,   1, 0, 0 ])
  const uvs       = [                [ 1, 0, 0,   1, 1, 0,   0, 1, 0,   0, 0, 0 ],
                                     [ 0, 0, 0,   1, 0, 0,   1, 1, 0,   0, 1, 0 ],
                                     [ 0, 0, 0,   1, 0, 0,   1, 1, 0,   0, 1, 0 ],
                    ];
  const indices = [0,  1,  2,  0,  2,  3];

  const t = [0, 0, 0];
  const max = [MAP_SIZE, MAX_HEIGHT, MAP_SIZE];
  function axis(a, b, c) {
    positions[0*3 + a] = 1;
    positions[0*3 + b] = 1;
    positions[0*3 + c] = 0;

    positions[1*3 + a] = 0;
    positions[1*3 + b] = 1;
    positions[1*3 + c] = 0;

    positions[2*3 + a] = 0;
    positions[2*3 + b] = 0;
    positions[2*3 + c] = 0;

    positions[3*3 + a] = 1;
    positions[3*3 + b] = 0;
    positions[3*3 + c] = 0;

    const light_global_lookup = () => {
      const lc = map_chunk(   chunk.x+t[0], t[1], chunk.z+t[2]);
      if (lc == undefined)             return MAX_LIGHT;
      if (lc.genned != CHUNK_GEN_DONE) return MAX_LIGHT;
      return map_light(chunk.x+t[0], t[1], chunk.z+t[2]);
    };

    for (t[a] = 0; t[a] < max[a]; t[a]++)
      for (t[b] = 0; t[b] < max[b]; t[b]++) {
        t[c] = -1;
        let _last = ID_BLOCK_NONE;
        let _last_light = light_global_lookup();

        for (t[c] = 0; t[c] <= max[c]; t[c]++) {
          const chunk_index = map_index(t[0], t[1], t[2]);

          const last_light = _last_light;
          const light = (t[c] == max[c]) ? light_global_lookup() : chunk.light[chunk_index];
          _last_light = light;

          const last = _last;
          const now = (t[c] == max[c]) ? ID_BLOCK_NONE : chunk.map[chunk_index];
          _last = now;

          if (VOXEL_PERFECT[last] == VOXEL_PERFECT[now]) continue;

          const block_id = VOXEL_PERFECT[last] ? last : now;
          const tex = id_to_tex_num(block_id)[c + 3*VOXEL_PERFECT[now]];
          const tile_idx_i = geo.vrt_i / VERT_FLOATS;
          for (let i = 0; i < positions.length; i += 3) {

            geo.cpu_position[geo.vrt_i++] = positions[i + 0] + t[0] + chunk.x;
            geo.cpu_position[geo.vrt_i++] = positions[i + 1] + t[1];
            geo.cpu_position[geo.vrt_i++] = positions[i + 2] + t[2] + chunk.z;
            geo.cpu_position[geo.vrt_i++] = 1;

            const u =   (tex %       GRID_SIZE) + uvs[c][i + 0];
            const v = ~~(tex * recip_GRID_SIZE) + uvs[c][i + 1];
            geo.cpu_position[geo.vrt_i++] = u * recip_GRID_SIZE;
            geo.cpu_position[geo.vrt_i++] = v * recip_GRID_SIZE;

            const darken = (VOXEL_PERFECT[now] ? last_light : light)/MAX_LIGHT;
            const biomed = TEX_BIOMED[tex];
            const cleary = 0;
            const u8_i = Float32Array.BYTES_PER_ELEMENT * geo.vrt_i;
            geo.vrt_i += 1;
            u8_cast[u8_i+0] = lerp(0.15, 1, ease_out_sine(darken))*255;
            u8_cast[u8_i+1] = (biomed << 0) | (cleary << 1);
          }

          for (const i_o of indices)
            geo.cpu_indices[geo.idx_i++] = tile_idx_i+i_o;

          if (c != 1 && block_id == ID_BLOCK_GRASS) {
            /* could be a function but this is a hot loop and it's not worth
             * taking the perf hit for the non-edge case (haven't A/B profiled tho) */
            const tex = SS_COLUMNS*2 + 6;
            const tile_idx_i = geo.vrt_i / VERT_FLOATS;
            for (let i = 0; i < positions.length; i += 3) {
              geo.cpu_position[geo.vrt_i++] = positions[i + 0] + t[0] + chunk.x;
              geo.cpu_position[geo.vrt_i++] = positions[i + 1] + t[1];
              geo.cpu_position[geo.vrt_i++] = positions[i + 2] + t[2] + chunk.z;
              geo.cpu_position[geo.vrt_i++] = 1;

              const u =   (tex %       GRID_SIZE) + uvs[c][i + 0];
              const v = ~~(tex * recip_GRID_SIZE) + uvs[c][i + 1];
              geo.cpu_position[geo.vrt_i++] = u * recip_GRID_SIZE;
              geo.cpu_position[geo.vrt_i++] = v * recip_GRID_SIZE;

              const darken = (VOXEL_PERFECT[now] ? last_light : light)/MAX_LIGHT;
              const biomed = 1;
              const cleary = 0;
              const u8_i = Float32Array.BYTES_PER_ELEMENT * geo.vrt_i;
              geo.vrt_i += 1;
              u8_cast[u8_i+0] = lerp(0.15, 1, ease_out_sine(darken))*255;
              u8_cast[u8_i+1] = (biomed << 0) | (cleary << 1);
            }

            for (const i_o of indices)
              geo.cpu_indices[geo.idx_i++] = tile_idx_i+i_o;
          }
        }
      }
  }

  axis(0, 1, 2);
  axis(1, 2, 0);
  axis(0, 2, 1);
}

function geo_fill(geo, gl, program_info, render_stage) {
  const cast = ray_to_map(cam_eye(), cam_looking());

  /* skybox */
  if (render_stage == 0) {
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
        window.innerWidth / window.innerHeight,
        0.1,
        SKYBOX_SIZE
      )
    }

    mat4_mul(proj, proj, view);
    const view_proj = proj;
    const mat = mat4_from_scaling(mat4_create(), [SKYBOX_SIZE, SKYBOX_SIZE, SKYBOX_SIZE]);
    geo_cube(geo, 0, 0, 0, [
        32*SS_COLUMNS + 64,
        32*SS_COLUMNS + 32, // top
        64*SS_COLUMNS + 64,
        64*SS_COLUMNS + 32,
        32*SS_COLUMNS + 0,  // bottom
        64*SS_COLUMNS + 0,
    ], { tex_size_x: 512/16, tex_size_y: 512/16, view_proj, mat, darken: 0 });
  }

  if (render_stage == 2) {
    for (const { pos, id } of state.items) {
      const mat = mat4_from_y_rotation(mat4_create(), Date.now()/1000);
      mat4_mul(mat, mat, mat4_from_translation(mat4_create(), [0.0, 0.15, 0.0]));
      mat4_mul(mat, mat, mat4_from_scaling(mat4_create(), [0.3, 0.3, 0.3]));
      geo_block(geo, ...pos, id, { mat });
    }
    
    for (const zom of state.zombies) {
      const { pos } = zom;
      const delta = sub3(state.pos, zom.pos);
      const y_rot = Math.atan2(delta[0], delta[2]);

      const hed_mat = (x, y, z) => {
        const mat = mat4_create();

        const eye = add3(zom.pos, [x+0.5, y+0.5, z+0.5]);
        mat4_mul(mat, mat, mat4_target_to(_scratch, eye, cam_eye()));

        return mat;
      }
      const rot_mat = (x, y, z, rot, y_offset) => {
        const mat = mat4_create();
        mat4_mul(mat, mat, mat4_from_translation(_scratch, add3(zom.pos, [0.5, 0.5, 0.5])));
        mat4_mul(mat, mat, mat4_from_y_rotation(_scratch, y_rot));
        mat4_mul(mat, mat, mat4_from_translation(_scratch, [x, y, z]));

        mat4_mul(mat, mat, mat4_from_translation(_scratch, [-0.0,  y_offset, -0.0]));
        mat4_mul(mat, mat, mat4_from_x_rotation(_scratch, rot));
        mat4_mul(mat, mat, mat4_from_translation(_scratch, [ 0.0, -y_offset,  0.0]));

        return mat;
      }

      const x = pos[0];
      const y = pos[1];
      const z = pos[2];
      let rot = 0;
      const leg_rot = Math.cos(Date.now()*0.007);
      const arm_l_rot = Math.abs(Math.cos((Date.now()      )*0.003)) - Math.PI*0.6;
      const arm_r_rot = Math.abs(Math.cos((Date.now() - 100)*0.003)) - Math.PI*0.6;
      geo_mob_part(geo, hed_mat( 0.00,  1.280, 0),                  96  , 96  , [ 2, 2,-2]);
      geo_mob_part(geo, rot_mat( 0.00,  0.650, 0,       rot, 0.0), 96+ 4, 96+4, [ 2, 3, 1]);
      geo_mob_part(geo, rot_mat( 0.10, -0.100, 0,   leg_rot, 0.4), 96   , 96+4, [ 1, 3, 1]);
      geo_mob_part(geo, rot_mat(-0.10, -0.100, 0,  -leg_rot, 0.4), 96   , 96+4, [-1, 3, 1]);
      geo_mob_part(geo, rot_mat( 0.38,  0.700, 0, arm_l_rot, 0.3), 96+10, 96+4, [ 1, 3, 1]);
      geo_mob_part(geo, rot_mat(-0.38,  0.700, 0, arm_r_rot, 0.3), 96+10, 96+4, [-1, 3, 1]);
    }
  }


  /* render voxel map */
  if (render_stage == 0 || render_stage == 2) {
    /* removing block being mined before rendering map */
    let mining_block_type = undefined;
    if (state.mining.block_coord) {
      const p = state.mining.block_coord;
      mining_block_type = map_get(p[0], p[1], p[2]);
      map_set(p[0], p[1], p[2], ID_BLOCK_NONE);
    }

    for (const chunk_key of map_chunks_near(state.pos)) {
      const chunk = state.chunks[chunk_key];
      if (chunk == undefined) continue;

      if (render_stage == 0) {
        if (!chunk.dirty || state.tick == window.last_chunk_tick) {
          if (chunk.geo)
            geo_draw(chunk.geo, gl, program_info, geo.default_view_proj);
          continue;
        }
        window.last_chunk_tick = state.tick;

        // chunk.geo ??= geo_create(
        //   gl,
        //   VERT_FLOATS*6*4 * MAP_SIZE*MAP_SIZE*MAX_HEIGHT,
        //               6*6 * MAP_SIZE*MAP_SIZE*MAX_HEIGHT
        // );
        const MAX_ADDRESSABLE_VERTS = 1 << 16;
        chunk.geo ??= geo_create(gl, VERT_FLOATS*(1 << 16), 2*MAX_ADDRESSABLE_VERTS);

        chunk.geo.vrt_i = 0;
        chunk.geo.idx_i = 0;

        geo_chunk(chunk.geo, chunk);

        for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
          for (let t_y = 0; t_y < MAX_HEIGHT; t_y++) 
            for (let t_z = 0; t_z < MAP_SIZE; t_z++) {
              const index = map_index(t_x, t_y, t_z);
              let block_id     = chunk.map [index];
              if (block_id == 0                                ||
                  VOXEL_PERFECT[block_id]                      ||
                  VOXEL_RENDER_STAGE[block_id] != render_stage
                ) continue;

              const block_data = chunk.data[index];
              const opts = { block_data, world_light: 1 };

              let empty_nbr = 0;
              for (let i = 0; i < 6; i++) {
                const offset = [0, 0, 0];
                offset[i % 3] = (i < 3) ? 1 : -1;
                const o_x = chunk.x + offset[0] + t_x;
                const o_y =           offset[1] + t_y;
                const o_z = chunk.z + offset[2] + t_z;

                if (map_chunk(o_x, o_y, o_z) != chunk) {
                  empty_nbr = 1;
                  continue;
                }

                const nbr = chunk.map[map_index(o_x, o_y, o_z)];
                if (!VOXEL_PERFECT[nbr])
                  empty_nbr = 1;
              }
              if (empty_nbr == 0) continue;

              const w_x = t_x + chunk.x;
              const w_y = t_y;
              const w_z = t_z + chunk.z;
              geo_block(chunk.geo, w_x, w_y, w_z, block_id, opts);
            }

        chunk.dirty = false;
        geo_sync(chunk.geo, gl);
        geo_draw(chunk.geo, gl, program_info, geo.default_view_proj);
      }

      if (render_stage == 2, 0) {
        const delta = mul3_f(cam_looking(), -1);

        // for (let __x = 0; __x < MAP_SIZE; __x++) 
        //   for (let __y = 0; __y < MAX_HEIGHT; __y++) 
        //     for (let __z = 0; __z < MAP_SIZE; __z++) {
        //       const t_x = (delta[0] < 0) ? (MAP_SIZE - 1 - __x) : __x;
        //       const t_y = (delta[1] < 0) ? (MAX_HEIGHT - 1 - __y) : __y;
        //       const t_z = (delta[2] < 0) ? (MAP_SIZE - 1 - __z) : __z;
        for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
          for (let t_y = 0; t_y < MAX_HEIGHT; t_y++) 
            for (let t_z = 0; t_z < MAP_SIZE; t_z++) {
              const index = map_index(t_x, t_y, t_z);
              let block_id     = chunk.map [index];
              if (block_id == 0 || VOXEL_RENDER_STAGE[block_id] != render_stage) continue;

              const block_data = chunk.data[index];
              const opts = { block_data, world_light: 1 };

              const w_x = t_x + chunk.x;
              const w_y = t_y;
              const w_z = t_z + chunk.z;
              geo_block(geo, w_x, w_y, w_z, block_id, opts);
            }
      }
    }

    if (render_stage == 2) {
      /* render block being mined with animation */
      if (mining_block_type) {
        let t = inv_lerp(state.mining.ts_start, state.mining.ts_end, Date.now());
        t = Math.min(1, t);
        t = ease_out_sine(t);
        const t_x = state.mining.block_coord[0];
        const t_y = state.mining.block_coord[1];
        const t_z = state.mining.block_coord[2];
        if (t < 0.98) {
          const opts = { world_light: 1 };
          opts.block_data = map_data(t_x, t_y, t_z);
          geo_block(geo, t_x, t_y, t_z, mining_block_type, opts);
        }
        const stage = Math.floor(lerp(0, 9, t));
        geo_block(geo, t_x, t_y, t_z, ID_BLOCK_BREAKING + stage, { world_light: 1 });
      }
    }

    /* undo "removing block being mined before rendering map" */
    if (state.mining.block_coord)
      map_set(state.mining.block_coord[0],
              state.mining.block_coord[1],
              state.mining.block_coord[2],
              mining_block_type);
  }

  /* render indicator of what block you are looking at */
  if (render_stage == 1             &&
      state.screen == SCREEN_WORLD  &&
      cast.coord != undefined       &&
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
    geo_block(geo, ...p, ID_BLOCK_GLASS, { darken: 0, mat, transparent: 1 });
  }
  
  /* show item in hand */
  if (render_stage == 2) {
    const proj = mat4_create();
    const aspect = window.innerWidth / window.innerHeight;
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
    let pos = [aspect*0.55, -0.425, -1.85];

    const item_id = state.inv.items[state.inv.held_i] &&
                    state.inv.items[state.inv.held_i].id;
    if (item_id == ID_ITEM_T0_SPADE) scale = 0.8, swing_rot = -90;
    if (item_id == ID_ITEM_T0_PICK ) scale = 0.8, swing_rot = -20;
    if (item_id == ID_ITEM_T0_AXE  ) scale = 0.8, swing_rot = -20;
    if (item_id == ID_ITEM_T1_SPADE) scale = 0.8, swing_rot = -90;
    if (item_id == ID_ITEM_T1_PICK ) scale = 0.8, swing_rot = -20;
    if (item_id == ID_ITEM_T1_AXE  ) scale = 0.8, swing_rot = -20;
    if (item_id == 0               ) scale = 1.5, swing_rot = -45,
                                     pos = [aspect*0.75, -0.625, -1.85];

    const now = Date.now();
    if (state.mining.ts_end > now) {

      let t = inv_lerp(state.mining.ts_start, state.mining.ts_end, now);
      t = Math.min(1, 8*(1 - 2*Math.abs(0.5 - t)));

      swing_rot += 20*t*Math.cos(now * 0.03);
    }

    if (state.using.ts_end > now) {
      let t = inv_lerp(state.using.ts_start, state.using.ts_end, now);
      t = (1 - 2.2*Math.abs(0.5 - t));
      t = ease_out_sine(t);
      swing_rot -= 40*t;
    }

    if (!isFinite(swing_rot)) debugger;

    const mat = mat4_from_translation(mat4_create(), pos);
    mat4_mul(mat, mat, mat4_from_y_rotation(_scratch,        40 / 180 * Math.PI));
    mat4_mul(mat, mat, mat4_from_x_rotation(_scratch, swing_rot / 180 * Math.PI));
    mat4_mul(mat, mat, mat4_from_scaling(_scratch, [scale, scale, scale]));

    if (item_id)
      geo_block(geo, 0, 0, 0, item_id, { mat, view_proj });
    else
      geo_mob_part(geo, mat, 96+10, 96+4, [-1, -3, 1], { view_proj });
  }

  const view_proj = mat4_create();
  const ui_w = window.innerWidth /4;
  const ui_h = window.innerHeight/4;
  const pixel_round = size => Math.floor(size*4)/4;
  const view_proj_center_x = size_x => {
    const offset = pixel_round((size_x - ui_w)/2);
    mat4_ortho(
      view_proj,
      offset + 0, offset + ui_w,
               0,          ui_h,
      0, 1
    );
  }

  const text_width = (str, size) => {
    const raw = str.split('').reduce((a, x) => a + letter_widths[x.charCodeAt(0)]/8, 0);
    return size*raw;
  };
  const ui_str = (str, x, y, size, opts={}) => {
    let cursor = 0;
    for (const i in str) {
      const chr = str[i];
      const code = chr.charCodeAt(0);
      const code_x = code % 16;
      const code_y = Math.floor(code / 16);

      const tex = SS_COLUMNS*(code_y + 16) + code_x;
      geo_ui_quad(
        geo,
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
  const ui_cube = (x, y, id) => {
    const mat       = mat4_create();
    mat4_mul(mat, mat, mat4_from_translation(_scratch, [x + 8, y + 8, -0.00001]));
    mat4_mul(mat, mat, mat4_from_scaling    (_scratch, [  9.5,   9.5,  0.00001]));
    mat4_mul(mat, mat, mat4_from_x_rotation (_scratch, Math.PI/5));
    mat4_mul(mat, mat, mat4_from_y_rotation (_scratch, Math.PI/4));

    geo_block(geo, 0, 0, 0, id, { view_proj, mat });
  }

  function ui_item(x, y, itm) {
    const id = itm.id;
    const item_tex = id_to_tex_num(id);

    if (id <= ID_BLOCK_LAST)
      ui_cube(x, y, id);
    else
      geo_ui_quad(geo, view_proj, x, y, 16, 16, item_tex, { z: -0.9997 });

    if (itm.amount > 1)
      ui_str(""+itm.amount, x, y, 8, { z: -1.0 });

    if (itm.durability != undefined) {
      const z = -1.0;
      const         bar = SS_COLUMNS*11 + 23;
      const translucent = SS_COLUMNS*11 + 24;
      const opts = { z, tex_size_x: 1/16, tex_size_y: 1/16 }
      geo_ui_quad(geo, view_proj, x+2, y+2, 13, 1, bar, opts);
      geo_ui_quad(geo, view_proj, x+2, y+1, 13, 1, bar, opts);

      const t = itm.durability / ITEM_STOCK_DURABILITY[itm.id];
      const bar_len = Math.ceil(12 * t);
      const bar_uv = bar + (1 + Math.ceil(14 * t))/16;
      geo_ui_quad(geo, view_proj, x+2, y+2, bar_len, 1, bar_uv     , opts);
      geo_ui_quad(geo, view_proj, x+2, y+2,      12, 1, translucent, opts);
    }

  }

  /* draw chat */
  if (state.screen == SCREEN_WORLD && render_stage == 2) {
    view_proj_center_x(ui_w);
    let up_cursor = 0;
    state.chat.sort((a, b) => b.ts_in - a.ts_in);
    const max_width = Math.max(...state.chat.map(({ msg }) => text_width(msg, 4)));
    for (const { msg, ts_in, ts_out } of state.chat) {
      const in_t  = inv_lerp(ts_in ,  ts_in + 800, Date.now());
      const out_t = ts_out ? inv_lerp(ts_out - 2500, ts_out, Date.now()) : -1;
      if (out_t > 1 || in_t < 0) continue;

      let t = 3;
      if (in_t < 1 && in_t > 0) {
        t = ease_out_expo(in_t);
        t = pixel_round(lerp(-10, 3, t));
      } else if (out_t < 1 && out_t > 0) {
        t = ease_out_expo(out_t);
        t = pixel_round(lerp(5, -max_width-4, t));
      }
      ui_str(msg,   t, 26+up_cursor, 4, { z: -1 });
      up_cursor += 5;
    }
  }

  if (state.screen == SCREEN_CHAT && render_stage == 2) {
    view_proj_center_x(ui_w);
    let up_cursor = 0;

    const cursor = ((Date.now()/300%2) < 1) ? '|' : '';
    ui_str(state.chat_input + cursor, 3, 26+up_cursor, 4, { z: -1 });
    up_cursor += 5;

    state.chat.sort((a, b) => b.ts_in - a.ts_in);
    for (const chat of state.chat) {
      chat.ts_out = Date.now() + 2500;
      const { msg, ts_in, ts_out } = chat;
      const in_t  = inv_lerp(ts_in ,  ts_in + 800, Date.now());

      let t = 3;
      if (in_t < 1 && in_t > 0) {
        t = ease_out_expo(in_t);
        t = pixel_round(lerp(-10, 3, t));
      }
      ui_str(msg,   t, 26+up_cursor, 4, { z: -1 });
      up_cursor += 5;
    }
  }

  if (render_stage == 2 && state.screen == SCREEN_WORLD) {
    const hotbar_size = 45*4 + 2;
    view_proj_center_x(hotbar_size);

    /* hotbar bg tex */
    {
      const size = 21;
      const slot = 16*SS_COLUMNS + 16;

      const size_x = hotbar_size;
      const opts = { tex_size_x: size_x/16, tex_size_y: size/16, z: -0.9997 };
      geo_ui_quad(geo, view_proj, 0, 2, size_x, size, slot, opts);
    }

    /* hotbar items preview */
    for (let i = 0; i < 9; i++) {
      const itm = state.inv.items[i];
      if (itm) {
        const x = 3 + i*20;
        ui_item(x, 4, itm);
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
      geo_ui_quad(geo, view_proj, quad_x, 0, size, size, slot, opts);
    }
  }

  const inv_screen = state.screen == SCREEN_INV     ||
                     state.screen == SCREEN_TABLE   ||
                     state.screen == SCREEN_FURNACE ;
  if (render_stage == 2 && inv_screen) {
    const z = -0.9997;

    const size_x = 176;
    view_proj_center_x(size_x);
    const size_y = 166;
    const btm_pad = pixel_round((ui_h - size_y)/2);

    /* render inv bg tex */
    {
      let tex_o;
      if (state.screen == SCREEN_INV    ) tex_o = 0*SS_COLUMNS + 16*2;
      if (state.screen == SCREEN_TABLE  ) tex_o = 0*SS_COLUMNS + 16*3;
      if (state.screen == SCREEN_FURNACE) tex_o = 0*SS_COLUMNS + 16*4;

      const opts = { tex_size_x: size_x/16,
                     tex_size_y: size_y/16,
                     z };
      geo_ui_quad(geo, view_proj, 0, btm_pad, size_x, size_y, tex_o, opts);
    }

    let scratch_i = state.inv.items.length - SLOTS_SCRATCH;
    const pickup_i = scratch_i++;

    const mp = [state.mousepos.x, state.mousepos.y, 0, 1];
    {

      /* invert p */
      {
        mp[0] = (mp[0] / window.innerWidth )*2 - 1;
        mp[1] = 1 - (mp[1] / window.innerHeight)*2;

        const inv = mat4_create();
        mat4_invert(inv, view_proj);
        mat4_transform_vec4(mp, mp, inv);
      }
    }

    const slot = (x, y, inv_i) => {
      const itm = state.inv.items[inv_i];
      const translucent = SS_COLUMNS*11 + 24;

      y += btm_pad;

      if (mp[0] > x && mp[0] < (x+16) &&
          mp[1] > y && mp[1] < (y+16)  ) {
        geo_ui_quad(geo, view_proj, x, y, 16, 16, translucent, { z });

        const itms = state.inv.items;

        const inv_id    = itms[inv_i   ] && itms[inv_i   ].id;
        const pickup_id = itms[pickup_i] && itms[pickup_i].id;

        if (state.mouseclick_double) {
          const dst_i = itms[pickup_i] ? pickup_i : inv_i;

          for (let i = SLOTS_INV-1; i >= 0; i--) {
            if (i == dst_i) continue;

            while (
              itms[i] &&
              itms[i].id == inv_id &&
              itms[dst_i].amount < ITEM_STACK_SIZE[inv_id]
            ) {
              itms[dst_i].amount++;
              itms[i].amount--;
              if (itms[i].amount == 0) {
                itms[i] = 0;
                break;
              }
            }
          }
        }
        else if (state.mouseclick) {
          if (inv_id == pickup_id && inv_id != 0) {
            /* combine! */
            while (itms[inv_i].amount < ITEM_STACK_SIZE[inv_id]) {
              itms[inv_i].amount++;
              itms[pickup_i].amount--;
              if (itms[pickup_i].amount == 0) {
                itms[pickup_i] = 0;
                break;
              }
            }
          } else {
            /* swap! */
            const tmp = itms[inv_i];
            itms[inv_i] = itms[pickup_i];
            itms[pickup_i] = tmp;
          }
        }

        const lastdrophash = inv_i + '|' + state.ts_mousedown_right;
        if (state.mousedown_right && window.lastdrophash != lastdrophash) {
          window.lastdrophash = lastdrophash;

          if (itms[pickup_i]) {
            if (itms[inv_i] == 0) {
              itms[pickup_i].amount--;
              itms[inv_i] = { id: itms[pickup_i].id, amount: 1 };
            }
            else if (inv_id == pickup_id && inv_id != undefined) {
              if (itms[inv_i].amount < ITEM_STACK_SIZE[inv_id])
                itms[pickup_i].amount--,
                itms[inv_i].amount++;
            }
          } else if (itms[inv_i].id && itms[inv_i].amount > 1) {
            itms[pickup_i] = { id: itm.id, amount: Math.floor(itm.amount/2) };
            itms[inv_i].amount = Math.ceil(itm.amount/2);
          }
        }

        if (itms[pickup_i])
          if (itms[pickup_i].amount == 0)
            itms[pickup_i] = 0;

        if (itms[inv_i])
          if (itms[inv_i].amount == 0)
            itms[inv_i] = 0;
      }

      if (state.inv.items[inv_i] && state.inv.items[inv_i].id)
        ui_item(x, y, state.inv.items[inv_i]);
    }
    const slot_out = (x, y, inv_i) => {
      let ret = 0;

      y += btm_pad;

      const itms = state.inv.items;
      const translucent = SS_COLUMNS*11 + 24;

      if (mp[0] > x && mp[0] < (x+16) &&
          mp[1] > y && mp[1] < (y+16)  ) {
        geo_ui_quad(geo, view_proj, x, y, 16, 16, translucent, { z });

        if (state.mouseclick) {
          const inv_id    = itms[inv_i   ] && itms[inv_i   ].id;
          const pickup_id = itms[pickup_i] && itms[pickup_i].id;

          if (
            (
              inv_id == pickup_id &&
              inv_id != 0 &&
              (itms[inv_i].amount + itms[pickup_i].amount) < ITEM_STACK_SIZE[inv_id]
            ) || itms[pickup_i] == 0
          ) {
            if (itms[pickup_i] == 0)
              itms[pickup_i] = itms[inv_i];
            else
              itms[pickup_i].amount += itms[inv_i].amount;

            ret = 1;
          }
        }
      }

      if (state.inv.items[inv_i] && state.inv.items[inv_i].id)
        ui_item(x, y, state.inv.items[inv_i]);

      return ret;
    };

    let i = 0;
    const inv_row = i_y => {
      for (let i_x = 0; i_x < 9; i_x++) {
        const x = 8 + i_x*18;
        const y = i_y;

        slot(x, y, i++);
      }
    };

    inv_row(8); /* hotbar */
    for (let i_y = 0; i_y < 3; i_y++)
      inv_row(66 - i_y*18); /* inv rows */

    /* crafting grid */
    let tbl_i = scratch_i;
    let tbl_extent = 0;
    if (state.screen == SCREEN_INV  ) {
      tbl_extent = 2;

      for (let i_y = 0; i_y < 2; i_y++)
        for (let i_x = 0; i_x < 2; i_x++) {
          const i = scratch_i++;
          slot(88 + 18*i_x, 124 - 18*i_y, i);
        }
    }
    if (state.screen == SCREEN_TABLE  ) {
      tbl_extent = 3;

      for (let i_y = 0; i_y < 3; i_y++)
        for (let i_x = 0; i_x < 3; i_x++) {
          const i = scratch_i++;
          slot(30 + 18*i_x, 132 - 18*i_y, i);
        }
    }
    let tbl_end_i = scratch_i;
    const tbl_slot_count = tbl_end_i - tbl_i;

    /* crafting output */
    if (tbl_extent) {
      const out_i = scratch_i++;

      const itms = state.inv.items;

      let tbl_x_min = 3, tbl_y_min = 3;
      let tbl_x_max = 0, tbl_y_max = 0;
      for (let i_x = 0; i_x < tbl_extent; i_x++)
        for (let i_y = 0; i_y < tbl_extent; i_y++) {
          const i = tbl_i + i_y*tbl_extent + i_x;
          if (state.inv.items[i] != 0)
            tbl_x_min = Math.min(  i_x, tbl_x_min),
            tbl_y_min = Math.min(  i_y, tbl_y_min),
            tbl_x_max = Math.max(1+i_x, tbl_x_max),
            tbl_y_max = Math.max(1+i_y, tbl_y_max);
        }
      const tbl_w = Math.max(0, tbl_x_max - tbl_x_min);
      const tbl_h = Math.max(0, tbl_y_max - tbl_y_min);
      const pattern = Array(tbl_w*tbl_h);
      for (let i_x = 0; i_x < tbl_w; i_x++)
        for (let i_y = 0; i_y < tbl_h; i_y++) {
          const grid_i = (tbl_y_min + i_y)*tbl_extent + (tbl_x_min + i_x);
          const itms_i = tbl_i + grid_i;

          const pattern_i = i_y*tbl_w + i_x;
          pattern[pattern_i] = itms[itms_i] && itms[itms_i].id;
        }

      const recipes = [
        {
          out: { id: ID_BLOCK_WOOD, amount: 4 },
          pattern_w: 1,
          pattern_h: 1,
          ingredients: [ID_BLOCK_LOG],
          pattern: [0]
        },
        {
          out: { id: ID_BLOCK_TABLE, amount: 1 },
          pattern_w: 2,
          pattern_h: 2,
          ingredients: [ID_BLOCK_WOOD],
          pattern: [
            0,0,
            0,0,
          ]
        },
        {
          out: { id: ID_ITEM_STICK, amount: 4 },
          pattern_w: 1,
          pattern_h: 2,
          ingredients: [ID_BLOCK_WOOD],
          pattern: [
            0,
            0,
          ]
        },
        {
          out: { id: ID_BLOCK_FURNACE0, amount: 1 },
          pattern_w: 3,
          pattern_h: 3,
          ingredients: [ID_BLOCK_NONE, ID_BLOCK_COBBLE],
          pattern: [
            1,1,1,
            1,0,1,
            1,1,1,
          ]
        },
        {
          out: { id: ID_ITEM_T0_SPADE, amount: 1 },
          pattern_w: 1,
          pattern_h: 3,
          ingredients: [ID_ITEM_STICK, ID_BLOCK_WOOD],
          pattern: [
            1,
            0,
            0,
          ]
        },
        {
          out: { id: ID_ITEM_T0_PICK, amount: 1 },
          pattern_w: 3,
          pattern_h: 3,
          ingredients: [ID_BLOCK_NONE, ID_ITEM_STICK, ID_BLOCK_WOOD],
          pattern: [
            2,2,2,
            0,1,0,
            0,1,0,
          ]
        },
        {
          out: { id: ID_ITEM_T0_AXE, amount: 1 },
          pattern_w: 3,
          pattern_h: 3,
          ingredients: [ID_BLOCK_NONE, ID_ITEM_STICK, ID_BLOCK_WOOD],
          pattern: [
            2,2,0,
            2,1,0,
            0,1,0,
          ]
        },
        {
          out: { id: ID_ITEM_T1_SPADE, amount: 1 },
          pattern_w: 1,
          pattern_h: 3,
          ingredients: [ID_ITEM_STICK, ID_BLOCK_COBBLE],
          pattern: [
            1,
            0,
            0,
          ]
        },
        {
          out: { id: ID_ITEM_T1_PICK, amount: 1 },
          pattern_w: 3,
          pattern_h: 3,
          ingredients: [ID_BLOCK_NONE, ID_ITEM_STICK, ID_BLOCK_COBBLE],
          pattern: [
            2,2,2,
            0,1,0,
            0,1,0,
          ]
        },
        {
          out: { id: ID_ITEM_T1_AXE, amount: 1 },
          pattern_w: 3,
          pattern_h: 3,
          ingredients: [ID_BLOCK_NONE, ID_ITEM_STICK, ID_BLOCK_COBBLE],
          pattern: [
            2,2,0,
            2,1,0,
            0,1,0,
          ]
        },
        {
          out: { id: ID_BLOCK_TORCH, amount: 4 },
          pattern_w: 1,
          pattern_h: 2,
          ingredients: [ID_ITEM_COAL, ID_ITEM_STICK],
          pattern: [
            0,
            1,
          ]
        },
        {
          out: { id: ID_BLOCK_STAIRS, amount: 4 },
          pattern_w: 3,
          pattern_h: 3,
          ingredients: [ID_BLOCK_NONE, ID_BLOCK_WOOD],
          pattern: [
            1,0,0,
            1,1,0,
            1,1,1,
          ]
        },
        {
          out: { id: ID_BLOCK_STAIRS, amount: 4 },
          pattern_w: 3,
          pattern_h: 3,
          ingredients: [ID_BLOCK_NONE, ID_BLOCK_WOOD],
          pattern: [
            0,0,1,
            0,1,1,
            1,1,1,
          ]
        },
      ];

      let out = 0;
      for (const r of recipes) {
        if (r.pattern_w != tbl_w) continue;
        if (r.pattern_h != tbl_h) continue;
        if (r.pattern.some((x, i) => r.ingredients[x] != pattern[i])) continue;
        out = r.out;
        break;
      }

      // console.log({ out, log_slots });
      state.inv.items[out_i] = out;

      let click;
      if (state.screen == SCREEN_INV  ) click = slot_out(88 + 56, 124 - 10, out_i);
      if (state.screen == SCREEN_TABLE) click = slot_out(70 + 56, 124 - 10, out_i);

      /* take 1 from each slot */
      if (click)
        for (let slot = 0; slot < tbl_slot_count; slot++) {
          const tbl_slot_i = tbl_i + slot;

          if (itms[tbl_slot_i]) {
            itms[tbl_slot_i].amount--;
            if (itms[tbl_slot_i].amount == 0)
              itms[tbl_slot_i] = 0;
          }
        }

      itms[out_i] = 0;
    }

    const block_data = 
      map_chunk(state.screen_block_coord[0],
                state.screen_block_coord[1],
                state.screen_block_coord[2])
      ? map_data(state.screen_block_coord[0],
                 state.screen_block_coord[1],
                 state.screen_block_coord[2])
      : 0;
    if (state.screen == SCREEN_FURNACE && block_data && block_data.furnace) {
      const md = block_data.furnace;
      const furnace_inv = md.inv;

      const itms = state.inv.items;

      /* copy the furnace_inv stored in map_data into the player inv
       * address space for the UI code, then copy it out for persistence */
      const host_inv_i = scratch_i;
      for (let i = 0; i < FURNACE_INDEX_COUNT; i++)
        itms[scratch_i++] = furnace_inv[i];

      {
        slot( 58,  97, host_inv_i + FURNACE_INDEX_FUEL);
        slot( 58, 132, host_inv_i + FURNACE_INDEX_COOK);
        slot(116, 115, host_inv_i + FURNACE_INDEX_OUT );
        let burn_t = inv_lerp(md.tick_burn_start, md.tick_burn_end, state.tick);
        let cook_t = inv_lerp(md.tick_cook_start, md.tick_cook_end, state.tick);
        burn_t = Math.max(0, Math.min(1, burn_t)); if (state.tick > md.tick_burn_end) burn_t = 0;
        cook_t = Math.max(0, Math.min(1, cook_t)); if (state.tick > md.tick_cook_end) cook_t = 0;

        const flame = 0*SS_COLUMNS + 16*4 + size_x/16;
        const arrow = 1*SS_COLUMNS + 16*4 + size_x/16;

        {
          const opts = { z, tex_size_x: 2*cook_t, tex_size_y: 1 }
          geo_ui_quad(geo, view_proj, 79, btm_pad+114, 32*cook_t, 16, arrow, opts);
        }

        {
          const below = SS_COLUMNS + flame;
          const size_x = 15;
          const opts = { z, tex_size_x: size_x/16, tex_size_y: -burn_t };
          geo_ui_quad(geo, view_proj, 59, btm_pad+114 + 16*burn_t, size_x, 16*-burn_t, below, opts);
        }
      }

      /* update the map_data furnace inv, clear out the items out of the player's inv */
      for (let i = 0; i < FURNACE_INDEX_COUNT; i++)
        furnace_inv[i] = itms[host_inv_i + i];
      for (let i = 0; i < FURNACE_INDEX_COUNT; i++)
        itms[host_inv_i + i] = 0;
    }

    if (state.inv.items[pickup_i])
      ui_item(mp[0]-8, mp[1]-8, state.inv.items[pickup_i]);
  }
}

function light_recalc() {
  for (const chunk_key of map_chunks_near(state.pos)) {
    const chunk = state.chunks[chunk_key];
    if (chunk == undefined) continue;
    const { x, z, light_src } = chunk;
    light_worker.postMessage({ chunk: { key: chunk_key, x, z, light_src } });
  }
  light_worker.postMessage({ compute: 1, around: state.pos });
}
function chunk_gen(chunk_key) {
  if (state.chunks[chunk_key] == undefined) {
    const [c_x, c_z] = chunk_key.split(',');
    map_chunk_add(c_x*MAP_SIZE, 0, c_z*MAP_SIZE);
  }

  state.chunks[chunk_key].genned = CHUNK_GEN_WIP;
  const { x, z } = state.chunks[chunk_key];
  worldgen_worker.postMessage({ chunk: { key: chunk_key, x, z } });
}
(async () => {
  const canvas = document.getElementById("p1");
  const gl = canvas.getContext("webgl", { antialias: false });

  const firstgen = {};
  const firstgen_range = 1;
  for (const chunk_key of map_chunks_near(state.pos, firstgen_range)) {
    firstgen[chunk_key] = { promise: undefined, res: undefined };
    firstgen[chunk_key].promise = new Promise(res => firstgen[chunk_key].res = res);
    chunk_gen(chunk_key);
  }

  worldgen_worker.onmessage = ({ data }) => {
    const { key, map, light_src, incidentals } = data.chunk;

    for (const chunk_key in incidentals) {
      const inc = incidentals[chunk_key];
      for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
        for (let t_y = 0; t_y < MAX_HEIGHT; t_y++) 
          for (let t_z = 0; t_z < MAP_SIZE; t_z++) {
            if (state.chunks[chunk_key] == undefined) {
              const [c_x, c_z] = chunk_key.split(',');
              map_chunk_add(c_x*MAP_SIZE, 0, c_z*MAP_SIZE);
            }
            state.chunks[chunk_key].incidentals = true;

            const i = map_index(t_x, t_y, t_z);
            if (inc.map[i] != ID_BLOCK_NONE && state.chunks[chunk_key].map[i] == ID_BLOCK_NONE) {
              state.chunks[chunk_key].map[i] = inc.map[i];
              state.chunks[chunk_key].dirty = 1;
            }
          }
    }
    const chunk = state.chunks[key];
    if (chunk.genned == CHUNK_GEN_DONE) debugger;
    chunk.light_src = light_src;
    if (chunk.incidentals == false)
      chunk.map = map;
    else {
      for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
        for (let t_y = 0; t_y < MAX_HEIGHT; t_y++) 
          for (let t_z = 0; t_z < MAP_SIZE; t_z++) {
            const i = map_index(t_x, t_y, t_z);
            if (chunk.map[i] == ID_BLOCK_NONE)
              chunk.map[i] = map[i];
          }
    }
    chunk.genned    = CHUNK_GEN_DONE;

    /* use light_src as placeholder for light until recalc */
    chunk.light.set(chunk.light_src);
    for (const i in chunk.light)
      if (chunk.light[i])
        chunk.light[i] = MAX_LIGHT;

    chunk.dirty = 1;

    light_recalc();

    if (firstgen[key]) {
      firstgen[key].res();
      delete firstgen[key];
    }
  };
  light_worker.onmessage = ({ data }) => {
    state.chunks[data.chunk_key].light = data.light;
    state.chunks[data.chunk_key].dirty = 1;
  };

  await Promise.all(Object.values(firstgen).map(x => x.promise));
  
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
    uniform_locations: {
      u_mvp: gl.getUniformLocation(shader_program, "u_mvp")
    },
  };

  await ss_sprite(gl);

  let geo = geo_create(gl, VERT_FLOATS * (1 << 20), 1 << 20);

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
    mining();

    /* gen more map on demand */
    {
      for (const chunk_key of map_chunks_near(state.pos)) {
        let chunk = state.chunks[chunk_key];
        if (chunk == undefined || chunk.genned == CHUNK_GEN_NO)
          chunk_gen(chunk_key);
      }
    }

    /* spritesheet shower helper thingy */
    if (0) {
      canvas.hidden = true;
      document.body.appendChild(spritesheet);
      spritesheet.style.position = 'absolute';
      spritesheet.style['top'] = '0px';
      spritesheet.style['left'] = '0px';
      document.body.style.background = 'black';
    }

    {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.clearColor(0.2, 0.3, 0.4, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    {
      geo.vrt_i = 0;
      geo.idx_i = 0;
      geo.default_view_proj = cam_view_proj();

      geo_fill(geo, gl, program_info, 0);
      geo_fill(geo, gl, program_info, 1);
      geo_fill(geo, gl, program_info, 2);
      geo_sync(geo, gl);
    }
    geo_draw(geo, gl, program_info, mat4_create());

    state.mouseclick = state.mouseclick_double = 0;
  });
})();
