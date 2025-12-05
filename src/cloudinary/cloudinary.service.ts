// src/cloudinary/cloudinary.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import {
  UploadApiErrorResponse,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';

export type CloudinaryResponse = UploadApiResponse | UploadApiErrorResponse;

@Injectable()
export class CloudinaryService {
  /**
   * Upload single image from buffer
   */
  async uploadImage(file: any, folder?: string): Promise<CloudinaryResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            format: 'jpg',
            folder: folder || 'uploads',
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result!);
          },
        )
        .end(file.buffer);
    });
  }

  /**
   * Upload single image and return URL directly
   */
  async uploadImageReturnUrl(file: any, folder?: string): Promise<string> {
    try {
      const result = await this.uploadImage(file, folder);
      return result.secure_url;
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Failed to upload image');
    }
  }

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(
    files: any[],
    folder?: string,
  ): Promise<CloudinaryResponse[]> {
    const uploadPromises = files.map((file) => this.uploadImage(file, folder));
    return Promise.all(uploadPromises);
  }

  /**
   * Upload multiple images and return URLs directly
   */
  async uploadMultipleImagesReturnUrls(
    files: any[],
    folder?: string,
  ): Promise<string[]> {
    try {
      const results = await this.uploadMultipleImages(files, folder);
      return results.map((result) => result.secure_url);
    } catch (error) {
      throw new BadRequestException('Failed to upload images');
    }
  }

  /**
   * Upload with custom transformations
   */
  async uploadWithTransformation(
    file: any,
    options: {
      folder?: string;
      width?: number;
      height?: number;
      crop?: string;
      quality?: string | number;
    } = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: options.folder || 'uploads',
            transformation: [
              {
                width: options.width || 1000,
                height: options.height || 1000,
                crop: options.crop || 'limit',
              },
              { quality: options.quality || 'auto' },
              { fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result!.secure_url);
          },
        )
        .end(file.buffer);
    });
  }

  /**
   * Delete single image
   */
  async deleteImage(publicId: string): Promise<any> {
    try {
      return await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new BadRequestException('Failed to delete image');
    }
  }

  /**
   * Delete multiple images
   */
  async deleteMultipleImages(publicIds: string[]): Promise<any> {
    try {
      return await cloudinary.api.delete_resources(publicIds);
    } catch (error) {
      throw new BadRequestException('Failed to delete images');
    }
  }

  /**
   * Get optimized URL from public ID
   */
  getOptimizedUrl(publicId: string, options?: any): string {
    return cloudinary.url(publicId, {
      fetch_format: 'auto',
      quality: 'auto',
      ...options,
    });
  }

  /**
   * Get thumbnail URL
   */
  getThumbnail(publicId: string, width = 200, height = 200): string {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: 'fill',
      fetch_format: 'auto',
      quality: 'auto',
    });
  }

  /**
   * Get signed URL with expiration (default 1 hour)
   */
  getSignedUrl(
    publicId: string,
    expiresInSeconds = 3600,
    options?: any,
  ): string {
    const timestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return cloudinary.url(publicId, {
      sign_url: true,
      type: 'authenticated',
      fetch_format: 'auto',
      quality: 'auto',
      expires_at: timestamp,
      ...options,
    });
  }

  /**
   * Get signed thumbnail URL with expiration
   */
  getSignedThumbnail(
    publicId: string,
    width = 200,
    height = 200,
    expiresInSeconds = 3600,
  ): string {
    return this.getSignedUrl(publicId, expiresInSeconds, {
      width,
      height,
      crop: 'fill',
    });
  }

  /**
   * Upload single image and return public ID directly
   */
  async uploadImageReturnPublicId(file: any, folder?: string): Promise<string> {
    try {
      const result = await this.uploadImage(file, folder);
      return result.public_id;
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Failed to upload image');
    }
  }

  /**
   * Upload multiple images and return public IDs directly
   */
  async uploadMultipleImagesReturnPublicIds(
    files: any[],
    folder?: string,
  ): Promise<string[]> {
    try {
      const results = await this.uploadMultipleImages(files, folder);
      return results.map((result) => result.public_id);
    } catch (error) {
      throw new BadRequestException('Failed to upload images');
    }
  }

  /**
   * Extract public ID from Cloudinary URL
   */
  extractPublicId(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    const publicId = filename.split('.')[0];
    const folder = parts[parts.length - 2];
    return `${folder}/${publicId}`;
  }

  /**
   * Upload image with multiple variations
   */
  async uploadWithVariations(
    file: any,
    variations: string[] = ['standard'],
    folder?: string,
  ): Promise<{ original: string; variations: Record<string, string> }> {
    try {
      // Upload original
      const original = await this.uploadImage(file, folder);

      const variationUrls: Record<string, string> = {};

      // Create variations based on requirements
      for (const variation of variations) {
        let transformOptions = {};

        switch (variation) {
          case 'thumbnail':
            transformOptions = {
              width: 300,
              height: 300,
              crop: 'fill',
              quality: 'auto',
            };
            break;
          case 'standard':
            transformOptions = {
              width: 1200,
              height: 1200,
              crop: 'limit',
              quality: 'auto',
            };
            break;
          case 'high_res':
            transformOptions = {
              width: 3000,
              height: 3000,
              crop: 'limit',
              quality: 90,
            };
            break;
          case 'compressed':
            transformOptions = {
              width: 800,
              height: 800,
              crop: 'limit',
              quality: 60,
            };
            break;
        }

        variationUrls[variation] = cloudinary.url(original.public_id, {
          fetch_format: 'auto',
          ...transformOptions,
        });
      }

      return {
        original: original.secure_url,
        variations: variationUrls,
      };
    } catch (error) {
      throw new BadRequestException('Failed to upload image with variations');
    }
  }
}
