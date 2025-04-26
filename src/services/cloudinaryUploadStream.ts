import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

const folder = process.env.CLOUDINERY_CLOUD_FOLDER;

/**
 * Upload a buffer to Cloudinary using stream
 * @param buffer - The buffer to upload
 * @returns The Cloudinary upload result
 */
export const cloudinaryUploadStream = (buffer: Buffer): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Create a stream from the buffer
    const stream = Readable.from(buffer);
    
    // Create upload stream to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );
    
    // Pipe the readable stream to the Cloudinary upload stream
    stream.pipe(uploadStream);
  });
}; 