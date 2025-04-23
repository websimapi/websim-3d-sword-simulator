// Utility functions

// Check if device is mobile
export function detectDevice() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return isMobile ? 'mobile' : 'desktop';
}

// Initialize debug mode
export function initDebugMode(isMobile) {
  if (isMobile) {
    // Only show debug panel on mobile
    const debugElement = document.getElementById('debug-data');
    if (debugElement) {
      debugElement.style.display = 'block';
    }
  }
  
  // Add debug event listeners or other setup if needed
  console.log('Debug mode enabled');
}

// Update debug information display
export function updateDebugInfo(type, data) {
  const debugElement = document.getElementById('debug-data');
  if (!debugElement) return;
  
  // Create sections if they don't exist
  if (!debugElement.querySelector(`.${type}-debug`)) {
    const section = document.createElement('div');
    section.className = `${type}-debug`;
    section.innerHTML = `<strong>${type}:</strong> <span></span>`;
    debugElement.appendChild(section);
    
    // Keep only the most recent debug sections
    if (debugElement.children.length > 8) {
      debugElement.removeChild(debugElement.children[0]);
    }
  }
  
  // Update the section content
  const section = debugElement.querySelector(`.${type}-debug span`);
  if (section) {
    if (typeof data === 'object') {
      section.textContent = JSON.stringify(data, null, 2)
        .replace(/[{}"]/g, '')
        .replace(/,/g, ', ')
        .substring(0, 100); // Truncate if too long
    } else {
      section.textContent = String(data);
    }
  }
}