import { updateDebugInfo } from './utils.js';

// Mobile controller variables
let room;
let currentUser;
let motionPermissionGranted = false;
let orientationPermissionGranted = false;
let touchStartTime = 0;
let touchStartPos = { x: 0, y: 0 };
let lastSwingTime = 0;
let swingCooldown = 300; // ms
let lastTouch = null;
let lastVibrationTime = 0;
let vibrationCooldown = 500; // ms
let referenceOrientation = { alpha: 0, beta: 0, gamma: 0 };
let isCalibrated = false;
let motionVibrationThreshold = 8;
let lastMotionVibrationTime = 0;
let motionVibrationCooldown = 300; // ms
let accelerationThreshold = 15;
let debugMode = true;

// Initialize mobile controller
export function initMobileController(roomInstance, userInfo) {
  room = roomInstance;
  currentUser = userInfo;
  
  // Add status message about permissions
  document.getElementById('status').textContent = 'Waiting for motion and orientation permissions...';
  
  // Request permissions for device motion and orientation
  if (typeof DeviceMotionEvent.requestPermission === 'function' || 
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+ requires permission request
    document.getElementById('mobile-instructions').innerHTML += 
      '<p>Tap "Allow" when prompted for motion and orientation access.</p>' +
      '<button id="request-permissions" style="background-color: #ff5722; padding: 15px; margin-top: 10px;">Enable Motion Controls</button>';
    
    document.getElementById('request-permissions').addEventListener('click', requestMotionPermission);
  } else {
    // Non-iOS devices or older iOS versions
    enableMotionAndOrientation();
  }
  
  // Set up touch handlers
  const touchArea = document.getElementById('touch-area');
  touchArea.addEventListener('touchstart', handleTouchStart);
  touchArea.addEventListener('touchmove', handleTouchMove);
  touchArea.addEventListener('touchend', handleTouchEnd);
  
  // Set up mobile button handlers
  document.getElementById('thrust-button').addEventListener('click', () => {
    sendSwordAction('thrust');
    navigator.vibrate([100, 30, 100]); // Enhanced vibration pattern
  });
  
  document.getElementById('special-attack').addEventListener('click', () => {
    sendSwordAction('special');
    navigator.vibrate([50, 30, 50, 30, 50, 30, 150]); // Enhanced vibration pattern
  });
  
  // Add calibration button handler
  document.getElementById('calibrate-button').addEventListener('click', calibrateOrientation);
  
  // Listen for same user connection status changes
  window.addEventListener('sameUserStatusChanged', (event) => {
    if (event.detail.sameUserConnected) {
      document.getElementById('status').textContent = `Connected as: ${currentUser.username} (Mobile - Controlling Desktop)`;
    } else {
      document.getElementById('status').textContent = `Connected as: ${currentUser.username} (Mobile - Waiting for desktop)`;
    }
  });
}

// Calibrate orientation
function calibrateOrientation() {
  // Visual feedback for calibration
  const overlay = document.getElementById('calibration-overlay');
  overlay.style.display = 'block';
  
  // Vibrate to indicate calibration started
  navigator.vibrate([50, 50, 150]);
  
  // Display calibration status
  document.getElementById('status').textContent = 'Calibrating... Please hold still';
  
  // Wait a moment before capturing reference orientation (allow user to stabilize)
  setTimeout(() => {
    // Get current orientation from presence 
    const currentOrientation = room.presence[room.clientId]?.orientation || { alpha: 0, beta: 0, gamma: 0 };
    
    // Store as reference for calibration
    referenceOrientation = { 
      alpha: currentOrientation.alpha || 0, 
      beta: currentOrientation.beta || 0, 
      gamma: currentOrientation.gamma || 0 
    };
    
    isCalibrated = true;
    
    // Vibrate to indicate calibration is complete
    navigator.vibrate([150, 50, 50]);
    
    // Display success message
    document.getElementById('status').textContent = 'Calibration complete!';
    
    if (debugMode) {
      updateDebugInfo('calibration', {
        reference: referenceOrientation,
        time: new Date().toLocaleTimeString()
      });
    }
    
    // Hide overlay after a moment
    setTimeout(() => {
      overlay.style.display = 'none';
      document.getElementById('status').textContent = room.presence[room.clientId]?.connectedToDesktop ? 
        `Connected as: ${currentUser.username} (Mobile - Controlling Desktop)` : 
        `Connected as: ${currentUser.username} (Mobile - Waiting for desktop)`;
    }, 1000);
  }, 500);
}

