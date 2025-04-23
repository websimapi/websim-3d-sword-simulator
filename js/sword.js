import * as THREE from 'three';

// Generate a new sword using the LLM
export async function generateSword(swordGroup) {
  if (!swordGroup) return;
  
  try {
    // Generate a sword image using the LLM
    const result = await websim.imageGen({
      prompt: "A detailed fantasy sword on a solid white background, high resolution, with an ornate handle and detailed blade, clear lighting, no shadows, centered composition, metallic texture of the blade, detailed handle with leather wrapping, fantasy style sword, sharp edge, isolated on pure white",
      aspect_ratio: "1:1",
    });
    
    // Get the image URL
    const imageUrl = result.url;
    
    // Load the image
    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = imageUrl;
    
    return new Promise((resolve, reject) => {
      image.onload = function() {
        // Process the image to remove the background
        const processedImage = removeBackground(image);
        
        // Create a texture from the processed image
        const texture = new THREE.Texture(processedImage);
        texture.needsUpdate = true;
        
        // Create material with transparency
        const material = new THREE.MeshBasicMaterial({ 
          map: texture, 
          transparent: true,
          side: THREE.DoubleSide
        });
        
        // Create a plane with the sword texture
        const geometry = new THREE.PlaneGeometry(3, 3);
        
        // Remove existing sword if present
        while (swordGroup.children.length > 0) {
          swordGroup.remove(swordGroup.children[0]);
        }
        
        // Create new sword
        const sword = new THREE.Mesh(geometry, material);
        swordGroup.add(sword);
        
        resolve(sword);
      };
      
      image.onerror = function() {
        reject(new Error('Error loading sword image!'));
      };
    });
  } catch (error) {
    console.error('Error generating sword:', error);
    throw error;
  }
}

// Remove the white background from the image
function removeBackground(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  
  // Draw the image to the canvas
  ctx.drawImage(image, 0, 0);
  
  // Get the image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Remove white background (with some tolerance)
  const threshold = 230; // RGB threshold for white
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // If the pixel is close to white, make it transparent
    if (r > threshold && g > threshold && b > threshold) {
      data[i + 3] = 0; // Set alpha to 0
    }
  }
  
  // Put the modified image data back
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
}