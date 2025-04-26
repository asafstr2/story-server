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
import { createHash } from "crypto";
import NodeCache from "node-cache";
import { getSubscriptionDetails } from "../services/stripe.service";

//@ts-ignore
const openai = new OpenAI();
const freeNumberOfStoriesLimit = Number(
  process.env.NUMBER_OF_STORIES_LIMIT_FREE_USER
);
const plusNumberOfStoriesLimit = Number(
  process.env.NUMBER_OF_STORIES_LIMIT_PLUS_USER
);
const proNumberOfStoriesLimit = Number(
  process.env.NUMBER_OF_STORIES_LIMIT_PRO_USER
);
const premiumNumberOfStoriesLimit = Number(
  process.env.NUMBER_OF_STORIES_LIMIT_PREMIUM_USER
);

// Create a cache for storing already processed images and prompts
// TTL: 1 hour (3600 seconds)
const imageCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Art style templates for more consistent results
const artStyleTemplates = {
  ghibli: {
    systemPrompt:
      "You are a master Studio Ghibli art director, trained to capture the magical realism, detailed environments, emotional storytelling, and distinctive character designs of Hayao Miyazaki and Isao Takahata. Your descriptions emphasize gentle color palettes, atmospheric elements, emotional expressiveness, and the harmonious relationship between nature and characters.",
    styleGuide:
      "Create this as a high-quality Studio Ghibli illustration with soft watercolor-like textures, atmospheric lighting (especially golden hour or dawn light rays), detailed natural elements (wind-blown grass, detailed clouds, water reflections), and the characteristic innocent but determined expressions of Ghibli protagonists. Include small magical details in the background that reward careful viewing.",
  },
  pixar: {
    systemPrompt:
      "You are a Pixar animation art director with expertise in creating emotionally resonant 3D animated scenes with vibrant colors, expressive characters, and carefully crafted lighting.",
    styleGuide:
      "Create this as a Pixar-inspired 3D illustration with vibrant colors, slightly exaggerated character features, dynamic lighting, and subtle emotional storytelling elements. The scene should feel both fantastical and believable, with careful attention to lighting that enhances the emotional tone.",
  },
  disney: {
    systemPrompt:
      "You are a Disney animation art director specializing in the classic 2D animated fairy tale aesthetic, with colorful, expressive characters and richly detailed fantasy environments.",
    styleGuide:
      "Create this as a Disney-inspired illustration with the classic fairy tale aesthetic - rich colors, expressive characters with large eyes, dynamic poses, and a magical environment with glowing elements. Include subtle storytelling details in the background that hint at the wider world.",
  },
};

