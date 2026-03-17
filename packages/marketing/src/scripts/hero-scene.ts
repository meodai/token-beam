import * as THREE from 'three';

const COLORS = ['#ff6347', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const SHAPE_COUNT = 14;
const TOKEN_SPEED = 0.6;

interface ShapeNode {
  mesh: THREE.Mesh;
  originalColor: THREE.Color;
  lit: boolean;
  litTime: number;
}

export function initHeroScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();

  // Isometric-style camera
  const frustum = 1;
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const camera = new THREE.OrthographicCamera(
    -frustum * aspect,
    frustum * aspect,
    frustum,
    -frustum,
    0.1,
    100,
  );
  camera.position.set(12, 10, 12);
  camera.lookAt(0, 0, 0);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // Wireframe material for unlit shapes
  const wireMat = new THREE.MeshStandardMaterial({
    color: 0x292f2f,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });

  // Create abstract shapes at random positions
  const geometries = [
    () => new THREE.BoxGeometry(0.8, 0.8, 0.8),
    () => new THREE.ConeGeometry(0.5, 1, 6),
    () => new THREE.CylinderGeometry(0.4, 0.4, 0.9, 8),
    () => new THREE.OctahedronGeometry(0.5),
    () => new THREE.TetrahedronGeometry(0.6),
    () => new THREE.TorusGeometry(0.4, 0.15, 8, 16),
    () => new THREE.DodecahedronGeometry(0.45),
  ];

  const nodes: ShapeNode[] = [];
  const spread = 6;

  for (let i = 0; i < SHAPE_COUNT; i++) {
    const geo = geometries[i % geometries.length]();
    const mesh = new THREE.Mesh(geo, wireMat.clone());

    // Spread shapes in a rough grid with jitter
    const angle = (i / SHAPE_COUNT) * Math.PI * 2;
    const radius = 1.5 + Math.random() * spread;
    mesh.position.set(
      Math.cos(angle) * radius + (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 1.5,
      Math.sin(angle) * radius + (Math.random() - 0.5) * 2,
    );
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    mesh.scale.setScalar(0.8 + Math.random() * 0.8);

    scene.add(mesh);
    nodes.push({
      mesh,
      originalColor: new THREE.Color(0x292f2f),
      lit: false,
      litTime: 0,
    });
  }

  // Token sphere
  const tokenGeo = new THREE.SphereGeometry(0.2, 16, 16);
  const tokenMat = new THREE.MeshStandardMaterial({
    color: 0xff6347,
    emissive: 0xff6347,
    emissiveIntensity: 0.4,
  });
  const token = new THREE.Mesh(tokenGeo, tokenMat);
  scene.add(token);

  // Path line between current and next shape
  const pathGeo = new THREE.BufferGeometry();
  const pathPositions = new Float32Array(6);
  pathGeo.setAttribute('position', new THREE.BufferAttribute(pathPositions, 3));
  const pathMat = new THREE.LineBasicMaterial({
    color: 0xff6347,
    transparent: true,
    opacity: 0.15,
  });
  const pathLine = new THREE.Line(pathGeo, pathMat);
  scene.add(pathLine);

  // Path: token visits shapes in sequence
  let currentTarget = 0;
  let nextTarget = 1;
  let progress = 0;
  let colorIndex = 0;

  // Camera offset from token
  const cameraOffset = new THREE.Vector3(12, 10, 12);
  const cameraLookTarget = new THREE.Vector3();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const a = w / h;
    camera.left = -frustum * a;
    camera.right = frustum * a;
    camera.top = frustum;
    camera.bottom = -frustum;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  resize();
  window.addEventListener('resize', resize);

  // Detect dark mode
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function updateTheme() {
    const isDark = darkQuery.matches;
    const baseColor = isDark ? 0xffffff : 0x292f2f;
    wireMat.color.set(baseColor);
    nodes.forEach((n) => {
      if (!n.lit) {
        (n.mesh.material as THREE.MeshStandardMaterial).color.set(baseColor);
      }
      n.originalColor.set(baseColor);
    });
  }
  updateTheme();
  darkQuery.addEventListener('change', updateTheme);

  let time = 0;

  function animate() {
    requestAnimationFrame(animate);
    time += 0.016;

    // Move token along path
    const from = nodes[currentTarget].mesh.position;
    const to = nodes[nextTarget].mesh.position;
    progress += TOKEN_SPEED * 0.016 / from.distanceTo(to);

    if (progress >= 1) {
      // Arrived — light up the shape
      const node = nodes[nextTarget];
      const color = new THREE.Color(COLORS[colorIndex % COLORS.length]);
      const mat = node.mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(color);
      mat.wireframe = false;
      mat.opacity = 1;
      mat.emissive.copy(color);
      mat.emissiveIntensity = 0.2;
      node.lit = true;
      node.litTime = time;

      // Update token color
      colorIndex++;
      const nextColor = new THREE.Color(COLORS[colorIndex % COLORS.length]);
      tokenMat.color.copy(nextColor);
      tokenMat.emissive.copy(nextColor);
      pathMat.color.copy(nextColor);

      // Pick next target
      currentTarget = nextTarget;
      nextTarget = (nextTarget + 1) % nodes.length;
      progress = 0;
    }

    // Interpolate token position with ease-in-out
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    token.position.lerpVectors(from, to, eased);

    // Draw path line from source to target, fade out as token approaches
    pathPositions[0] = from.x;
    pathPositions[1] = from.y;
    pathPositions[2] = from.z;
    pathPositions[3] = to.x;
    pathPositions[4] = to.y;
    pathPositions[5] = to.z;
    pathGeo.attributes.position.needsUpdate = true;
    pathMat.opacity = 0.6 * (1 - eased);

    // Gentle shape rotation
    nodes.forEach((n) => {
      n.mesh.rotation.y += 0.003;
      n.mesh.rotation.x += 0.001;
    });

    // Camera smoothly follows token
    cameraLookTarget.lerp(token.position, 0.02);
    camera.position.copy(cameraLookTarget).add(cameraOffset);
    camera.lookAt(cameraLookTarget);

    renderer.render(scene, camera);
  }

  animate();
}
