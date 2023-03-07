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

function chunk_light_from_src(chunk) {
  for (let __x = 0; __x < MAP_SIZE; __x++) 
    for (let __y = 0; __y < MAX_HEIGHT; __y++) 
      for (let __z = 0; __z < MAP_SIZE; __z++) {

        const t_x = chunk.x + __x;
        const t_y =           __y;
        const t_z = chunk.z + __z;

        if (map_light_src(t_x, t_y, t_z)) {
          for (let o_x = -MAX_LIGHT; o_x <= MAX_LIGHT; o_x++)
            for (let o_z = -MAX_LIGHT; o_z <= MAX_LIGHT; o_z++) {
              const n_x = t_x + o_x;
              const n_y = t_y;
              const n_z = t_z + o_z;
              if (map_chunk(n_x, n_y, n_z) == undefined) continue;

              const light_now = map_light(n_x, n_y, n_z);
              const diffuse = MAX_LIGHT - (Math.abs(o_x) + Math.abs(o_z));
              map_light_set(n_x, n_y, n_z, Math.max(light_now, diffuse));
            }
        }
      }
}

let n_computes = 0;

onmessage = ({ data }) => {
  if (data.chunk) {
    state.chunks[data.chunk.key] = {
      x: data.chunk.x,
      z: data.chunk.z,
      light_src: data.chunk.light_src,
      light: new Uint8Array(MAP_SIZE*MAP_SIZE*MAX_HEIGHT)
    };
  }

  if (data.compute) {
    for (const chunk_key in state.chunks)
      state.chunks[chunk_key].light.fill(0);

    const keys = Object.keys(state.chunks);
    const compute = ++n_computes;
    (function do_chunk() {
      if (compute != n_computes) {
        console.log(`I'm compute ${compute} but current compute is ${n_computes}, bailing`);
        return;
      }

      console.log(`do_chunk: ${keys.length} keys left in ${n_computes} compute`);
      if (keys.length == 0) return;

      const chunk_key = keys.pop();
      chunk_light_from_src(state.chunks[chunk_key]);
      postMessage({ chunk_key, light: state.chunks[chunk_key].light });

      setTimeout(do_chunk);
    })();
  }
}