export const generateStory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get the authenticated user
    const user = req.user as IUser;
    const style = req.body.style;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Check if user has a paid subscription
    let hasPaidSubscription = user.subscription?.status === "active";
    if (!hasPaidSubscription) {
      const subscriptionDetails = await getSubscriptionDetails(user._id);
      if (subscriptionDetails.hasSubscription) {
        hasPaidSubscription = subscriptionDetails.hasSubscription;
        user.subscription = subscriptionDetails;
        await user.save();
      }
    }

    const subscriptionType = user.subscription?.type;
    console.log({
      subscriptionType,
      hasPaidSubscription,
      status: user.subscription?.status,
    });
    // If user doesn't have a paid subscription, check story count
    const storyCount = await Story.countDocuments({ userId: user._id });
    if (!hasPaidSubscription) {
      if (storyCount >= freeNumberOfStoriesLimit) {
        return res.status(403).json({
          message: `Free users are limited to ${freeNumberOfStoriesLimit} stories. Please upgrade your subscription to create more.`,
          limitReached: true,
        });
      }
    }
    if (subscriptionType === "plus") {
      if (storyCount >= plusNumberOfStoriesLimit) {
        return res.status(403).json({
          message: `Plus users are limited to ${plusNumberOfStoriesLimit} stories. Please upgrade your subscription to create more.`,
          limitReached: true,
        });
      }
    }
    if (subscriptionType === "pro") {
      if (storyCount >= proNumberOfStoriesLimit) {
        return res.status(403).json({
          message: `Pro users are limited to ${proNumberOfStoriesLimit} stories. Please upgrade your subscription to create more.`,
          limitReached: true,
        });
      }
    }
    if (subscriptionType === "premium") {
      if (storyCount >= premiumNumberOfStoriesLimit) {
        return res.status(403).json({
          message: `Premium users are limited to ${premiumNumberOfStoriesLimit} stories. Please upgrade your subscription to create more.`,
          limitReached: true,
        });
      }
    }

    if (!req.file) {
      throw new Error("No image file uploaded");
    }
    console.log("validation  -done 5% of story");

    // Process the image
    const processedImage = await sharp(req.file.buffer)
      .resize(512, 512, { fit: "inside" })
      .toBuffer();
    // Convert to base64
    const base64Image = processedImage.toString("base64");
    // Generate story using OpenAI
    console.log("processing image -done 10% of story");
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
    console.log("processing story -done 20% of story");
    const storyContent = completion.choices[0].message?.content;

    if (!storyContent) {
      throw new Error("Failed to generate story");
    }
    // Split content into paragraphs
    const paragraphs = storyContent
      .split("\n\n")
      .filter((p: string) => p.trim());

    // Generate images for each paragraph using DALL-E
    console.log("processing images - starting  30% of story");
    const imagePromises: Promise<CloudinaryAsset>[] = paragraphs.map(
      (paragraph: string) =>
        convertImageToGhibli(
          base64Image,
          req.body.name ?? "Maya",
          paragraph,
          style
        )
    );

    const images = await Promise.all(imagePromises);
    console.log("processing images -done 50% of story");
    // Create story in database
    const story = await Story.create({
      userId: user._id, // Associate the story with the user
      title: "A Magical Adventure",
      content: paragraphs,
      images,
      heroImage: `data:image/jpeg;base64,${base64Image}`,
    });
    console.log("creating story -done 100% done");

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

/**
 * Converts an image to a stylized illustration based on a story paragraph.
 * Enhanced with caching, parallel processing capabilities, and improved error handling.
 *
 * @param base64Image - Base64 encoded image
 * @param username - Name of the character in the story
 * @param paragraph - Story paragraph to base the illustration on
 * @param style - Art style to use (default: 'ghibli')
 * @param options - Additional options for image generation
 * @returns Promise with CloudinaryAsset result
 */
