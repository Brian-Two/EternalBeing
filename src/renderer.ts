import * as THREE from 'three';

// One fullscreen quad, one über-shader. Every effect is driven by uHold (0→1):
// fruit state = warm grade + fine grain + soft vignette;
// flesh state = RGB shift + bad-tv distortion + crushed contrast + flicker.
// This mirrors the shader school Network Effect credits (Felix Turner et al.).

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D tFruit;
  uniform sampler2D tFlesh;
  uniform float uHold;        // eased hold progress 0..1
  uniform float uTime;
  uniform vec2 uCoverScale;   // cover-fit UV scaling
  uniform float uReducedMotion;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec3 desaturate(vec3 c, float f) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    return mix(c, vec3(l), f);
  }

  void main() {
    // cover-fit both textures (reels share 16:9 aspect)
    vec2 uv = (vUv - 0.5) * uCoverScale + 0.5;

    float motion = 1.0 - uReducedMotion;

    // --- fruit layer: stable, warm, dreamlike ---
    vec3 fruit = texture2D(tFruit, uv).rgb;
    fruit = desaturate(fruit, 0.18);
    fruit *= vec3(1.06, 1.0, 0.92);              // warm grade
    fruit = fruit * 0.94 + 0.035;                // lifted blacks, soft ceiling

    // --- flesh layer: distorted, cold-hot, degraded ---
    vec2 fuv = uv;
    // bad-tv style horizontal tearing, intermittent
    float tear = step(0.72, sin(uTime * 1.7) * sin(uTime * 0.53));
    fuv.x += sin(fuv.y * 90.0 + uTime * 13.0) * 0.006 * uHold * motion;
    fuv.x += tear * sin(fuv.y * 14.0 + uTime * 40.0) * 0.011 * uHold * motion;
    // occasional vertical roll
    fuv.y += tear * 0.015 * sin(uTime * 60.0) * uHold * motion;

    float shift = 0.004 + 0.004 * sin(uTime * 27.0) * motion;
    shift *= uHold;
    vec3 flesh;
    flesh.r = texture2D(tFlesh, fuv + vec2(shift, 0.0)).r;
    flesh.g = texture2D(tFlesh, fuv).g;
    flesh.b = texture2D(tFlesh, fuv - vec2(shift, 0.0)).b;
    flesh = desaturate(flesh, 0.35);
    flesh *= vec3(1.05, 0.9, 0.88);              // sickly warm-red cast
    flesh = (flesh - 0.5) * 1.35 + 0.42;         // crush + contrast
    // luminance flicker (capped; off under reduced motion)
    flesh *= 1.0 - 0.12 * motion * uHold * step(0.5, hash(vec2(floor(uTime * 24.0), 7.0)));

    // --- reveal: audio leads (JS), image flickers through 0.3–0.7s window ---
    float reveal = smoothstep(0.35, 1.0, uHold);
    // flicker between layers mid-transition
    float mid = smoothstep(0.3, 0.6, uHold) * (1.0 - smoothstep(0.85, 1.0, uHold));
    reveal += mid * (hash(vec2(floor(uTime * 30.0), 3.0)) - 0.5) * 0.8 * motion;
    reveal = clamp(reveal, 0.0, 1.0);

    vec3 color = mix(fruit, flesh, reveal);

    // --- film grain (fine → coarse with hold) ---
    float grainAmp = mix(0.035, 0.10, uHold);
    vec2 gseed = vUv * mix(700.0, 260.0, uHold);
    float grain = hash(gseed + fract(uTime) * 61.7) - 0.5;
    color += grain * grainAmp;

    // --- vignette (soft/wide → tight/dark) ---
    vec2 d = vUv - 0.5;
    float vr = length(d) * mix(1.15, 1.7, uHold);
    float vig = smoothstep(1.0, mix(0.35, 0.55, uHold), vr);
    color *= mix(0.82, 1.0, vig);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  private videoAspect = 16 / 9;

  constructor(
    canvas: HTMLCanvasElement,
    fruitVideo: HTMLVideoElement,
    fleshVideo: HTMLVideoElement,
    reducedMotion: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const tFruit = new THREE.VideoTexture(fruitVideo);
    const tFlesh = new THREE.VideoTexture(fleshVideo);
    for (const t of [tFruit, tFlesh]) {
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.colorSpace = THREE.SRGBColorSpace;
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        tFruit: { value: tFruit },
        tFlesh: { value: tFlesh },
        uHold: { value: 0 },
        uTime: { value: 0 },
        uCoverScale: { value: new THREE.Vector2(1, 1) },
        uReducedMotion: { value: reducedMotion ? 1 : 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  private resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const screenAspect = window.innerWidth / window.innerHeight;
    const scale = this.material.uniforms.uCoverScale.value as THREE.Vector2;
    if (screenAspect > this.videoAspect) {
      scale.set(1, this.videoAspect / screenAspect); // wide screen: crop top/bottom
    } else {
      scale.set(screenAspect / this.videoAspect, 1); // tall screen: crop sides
    }
  }

  render(holdT: number, timeSec: number) {
    this.material.uniforms.uHold.value = holdT;
    this.material.uniforms.uTime.value = timeSec;
    this.renderer.render(this.scene, this.camera);
  }
}
