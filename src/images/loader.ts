export interface LoadedImage {
  bitmap: ImageBitmap;
  url: string;
  width: number;
  height: number;
}

export class ImageLoader {
  private imageUrls: string[] = [];
  private cache = new Map<string, LoadedImage>();
  private currentIndex = 0;

  async initialize(): Promise<void> {
    try {
      const response = await fetch('./images.json');
      this.imageUrls = await response.json();
      console.log(`Loaded ${this.imageUrls.length} image URLs`);
    } catch (error) {
      console.error('Error loading image URLs:', error);
      // Fallback to default images if loading fails
      this.imageUrls = [];
      
      // Create simple colored canvas test images
      for (let i = 0; i < 3; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d')!;
        
        // Create a gradient pattern
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, `hsl(${i * 120}, 70%, 50%)`);
        gradient.addColorStop(1, `hsl(${i * 120 + 60}, 70%, 30%)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
        // Add some pattern
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for (let x = 0; x < 512; x += 64) {
          for (let y = 0; y < 512; y += 64) {
            if ((x + y) % 128 === 0) {
              ctx.fillRect(x, y, 32, 32);
            }
          }
        }
        
        this.imageUrls.push(canvas.toDataURL());
      }
    }
  }

  async loadImage(url: string): Promise<LoadedImage> {
    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    try {
      console.log(`Loading image: ${url}`);
      
      // Fetch image
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Create bitmap with specific options
      const bitmap = await createImageBitmap(blob, {
        premultiplyAlpha: 'premultiply',
        colorSpaceConversion: 'default',
      });
      
      const loadedImage: LoadedImage = {
        bitmap,
        url,
        width: bitmap.width,
        height: bitmap.height,
      };
      
      // Cache the result
      this.cache.set(url, loadedImage);
      console.log(`Image loaded: ${url} (${bitmap.width}x${bitmap.height})`);
      
      return loadedImage;
    } catch (error) {
      console.error(`Error loading image ${url}:`, error);
      throw error;
    }
  }

  async loadRandomImage(): Promise<LoadedImage> {
    if (this.imageUrls.length === 0) {
      throw new Error('No image URLs available');
    }
    
    const randomIndex = Math.floor(Math.random() * this.imageUrls.length);
    const url = this.imageUrls[randomIndex];
    return this.loadImage(url);
  }

  async loadNextImage(): Promise<LoadedImage> {
    if (this.imageUrls.length === 0) {
      throw new Error('No image URLs available');
    }
    
    this.currentIndex = (this.currentIndex + 1) % this.imageUrls.length;
    const url = this.imageUrls[this.currentIndex];
    console.log(`Loading next image: index ${this.currentIndex}/${this.imageUrls.length}, URL: ${url}`);
    return this.loadImage(url);
  }

  async preloadNextImage(): Promise<LoadedImage> {
    if (this.imageUrls.length === 0) {
      throw new Error('No image URLs available');
    }
    
    const nextIndex = (this.currentIndex + 1) % this.imageUrls.length;
    const url = this.imageUrls[nextIndex];
    console.log(`Preloading next image: index ${nextIndex}/${this.imageUrls.length} (current: ${this.currentIndex}), URL: ${url}`);
    
    // Load in background without changing currentIndex
    return this.loadImage(url);
  }

  clearCache(): void {
    // Close all cached bitmaps
    for (const [_url, image] of this.cache) {
      image.bitmap.close();
    }
    this.cache.clear();
    console.log('Image cache cleared');
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getImageCount(): number {
    return this.imageUrls.length;
  }
}