// vim: sw=2 ts=2 expandtab smartindent ft=javascript

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

function noise3(
  x,      y,      z,
  x_wrap, y_wrap, z_wrap,
  seed
) {
  // not same permutation table as Perlin's reference to avoid copyright issues;
  // Perlin's table can be found at http://mrl.nyu.edu/~perlin/noise/
  // static unsigned char stb__perlin_randtab[512] =
  const stb__perlin_randtab = [
     23, 125, 161, 52, 103, 117, 70, 37, 247, 101, 203, 169, 124, 126, 44, 123,
     152, 238, 145, 45, 171, 114, 253, 10, 192, 136, 4, 157, 249, 30, 35, 72,
     175, 63, 77, 90, 181, 16, 96, 111, 133, 104, 75, 162, 93, 56, 66, 240,
     8, 50, 84, 229, 49, 210, 173, 239, 141, 1, 87, 18, 2, 198, 143, 57,
     225, 160, 58, 217, 168, 206, 245, 204, 199, 6, 73, 60, 20, 230, 211, 233,
     94, 200, 88, 9, 74, 155, 33, 15, 219, 130, 226, 202, 83, 236, 42, 172,
     165, 218, 55, 222, 46, 107, 98, 154, 109, 67, 196, 178, 127, 158, 13, 243,
     65, 79, 166, 248, 25, 224, 115, 80, 68, 51, 184, 128, 232, 208, 151, 122,
     26, 212, 105, 43, 179, 213, 235, 148, 146, 89, 14, 195, 28, 78, 112, 76,
     250, 47, 24, 251, 140, 108, 186, 190, 228, 170, 183, 139, 39, 188, 244, 246,
     132, 48, 119, 144, 180, 138, 134, 193, 82, 182, 120, 121, 86, 220, 209, 3,
     91, 241, 149, 85, 205, 150, 113, 216, 31, 100, 41, 164, 177, 214, 153, 231,
     38, 71, 185, 174, 97, 201, 29, 95, 7, 92, 54, 254, 191, 118, 34, 221,
     131, 11, 163, 99, 234, 81, 227, 147, 156, 176, 17, 142, 69, 12, 110, 62,
     27, 255, 0, 194, 59, 116, 242, 252, 19, 21, 187, 53, 207, 129, 64, 135,
     61, 40, 167, 237, 102, 223, 106, 159, 197, 189, 215, 137, 36, 32, 22, 5,

     // and a second copy so we don't need an extra mask or static initializer
     23, 125, 161, 52, 103, 117, 70, 37, 247, 101, 203, 169, 124, 126, 44, 123,
     152, 238, 145, 45, 171, 114, 253, 10, 192, 136, 4, 157, 249, 30, 35, 72,
     175, 63, 77, 90, 181, 16, 96, 111, 133, 104, 75, 162, 93, 56, 66, 240,
     8, 50, 84, 229, 49, 210, 173, 239, 141, 1, 87, 18, 2, 198, 143, 57,
     225, 160, 58, 217, 168, 206, 245, 204, 199, 6, 73, 60, 20, 230, 211, 233,
     94, 200, 88, 9, 74, 155, 33, 15, 219, 130, 226, 202, 83, 236, 42, 172,
     165, 218, 55, 222, 46, 107, 98, 154, 109, 67, 196, 178, 127, 158, 13, 243,
     65, 79, 166, 248, 25, 224, 115, 80, 68, 51, 184, 128, 232, 208, 151, 122,
     26, 212, 105, 43, 179, 213, 235, 148, 146, 89, 14, 195, 28, 78, 112, 76,
     250, 47, 24, 251, 140, 108, 186, 190, 228, 170, 183, 139, 39, 188, 244, 246,
     132, 48, 119, 144, 180, 138, 134, 193, 82, 182, 120, 121, 86, 220, 209, 3,
     91, 241, 149, 85, 205, 150, 113, 216, 31, 100, 41, 164, 177, 214, 153, 231,
     38, 71, 185, 174, 97, 201, 29, 95, 7, 92, 54, 254, 191, 118, 34, 221,
     131, 11, 163, 99, 234, 81, 227, 147, 156, 176, 17, 142, 69, 12, 110, 62,
     27, 255, 0, 194, 59, 116, 242, 252, 19, 21, 187, 53, 207, 129, 64, 135,
     61, 40, 167, 237, 102, 223, 106, 159, 197, 189, 215, 137, 36, 32, 22, 5,
  ];


  // perlin's gradient has 12 cases so some get used 1/16th of the time
  // and some 2/16ths. We reduce bias by changing those fractions
  // to 5/64ths and 6/64ths

  // this array is designed to match the previous implementation
  // of gradient hash: indices[stb__perlin_randtab[i]&63]
  // static unsigned char stb__perlin_randtab_grad_idx[512] =
  const stb__perlin_randtab_grad_idx = [
      7, 9, 5, 0, 11, 1, 6, 9, 3, 9, 11, 1, 8, 10, 4, 7,
      8, 6, 1, 5, 3, 10, 9, 10, 0, 8, 4, 1, 5, 2, 7, 8,
      7, 11, 9, 10, 1, 0, 4, 7, 5, 0, 11, 6, 1, 4, 2, 8,
      8, 10, 4, 9, 9, 2, 5, 7, 9, 1, 7, 2, 2, 6, 11, 5,
      5, 4, 6, 9, 0, 1, 1, 0, 7, 6, 9, 8, 4, 10, 3, 1,
      2, 8, 8, 9, 10, 11, 5, 11, 11, 2, 6, 10, 3, 4, 2, 4,
      9, 10, 3, 2, 6, 3, 6, 10, 5, 3, 4, 10, 11, 2, 9, 11,
      1, 11, 10, 4, 9, 4, 11, 0, 4, 11, 4, 0, 0, 0, 7, 6,
      10, 4, 1, 3, 11, 5, 3, 4, 2, 9, 1, 3, 0, 1, 8, 0,
      6, 7, 8, 7, 0, 4, 6, 10, 8, 2, 3, 11, 11, 8, 0, 2,
      4, 8, 3, 0, 0, 10, 6, 1, 2, 2, 4, 5, 6, 0, 1, 3,
      11, 9, 5, 5, 9, 6, 9, 8, 3, 8, 1, 8, 9, 6, 9, 11,
      10, 7, 5, 6, 5, 9, 1, 3, 7, 0, 2, 10, 11, 2, 6, 1,
      3, 11, 7, 7, 2, 1, 7, 3, 0, 8, 1, 1, 5, 0, 6, 10,
      11, 11, 0, 2, 7, 0, 10, 8, 3, 5, 7, 1, 11, 1, 0, 7,
      9, 0, 11, 5, 10, 3, 2, 3, 5, 9, 7, 9, 8, 4, 6, 5,

      // and a second copy so we don't need an extra mask or static initializer
      7, 9, 5, 0, 11, 1, 6, 9, 3, 9, 11, 1, 8, 10, 4, 7,
      8, 6, 1, 5, 3, 10, 9, 10, 0, 8, 4, 1, 5, 2, 7, 8,
      7, 11, 9, 10, 1, 0, 4, 7, 5, 0, 11, 6, 1, 4, 2, 8,
      8, 10, 4, 9, 9, 2, 5, 7, 9, 1, 7, 2, 2, 6, 11, 5,
      5, 4, 6, 9, 0, 1, 1, 0, 7, 6, 9, 8, 4, 10, 3, 1,
      2, 8, 8, 9, 10, 11, 5, 11, 11, 2, 6, 10, 3, 4, 2, 4,
      9, 10, 3, 2, 6, 3, 6, 10, 5, 3, 4, 10, 11, 2, 9, 11,
      1, 11, 10, 4, 9, 4, 11, 0, 4, 11, 4, 0, 0, 0, 7, 6,
      10, 4, 1, 3, 11, 5, 3, 4, 2, 9, 1, 3, 0, 1, 8, 0,
      6, 7, 8, 7, 0, 4, 6, 10, 8, 2, 3, 11, 11, 8, 0, 2,
      4, 8, 3, 0, 0, 10, 6, 1, 2, 2, 4, 5, 6, 0, 1, 3,
      11, 9, 5, 5, 9, 6, 9, 8, 3, 8, 1, 8, 9, 6, 9, 11,
      10, 7, 5, 6, 5, 9, 1, 3, 7, 0, 2, 10, 11, 2, 6, 1,
      3, 11, 7, 7, 2, 1, 7, 3, 0, 8, 1, 1, 5, 0, 6, 10,
      11, 11, 0, 2, 7, 0, 10, 8, 3, 5, 7, 1, 11, 1, 0, 7,
      9, 0, 11, 5, 10, 3, 2, 3, 5, 9, 7, 9, 8, 4, 6, 5,
  ];

  function stb__perlin_lerp(a, b, t) { return a + (b-a) * t; }

  const stb__perlin_fastfloor = Math.floor;

  // different grad function from Perlin's, but easy to modify to match reference
  function stb__perlin_grad(grad_idx, x, y, z) {
    // static float basis[12][4] =
    const basis = [
      [  1, 1, 0 ],
      [ -1, 1, 0 ],
      [  1,-1, 0 ],
      [ -1,-1, 0 ],
      [  1, 0, 1 ],
      [ -1, 0, 1 ],
      [  1, 0,-1 ],
      [ -1, 0,-1 ],
      [  0, 1, 1 ],
      [  0,-1, 1 ],
      [  0, 1,-1 ],
      [  0,-1,-1 ],
    ];

    const grad = basis[grad_idx];
    return grad[0]*x + grad[1]*y + grad[2]*z;
  }

  let u,v,w;
  let n000,n001,n010,n011,n100,n101,n110,n111;
  let n00,n01,n10,n11;
  let n0,n1;

  let x_mask = (x_wrap-1) & 255;
  let y_mask = (y_wrap-1) & 255;
  let z_mask = (z_wrap-1) & 255;
  let px = stb__perlin_fastfloor(x);
  let py = stb__perlin_fastfloor(y);
  let pz = stb__perlin_fastfloor(z);
  let x0 = px & x_mask, x1 = (px+1) & x_mask;
  let y0 = py & y_mask, y1 = (py+1) & y_mask;
  let z0 = pz & z_mask, z1 = (pz+1) & z_mask;
  let r0,r1, r00,r01,r10,r11;

  const stb__perlin_ease = a => (((a*6-15)*a + 10) * a * a * a);

  x -= px; u = stb__perlin_ease(x);
  y -= py; v = stb__perlin_ease(y);
  z -= pz; w = stb__perlin_ease(z);

  r0 = stb__perlin_randtab[x0+seed];
  r1 = stb__perlin_randtab[x1+seed];

  r00 = stb__perlin_randtab[r0+y0];
  r01 = stb__perlin_randtab[r0+y1];
  r10 = stb__perlin_randtab[r1+y0];
  r11 = stb__perlin_randtab[r1+y1];

  n000 = stb__perlin_grad(stb__perlin_randtab_grad_idx[r00+z0], x  , y  , z   );
  n001 = stb__perlin_grad(stb__perlin_randtab_grad_idx[r00+z1], x  , y  , z-1 );
  n010 = stb__perlin_grad(stb__perlin_randtab_grad_idx[r01+z0], x  , y-1, z   );
  n011 = stb__perlin_grad(stb__perlin_randtab_grad_idx[r01+z1], x  , y-1, z-1 );
  n100 = stb__perlin_grad(stb__perlin_randtab_grad_idx[r10+z0], x-1, y  , z   );
  n101 = stb__perlin_grad(stb__perlin_randtab_grad_idx[r10+z1], x-1, y  , z-1 );
  n110 = stb__perlin_grad(stb__perlin_randtab_grad_idx[r11+z0], x-1, y-1, z   );
  n111 = stb__perlin_grad(stb__perlin_randtab_grad_idx[r11+z1], x-1, y-1, z-1 );

  n00 = stb__perlin_lerp(n000,n001,w);
  n01 = stb__perlin_lerp(n010,n011,w);
  n10 = stb__perlin_lerp(n100,n101,w);
  n11 = stb__perlin_lerp(n110,n111,w);

  n0 = stb__perlin_lerp(n00,n01,v);
  n1 = stb__perlin_lerp(n10,n11,v);

  return stb__perlin_lerp(n0,n1,u);
}
function fbm3(x, y, z, lacunarity, gain, octaves, seed_offset=0) {
  let freq = 1;
  let amp = 1;
  let sum = 0;

  for (let i = 0; i < octaves; i++) {
    sum += noise3(x*freq, y*freq, z*freq, 0, 0, 0, seed_offset+i)*amp;
    freq *= lacunarity;
    amp *= gain;
  }

  return sum;
}

