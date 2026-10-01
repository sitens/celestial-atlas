// ===================== 25_post.js — HDR bloom (render target + dual-filter blur), keeps the log-depth scene intact =====================
const POST = { ok: false, rt: null, mips: [], quad: null, scene: null, cam: null, samples: 0, strength: 0.62, threshold: 0.85, knee: 0.55 };
const POST_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function postMat(fs, uniforms, additive) {
  return new THREE.ShaderMaterial({ uniforms, vertexShader: POST_VS, fragmentShader: fs, depthTest: false, depthWrite: false, transparent: !!additive, blending: additive ? THREE.AdditiveBlending : THREE.NoBlending });
}
function initPost() {
  try {
    const gl = renderer.getContext();
    if (!renderer.capabilities.isWebGL2 || !(renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'))) return;
    POST.scene = new THREE.Scene(); POST.cam = new THREE.Camera();
    POST.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat('void main(){ gl_FragColor = vec4(0.0); }', {}));
    POST.quad.frustumCulled = false; POST.scene.add(POST.quad);
    POST.pre = postMat(`
      precision highp float; uniform sampler2D tSrc; uniform vec2 texel; uniform float threshold, knee; varying vec2 vUv;
      vec3 pf(vec3 c){ float br = max(max(c.r, c.g), c.b); float s = clamp(br - threshold + knee, 0.0, 2.0 * knee); s = s * s / (4.0 * knee + 1e-4); return c * (max(s, br - threshold) / max(br, 1e-4)); }
      void main(){ vec3 c = (texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb) * 0.25;
        gl_FragColor = vec4(pf(min(c, vec3(24.0))), 1.0); }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: POST.threshold }, knee: { value: POST.knee } });
    POST.down = postMat(`
      precision highp float; uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.25 + (texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb) * 0.1875;
        gl_FragColor = vec4(c, 1.0); }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
    POST.up = postMat(`
      precision highp float; uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.25 + (texture2D(tSrc, vUv + texel * vec2(-1.0, 0.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, 0.0)).rgb + texture2D(tSrc, vUv + texel * vec2(0.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(0.0, 1.0)).rgb) * 0.125 + (texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb) * 0.0625;
        gl_FragColor = vec4(c, 1.0); }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } }, true);
    POST.comp = postMat(`
      precision highp float; uniform sampler2D tScene, tBloom; uniform float strength; uniform vec2 inv; varying vec2 vUv;
      vec3 px(vec2 uv){ return texture2D(tScene, uv).rgb + texture2D(tBloom, uv).rgb * strength; }
      float lum(vec3 c){ return sqrt(dot(min(c, vec3(1.0)), vec3(0.299, 0.587, 0.114))); }
      void main(){
        // FXAA-lite on perceptual luma, then add bloom (the HDR target is not multisampled: far cheaper on weak GPUs)
        vec3 m = px(vUv), nw = px(vUv + inv * vec2(-1.0, -1.0)), ne = px(vUv + inv * vec2(1.0, -1.0)), sw = px(vUv + inv * vec2(-1.0, 1.0)), se = px(vUv + inv * vec2(1.0, 1.0));
        float lM = lum(m), lNW = lum(nw), lNE = lum(ne), lSW = lum(sw), lSE = lum(se);
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
        float red = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0), rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
        dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * inv;
        vec3 a = 0.5 * (px(vUv + dir * (1.0 / 3.0 - 0.5)) + px(vUv + dir * (2.0 / 3.0 - 0.5)));
        vec3 b = a * 0.5 + 0.25 * (px(vUv + dir * -0.5) + px(vUv + dir * 0.5));
        float lB = lum(b);
        vec3 c = (lB < lMin || lB > lMax) ? a : b;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`, { tScene: { value: null }, tBloom: { value: null }, strength: { value: POST.strength }, inv: { value: new THREE.Vector2(1, 1) } });
    POST.ok = true; postResize();
  } catch (e) { console.warn('bloom disabled:', e); POST.ok = false; }
}
function postResize() {
  if (!POST.ok) return;
  const v = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(2, v.x | 0), h = Math.max(2, v.y | 0);
  if (POST.rt) POST.rt.dispose(); POST.mips.forEach(m => m.dispose()); POST.mips = [];
  const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, colorSpace: THREE.LinearSRGBColorSpace };
  POST.rt = new THREE.WebGLRenderTarget(w, h, Object.assign({ samples: window.__postSamples != null ? window.__postSamples : POST.samples }, opts));
  let mw = w, mh = h;
  for (let i = 0; i < 5; i++) { mw = Math.max(2, mw >> 1); mh = Math.max(2, mh >> 1); POST.mips.push(new THREE.WebGLRenderTarget(mw, mh, Object.assign({}, opts, { depthBuffer: false }))); }
}
function postPass(mat, target, src, autoClear) {
  POST.quad.material = mat; mat.uniforms.tSrc && (mat.uniforms.tSrc.value = src);
  if (mat.uniforms.texel && src) mat.uniforms.texel.value.set(1 / src.image.width, 1 / src.image.height);
  renderer.setRenderTarget(target); renderer.autoClear = autoClear; renderer.render(POST.scene, POST.cam); renderer.autoClear = true;
}
function renderScene(scn, cam) {
  if (!POST.ok || !S.tg.bloom) { renderer.setRenderTarget(null); renderer.render(scn, cam); return; }
  renderer.setRenderTarget(POST.rt); renderer.render(scn, cam);
  const m = POST.mips, rtex = POST.rt.texture;
  rtex.image = { width: POST.rt.width, height: POST.rt.height };
  POST.pre.uniforms.threshold.value = POST.threshold;
  postPass(POST.pre, m[0], rtex, true);
  for (let i = 1; i < m.length; i++) { m[i - 1].texture.image = { width: m[i - 1].width, height: m[i - 1].height }; postPass(POST.down, m[i], m[i - 1].texture, true); }
  for (let i = m.length - 2; i >= 0; i--) { m[i + 1].texture.image = { width: m[i + 1].width, height: m[i + 1].height }; postPass(POST.up, m[i], m[i + 1].texture, false); }
  POST.comp.uniforms.tScene.value = rtex; POST.comp.uniforms.tBloom.value = m[0].texture; POST.comp.uniforms.strength.value = POST.strength; POST.comp.uniforms.inv.value.set(1 / POST.rt.width, 1 / POST.rt.height);
  POST.quad.material = POST.comp; renderer.setRenderTarget(null); renderer.render(POST.scene, POST.cam);
}
