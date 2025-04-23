import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generateSword } from './sword.js';

// Constants for terrain
const TERRAIN_SIZE = 1000;
const TERRAIN_SEGMENTS = 100;
const GRASS_REPEAT = 20;

// Global scene variables
let camera, scene, renderer, controls;
let terrain;
let objectsGroup;
let swordGroup;
let sword;
let sameUserConnected = false;

// Object types for spawning
const objectTypes = [
  { type: 'rock', scale: [1, 1, 1], probability: 0.4 },
  { type: 'tree', scale: [1.5, 3, 1.5], probability: 0.3 },
  { type: 'flower', scale: [0.3, 0.8, 0.3], probability: 0.3 }
];

// Initialize the 3D scene
export async function initDesktopScene(room, currentUser) {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Sky blue
  
  // Create camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 10, 20);
  
  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.getElementById('scene-container').appendChild(renderer.domElement);
  
  // Add lights
  setupLights();
  
  // Create infinite terrain
  createTerrain();
  
  // Create objects group
  objectsGroup = new THREE.Group();
  scene.add(objectsGroup);
  
  // Create group for the sword
  swordGroup = new THREE.Group();
  swordGroup.position.set(2, 3, 0); // Position sword at right side
  scene.add(swordGroup);
  
  // Create camera controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 5;
  controls.maxDistance = 50;
  controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent camera from going below ground
  
  // Spawn objects in the scene
  spawnObjects();
  
  // Generate initial sword
  await generateSwordModel();
  
  // Listen for presence updates
  window.addEventListener('presenceUpdate', handlePresenceUpdate);
  
  // Listen for realtime messages
  window.addEventListener('realtimeMessage', handleRealtimeMessage);
  
  // Listen for same user connection status changes
  window.addEventListener('sameUserStatusChanged', (event) => {
    sameUserConnected = event.detail.sameUserConnected;
  });
  
  // Resize handler
  window.addEventListener('resize', onWindowResize);
  
  // Start animation loop
  animate();
  
  // Expose sword generation to global scope for button click
  window.generateSword = generateSwordModel;
}

// Handle presence updates from mobile devices
function handlePresenceUpdate(event) {
  const presence = event.detail;
  
  // Sync sword position if controlled by mobile
  if (sameUserConnected && sword) {
    for (const clientId in presence) {
      if (presence[clientId].deviceType === 'mobile') {
        if (presence[clientId].orientation) {
          updateSwordOrientation(presence[clientId].orientation);
        }
        if (presence[clientId].acceleration) {
          checkForSwingMotion(presence[clientId].acceleration);
        }
      }
    }
  }
}

// Handle realtime messages
function handleRealtimeMessage(event) {
  const data = event.detail;
  if (data.type === "sword_action") {
    performSwordAction(data.action, data.params);
  } else if (data.type === "place_object") {
    placeObject(data.objectType, data.position);
  }
}

// Create terrain with grass texture
function createTerrain() {
  // Load grass texture
  const textureLoader = new THREE.TextureLoader();
  const grassTexture = textureLoader.load('textures/grass.jpg', function(texture) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(GRASS_REPEAT, GRASS_REPEAT);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    
    // Create terrain geometry
    const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    geometry.rotateX(-Math.PI / 2); // Rotate to be horizontal
    
    // Create terrain material
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
      metalness: 0.2,
    });
    
    // Create terrain mesh
    terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    scene.add(terrain);
  });
  
  // Fallback in case texture loading fails
  grassTexture.onerror = function() {
    console.error("Failed to load grass texture");
    // Create a green plane as fallback
    const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x4CAF50 });
    terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    scene.add(terrain);
  };
}

// Set up scene lighting
function setupLights() {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // Directional light (sun)
  const sunLight = new THREE.DirectionalLight(0xffffff, 1);
  sunLight.position.set(50, 100, 50);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 500;
  sunLight.shadow.camera.left = -100;
  sunLight.shadow.camera.right = 100;
  sunLight.shadow.camera.top = 100;
  sunLight.shadow.camera.bottom = -100;
  scene.add(sunLight);
}

