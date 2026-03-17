import * as THREE from 'three';

const COLORS = ['#ff6347', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const SHAPE_COUNT = 14;
const TOKEN_SPEED = 0.6;

const BEAM_LABELS = [
  'beam://F4A1C3',
  'beam://3B82F6',
  'beam://10B981',
  'beam://F59E0B',
  'beam://8B5CF6',
  'beam://EC4899',
  'beam://2DD4BF',
  'beam://A78BFA',
  'beam://FB923C',
  'beam://34D399',
  'beam://F87171',
  'beam://60A5FA',
  'beam://C084FC',
  'beam://FBBF24',
];

interface ShapeNode {
  mesh: THREE.Mesh;
  outline: THREE.LineSegments;
  originalColor: THREE.Color;
  lit: boolean;
  litTime: number;
  fillColor: THREE.Color | null;
  filledFaces: number;
  totalFaces: number;
  unfilling: boolean;
  unfillTime: number;
}

export function initHeroScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // Isometric-style camera
  const frustum = 1;
  let aspect = canvas.clientWidth / canvas.clientHeight;
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

  // Solid fill material — used for the colored version, revealed via drawRange
  function createFillMaterial(color: THREE.Color): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color });
  }

  // Segmented cube: 4 smaller cubes in a 2x2 grid with gaps
  function makeSegmentedBox(): THREE.BufferGeometry {
    const size = 0.35;
    const gap = 0.08;
    const offset = (size + gap) / 2;
    const geos: THREE.BufferGeometry[] = [];

    for (const x of [-offset, offset]) {
      for (const y of [-offset, offset]) {
        for (const z of [-offset, offset]) {
          const box = new THREE.BoxGeometry(size, size, size, 2, 2, 2).toNonIndexed();
          const pos = box.getAttribute('position');
          for (let i = 0; i < pos.count; i++) {
            pos.setXYZ(i, pos.getX(i) + x, pos.getY(i) + y, pos.getZ(i) + z);
          }
          geos.push(box);
        }
      }
    }

    return mergeBufferGeometries(geos);
  }

  function mergeBufferGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    for (const geo of geos) {
      const pos = geo.getAttribute('position');
      const norm = geo.getAttribute('normal');
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      }
      geo.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return merged;
  }

  const geometries = [
    () => makeSegmentedBox(),
    () => new THREE.SphereGeometry(0.5, 12, 8),
    () => new THREE.ConeGeometry(0.5, 1, 8, 3), // pyramid
    () => new THREE.CylinderGeometry(0.4, 0.4, 0.9, 12, 3),
    () => new THREE.ConeGeometry(0.5, 1, 12, 3), // cone
  ];

  const nodes: ShapeNode[] = [];
  const MIN_DISTANCE = 3.5;

  function findPosition(existing: THREE.Vector3[]): THREE.Vector3 {
    for (let attempt = 0; attempt < 100; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 8;
      const pos = new THREE.Vector3(
        Math.cos(angle) * radius + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 1.5,
        Math.sin(angle) * radius + (Math.random() - 0.5) * 2,
      );
      if (existing.every((p) => p.distanceTo(pos) >= MIN_DISTANCE)) return pos;
    }
    return new THREE.Vector3(Math.random() * 16 - 8, 0, Math.random() * 16 - 8);
  }

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const placedPositions: THREE.Vector3[] = [];

  for (let i = 0; i < SHAPE_COUNT; i++) {
    const geo = geometries[i % geometries.length]();
    const pos = findPosition(placedPositions);
    placedPositions.push(pos);
    const rot = new THREE.Euler(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    const scl = 0.8 + Math.random() * 0.8;

    // Fill mesh — starts with 0 faces drawn, revealed one by one
    const fillGeo = geo.clone().toNonIndexed(); // ensure each triangle has its own vertices
    const fillMat = createFillMaterial(new THREE.Color(0x292f2f));
    const mesh = new THREE.Mesh(fillGeo, fillMat);
    mesh.position.copy(pos);
    mesh.rotation.copy(rot);
    mesh.scale.setScalar(scl);
    fillGeo.setDrawRange(0, 0); // hidden initially
    scene.add(mesh);

    // Edge outline — just contour lines
    const edges = new THREE.EdgesGeometry(geo, 15);
    const edgeMat = new THREE.LineBasicMaterial({
      color: isDark ? 0xffffff : 0x292f2f,
    });
    const outline = new THREE.LineSegments(edges, edgeMat);
    outline.position.copy(pos);
    outline.rotation.copy(rot);
    outline.scale.setScalar(scl);
    scene.add(outline);

    const totalFaces = Math.floor(fillGeo.getAttribute('position').count / 3);
    nodes.push({
      mesh,
      outline,
      originalColor: new THREE.Color(0x292f2f),
      lit: false,
      litTime: 0,
      fillColor: null,
      filledFaces: 0,
      totalFaces,
      unfilling: false,
      unfillTime: 0,
    });
  }

  // Labels
  function createSpriteLabel(text: string, isDark: boolean): THREE.Sprite {
    const canvas2d = document.createElement('canvas');
    canvas2d.width = 512;
    canvas2d.height = 64;
    const ctx = canvas2d.getContext('2d')!;
    ctx.font = '300 18px monospace';
    const metrics = ctx.measureText(text);
    const pad = 24;
    const padV = 18;
    const bgW = metrics.width + pad * 2;
    const bgH = 18 + padV * 2;
    ctx.fillStyle = isDark ? '#ffffff' : '#292f2f';
    ctx.fillRect(0, 4, bgW, bgH);
    ctx.fillStyle = isDark ? '#000000' : '#ffffff';
    ctx.fillText(text, pad, 4 + padV + 15);
    const tex = new THREE.CanvasTexture(canvas2d);
    tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.8, 0.1, 1);
    sprite.renderOrder = 1;
    return sprite;
  }

  // Static beam:// labels on shapes
  nodes.forEach((node, i) => {
    const label = createSpriteLabel(BEAM_LABELS[i % BEAM_LABELS.length], isDark);
    label.position.copy(node.mesh.position);
    label.position.y -= 0.7;
    scene.add(label);
  });

  // Floating token label that follows the ball
  const TOKEN_LABELS = [
    'color.primary',
    'color.accent',
    'color.surface',
    'spacing.md',
    'radius.lg',
    'color.bg',
    'font.body',
    'shadow.sm',
    'color.border',
    'opacity.muted',
    'size.icon',
    'color.success',
    'weight.bold',
    'color.warning',
  ];

  function createTokenLabel(text: string, isDark: boolean) {
    const canvas2d = document.createElement('canvas');
    canvas2d.width = 512;
    canvas2d.height = 64;
    const ctx = canvas2d.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas2d);
    tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, toneMapped: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.5, 0.06, 1);

    function update(label: string, dark: boolean) {
      ctx.clearRect(0, 0, 512, 64);
      ctx.font = '300 28px monospace';
      ctx.fillStyle = dark ? '#ffffff' : '#292f2f';
      ctx.fillText(label, 8, 36);
      tex.needsUpdate = true;
    }

    update(text, isDark);
    return { sprite, update };
  }

  const floatingLabel = createTokenLabel(TOKEN_LABELS[0], isDark);
  scene.add(floatingLabel.sprite);

  // Token sphere
  const tokenGeo = new THREE.SphereGeometry(0.06, 12, 12);
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
  const cameraLookTarget = nodes[0].mesh.position.clone();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const a = w / h;
    aspect = a;
    camera.left = -frustum * a - frustum * 1.2;
    camera.right = frustum * a - frustum * 1.2;
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
    const edgeColor = isDark ? 0xffffff : 0x292f2f;
    nodes.forEach((n) => {
      (n.outline.material as THREE.LineBasicMaterial).color.set(edgeColor);
      n.originalColor.set(edgeColor);
    });
  }
  updateTheme();
  darkQuery.addEventListener('change', updateTheme);

  let time = 0;

  function animate() {
    requestAnimationFrame(animate);
    time += 0.016;

    // Move token along path
    let from = nodes[currentTarget].mesh.position;
    let to = nodes[nextTarget].mesh.position;
    progress += (TOKEN_SPEED * 0.016) / from.distanceTo(to);

    // Start unfilling the shape we just left
    const leavingNode = nodes[currentTarget];
    if (progress > 0.2 && leavingNode.lit && !leavingNode.unfilling) {
      leavingNode.unfilling = true;
      leavingNode.unfillTime = time;
    }

    // Start filling the target shape when ball is close
    const targetNode = nodes[nextTarget];
    const currentColor = new THREE.Color(COLORS[colorIndex % COLORS.length]);
    if (progress > 0.9 && !targetNode.fillColor) {
      (targetNode.mesh.material as THREE.MeshStandardMaterial).color.copy(currentColor);
      targetNode.fillColor = currentColor;
      targetNode.filledFaces = 0;
      targetNode.litTime = time;
      targetNode.lit = true;
    }

    if (progress >= 1) {
      // Update token color and floating label
      colorIndex++;
      const nextColor = new THREE.Color(COLORS[colorIndex % COLORS.length]);
      floatingLabel.update(TOKEN_LABELS[colorIndex % TOKEN_LABELS.length], darkQuery.matches);
      tokenMat.color.copy(nextColor);
      tokenMat.emissive.copy(nextColor);
      pathMat.color.copy(nextColor);

      // Pick next target
      currentTarget = nextTarget;
      nextTarget = (nextTarget + 1) % nodes.length;
      progress = 0;

      // Re-capture from/to so token doesn't snap back
      from = nodes[currentTarget].mesh.position;
      to = nodes[nextTarget].mesh.position;
    }

    // Interpolate token position with ease-in-out
    const eased =
      progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    token.position.lerpVectors(from, to, eased);

    // Label follows the ball
    floatingLabel.sprite.position.copy(token.position);
    floatingLabel.sprite.position.y -= 0.25;

    // Draw path line from source to target, visible until ball arrives
    pathPositions[0] = from.x;
    pathPositions[1] = from.y;
    pathPositions[2] = from.z;
    pathPositions[3] = to.x;
    pathPositions[4] = to.y;
    pathPositions[5] = to.z;
    pathGeo.attributes.position.needsUpdate = true;
    pathLine.visible = progress > 0.05 && progress < 1;

    // Gentle shape rotation — keep outline in sync
    nodes.forEach((n) => {
      n.mesh.rotation.y += 0.003;
      n.mesh.rotation.x += 0.001;
      n.outline.rotation.copy(n.mesh.rotation);
    });

    // Camera smoothly follows token
    cameraLookTarget.lerp(token.position, 0.005);
    camera.position.copy(cameraLookTarget).add(cameraOffset);
    camera.lookAt(cameraLookTarget);

    // Fill and unfill faces one by one
    nodes.forEach((n) => {
      // Filling in
      if (n.fillColor && !n.unfilling && n.filledFaces < n.totalFaces) {
        const elapsed = (time - n.litTime) * 1000;
        const expectedFaces = Math.min(Math.floor(elapsed / 5), n.totalFaces);
        if (expectedFaces > n.filledFaces) {
          n.filledFaces = expectedFaces;
          n.mesh.geometry.setDrawRange(0, n.filledFaces * 3);
        }
      }
      // Unfilling after ball leaves
      if (n.unfilling && n.filledFaces > 0) {
        const elapsed = (time - n.unfillTime) * 1000;
        const removedFaces = Math.floor(elapsed / 5);
        const remaining = Math.max(0, n.totalFaces - removedFaces);
        if (remaining !== n.filledFaces) {
          n.filledFaces = remaining;
          n.mesh.geometry.setDrawRange(0, n.filledFaces * 3);
        }
        if (remaining === 0) {
          n.unfilling = false;
          n.fillColor = null;
          n.lit = false;
        }
      }
    });

    renderer.render(scene, camera);
  }

  animate();
}
