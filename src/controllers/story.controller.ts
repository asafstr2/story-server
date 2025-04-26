import { Request, Response, NextFunction } from "express";
import sharp from "sharp";
import { Story } from "../models/story.model";
import { CustomError } from "../middleware/error.middleware";
import OpenAI from "openai";
import { CloudinaryAsset } from "../types/CloudinaryAsset";
import { uploadAsset } from "../services/cloudineryUploadFromLink";
import { IUser } from "../models/user.model";
import PDFDocument from "pdfkit";
import axios from "axios";

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

    // Check if user has a paid subscription
    const hasPaidSubscription = user.subscription?.status === "active";

    // If user doesn't have a paid subscription, check story count
    if (!hasPaidSubscription) {
      const storyCount = await Story.countDocuments({ userId: user._id });
      if (storyCount >= Number(process.env.NUMBER_OF_STORIES_LIMIT)) {
        return res.status(403).json({
          message:
            "Free users are limited to 2 stories. Please upgrade your subscription to create more.",
          limitReached: true,
        });
      }
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
    const imagePromises: Promise<CloudinaryAsset>[] = paragraphs.map(
      (paragraph: string) =>
        convertImageToGhibli(base64Image, req.body.name ?? "Maya", paragraph)
    );

    const images = await Promise.all(imagePromises);
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
  // Step 3: Upload generated image to Cloudinary
  const uploadedImage = await uploadAsset({
    imageUrls: imageUrls,
    customPrompt: "storytime illustration",
  });

  if (!uploadedImage || uploadedImage.length === 0) {
    throw new Error("Failed to upload image to Cloudinary");
  }

  return uploadedImage[0] as CloudinaryAsset;
};

export async function selectedImageCloudineryUpload(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Extract trainer details from the request body
  let user = req.user as IUser; // from the auth middleware preceding this (correctUser)
  if (!user) {
    res.status(404).json({ message: "User not found" });
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
      throw new Error("Story not found");
    }
    story.images = uploadedImages;
    await story.save();

    res.json({ uploadedImages, customPrompt });
  } catch (error) {
    console.error("Error generating image:", error);
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
      .select("_id title heroImage createdAt");

    res.status(200).json(stories);
  } catch (error) {
    console.error("Error fetching user stories:", error);
    next(error);
  }
};

export const generatePdf = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const storyId = req.params.id;

    // Fetch the story from the database
    const story = await Story.findById(storyId);
    if (!story) {
      const error = new Error("Story not found") as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Create a new PDF document
    const doc = new PDFDocument({
      size: "A5",
      margins: { top: 50, bottom: 50, left: 70, right: 70 },
      autoFirstPage: false,
    });

    // Set the response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${story.title.replace(/\s+/g, "_")}.pdf`
    );

    // Pipe the PDF document to the response
    doc.pipe(res);

    // Add first page (cover)
    doc.addPage();

    // Create the cover page
    doc.fillColor("#2E7D32").rect(0, 0, doc.page.width, doc.page.height).fill();

    // Add title - position in center
    const titleY = doc.page.height / 3;
    doc.fillColor("white").font("Helvetica-Bold").fontSize(24);

    doc.text(story.title, 0, titleY, {
      align: "center",
      width: doc.page.width,
    });

    // Add subtitle
    doc.font("Helvetica-Oblique").fontSize(16);

    doc.text("A Magical Adventure", 0, titleY + 40, {
      align: "center",
      width: doc.page.width,
    });

    // Add footer
    doc.fontSize(8).font("Helvetica");

    doc.text("Created with Magical Story Creator", 0, doc.page.height - 50, {
      align: "center",
      width: doc.page.width,
    });

    // Add a new page for the title page
    doc.addPage();

    // Title page background
    doc.fillColor("#F9F4E8").rect(0, 0, doc.page.width, doc.page.height).fill();

    // Title
    doc.fillColor("black").font("Helvetica-Bold").fontSize(20);

    doc.text(story.title, 0, 50, {
      align: "center",
      width: doc.page.width,
    });

    // Process content pages
    for (let i = 0; i < story.content.length; i++) {
      // Add a new page for each content section
      doc.addPage();

      // Page background
      doc
        .fillColor("#F9F4E8")
        .rect(0, 0, doc.page.width, doc.page.height)
        .fill();

      // Page number
      doc.fillColor("#969696").fontSize(8);

      doc.text(`${i + 1}`, doc.page.width - 40, 30);

      // Add image if available
      if (story.images && story.images[i]) {
        try {
          const imageAsset = story.images[i];
          // Prefer secure_url if available, then url, or use the string directly
          const imageUrlString =
            typeof imageAsset === "string"
              ? imageAsset
              : imageAsset.secure_url || imageAsset.url;

          if (!imageUrlString) {
            throw new Error("Invalid image URL format");
          }

          const imageResponse = await axios.get(imageUrlString, {
            responseType: "arraybuffer",
          });

          const imageBuffer = Buffer.from(imageResponse.data as ArrayBuffer);

          // Calculate image dimensions - center better
          const imgWidth = doc.page.width - 140; // Reduced width to prevent overflow
          const imgHeight = (doc.page.height - 200) / 2;

          // Center the image horizontally by calculating its position
          const imgX = (doc.page.width - imgWidth) / 2;

          // Add image with explicit X position
          doc.image(imageBuffer, imgX, 50, {
            fit: [imgWidth, imgHeight],
            align: "center",
          });

          // Add text below the image - adjust text position to prevent cutoff
          const textY = 50 + imgHeight + 20; // Position text below image with padding
          const textX = (doc.page.width - (doc.page.width - 140)) / 2; // Center text

          doc.fillColor("black").fontSize(10).font("Helvetica");

          doc.text(story.content[i], textX, textY, {
            align: "justify",
            width: doc.page.width - 140, // Same width as image
          });
        } catch (error) {
          console.error("Error adding image to PDF:", error);

          // Just add text if image fails
          const textX = (doc.page.width - (doc.page.width - 140)) / 2; // Center text

          doc.fillColor("black").fontSize(10).font("Helvetica");

          doc.text(story.content[i], textX, 50, {
            align: "justify",
            width: doc.page.width - 140,
          });
        }
      } else {
        // Just add text if no image
        const textX = (doc.page.width - (doc.page.width - 140)) / 2; // Center text

        doc.fillColor("black").fontSize(10).font("Helvetica");

        doc.text(story.content[i], textX, 50, {
          align: "justify",
          width: doc.page.width - 140,
        });
      }
    }

    // Back cover
    doc.addPage();
    doc.fillColor("#2E7D32").rect(0, 0, doc.page.width, doc.page.height).fill();

    doc.fillColor("white").fontSize(16).font("Helvetica-Bold");

    doc.text("The End", 0, doc.page.height / 2, {
      align: "center",
      width: doc.page.width,
    });

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    next(error);
  }
};
