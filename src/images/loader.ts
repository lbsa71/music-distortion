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
      // Fallback to default images
      this.imageUrls = [
        'https://picsum.photos/1920/1080?random=1',
        'https://picsum.photos/1920/1080?random=2',
        'https://picsum.photos/1920/1080?random=3',
      ];
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
    return this.loadImage(url);
  }

  async preloadNextImage(): Promise<LoadedImage> {
    if (this.imageUrls.length === 0) {
      throw new Error('No image URLs available');
    }
    
    const nextIndex = (this.currentIndex + 1) % this.imageUrls.length;
    const url = this.imageUrls[nextIndex];
    
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