// Request motion and orientation permissions for iOS
async function requestMotionPermission() {
  try {
    document.getElementById('status').textContent = 'Requesting motion and orientation permissions...';
    
    // Request device motion permission (iOS 13+)
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const motionPermission = await DeviceMotionEvent.requestPermission();
      if (motionPermission === 'granted') {
        motionPermissionGranted = true;
        document.getElementById('status').textContent = 'Motion permission granted!';
      } else {
        document.getElementById('status').textContent = 'Motion permission denied!';
        return;
      }
    } else {
      motionPermissionGranted = true;
    }
    
    // Request device orientation permission (iOS 13+)
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const orientationPermission = await DeviceOrientationEvent.requestPermission();
      if (orientationPermission === 'granted') {
        orientationPermissionGranted = true;
        document.getElementById('status').textContent = 'Orientation permission granted!';
      } else {
        document.getElementById('status').textContent = 'Orientation permission denied!';
        return;
      }
    } else {
      orientationPermissionGranted = true;
    }
    
    // Hide the permission button if it exists
    const permButton = document.getElementById('request-permissions');
    if (permButton) permButton.style.display = 'none';
    
    enableMotionAndOrientation();
  } catch (error) {
    console.error('Error requesting motion/orientation permission:', error);
    document.getElementById('status').textContent = 'Error requesting permissions: ' + error.message;
  }
}

// Enable motion and orientation events
function enableMotionAndOrientation() {
  document.getElementById('status').textContent = 'Setting up motion and orientation...';
  
  // Check if device orientation API is available
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', handleOrientation, true);
    document.getElementById('status').textContent = 'Orientation tracking enabled!';
  } else {
    document.getElementById('status').textContent = 'Device orientation not supported!';
  }
  
  // Check if device motion API is available
  if (window.DeviceMotionEvent) {
    window.addEventListener('devicemotion', handleMotion, true);
    document.getElementById('status').textContent = 'Motion tracking enabled!';
  } else {
    document.getElementById('status').textContent = 'Device motion not supported!';
  }
  
  // Send immediate test data to confirm connection
  sendTestOrientation();
}

// Send test orientation data
function sendTestOrientation() {
  room.updatePresence({
    orientation: {
      alpha: 0,
      beta: 0,
      gamma: 0
    },
    testMessage: "Orientation data initialized"
  });
  
  // Log to console for debugging
  console.log("Test orientation data sent");
  
  // Update debug display
  if (debugMode) {
    updateDebugInfo('status', {message: 'Test orientation data sent'});
  }
}

// Handle device orientation
function handleOrientation(event) {
  // Get orientation data with fallbacks
  const orientation = {
    alpha: event.alpha || 0,      // Z-axis rotation [0-360)
    beta: event.beta || 0,        // X-axis rotation [-180, 180]
    gamma: event.gamma || 0,      // Y-axis rotation [-90, 90]
    absolute: event.absolute || false
  };
  
  // Apply calibration if enabled
  const calibratedOrientation = isCalibrated ? {
    alpha: (orientation.alpha - referenceOrientation.alpha + 360) % 360, // Ensure alpha wraps correctly
    beta: orientation.beta - referenceOrientation.beta,
    gamma: orientation.gamma - referenceOrientation.gamma,
    absolute: orientation.absolute
  } : orientation;
  
  // Update our presence with the new orientation
  room.updatePresence({
    orientation: calibratedOrientation,
    originalOrientation: orientation, // Keep original for debugging
    isCalibrated: isCalibrated,
    timestamp: Date.now()
  });
  
  // Update visual feedback on mobile
  updateMobileSwordFeedback(calibratedOrientation);
  
  // Update debug info
  if (debugMode) {
    updateDebugInfo('orientation', calibratedOrientation);
  }
}

