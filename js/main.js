// Main application initialization
import { detectDevice, initDebugMode } from './utils.js';
import { initMobileController } from './mobile-controller.js';
import { initDesktopScene } from './scene.js';
import { initMultiplayer } from './multiplayer.js';

// Global variables
let room;
let currentUser;
let isMobile;
let isDesktop;
let debugMode = true; // Set to false in production

// Initialize the application
async function init() {
  const deviceType = detectDevice();
  isMobile = deviceType === 'mobile';
  isDesktop = deviceType === 'desktop';
  
  // Initialize multiplayer connection
  const { room: roomInstance, currentUser: userInfo } = await initMultiplayer(deviceType);
  room = roomInstance;
  currentUser = userInfo;
  
  // Initialize debug mode if enabled
  if (debugMode) {
    initDebugMode(isMobile);
  }
  
  // Initialize based on device type
  if (isDesktop) {
    await initDesktopScene(room, currentUser);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('status').textContent = `Connected as: ${currentUser.username} (Desktop)`;
    document.getElementById('generate-sword').addEventListener('click', () => {
      window.generateSword(); // This function is exposed by sword.js
    });
  } else {
    initMobileController(room, currentUser);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('mobile-instructions').style.display = 'block';
    document.getElementById('status').textContent = `Connected as: ${currentUser.username} (Mobile)`;
    document.getElementById('controls').style.display = 'none';
    document.getElementById('mobile-controls').style.display = 'block';
    document.getElementById('touch-area').style.display = 'block';
    document.getElementById('sword-feedback').style.display = 'block';
    
    if (debugMode) {
      document.getElementById('debug-data').style.display = 'block';
    }
  }
}

// Start the application when the page loads
window.addEventListener('load', init);

// Export globals for other modules
export { room, currentUser, isMobile, isDesktop, debugMode };