const MAP_SIZE = 16;
const MAX_HEIGHT = 64;
const MAX_LIGHT = 8;

const LIGHT_SRC_NONE  = 0;
const LIGHT_SRC_SUN   = 1;
const LIGHT_SRC_TORCH = 2;

const modulo = (n, d) => ((n % d) + d) % d;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const map_index = (x, y, z) => modulo(x, MAP_SIZE)    *MAP_SIZE*MAX_HEIGHT +
                               clamp(y, 0, MAX_HEIGHT)*MAP_SIZE +
                               modulo(z, MAP_SIZE);
const map_chunk_key = (x, y, z) => {
  const c_x = Math.floor(x / MAP_SIZE);
  const c_z = Math.floor(z / MAP_SIZE);
  const chunk_key = c_x + ',' + c_z;
  return chunk_key;
}

function place_tree(chunk_get, chunk_set, t_x, t_y, t_z) {
  const height = 4 + (Math.random() < 0.4) +
                     (Math.random() < 0.3);

  for (let i = 0; i < height; i++)
    chunk_set(t_x, t_y++, t_z, ID_BLOCK_LOG);
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
          if (chunk_get(x, y, z) != ID_BLOCK_NONE) continue;
          chunk_set(x, y, z, ID_BLOCK_LEAVES);
        }
      }
}