const convertImageToGhibli = async (
  base64Image: string,
  username: string = "Maya",
  paragraph: string,
  style: "ghibli" | "pixar" | "disney" = "ghibli",
  options: {
    quality?: "standard" | "hd";
    size?: "1024x1024" | "1792x1024" | "1024x1792";
    forceRefresh?: boolean;
  } = {}
): Promise<CloudinaryAsset> => {
  try {
    // Set defaults for options
    console.log(`[sub process] generating image in ${style} style 1% done`);
    const imageQuality = options.quality || "hd";
    const imageSize = options.size || "1024x1024";
    const forceRefresh = options.forceRefresh || false;

    // Create a cache key from inputs
    const cacheKey = createHash("md5")
      .update(
        `${base64Image.substring(
          0,
          100
        )}${username}${paragraph}${style}${imageQuality}${imageSize}`
      )
      .digest("hex");

    // Try to get from cache unless force refresh is requested
    if (!forceRefresh && imageCache.has(cacheKey)) {
      console.log("Using cached image result");
      return imageCache.get(cacheKey) as CloudinaryAsset;
    }

    // Select art style template
    const styleTemplate = artStyleTemplates[style];
    console.log(`[sub process] generating image in ${style} style 10% done`);

    // Run description and prompt generation in parallel
    const [imageDescription, paragraphAnalysis] = await Promise.all([
      // Get detailed image description
      openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: styleTemplate.systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Describe this image in rich, vivid detail as if directing an artist to recreate it in ${style} style. Focus on subject, environment, lighting, mood, and visual storytelling elements.`,
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
      }),

      // Analyze paragraph for emotional and visual elements in parallel
      openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content:
              "You analyze text to extract key visual and emotional elements for illustration. Focus on emotional tone, key actions, setting details, color themes, lighting, and symbolism.",
          },
          {
            role: "user",
            content: `Extract the most important visual and emotional elements from this story paragraph that should be included in an illustration featuring ${username}:\n\n${paragraph}`,
          },
        ],
      }),
    ]);
    console.log(`[sub process] generating image in ${style} style 50% done`);

    // Extract results
    const description =
      imageDescription.choices[0]?.message?.content ||
      "A child on an adventure in a magical world";
    const visualElements =
      paragraphAnalysis.choices[0]?.message?.content ||
      "Emotional child on a magical adventure";

    // Generate enhanced storytelling prompt
    const enhancedPromptResult = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `You are a master visual storyteller who creates art direction for ${style}-style illustrations. You combine character descriptions, emotional themes, and story contexts into vivid, detailed art prompts.`,
        },
        {
          role: "user",
          content: `Create a detailed, emotion-rich prompt for a ${style}-style illustration featuring ${username} that captures this moment in the story. 
          
Character description: ${description}

Key story elements: ${visualElements}

Story paragraph: ${paragraph}

Your prompt should be highly detailed, emphasizing characteristic elements of ${style} style, emotional expressions, dynamic compositions, and atmospheric elements.`,
        },
      ],
    });

    const combinedPrompt =
      enhancedPromptResult.choices[0]?.message?.content ||
      `Create a ${style}-style illustration of ${username} experiencing: ${paragraph}`;

    // Add specific style guidance
    const finalPrompt = `${combinedPrompt}\n\n${styleTemplate.styleGuide}\n\nMain character name: ${username}`;

    // Limit prompt length to 3900 characters to avoid "string too long" errors (max is 4000)
    const limitedPrompt =
      finalPrompt.length > 3900 ? finalPrompt.substring(0, 3900) : finalPrompt;
    console.log(
      `[sub process] Generating illustration with prompt with ${style} style 70% done`
    );

    // Generate styled image
    const generatedImage = await openai.images
      .generate({
        model: "dall-e-3",
        prompt: limitedPrompt,
        size: imageSize as any,
        quality: imageQuality,
        style: "vivid",
        n: 1,
      })
      .catch((error) => {
        console.error("DALL-E generation error:", error.message);
        throw new Error(`Image generation failed: ${error.message}`);
      });

    if (!generatedImage.data || generatedImage.data.length === 0) {
      throw new Error("Image generation returned no results");
    }
    console.log(
      `[sub process] Generating images with prompt with ${style} id done  style 90% done`
    );
    console.log(`[sub process] start uploading to cloudinery 90%`);

    const imageUrls = generatedImage.data.map((img: any) => img.url);

    // Better error handling for Cloudinary upload with retry
    let uploadedImage: CloudinaryAsset[] | undefined;
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        uploadedImage = await uploadAsset({
          imageUrls: imageUrls,
          customPrompt: `${username}'s ${style}-style story illustration`,
        });

        if (!uploadedImage || uploadedImage.length === 0) {
          throw new Error("Empty response from Cloudinary");
        }

        break; // Exit loop on success
      } catch (error) {
        console.error(
          `Cloudinary upload error (attempt ${retries + 1}/${maxRetries + 1}):`,
          error
        );
        retries++;

        if (retries > maxRetries) {
          throw new Error(
            `Failed to upload image after ${maxRetries + 1} attempts`
          );
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, retries))
        );
      }
    }
    console.log(`[sub process]  uploading to cloudinery done  90%`);

    // Store result in cache - if we got here, uploadedImage must be defined
    if (!uploadedImage || uploadedImage.length === 0) {
      throw new Error("Failed to upload image to Cloudinary after retries");
    }

    const result = uploadedImage[0] as CloudinaryAsset;
    imageCache.set(cacheKey, result);
    console.log(`[sub process] story images are done  100%`);

    return result;
  } catch (error: any) {
    console.error("Error in convertImageToGhibli:", error);

    // More detailed error logging and handling
    if (error.response) {
      console.error("API Error Response:", {
        status: error.response.status,
        data: error.response.data,
      });
    }

    throw error;
  }
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
