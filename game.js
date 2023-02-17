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
const MAP_SIZE = 8;
const VERT_FLOATS = 4;

function lerp(v0, v1, t) { return (1 - t) * v0 + t * v1; }
function inv_lerp(min, max, p) { return (((p) - (min)) / ((max) - (min))); }
function ease_out_circ(x) {
  return Math.sqrt(1 - Math.pow(x - 1, 2));
}

function mat4_target_to(eye, target, up=VEC3_UP) {
  /**
   * Generates a matrix that makes something look at something else.
   *
   * eye = Position of the viewer
   * center = Point the viewer is looking at
   * up = vec3 pointing up
   * returns mat4 out
   */
  var eyex = eye[0],
      eyey = eye[1],
      eyez = eye[2],
      upx = up[0],
      upy = up[1],
      upz = up[2];
  var z0 = eyex - target[0],
      z1 = eyey - target[1],
      z2 = eyez - target[2];
  var len = z0 * z0 + z1 * z1 + z2 * z2;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
    z0 *= len;
    z1 *= len;
    z2 *= len;
  }

  var x0 = upy * z2 - upz * z1,
      x1 = upz * z0 - upx * z2,
      x2 = upx * z1 - upy * z0;
  len = x0 * x0 + x1 * x1 + x2 * x2;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
    x0 *= len;
    x1 *= len;
    x2 *= len;
  }

  const out = new DOMMatrix();
  out.m11 = x0;
  out.m12 = x1;
  out.m13 = x2;
  out.m14 = 0;
  out.m21 = z1 * x2 - z2 * x1;
  out.m22 = z2 * x0 - z0 * x2;
  out.m23 = z0 * x1 - z1 * x0;
  out.m24 = 0;
  out.m31 = z0;
  out.m32 = z1;
  out.m33 = z2;
  out.m34 = 0;
  out.m41 = eyex;
  out.m42 = eyey;
  out.m43 = eyez;
  out.m44 = 1;
  return out;
}
function mat4_perspective(fovy, aspect, near, far) {
  const out = new DOMMatrix();
  const f = 1.0 / Math.tan(fovy / 2);
  out.m11 = f / aspect;
  out.m12 = 0;
  out.m13 = 0;
  out.m14 = 0;
  out.m21 = 0;
  out.m22 = f;
  out.m23 = 0;
  out.m24 = 0;
  out.m31 = 0;
  out.m32 = 0;
  out.m34 = -1;
  out.m41 = 0;
  out.m42 = 0;
  out.m44 = 0;


  if (far != null && far !== Infinity) {
    const nf = 1 / (near - far);
    out.m33 = (far + near) * nf;
    out.m43 = 2 * far * near * nf;
  } else {
    out.m33 = -1;
    out.m43 = -2 * near;
  }

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
function add3(l, r) {
  return [l[0] + r[0],
          l[1] + r[1],
          l[2] + r[2]];
}
function mul3_f(v, f) {
  return [v[0] * f, v[1] * f, v[2] * f];
}
function ray_to_plane(p, v, n, d) {
  const denom = dot(n, v);
  if (Math.abs(denom) <= 0.0001) return;

  const t = -(dot(n, p) + d) / dot(n, v);
  if (t <= 0.0001) return;

  return add3(p, mul3_f(v, t));
}

let state = {
  pos: [0, 2, 6],
  map: new Uint8Array(MAP_SIZE * MAP_SIZE * MAP_SIZE),
  cam: { yaw_deg: 0, pitch_deg: 0 },
  keysdown: {},
  mousedown: 0,
  mining: { block_coord: undefined, ts_start: Date.now(), ts_end: Date.now() },
};
for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
  for (let t_z = 0; t_z < MAP_SIZE; t_z++) {
    const t_y = 1;
    state.map[t_x*MAP_SIZE*MAP_SIZE + t_y*MAP_SIZE + t_z] = (t_x^t_z)%2;
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

  if (e.button == 2) {
    e.preventDefault();

    const cast = ray_to_map(cam_eye(), cam_looking());

    if (cast.coord) {
      const p = [...cast.coord];
      p[cast.side] -= cast.dir;
      const index = p[0]*MAP_SIZE*MAP_SIZE + p[1]*MAP_SIZE + p[2];

      state.map[index] = 3;
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
  const dy = e.movementY * 0.35;
  const dx = e.movementX * 0.35;
  state.cam.pitch_deg = Math.max(-89, Math.min(89, state.cam.pitch_deg - dy));
  state.cam.yaw_deg = (state.cam.yaw_deg - dx) % 360;
};
window.onkeydown = e => state.keysdown[e.code] = 1;
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

function draw_scene(gl, program_info, geo) {
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const side = cross3(VEC3_UP, cam_looking());
  const fwd = cam_looking();
  fwd[1] = 0;
  norm(fwd);
  if (state.keysdown['KeyW']) state.pos = add3(state.pos, mul3_f( fwd,  0.1));
  if (state.keysdown['KeyS']) state.pos = add3(state.pos, mul3_f( fwd, -0.1));
  if (state.keysdown['KeyA']) state.pos = add3(state.pos, mul3_f(side,  0.1));
  if (state.keysdown['KeyD']) state.pos = add3(state.pos, mul3_f(side, -0.1));

  const cast = ray_to_map(cam_eye(), cam_looking());
  if (cast.coord && cast.coord+'' == state.mining.block_coord+'') {
    if (state.mining.ts_end < Date.now()) {
      const p = [...state.mining.block_coord];
      const index = p[0]*MAP_SIZE*MAP_SIZE + p[1]*MAP_SIZE + p[2];
      state.map[index] = 0;
    }
  } else {
    state.mining = { block_coord: undefined, ts_start: Date.now(), ts_end: Date.now() };
  }
  {
    const { block_coord, ts_end } = state.mining;
    if (state.mousedown && (block_coord == undefined || ts_end < Date.now())) {
      state.mining.block_coord = cast.coord;
      state.mining.ts_start = Date.now();
      state.mining.ts_end = Date.now() + 1000;
    }
  }

  const fieldOfView = (45 * Math.PI) / 180;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4_perspective(fieldOfView, aspect, zNear, zFar);
  const eye = cam_eye();
  const viewMatrix = mat4_target_to(eye, add3(cam_looking(), eye), VEC3_UP);
  const viewProjectionMatrix = projectionMatrix.multiply(viewMatrix.inverse());
  // const viewProjectionMatrix = viewMatrix.multiply(projectionMatrix);
  // const viewProjectionMatrix = projectionMatrix;

  const modelViewMatrix = new DOMMatrix();

  gl.bindBuffer(gl.ARRAY_BUFFER, geo.gpu_position);
  {
    gl.vertexAttribPointer(
      /* index         */ program_info.attribLocations.a_vpos,
      /* numComponents */ 4,
      /* type          */ gl.FLOAT,
      /* normalize     */ false,
      /* stride        */ VERT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      /* offset        */ 0
    );
    gl.enableVertexAttribArray(program_info.attribLocations.a_vpos);
  }
  {
    gl.vertexAttribPointer(
      /* index         */ program_info.attribLocations.a_tex_i,
      /* numComponents */ 2,
      /* type          */ gl.UNSIGNED_BYTE,
      /* normalize     */ false,
      /* stride        */ VERT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      /* offset        */           3 * Float32Array.BYTES_PER_ELEMENT,
    );
    gl.enableVertexAttribArray(program_info.attribLocations.a_tex_i);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.gpu_indices);
  gl.useProgram(program_info.program);

  // Set the shader uniforms
  const mat_to_arr = mat => [
    mat.m11, mat.m12, mat.m13, mat.m14,
    mat.m21, mat.m22, mat.m23, mat.m24,
    mat.m31, mat.m32, mat.m33, mat.m34,
    mat.m41, mat.m42, mat.m43, mat.m44 
  ];
  gl.uniformMatrix4fv(
    program_info.uniformLocations.viewProjectionMatrix,
    false,
    mat_to_arr(viewProjectionMatrix)
  );
  gl.uniformMatrix4fv(
    program_info.uniformLocations.modelViewMatrix,
    false,
    mat_to_arr(modelViewMatrix)
  );

  {
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, geo.idxs_used, type, offset);
  }
}

function init_shader_program(gl) {
  const vsSource = `
    attribute vec3 a_vpos;
    attribute vec2 a_tex_i;

    uniform mat4 u_mvp;
    uniform mat4 u_proj;

    varying lowp vec4 v_color;
    varying lowp vec2 v_texcoord;

    void main(void) {
      gl_Position = u_proj * u_mvp * vec4(a_vpos.x, a_vpos.y, a_vpos.z, 1.0);
      v_texcoord.x =   mod(a_tex_i.x , 15.0) / 16.0;
      v_texcoord.y = floor(a_tex_i.x / 15.0) / 16.0;
      if (a_tex_i.y == 2.0)
        v_color = vec4(vec3(0.6)*0.35, 0.35);
      else
        v_color = mix(vec4(1.0), vec4(0.48, 0.65, 0.4, 1), a_tex_i.y);
    }
  `;
  const fsSource = `
    varying lowp vec4 v_color;
    varying lowp vec2 v_texcoord;

    uniform sampler2D u_tex;

    void main(void) {
      gl_FragColor = v_color * texture2D(u_tex, v_texcoord);
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

  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

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

const SPRITESHEET_SCALE = 1024;
let spritesheet, ss_ctx;
async function ss_sprite(gl) {
  const img = new Image();
  img.src = `./terrain.png`;
  await new Promise(res => img.onload = res);

  if (spritesheet == undefined) {
    spritesheet = document.createElement("canvas");
    spritesheet.width = spritesheet.height = SPRITESHEET_SCALE;
    ss_ctx = spritesheet.getContext("2d");
  }

  ss_ctx.drawImage(img, 0, 0, SPRITESHEET_SCALE, SPRITESHEET_SCALE);

  gl_upload_image(gl, spritesheet, 0);
}

(async () => {
  const canvas = document.getElementById("p1");
  const gl = canvas.getContext("webgl");

  if (gl === null) alert(
    "Unable to initialize WebGL. Your browser or machine may not support it."
  );

  const shader_program = init_shader_program(gl);

  const program_info = {
    program: shader_program,
    attribLocations: {
      a_vpos: gl.getAttribLocation(shader_program, "a_vpos"),
      a_tex_i: gl.getAttribLocation(shader_program, "a_tex_i"),
    },
    uniformLocations: {
      viewProjectionMatrix: gl.getUniformLocation(
        shader_program,
        "u_proj"
      ),
      modelViewMatrix: gl.getUniformLocation(shader_program, "u_mvp"),
    },
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
    cpu_position: new Float32Array(1 << 15),
    gpu_indices: gl.createBuffer(),
    cpu_indices: new Uint16Array(1 << 15),
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
  let last;
  requestAnimationFrame(function render(now) {
    requestAnimationFrame(render);

    {
      let vrt_i = 0;
      let idx_i = 0;

      const ident = new DOMMatrix();
      function place_cube(t_x, t_y, t_z, tex_offset, opts={}) {
        const tile_idx_i = vrt_i / VERT_FLOATS;

        const positions = new Float32Array([
          0, 0, 1,   1, 0, 1,   1, 1, 1,   0, 1, 1, // Front face
          0, 0, 0,   0, 1, 0,   1, 1, 0,   1, 0, 0, // Back face
          0, 1, 0,   0, 1, 1,   1, 1, 1,   1, 1, 0, // Top face
          0, 0, 0,   1, 0, 0,   1, 0, 1,   0, 0, 1, // Bottom face
          1, 0, 0,   1, 1, 0,   1, 1, 1,   1, 0, 1, // Right face
          0, 0, 0,   0, 0, 1,   0, 1, 1,   0, 1, 0, // Left face
        ]);
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i + 0] - 0.5;
          const y = positions[i + 1] - 0.5;
          const z = positions[i + 2] - 0.5;
          const p = new DOMPoint(x, y, z).matrixTransform(opts.mat ?? ident);
          geo.cpu_position[vrt_i++] = p.x + 0.5 + t_x;
          geo.cpu_position[vrt_i++] = p.y + 0.5 + t_y;
          geo.cpu_position[vrt_i++] = p.z + 0.5 + t_z;

          const u8_cast = new Uint8Array(
            geo.cpu_position.buffer,
            Float32Array.BYTES_PER_ELEMENT * vrt_i++
          );

          if ((i/3)%4 == 0) u8_cast[0] = tex_offset +  0 + 0;
          if ((i/3)%4 == 1) u8_cast[0] = tex_offset +  0 + 1;
          if ((i/3)%4 == 2) u8_cast[0] = tex_offset + 15 + 1;
          if ((i/3)%4 == 3) u8_cast[0] = tex_offset + 15 + 0;

          u8_cast[1] = 0;
          if (tex_offset == 0)     u8_cast[1] = 1;
          if (opts.transparent || tex_offset >= 15*15) u8_cast[1] = 2;
        }

        for (const i_o of [
           0,  1,  2,  0,  2,  3, // front
           4,  5,  6,  4,  6,  7, // back
           8,  9, 10,  8, 10, 11, // top
          12, 13, 14, 12, 14, 15, // bottom
          16, 17, 18, 16, 18, 19, // right
          20, 21, 22, 20, 22, 23, // left
        ])
          geo.cpu_indices[idx_i++] = tile_idx_i+i_o;
      }

      for (let t_x = 0; t_x < MAP_SIZE; t_x++) 
        for (let t_y = 0; t_y < MAP_SIZE; t_y++) 
          for (let t_z = 0; t_z < MAP_SIZE; t_z++) {
            const index = t_x*MAP_SIZE*MAP_SIZE + t_y*MAP_SIZE + t_z;
            let draw = state.map[index];

            if (draw) place_cube(t_x, t_y, t_z, draw-1);
          }
      place_cube(Math.floor(state.pos[0]),
                 Math.floor(state.pos[1]) - 1,
                 Math.floor(state.pos[2]), 2);

      const cast = ray_to_map(cam_eye(), cam_looking());
      if (cast.coord && state.mining.block_coord) {
        let t = inv_lerp(state.mining.ts_start, state.mining.ts_end, Date.now());
        t = ease_out_circ(t);
        place_cube(...cast.coord, 15*15 + Math.floor(lerp(0, 10, t)));
      }
      if (cast.index != undefined                  &&
          cast.index <  MAP_SIZE*MAP_SIZE*MAP_SIZE &&
          cast.index >= 0                            
      ) {
        const p = [...cast.coord];
        const thickness = 0.04;
        p[cast.side] -= cast.dir*0.5;

        const scale = [1, 1, 1];
        scale[cast.side] = 0.004;
        const mat = new DOMMatrix().scale(...scale);
        place_cube(...p, 3*15 + 1, { mat, transparent: 1 });
      }

      // Create a buffer for the square's positions.
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.gpu_position);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, geo.cpu_position);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.gpu_indices);
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, geo.cpu_indices);

      geo.vrts_used = vrt_i;
      geo.idxs_used = idx_i;
    }

    let dt = 0;
    if (last != undefined) dt = now - last;
    last = now;

    draw_scene(gl, program_info, geo);
  });
})();
