import { cloudinary } from "./cloudineryCfg";
import { CloudinaryAsset } from "../types/CloudinaryAsset";

const folder = process.env.CLOUDINERY_CLOUD_FOLDER;

export const uploadAsset = async (data: {
	imageUrls: string[];
	customPrompt: string;
}): Promise<CloudinaryAsset[]> => {
	try {
		// Upload each image URL to Cloudinary
		const uploadPromises = data.imageUrls.map(url => {
			return cloudinary.uploader.upload(url, {
				folder: folder, // optional: specify a folder
				use_filename: true, // optional: keep original file name
				unique_filename: false,
				// Attach the custom prompt as metadata (context) if needed
				context: `caption=${data.customPrompt}`,
			});
		});

		const results = await Promise.all(uploadPromises);
		console.log('Uploaded images:', results);
		return results as unknown as CloudinaryAsset[]; // Return the results as an array
	} catch (err) {
		console.error('Error uploading images:', err);
		return [];
	}
};