// Spawn basic objects in the scene
function spawnObjects() {
  // Create basic geometries for objects
  const geometries = {
    rock: new THREE.DodecahedronGeometry(1, 1),
    tree: new THREE.CylinderGeometry(0.5, 1, 4, 8),
    flower: new THREE.ConeGeometry(0.5, 2, 8)
  };
  
  // Create materials for objects
  const materials = {
    rock: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 }),
    tree: new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 }),
    flower: new THREE.MeshStandardMaterial({ color: 0xFF69B4, roughness: 0.5 })
  };
  
  // Add tree tops
  const treeTopGeometry = new THREE.ConeGeometry(2, 4, 8);
  const treeTopMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.7 });
  
  // Spawn objects randomly across terrain
  const terrainHalfSize = TERRAIN_SIZE / 2 - 10;
  const objectCount = 200; // Number of objects to spawn
  
  for (let i = 0; i < objectCount; i++) {
    // Determine object type based on probability
    let selectedType;
    const rand = Math.random();
    let cumulativeProbability = 0;
    
    for (const objType of objectTypes) {
      cumulativeProbability += objType.probability;
      if (rand < cumulativeProbability) {
        selectedType = objType.type;
        break;
      }
    }
    
    // Random position on terrain
    const x = Math.random() * TERRAIN_SIZE - TERRAIN_SIZE / 2;
    const z = Math.random() * TERRAIN_SIZE - TERRAIN_SIZE / 2;
    
    // Create object
    const object = new THREE.Mesh(geometries[selectedType], materials[selectedType]);
    object.position.set(x, geometries[selectedType].parameters.height / 2, z);
    object.scale.set(...objectTypes.find(t => t.type === selectedType).scale);
    object.castShadow = true;
    object.receiveShadow = true;
    objectsGroup.add(object);
    
    // Add treetop if it's a tree
    if (selectedType === 'tree') {
      const treeTop = new THREE.Mesh(treeTopGeometry, treeTopMaterial);
      treeTop.position.set(x, 4, z);
      treeTop.castShadow = true;
      objectsGroup.add(treeTop);
    }
  }
  
  // Update room state with object positions
  const objectPositions = {};
  objectsGroup.children.forEach((obj, index) => {
    objectPositions[`object-${index}`] = {
      type: obj.geometry.type.includes('Cone') && obj.position.y < 3 ? 'flower' : 
            obj.geometry.type.includes('Cone') ? 'treetop' :
            obj.geometry.type.includes('Cylinder') ? 'tree' : 'rock',
      x: obj.position.x,
      y: obj.position.y,
      z: obj.position.z,
      scaleX: obj.scale.x,
      scaleY: obj.scale.y,
      scaleZ: obj.scale.z
    };
  });
}

// Place a new object in the scene
function placeObject(type, position) {
  // Implementation for dynamic object placement
  console.log(`Placing ${type} at position:`, position);
  // This would create a new object at the specified position
}

// Generate the sword model
async function generateSwordModel() {
  try {
    document.getElementById('status').textContent = 'Generating sword...';
    await generateSword(swordGroup);
    document.getElementById('status').textContent = `Connected as: ${window.currentUser.username} (Desktop)`;
  } catch (error) {
    console.error('Error generating sword:', error);
    document.getElementById('status').textContent = 'Error generating sword!';
  }
}

// Update sword orientation based on mobile device orientation
function updateSwordOrientation(orientation) {
  if (!swordGroup || !orientation) return;
  
  // Reset the rotation to avoid accumulation
  swordGroup.rotation.set(0, 0, 0);
  
  // Convert degrees to radians
  const alphaRad = THREE.MathUtils.degToRad(orientation.alpha || 0);
  const betaRad = THREE.MathUtils.degToRad(orientation.beta || 0);
  const gammaRad = THREE.MathUtils.degToRad(orientation.gamma || 0);
  
  // Apply the rotation - improved mapping for more intuitive control
  swordGroup.rotation.z = gammaRad; // Tilt left/right (roll)
  swordGroup.rotation.x = betaRad * 0.6; // Tilt forward/backward (pitch)
  swordGroup.rotation.y = -alphaRad * 0.4; // Rotation around vertical axis (yaw)
}

