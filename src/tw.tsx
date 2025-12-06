import * as THREE from 'three';
import { useRef, useEffect } from 'react';

// Function to create the celestial grid
function createCelestialGrid(spacing: number, radius: number): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x888888 });

  // Longitudes (meridians)
  for (let lon = 0; lon < 360; lon += spacing) {
    const points = [];
    for (let lat = -90; lat <= 90; lat += 1) {
      const tolat = (90 - lat) * (Math.PI / 180);
      const tolong = lon * (Math.PI / 180);
      const z = radius * Math.sin(tolat) * Math.cos(tolong);
      const x = radius * Math.sin(tolat) * Math.sin(tolong);
      const y = radius * Math.cos(tolat);
      points.push(new THREE.Vector3(x, y, z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    group.add(line);
  }

  // Latitudes (parallels)
  for (let lat = -90 + spacing; lat < 90; lat += spacing) {
    const points = [];
    for (let lon = 0; lon <= 360; lon += 1) {
      const tolat = (90 - lat) * (Math.PI / 180);
      const tolong = lon * (Math.PI / 180);
      const z = radius * Math.sin(tolat) * Math.cos(tolong);
      const x = radius * Math.sin(tolat) * Math.sin(tolong);
      const y = radius * Math.cos(tolat);
      points.push(new THREE.Vector3(x, y, z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    group.add(line);
  }

  return group;
}

// Function to create a highlighted spherical rectangle for the selected grid region
function createSphericalRect(latMin: number, latMax: number, lonMin: number, lonMax: number, radius: number): THREE.Mesh {
  const segments = 20; // Resolution for the mesh
  const geometry = new THREE.BufferGeometry();
  const vertices = [];

  for (let i = 0; i <= segments; i++) {
    const lat = latMin + (latMax - latMin) * (i / segments);
    const phi = (90 - lat) * (Math.PI / 180);
    for (let j = 0; j <= segments; j++) {
      let lon = lonMin + (lonMax - lonMin) * (j / segments);
      if (lon >= 360) lon -= 360;
      const theta = lon * (Math.PI / 180);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      vertices.push(x, y, z);
    }
  }

  const indices = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    opacity: 0.3,
    transparent: true,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

export function CelestialGridViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current || !textRef.current) return;

    const mount = mountRef.current;
    const textOverlay = textRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(20, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, 1); // Initialize at 0 latitude (equatorial plane)

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000);
    mount.appendChild(renderer.domElement);

    const radius = 100; // Arbitrary large radius for the sphere grid
    let grid: THREE.Group | null = null;
    let selectedMesh: THREE.Mesh | null = null;

    // Invisible sphere for raycasting
    const sphereGeometry = new THREE.SphereGeometry(radius, 64, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const pickSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(pickSphere);

    const possibleSpacings = [1, 2, 5, 10, 15, 30, 45, 60, 90];

    const updateGrid = () => {
      if (grid) {
        scene.remove(grid);
      }

      const fovDeg = camera.fov;
      let spacing = 1;
      for (let i = possibleSpacings.length - 1; i >= 0; i--) {
        const s = possibleSpacings[i];
        if (fovDeg / s > 3) {
          spacing = s;
          break;
        }
      }

      grid = createCelestialGrid(spacing, radius);
      scene.add(grid);
    };

    updateGrid();

    // Update text overlay with camera lookAt coordinates
    const updateTextOverlay = () => {
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      textOverlay.textContent = `LookAt: x=${direction.x.toFixed(2)}, y=${direction.y.toFixed(2)}, z=${direction.z.toFixed(2)}`;
    };

    const animate = () => {
      requestAnimationFrame(animate);
      updateTextOverlay();
      renderer.render(scene, camera);
    };
    animate();

    // Zoom FOV with mouse wheel
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY * 0.1; // Adjust sensitivity
      camera.fov = Math.max(1, Math.min(179, camera.fov + delta));
      camera.updateProjectionMatrix();
      updateGrid();
    };
    mount.addEventListener('wheel', handleWheel, { passive: false });

    // Mouse drag for panning (longitude and latitude)
    let isDragging = false;
    let previousMouseX = 0;
    let previousMouseY = 0;

    const handleMouseDown = (event: MouseEvent) => {
      isDragging = true;
      previousMouseX = event.clientX;
      previousMouseY = event.clientY;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;event.preventDefault();

  // Calculate delta movement
  const deltaX = event.clientX - previousMouseX;
  const deltaY = event.clientY - previousMouseY;
  previousMouseX = event.clientX;
  previousMouseY = event.clientY;

  // Sensitivity for rotation (adjust as needed)
  const deltaLon = (deltaX * 0.5 * Math.PI) / 180;
  const deltaLat = (deltaY * 0.5 * Math.PI) / 180;

  // Get current camera direction
  const currentDirection = new THREE.Vector3();
  camera.getWorldDirection(currentDirection);

  // Convert to lat/lon (in degrees)
  const nlat = Math.acos(currentDirection.y);
  const nlon = Math.atan2(currentDirection.x, currentDirection.z);
  let lat = (Math.PI / 2 - nlat) * (180 / Math.PI);
  let lon = nlon * (180 / Math.PI);

  // Apply rotation
  lon += deltaLon * (180 / Math.PI);
  lat += deltaLat * (180 / Math.PI); // Invert for natural drag (up = positive lat)

  // Clamp latitude to avoid poles
  lat = Math.max(-89.9, Math.min(89.9, lat));

  // Normalize longitude to [-180, 180]
  lon = ((lon + 180) % 360) - 180;

  // Convert back to spherical coordinates
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = lon * (Math.PI / 180);

  // Calculate new look-at point
  const x = Math.sin(phi) * Math.sin(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.cos(theta);

  // Update camera
  camera.lookAt(new THREE.Vector3(x, y, z));
  camera.up.set(0, 1, 0); // Ensure up is +y
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    mount.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Mouse click to select grid region
    const handleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObject(pickSphere);
      if (intersects.length > 0) {
        const point = intersects[0].point.normalize(); // Get direction

        // Convert to lat/lon
        const theta = Math.atan2(point.y, point.x);
        const phi = Math.acos(point.z);
        let lat = 90 - (phi * 180) / Math.PI;
        let lon = (theta * 180) / Math.PI;
        if (lon < 0) lon += 360;

        // Get current spacing
        const fovDeg = camera.fov;
        let spacing = 1;
        for (let i = possibleSpacings.length - 1; i >= 0; i--) {
          const s = possibleSpacings[i];
          if (fovDeg / s > 3) {
            spacing = s;
            break;
          }
        }

        // Calculate grid region bounds
        const latMin = Math.floor((lat + 90) / spacing) * spacing - 90;
        let latMax = latMin + spacing;
        if (latMax > 90) latMax = 90;

        const lonMin = Math.floor(lon / spacing) * spacing;
        const lonMax = lonMin + spacing;

        // Remove previous selection
        if (selectedMesh) {
          scene.remove(selectedMesh);
        }

        // Create and add new highlight mesh
        selectedMesh = createSphericalRect(latMin, latMax, lonMin, lonMax, radius);
        scene.add(selectedMesh);
      }
    };
    mount.addEventListener('click', handleClick);

    // Touch events for panning and pinch zoom
    let isPanning = false;
    let previousTouchX = 0;
    let previousTouchY = 0;
    let initialDist = 0;

    const handleTouchStart = (event: TouchEvent) => {
      event.preventDefault();
      if (event.touches.length === 1) {
        isPanning = true;
        previousTouchX = event.touches[0].clientX;
        previousTouchY = event.touches[0].clientY;
      } else if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        initialDist = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      if (event.touches.length === 1 && isPanning) {
        const deltaX = event.touches[0].clientX - previousTouchX;
        const deltaY = event.touches[0].clientY - previousTouchY;
        previousTouchX = event.touches[0].clientX;
        previousTouchY = event.touches[0].clientY;

        // Convert pixel deltas to lat/lon changes
        const fovDeg = camera.fov;
        const deltaLon = (deltaX / mount.clientWidth) * fovDeg; // Scale with FOV
        const deltaLat = (deltaY / mount.clientHeight) * fovDeg; // Scale with FOV

        const currentDirection = new THREE.Vector3();
        camera.getWorldDirection(currentDirection);
        const curUp = new THREE.Vector3();
        const nlat = Math.acos(currentDirection.y);
        const nlon = Math.atan2(currentDirection.x, currentDirection.z);
        let lat = 90 - (nlat * 180) / Math.PI;
        let lon = (nlon * 180) / Math.PI;
        if (lon < 0) lon += 360;

        lon += deltaLon; // Update longitude
        lat += deltaLat; // Update latitude (inverted for natural drag direction)
        lon = ((lon + 90) % 360) - 90; // Wrap longitude to [-90, 90]
        lat = Math.max(-89.9, Math.min(89.9, lat)); // Clamp latitude to avoid poles

        const tolat = (90 - lat) * (Math.PI / 180);
        const toLon = (lon * Math.PI) / 180;
        const z = Math.sin(tolat) * Math.cos(toLon);
        const x = Math.sin(tolat) * Math.sin(toLon);
        const y = Math.cos(tolat);
        camera.lookAt(x, y, z);

      } else if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (initialDist > 0) {
          const ratio = initialDist / dist;
          camera.fov *= ratio;
          camera.fov = Math.max(1, Math.min(179, camera.fov));
          camera.updateProjectionMatrix();
          updateGrid();
          initialDist = dist;
        }
      }
    };

    const handleTouchEnd = () => {
      isPanning = false;
      initialDist = 0;
    };

    mount.addEventListener('touchstart', handleTouchStart, { passive: false });
    mount.addEventListener('touchmove', handleTouchMove, { passive: false });
    mount.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Handle resize
    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      mount.removeChild(renderer.domElement);
      mount.removeEventListener('wheel', handleWheel);
      mount.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      mount.removeEventListener('click', handleClick);
      mount.removeEventListener('touchstart', handleTouchStart);
      mount.removeEventListener('touchmove', handleTouchMove);
      mount.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div
        ref={textRef}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '5px',
          fontSize: '12px',
          fontFamily: 'Arial, sans-serif',
        }}
      />
    </div>
  );
}