// Handle device motion
function handleMotion(event) {
  // Get acceleration data with fallbacks
  const rawAcceleration = event.acceleration || event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
  const acceleration = {
    x: rawAcceleration.x || 0,
    y: rawAcceleration.y || 0,
    z: rawAcceleration.z || 0
  };
  
  // Get rotation rate with fallbacks
  const rotationRate = event.rotationRate || { alpha: 0, beta: 0, gamma: 0 };
  
  // Update our presence with the new data
  room.updatePresence({
    acceleration: acceleration,
    rotationRate: {
      alpha: rotationRate.alpha || 0,
      beta: rotationRate.beta || 0,
      gamma: rotationRate.gamma || 0
    },
    timestamp: Date.now()
  });
  
  // Update debug info
  if (debugMode) {
    updateDebugInfo('acceleration', acceleration);
  }
  
  // Check for swing motion
  detectSwing(acceleration);
  
  // Add vibration for general motion
  detectMotionForVibration(acceleration);
}

// Detect any significant motion and provide haptic feedback
function detectMotionForVibration(acceleration) {
  const now = Date.now();
  
  // Calculate total acceleration magnitude
  const totalAcceleration = Math.sqrt(
    Math.pow(acceleration.x || 0, 2) + 
    Math.pow(acceleration.y || 0, 2) + 
    Math.pow(acceleration.z || 0, 2)
  );
  
  // If significant motion detected and not in cooldown period
  if (totalAcceleration > motionVibrationThreshold && now - lastMotionVibrationTime > motionVibrationCooldown) {
    // Subtle vibration for motion feedback
    navigator.vibrate(Math.min(Math.floor(totalAcceleration * 3), 50));
    lastMotionVibrationTime = now;
    
    if (debugMode) {
      updateDebugInfo('motionVibration', {
        acceleration: totalAcceleration,
        time: new Date(now).toLocaleTimeString()
      });
    }
  }
}

// Detect swing motion from acceleration data
function detectSwing(acceleration) {
  // Calculate total acceleration magnitude
  const totalAcceleration = Math.sqrt(
    Math.pow(acceleration.x || 0, 2) + 
    Math.pow(acceleration.y || 0, 2) + 
    Math.pow(acceleration.z || 0, 2)
  );
  
  const now = Date.now();
  
  // Check if acceleration exceeds threshold and we're not in cooldown
  if (totalAcceleration > accelerationThreshold && now - lastSwingTime > swingCooldown) {
    lastSwingTime = now;
    
    // Determine swing direction based on acceleration vector
    let direction = 'horizontal';
    if (Math.abs(acceleration.y) > Math.abs(acceleration.x) && Math.abs(acceleration.y) > Math.abs(acceleration.z)) {
      direction = acceleration.y > 0 ? 'up' : 'down';
    } else if (Math.abs(acceleration.x) > Math.abs(acceleration.y) && Math.abs(acceleration.x) > Math.abs(acceleration.z)) {
      direction = acceleration.x > 0 ? 'right' : 'left';
    }
    
    // Send the swing event
    sendSwordAction('swing', { 
      force: totalAcceleration,
      direction: direction
    });
    
    // Update presence with swing info
    room.updatePresence({
      gestures: {
        swipe: true,
        direction: direction,
        force: totalAcceleration
      },
      lastSwing: now
    });
    
    // Vibrate based on the strength of the swing
    if (totalAcceleration > accelerationThreshold * 2) {
      navigator.vibrate([100, 50, 100, 50, 150]); // Strong swing
    } else {
      navigator.vibrate([80, 40, 80]); // Normal swing
    }
    lastVibrationTime = now;
    
    if (debugMode) {
      updateDebugInfo('swingEvent', {
        force: totalAcceleration,
        direction: direction,
        time: new Date(now).toLocaleTimeString()
      });
    }
  }
  
  // Reset the swipe gesture after a short delay
  setTimeout(() => {
    room.updatePresence({
      gestures: {
        swipe: false,
        direction: null
      }
    });
  }, 200);
  
  // Get orientation data from presence
  const orientation = room.presence[room.clientId]?.orientation;
  
  // Vibrate when sword is raised up (beta angle close to -90)
  if (orientation && orientation.beta < -70 && now - lastVibrationTime > vibrationCooldown) {
    sendSwordAction('raise');
    navigator.vibrate([50, 30, 50, 30, 100]);
    lastVibrationTime = now;
    
    if (debugMode) {
      updateDebugInfo('raiseEvent', {
        beta: orientation.beta,
        time: new Date(now).toLocaleTimeString()
      });
    }
  }
}