function chunk_gen(chunk_key, c_x, c_y, c_z) {
  const chunk = {
    light_src: new Uint8Array(MAP_SIZE*MAX_HEIGHT*MAP_SIZE),
    map: new Uint8Array(MAP_SIZE*MAX_HEIGHT*MAP_SIZE),
    incidentals: {}
  };

  chunk.light_src.fill(0);

  const OCTAVES = 8;

  const cave = [...Array(MAP_SIZE*MAX_HEIGHT*MAP_SIZE)].fill(0);
  const dirt_height = [...Array(MAP_SIZE*MAP_SIZE)].fill(0);
  const stone_height = [...Array(MAP_SIZE*MAP_SIZE)].fill(0);
  for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
    for (let t_z = 0; t_z < MAP_SIZE; t_z++) {
      const range = MAP_SIZE;
      const dirt  = fbm3((c_x + t_x)/range, 0.000, (c_z + t_z)/range, 2, 0.3, OCTAVES);
      const stone = fbm3((c_x + t_x)/range, 0.100, (c_z + t_z)/range, 2, 0.3, OCTAVES);
      const i2D = t_z*MAP_SIZE + t_x;
       dirt_height[i2D] = Math.ceil(30 + 15* dirt* dirt);
      stone_height[i2D] = Math.ceil(28 + 15*stone*stone);

      for (let i = 0; i < dirt_height[i2D]+1; i++) {
        const range = MAP_SIZE;
        const height_t = Math.min(1, i/40);
        const mid_t = 2*Math.abs(0.5 - height_t);
        // console.log({ height_t, mid_t });
        const f = fbm3((c_x + t_x)/range, i / range, (c_z + t_z)/range, 2, 0.5, OCTAVES, 202);
        cave[map_index(t_x, i, t_z)] = f < lerp(-0.2, -0.75, mid_t);
      }
    }

  const chunk_light_src_set = (x, y, z, val) => {
    if (map_chunk_key(c_x + x, c_y + y, c_z + z) != chunk_key) return;
    return chunk.light_src[map_index(x, y, z)] = val;
  };
  const chunk_set = (x, y, z, val) => {
    if (map_chunk_key(c_x + x, c_y + y, c_z + z) != chunk_key) return;
    return chunk.map[map_index(x, y, z)] = val;
  };
  const chunk_get = (x, y, z     ) => {
    if (map_chunk_key(c_x + x, c_y + y, c_z + z) != chunk_key) return;
    return chunk.map[map_index(x, y, z)];
  };

  for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
    for (let t_z = 0; t_z < MAP_SIZE; t_z++) {
      const t_y     = dirt_height[t_z*MAP_SIZE + t_x];
      const stone_y = stone_height[t_z*MAP_SIZE + t_x];

      let flower;
      {
        if (Math.random() < ( 8/(MAP_SIZE*MAP_SIZE)))
          flower = (Math.random() < 0.5) ? ID_BLOCK_FLOWER0 : ID_BLOCK_FLOWER1;
        if (Math.random() < (16/(MAP_SIZE*MAP_SIZE)))
          flower = ID_BLOCK_FLOWER2;
      }
      if (flower) chunk_set(t_x, t_y+1, t_z, flower);

      if (!cave[map_index(t_x, t_y, t_z)])
        chunk_set(t_x, t_y, t_z, ID_BLOCK_GRASS);

      for (let i = 0; i <= t_y; i++) {
        if (i > 0 && cave[map_index(t_x, i, t_z)])
          continue;

        if (i < stone_y)
          chunk_set(t_x, i, t_z, ID_BLOCK_STONE);
        else
          chunk_set(t_x, i, t_z, ID_BLOCK_DIRT);
      }
    }

  for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
    for (let t_y = 0; t_y < MAX_HEIGHT; t_y++) 
      for (let t_z = 0; t_z < MAP_SIZE; t_z++) {

        if (chunk_get(t_x, t_y, t_z) == ID_BLOCK_STONE) {
          {
            const min_height = 0;
            const max_height = 20;
            const height_range = max_height - min_height;
            const t = 1 - Math.abs(0.5 - inv_lerp(min_height, max_height, t_y));
            const per_chunk_avg = 25;
            const freq = per_chunk_avg/(MAP_SIZE*MAP_SIZE*height_range);
            if (Math.random() < t*freq) {
              let vein_size = Math.ceil(3 + 3*Math.random() + Math.random()*Math.random());
              const v = [t_x, t_y, t_z];
              for (let i = 0; i < vein_size; i++) {
                v[Math.floor(Math.random() * 3)] += (Math.random() < 0.5) ? -1 : 1;

                if (chunk_key == map_chunk_key(c_x + v[0], c_y + v[1], c_z + v[2]))
                  if (chunk_get(v[0], v[1], v[2]) == ID_BLOCK_STONE)
                    chunk_set(v[0], v[1], v[2], ID_BLOCK_ORE_T2);
              }
            }
          }
          {
            const min_height = 10;
            const max_height = 30;
            const height_range = max_height - min_height;
            const t = 1 - Math.abs(0.5 - inv_lerp(min_height, max_height, t_y));
            const per_chunk_avg = 45;
            const freq = per_chunk_avg/(MAP_SIZE*MAP_SIZE*height_range);
            if (Math.random() < t*freq) {
              let vein_size = Math.ceil(5 + 4*Math.random());
              const v = [t_x, t_y, t_z];
              for (let i = 0; i < vein_size; i++) {
                v[Math.floor(Math.random() * 3)] += (Math.random() < 0.5) ? -1 : 1;

                if (chunk_key == map_chunk_key(c_x + v[0], c_y + v[1], c_z + v[2]))
                  if (chunk_get(v[0], v[1], v[2]) == ID_BLOCK_STONE)
                    chunk_set(v[0], v[1], v[2], ID_BLOCK_ORE_COAL);
              }
            }
          }
        }

      }

  if (0) for (let i = 0; i < 4; i++) {
    let t_x = 3;
    let t_y = 45;
    let t_z = 1+i;
    chunk_set(t_x, t_y, t_z, ID_BLOCK_WATER);
  }

  for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
    for (let t_z = 0; t_z < MAP_SIZE; t_z++) {
      let t_y = MAX_HEIGHT-1;
      while (t_y > 0) {
        const block_id = chunk_get(t_x, t_y, t_z);
        if (VOXEL_PERFECT[block_id]) {
          if (block_id == ID_BLOCK_DIRT)
            chunk_set(t_x, t_y, t_z, ID_BLOCK_GRASS);
          break;
        }
        chunk_light_src_set(t_x, t_y, t_z, LIGHT_SRC_SUN);
        t_y--;
      }
    }

  return chunk;
}

