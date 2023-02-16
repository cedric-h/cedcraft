"use strict";
// vim: sw=2 ts=2 expandtab smartindent ft=javascript

/* ENGINE
 *  [ ] Camera
 *  [ ] Skybox

 *  [ ] 2D Physics
 *  [ ] Jump
 *
 *  [ ] Splitscreen
 *  [ ] State Cache

 *  [ ] Networking
 *  [ ] Chat
 *
 * SANDBOX
 *  [ ] Break
 *  [ ] Place
 *  [ ] Pick Up
 *
 *  [ ] Hotbar
 *  [ ] Item break speeds
 *
 *  [ ] Inventory
 *  [ ] Furnace
 *  [ ] Chest
 *
 * DAY DREAM
 *  [ ] Grappling Hook
 *  [ ] World-in-a-Pot
 *  [ ] Pulleys
 */

const log = x => (console.log(x), x);
const VEC3_UP = [0, 1, 0];

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

let state = {
  pos: [0, 0, 6],
  cam: { yaw_deg: 0, pitch_deg: 0 },
  keysdown: {},
};
window.onmousemove = e => {
  if (!document.pointerLockElement) return;
  const dy = e.movementY * 0.35;
  const dx = e.movementX * 0.35;
  state.cam.pitch_deg = Math.max(-89, Math.min(89, state.cam.pitch_deg - dy));
  state.cam.yaw_deg = (state.cam.yaw_deg - dx) % 360;
};
window.onkeydown = e => state.keysdown[e.code] = 1;
window.onkeyup   = e => state.keysdown[e.code] = 0;
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

function draw_scene(gl, programInfo, geo) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const side = cross3(VEC3_UP, cam_looking());
  const fwd = cam_looking();
  fwd[1] = 0;
  norm(fwd);
  if (state.keysdown['KeyW']) state.pos = add3(state.pos, mul3_f( fwd,  0.1));
  if (state.keysdown['KeyS']) state.pos = add3(state.pos, mul3_f( fwd, -0.1));
  if (state.keysdown['KeyA']) state.pos = add3(state.pos, mul3_f(side,  0.1));
  if (state.keysdown['KeyD']) state.pos = add3(state.pos, mul3_f(side, -0.1));

  const fieldOfView = (45 * Math.PI) / 180;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4_perspective(fieldOfView, aspect, zNear, zFar);
  const eye = add3(state.pos, mul3_f(VEC3_UP, 1.8));
  const viewMatrix = mat4_target_to(eye, add3(cam_looking(), eye), VEC3_UP);
  const viewProjectionMatrix = projectionMatrix.multiply(viewMatrix.inverse());
  // const viewProjectionMatrix = viewMatrix.multiply(projectionMatrix);
  // const viewProjectionMatrix = projectionMatrix;

  const modelViewMatrix = new DOMMatrix();

  {
    const numComponents = 3;
    const type = gl.FLOAT; // the data in the buffer is 32bit floats
    const normalize = false; // don't normalize
    const stride = 0; // how many bytes to get from one set of values to the next
    // 0 = use type and numComponents above
    const offset = 0; // how many bytes inside the buffer to start from
    gl.bindBuffer(gl.ARRAY_BUFFER, geo.gpu_position);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.gpu_indices);
  gl.useProgram(programInfo.program);

  // Set the shader uniforms
  const mat_to_arr = mat => [
    mat.m11, mat.m12, mat.m13, mat.m14,
    mat.m21, mat.m22, mat.m23, mat.m24,
    mat.m31, mat.m32, mat.m33, mat.m34,
    mat.m41, mat.m42, mat.m43, mat.m44 
  ];
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.viewProjectionMatrix,
    false,
    mat_to_arr(viewProjectionMatrix)
  );
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.modelViewMatrix,
    false,
    mat_to_arr(modelViewMatrix)
  );

  {
    const vertexCount = 36;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, geo.vrts_used, type, offset);
  }
}

function initShaderProgram(gl) {
  const vsSource = `
    attribute vec4 aVertexPosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying lowp vec4 vColor;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vColor = vec4(1);
    }
  `;
  const fsSource = `
    varying lowp vec4 vColor;

    void main(void) {
      gl_FragColor = vColor;
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

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
    throw new Error(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        shaderProgram
      )}`
    );

  return shaderProgram;
}

(function main() {
  const canvas = document.getElementById("p1");
  const gl = canvas.getContext("webgl");

  if (gl === null) alert(
    "Unable to initialize WebGL. Your browser or machine may not support it."
  );

  const shaderProgram = initShaderProgram(gl);

  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
    },
    uniformLocations: {
      viewProjectionMatrix: gl.getUniformLocation(
        shaderProgram,
        "uProjectionMatrix"
      ),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
    },
  };

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

      function place_tile(t_x, t_y, t_z) {
        const tile_idx_i = vrt_i / 3;

        const positions = new Float32Array([
          // Top face
          0.0, 0.0, 0.0,
          0.0, 0.0, 1.0,
          1.0, 0.0, 1.0,
          1.0, 0.0, 0.0,
        ]);
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i + 0] + t_x;
          const y = positions[i + 1] + t_y;
          const z = positions[i + 2] + t_z;
          geo.cpu_position[vrt_i++] = x;
          geo.cpu_position[vrt_i++] = y;
          geo.cpu_position[vrt_i++] = z;
        }

        geo.cpu_indices[idx_i++] = tile_idx_i+0;
        geo.cpu_indices[idx_i++] = tile_idx_i+1;
        geo.cpu_indices[idx_i++] = tile_idx_i+2;
        geo.cpu_indices[idx_i++] = tile_idx_i+0;
        geo.cpu_indices[idx_i++] = tile_idx_i+2;
        geo.cpu_indices[idx_i++] = tile_idx_i+3;
      }
      for (let t_x = 0; t_x < 8; t_x++) 
        for (let t_z = 0; t_z < 8; t_z++) 
          if ((t_x^t_z)%2)
            place_tile(t_x, 0, t_z);
      place_tile(Math.floor(state.pos[0]),
                 Math.floor(state.pos[1]),
                 Math.floor(state.pos[2]));

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

    draw_scene(gl, programInfo, geo);
  });
})();
