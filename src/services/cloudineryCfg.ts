import { v2 as cloudinary } from 'cloudinary';

// Configure your cloud name, API key, and API secret:
cloudinary.config({
	cloud_name: process.env.CLOUDINERY_CLOUD_NAME,
	api_key: process.env.CLOUDINERY_API_KEY,
	api_secret: process.env.CLOUDINERY_API_SECRET,
	secure: true,
});

const myconfig = cloudinary;
export { myconfig, cloudinary };