function chunk_growth(chunk_key, chunk, c_x, c_y, c_z) {
  const chunk_light_src_set = (x, y, z, val) => {
    if (map_chunk_key(c_x + x, c_y + y, c_z + z) != chunk_key) return;
    return chunk.light_src[map_index(x, y, z)] = val;
  };
  const chunk_set = (x, y, z, val) => {
    const xyz_key = map_chunk_key(c_x + x, c_y + y, c_z + z);
    if (xyz_key != chunk_key) {
      chunk.incidentals[xyz_key] ??= {};
      chunk.incidentals[xyz_key].map ??= new Uint8Array(MAP_SIZE*MAX_HEIGHT*MAP_SIZE);
      chunk.incidentals[xyz_key].map[map_index(c_x + x, c_y + y, c_z + z)] = val;
      return;
    }
    return chunk.map[map_index(x, y, z)] = val;
  };
  const chunk_get = (x, y, z     ) => {
    if (map_chunk_key(c_x + x, c_y + y, c_z + z) != chunk_key)
      return ID_BLOCK_NONE;
    return chunk.map[map_index(x, y, z)];
  };

  for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
    for (let t_z = 0; t_z < MAP_SIZE; t_z++) {
      let t_y = MAX_HEIGHT-1;
      while (t_y > 0) {
        const block_id = chunk_get(t_x, t_y, t_z);
        if (VOXEL_PERFECT[block_id]) {
          if (block_id == ID_BLOCK_GRASS && Math.random() < 0.01) {
            place_tree(chunk_get, chunk_set, t_x, t_y, t_z);

            /* wood rendered in separate pass, has bug makes darker */
            chunk_light_src_set(t_x, t_y, t_z, LIGHT_SRC_SUN);
          }
          break;
        }
        t_y--;
      }
    }
}


onmessage = async ({ data }) => {
  if (data.chunk) {
    const { key, x, z } = data.chunk;

    const chunk = chunk_gen(key, x, 0, z);
    chunk_growth(key, chunk, x, 0, z);

    const { light_src, map, incidentals } = chunk;
    postMessage({ chunk: { key, x, z, light_src, map, incidentals } });
  }
}