// Check for swing motion and animate sword
function checkForSwingMotion(acceleration) {
  if (!acceleration) return;
  
  const totalAcceleration = Math.sqrt(
    Math.pow(acceleration.x || 0, 2) + 
    Math.pow(acceleration.y || 0, 2) + 
    Math.pow(acceleration.z || 0, 2)
  );
  
  if (totalAcceleration > 15) { // Threshold for swing detection
    // Apply a "swinging" animation to the sword
    if (swordGroup) {
      // Add a slight rotation or movement to simulate swinging
      const swingDirection = Math.sign(acceleration.x) || 1;
      
      // Get the current rotation as a starting point
      const startRotation = { 
        x: swordGroup.rotation.x, 
        y: swordGroup.rotation.y, 
        z: swordGroup.rotation.z 
      };
      
      // Calculate swing amount based on acceleration
      const swingAmount = totalAcceleration / 25; // Adjusted for more responsive movement
      
      // Animation timing
      let startTime = null;
      const duration = 300; // ms
      
      function animateSwing(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        if (progress < 1) {
          // Using sine wave for smooth swing effect
          const swingProgress = Math.sin(progress * Math.PI);
          
          // Apply rotation based on acceleration direction
          if (Math.abs(acceleration.x) > Math.abs(acceleration.y)) {
            // Horizontal swing (z-axis rotation)
            swordGroup.rotation.z = startRotation.z + swingDirection * swingAmount * swingProgress;
          } else {
            // Vertical swing (x-axis rotation)
            const verticalDirection = Math.sign(acceleration.y) || 1;
            swordGroup.rotation.x = startRotation.x + verticalDirection * swingAmount * swingProgress;
          }
          
          requestAnimationFrame(animateSwing);
        } else {
          // Reset to original rotation
          swordGroup.rotation.x = startRotation.x;
          swordGroup.rotation.y = startRotation.y;
          swordGroup.rotation.z = startRotation.z;
        }
      }
      
      requestAnimationFrame(animateSwing);
    }
  }
}

// Perform a sword action
function performSwordAction(action, params = {}) {
  switch (action) {
    case 'swing':
      animateSwingAction(params.direction, params.force || 1);
      break;
    case 'swipe':
      animateSwipeAction(params.direction, params.speed || 1);
      break;
    case 'tap':
      animateTapAction();
      break;
    case 'thrust':
      animateThrustAction();
      break;
    case 'special':
      animateSpecialAttack();
      break;
    case 'raise':
      animateRaiseAction();
      break;
  }
}

// Animation for sword swing action
function animateSwingAction(direction, force) {
  if (!swordGroup) return;
  
  const startPosition = swordGroup.position.clone();
  const startRotation = new THREE.Euler().copy(swordGroup.rotation);
  
  let animateX = 0;
  let animateY = 0;
  let animateZ = 0;
  
  // Set animation based on direction
  if (direction === 'left' || direction === 'right') {
    animateZ = direction === 'right' ? -0.8 * force : 0.8 * force;
  } else if (direction === 'up' || direction === 'down') {
    animateX = direction === 'down' ? -0.8 * force : 0.8 * force;
  } else {
    animateZ = 0.8 * force;
  }
  
  // Animation timeline
  let startTime = null;
  const duration = 300; // ms
  
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    if (progress < 1) {
      // Using sine wave for smooth swing effect
      const swingProgress = Math.sin(progress * Math.PI);
      
      // Apply rotation
      swordGroup.rotation.x = startRotation.x + animateX * swingProgress;
      swordGroup.rotation.y = startRotation.y + animateY * swingProgress;
      swordGroup.rotation.z = startRotation.z + animateZ * swingProgress;
      
      requestAnimationFrame(animate);
    } else {
      // Reset position and rotation
      swordGroup.position.copy(startPosition);
      swordGroup.rotation.copy(startRotation);
    }
  }
  
  requestAnimationFrame(animate);
}

