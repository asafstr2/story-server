import { Request, Response, NextFunction } from "express";
import sharp from "sharp";
import { Story } from "../models/story.model";
import { CustomError } from "../middleware/error.middleware";
import OpenAI from "openai";
import { CloudinaryAsset } from "../types/CloudinaryAsset";
import { uploadAsset } from "../services/cloudineryUploadFromLink";
import { IUser } from "../models/user.model";

//@ts-ignore
const openai = new OpenAI();

export const generateStory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get the authenticated user
    const user = req.user as IUser;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!req.file) {
      throw new Error("No image file uploaded");
    }

    // Process the image
    const processedImage = await sharp(req.file.buffer)
      .resize(512, 512, { fit: "inside" })
      .toBuffer();
    // Convert to base64
    const base64Image = processedImage.toString("base64");
    // Generate story using OpenAI

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a children's story writer who creates magical and engaging stories for kids aged 5-10. Create a story with 3-4 paragraphs featuring the child in the image as the main character.",
        },
        {
          role: "user",
          content: `Create a magical story for this child named ${
            req.body.name ?? "Maya"
          }`,
        },
      ],
      max_tokens: 1000,
    });
    console.log({ completion });
    const storyContent = completion.choices[0].message?.content;

    if (!storyContent) {
      throw new Error("Failed to generate story");
    }
    // Split content into paragraphs
    const paragraphs = storyContent
      .split("\n\n")
      .filter((p: string) => p.trim());

    // Generate images for each paragraph using DALL-E
    const imagePromises: Promise<string>[] = paragraphs.map(
      (paragraph: string) =>
        convertImageToGhibli(base64Image, req.body.name ?? "Maya", paragraph)
    );

    const imageResponses = await Promise.all(imagePromises);
    const images = imageResponses.map((response: string) => response);
    console.log({ images });
    // Create story in database
    const story = await Story.create({
      userId: user._id, // Associate the story with the user
      title: "A Magical Adventure",
      content: paragraphs,
      images,
      heroImage: `data:image/jpeg;base64,${base64Image}`,
    });
    console.log({ story });
    res.status(201).json(story);
  } catch (error) {
    console.log({ error });
    next(error);
  }
};

export const getStory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      const error = new Error("Story not found") as CustomError;
      error.statusCode = 404;
      throw error;
    }
    res.json(story);
  } catch (error) {
    next(error);
  }
};

// Assuming you have `base64Image` from req.body
const convertImageToGhibli = async (
  base64Image: string,
  username: string = "Maya",
  paragraph: string
) => {
  // Step 1: Get detailed image description
  const imageDescription = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe this image in detail for an illustrator to recreate in Studio Ghibli style.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
              detail: "high",
            },
          },
        ],
      },
    ],
  });

  const description = imageDescription.choices[0].message.content;

  // Step 2: Generate a storytelling-based prompt combining image + paragraph
  const promptGeneration = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: `Using the following image description and story paragraph, create a single detailed and emotionally rich prompt for generating a Studio Ghibli-style illustration:\n\nImage description: ${description}\n\nStory context: ${paragraph}`,
      },
    ],
  });
  const combinedPrompt = promptGeneration.choices[0].message.content;
  console.log({ combinedPrompt });

  // Step 2: Generate Ghibli-style image from description
  const ghibliImage = await openai.images.generate({
    model: "dall-e-3",
    prompt: `${combinedPrompt}`,
    size: "1024x1024",
    n: 1,
  });
  const imageUrls = ghibliImage.data.map((img: any) => img.url);

  return imageUrls[0] as string;
};


export async function selectedImageCloudineryUpload(
	req: Request,
	res: Response,
	next: NextFunction
) {
	// Extract trainer details from the request body
	let user = req.user as IUser; // from the auth middleware preceding this (correctUser)
	if (!user) {
		res.status(404).json({ message: 'User not found' });
		return;
	}
	const {
		imageUrls,
		customPrompt,
	}: { imageUrls: string[]; customPrompt: string } = req.body;

	try {
		const uploadedImages: CloudinaryAsset[] = await uploadAsset({
			imageUrls,
			customPrompt,
		});

		// Update story with uploaded image URL
		const story = await Story.findById(req.body.storyId);
		if (!story) {
			throw new Error('Story not found');
		}
		story.images = uploadedImages;
		await story.save();

		res.json({ uploadedImages, customPrompt });
	} catch (error) {
		console.error('Error generating image:', error);
		next(error);
	}
}

export const getUserStories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const stories = await Story.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .select('_id title heroImage createdAt');
    
    res.status(200).json(stories);
  } catch (error) {
    console.error("Error fetching user stories:", error);
    next(error);
  }
};