// Handle touch start
function handleTouchStart(event) {
  touchStartTime = Date.now();
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    lastTouch = { x: touch.clientX, y: touch.clientY };
  }
}

// Handle touch move
function handleTouchMove(event) {
  event.preventDefault();
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    const currentPos = { x: touch.clientX, y: touch.clientY };
    
    // Calculate swipe distance and direction
    const deltaX = currentPos.x - touchStartPos.x;
    const deltaY = currentPos.y - touchStartPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Update last touch position
    lastTouch = currentPos;
    
    // If significant movement, it's a swipe
    if (distance > 50) {
      const now = Date.now();
      if (now - lastSwingTime > swingCooldown) {
        lastSwingTime = now;
        
        // Calculate swipe direction
        let direction = 'horizontal';
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          direction = deltaY > 0 ? 'down' : 'up';
        } else {
          direction = deltaX > 0 ? 'right' : 'left';
        }
        
        // Calculate swipe speed
        const speed = distance / (now - touchStartTime);
        
        // Send the swipe event
        sendSwordAction('swipe', { 
          direction: direction, 
          speed: speed 
        });
        
        // Update presence with swipe info
        room.updatePresence({
          gestures: {
            swipe: true,
            direction: direction,
            speed: speed
          }
        });
        
        // Vibrate based on swipe speed
        if (speed > 1.5) {
          navigator.vibrate([100, 50, 100]);
        } else {
          navigator.vibrate([50, 20, 50]);
        }
        lastVibrationTime = now;
        
        if (debugMode) {
          updateDebugInfo('swipeEvent', {
            direction: direction,
            speed: speed,
            time: new Date(now).toLocaleTimeString()
          });
        }
      }
    }
  }
}

// Handle touch end
function handleTouchEnd(event) {
  const tapDuration = Date.now() - touchStartTime;
  
  // Reset swipe status
  room.updatePresence({
    gestures: {
      swipe: false,
      direction: null
    }
  });
  
  // If it was a quick tap (not a swipe)
  if (tapDuration < 200 && lastTouch) {
    const deltaX = lastTouch.x - touchStartPos.x;
    const deltaY = lastTouch.y - touchStartPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance < 10) {
      // Send tap event
      sendSwordAction('tap', { 
        x: touchStartPos.x, 
        y: touchStartPos.y 
      });
      
      // Update presence with tap info
      room.updatePresence({
        gestures: {
          tap: true,
          x: touchStartPos.x,
          y: touchStartPos.y
        }
      });
      
      // Vibrate for tap
      navigator.vibrate(50);
      
      // Reset tap after short delay
      setTimeout(() => {
        room.updatePresence({
          gestures: {
            tap: false
          }
        });
      }, 100);
    }
  }
}

// Update mobile sword feedback
function updateMobileSwordFeedback(orientation) {
  const swordFeedback = document.getElementById('sword-feedback');
  if (swordFeedback && orientation) {
    // Apply rotation based on orientation with better visual feedback
    const tiltX = orientation.beta * 0.6; // Pitch
    const tiltY = orientation.gamma; // Roll
    
    swordFeedback.style.transform = `translate(-50%, -50%) 
      rotate(${tiltY}deg) 
      perspective(500px) 
      rotateX(${-tiltX}deg)`;
      
    // Add color indication based on orientation intensity
    const intensity = Math.min(100, Math.abs(tiltX) + Math.abs(tiltY));
    swordFeedback.style.backgroundColor = `rgba(255, ${255 - intensity * 2}, ${255 - intensity * 2}, 0.3)`;
  }
}

// Send a sword action to the desktop
function sendSwordAction(action, params = {}) {
  room.send({
    type: "sword_action",
    action: action,
    params: params,
    echo: false,
    timestamp: Date.now()
  });
  
  if (debugMode) {
    updateDebugInfo('sentAction', {
      action: action,
      params: JSON.stringify(params).substring(0, 30),
      time: new Date().toLocaleTimeString()
    });
  }
}