// Animation for sword swipe action
function animateSwipeAction(direction, speed) {
  animateSwingAction(direction, speed);
}

// Animation for tap action (quick jab)
function animateTapAction() {
  if (!swordGroup) return;
  
  const startPosition = swordGroup.position.clone();
  
  // Animation timeline
  let startTime = null;
  const duration = 200; // ms
  
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    if (progress < 1) {
      // Forward and back motion
      if (progress < 0.5) {
        // Forward motion
        swordGroup.position.z = startPosition.z - 0.5 * (progress * 2);
      } else {
        // Return motion
        swordGroup.position.z = startPosition.z - 0.5 * (1 - (progress - 0.5) * 2);
      }
      
      requestAnimationFrame(animate);
    } else {
      // Reset position
      swordGroup.position.copy(startPosition);
    }
  }
  
  requestAnimationFrame(animate);
}

// Animation for thrust action
function animateThrustAction() {
  if (!swordGroup) return;
  
  const startPosition = swordGroup.position.clone();
  
  // Animation timeline
  let startTime = null;
  const duration = 400; // ms
  
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    if (progress < 1) {
      // Forward and back motion with easing
      if (progress < 0.4) {
        // Forward motion
        swordGroup.position.z = startPosition.z - 1.5 * (progress / 0.4);
      } else if (progress < 0.6) {
        // Hold at forward position
        swordGroup.position.z = startPosition.z - 1.5;
      } else {
        // Return motion
        swordGroup.position.z = startPosition.z - 1.5 * (1 - (progress - 0.6) / 0.4);
      }
      
      requestAnimationFrame(animate);
    } else {
      // Reset position
      swordGroup.position.copy(startPosition);
    }
  }
  
  requestAnimationFrame(animate);
}

// Animation for special attack
function animateSpecialAttack() {
  if (!swordGroup) return;
  
  const startPosition = swordGroup.position.clone();
  const startRotation = new THREE.Euler().copy(swordGroup.rotation);
  
  // Animation timeline
  let startTime = null;
  const duration = 1000; // ms
  
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    if (progress < 1) {
      // Full 360-degree spin
      swordGroup.rotation.y = startRotation.y + Math.PI * 2 * progress;
      
      // Move forward during the middle of the animation
      if (progress > 0.25 && progress < 0.75) {
        const moveProgress = (progress - 0.25) / 0.5;
        if (moveProgress < 0.5) {
          // Move forward
          swordGroup.position.z = startPosition.z - moveProgress * 2;
        } else {
          // Move back
          swordGroup.position.z = startPosition.z - (1 - (moveProgress - 0.5) * 2);
        }
      }
      
      requestAnimationFrame(animate);
    } else {
      // Reset position and rotation
      swordGroup.position.copy(startPosition);
      swordGroup.rotation.copy(startRotation);
    }
  }
  
  requestAnimationFrame(animate);
}

// Animation for raising the sword
function animateRaiseAction() {
  if (!swordGroup) return;
  
  const startRotation = new THREE.Euler().copy(swordGroup.rotation);
  
  // Animation timeline
  let startTime = null;
  const duration = 800; // ms
  
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    if (progress < 1) {
      // Raise the sword up
      if (progress < 0.4) {
        // Raise up
        swordGroup.rotation.x = startRotation.x - Math.PI * 0.5 * (progress / 0.4);
      } else if (progress < 0.7) {
        // Hold up
        swordGroup.rotation.x = startRotation.x - Math.PI * 0.5;
      } else {
        // Lower down
        swordGroup.rotation.x = startRotation.x - Math.PI * 0.5 * (1 - (progress - 0.7) / 0.3);
      }
      
      requestAnimationFrame(animate);
    } else {
      // Reset rotation
      swordGroup.rotation.copy(startRotation);
    }
  }
  
  requestAnimationFrame(animate);
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update controls
  controls.update();
  
  // Keep camera above ground
  if (camera.position.y < 1) {
    camera.position.y = 1;
  }
  
  // Render the scene
  renderer.render(scene, camera);
}