// vim: sw=2 ts=2 expandtab smartindent ft=javascript

const MAP_SIZE = 16;
const MAX_HEIGHT = 64;
const MAX_LIGHT = 8;

const state = { chunks: {} };
const modulo = (n, d) => ((n % d) + d) % d;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const map_index = (x, y, z) => modulo(x, MAP_SIZE)    *MAP_SIZE*MAX_HEIGHT +
                               clamp(y, 0, MAX_HEIGHT)*MAP_SIZE +
                               modulo(z, MAP_SIZE);
const map_chunk = (x, y, z) => {
  const c_x = Math.floor(x / MAP_SIZE);
  const c_z = Math.floor(z / MAP_SIZE);
  const chunk_key = c_x + ',' + c_z;
  return state.chunks[chunk_key];
}
const map_light_src     = (x, y, z   ) => map_chunk(x, y, z).light_src[map_index(x, y, z)];
const map_light         = (x, y, z   ) => map_chunk(x, y, z).light    [map_index(x, y, z)];
const map_light_set     = (x, y, z, v) => map_chunk(x, y, z).light    [map_index(x, y, z)] = v;

function chunk_light_from_src(chunk, chunk_out) {
  for (let __x = 0; __x < MAP_SIZE; __x++) 
    for (let __y = 0; __y < MAX_HEIGHT; __y++) 
      for (let __z = 0; __z < MAP_SIZE; __z++) {

        const t_x = chunk.x + __x;
        const t_y =           __y;
        const t_z = chunk.z + __z;

        let light = Math.max(0, map_light(t_x, t_y, t_z)-1);
        if (map_light_src(t_x, t_y, t_z))
          light = MAX_LIGHT;
        else {
          for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
            let nbr_light = map_light(t_x+x, t_y+y, t_z+z);
            light = Math.max(light, nbr_light-1);
          }
        }
        chunk_out[map_index(__x, __y, __z)] = light;
      }
}

let n_computes = 0;

const chunk_out = new Uint8Array(MAP_SIZE*MAP_SIZE*MAX_HEIGHT);
let invocation_i = 0;
onmessage = async ({ data }) => {
  if (data.chunk) {
    state.chunks[data.chunk.key] = {
      x: data.chunk.x,
      z: data.chunk.z,
      light_src: data.chunk.light_src,
      light: new Uint8Array(MAP_SIZE*MAP_SIZE*MAX_HEIGHT)
    };
  }

  if (data.compute) {
    for (const chunk_key in state.chunks) {
      const chunk = state.chunks[chunk_key];
      chunk.light.fill(0);
    }

    const my_invocation = ++invocation_i;
    for (let i = 0; i < MAX_LIGHT; i++) {
      for (const chunk_key in state.chunks) {
        const chunk = state.chunks[chunk_key];
        chunk_out.fill(0);
        chunk_light_from_src(chunk, chunk_out);
        chunk.light.set(chunk_out);
      }
      await new Promise(res => setTimeout(res));
      if (invocation_i != my_invocation) return;
    }

    for (const chunk_key in state.chunks)
      postMessage({ chunk_key, light: state.chunks[chunk_key].light });
  }
}
