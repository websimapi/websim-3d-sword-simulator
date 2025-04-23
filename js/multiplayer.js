// Multiplayer connection management

// Initialize the realtime connection
export async function initMultiplayer(deviceType) {
  // Initialize the realtime room
  const room = new WebsimSocket();
  await room.initialize();
  
  const currentUser = {
    id: room.clientId,
    username: room.peers[room.clientId].username,
    avatarUrl: room.peers[room.clientId].avatarUrl,
    deviceType: deviceType
  };
  
  // Setup presence data
  room.updatePresence({
    deviceType: deviceType,
    username: currentUser.username,
    orientation: { alpha: 0, beta: 0, gamma: 0 },
    acceleration: { x: 0, y: 0, z: 0 },
    gestures: { tap: false, swipe: false, direction: null },
    lastSwing: 0,
    connected: true
  });
  
  // Subscribe to presence updates
  room.subscribePresence((presence) => {
    checkForSameUser(room, currentUser, presence);
    
    // Event will be handled by scene.js for desktop or mobile-controller.js for mobile
    const event = new CustomEvent('presenceUpdate', { detail: presence });
    window.dispatchEvent(event);
  });
  
  // Setup message handling for realtime events
  room.onmessage = (event) => {
    // Dispatch to appropriate handlers
    const customEvent = new CustomEvent('realtimeMessage', { detail: event.data });
    window.dispatchEvent(customEvent);
  };
  
  // Stay alive - periodically send keepalive presence updates
  if (deviceType === 'mobile') {
    setInterval(() => {
      room.updatePresence({
        connected: true,
        timestamp: Date.now()
      });
    }, 5000);
  }
  
  return { room, currentUser };
}

// Check if the same user is connected with multiple devices
function checkForSameUser(room, currentUser, presence) {
  let sameUserConnected = false;
  
  for (const clientId in presence) {
    if (clientId !== room.clientId && presence[clientId].username === currentUser.username) {
      sameUserConnected = true;
      
      // If we're mobile and desktop is already connected
      if (currentUser.deviceType === 'mobile' && presence[clientId].deviceType === 'desktop') {
        document.getElementById('status').textContent = `Connected as: ${currentUser.username} (Mobile - Controlling Desktop)`;
      }
      // If we're desktop and mobile is connected
      else if (currentUser.deviceType === 'desktop' && presence[clientId].deviceType === 'mobile') {
        document.getElementById('status').textContent = `Connected as: ${currentUser.username} (Desktop - Controlled by Mobile)`;
      }
    }
  }
  
  if (!sameUserConnected) {
    if (currentUser.deviceType === 'desktop') {
      document.getElementById('status').textContent = `Connected as: ${currentUser.username} (Desktop - Waiting for mobile)`;
    } else {
      document.getElementById('status').textContent = `Connected as: ${currentUser.username} (Mobile - Waiting for desktop)`;
    }
  }
  
  // Dispatch sameUserConnected status change event
  const event = new CustomEvent('sameUserStatusChanged', { detail: { sameUserConnected } });
  window.dispatchEvent(event);
  
  return sameUserConnected;
}