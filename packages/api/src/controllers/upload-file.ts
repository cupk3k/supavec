import { Request, Response } from "express";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { unlink, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { z } from "zod";
// import type { Document } from "@langchain/core/documents"; // Removed unused import
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { updateLoopsContact } from "../utils/loops";
import { client } from "../utils/posthog";
import { logApiUsageAsync } from "../utils/async-logger";
import { supabase } from "../utils/supabase";
import { storeDocumentsWithFileId } from "../utils/vector-store";

console.log("[UPLOAD-FILE] Module loaded");

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

const uploadQuerySchema = z.object({
  chunk_size: z.number().positive().default(DEFAULT_CHUNK_SIZE),
  chunk_overlap: z.number()
    .positive()
    .default(DEFAULT_CHUNK_OVERLAP),
}).refine(
  (data) => {
    return data.chunk_overlap < data.chunk_size;
  },
  {
    message: "chunk_overlap must be less than chunk_size",
    path: ["chunk_overlap"],
  },
);

export const uploadFile = async (req: Request, res: Response) => {
  console.log("[UPLOAD-FILE] Request received");
  try {
    const apiKey = req.headers.authorization as string;

    // Get team ID from API key
    console.log("[UPLOAD-FILE] Verifying API key");
    // const { data: apiKeyData, error: apiKeyError } = await supabase
    const { data: apiKeyData } = await supabase
      .from("api_keys")
      .select("team_id, user_id, profiles(email)")
      .match({ api_key: apiKey })
      .single();

    // if (apiKeyError || !apiKeyData?.team_id) {
    //   console.log("[UPLOAD-FILE] Invalid API key", { error: apiKeyError });
    //   return res.status(401).json({
    //     success: false,
    //     error: "Invalid API key",
    //   });
    // }

    // const teamId = apiKeyData.team_id as string;
    const teamId = apiKeyData?.team_id as string;
    console.log("[UPLOAD-FILE] Team ID retrieved", { teamId });

    // Validate query parameters
    console.log("[UPLOAD-FILE] Validating query parameters");
    const queryValidation = uploadQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      console.log(
        "[UPLOAD-FILE] Query validation failed",
        queryValidation.error.errors,
      );
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: queryValidation.error.errors,
      });
    }
    const { chunk_size, chunk_overlap } = queryValidation.data;
    console.log("[UPLOAD-FILE] Query parameters validated", {
      chunk_size,
      chunk_overlap,
    });

    if (!req.file) {
      console.log("[UPLOAD-FILE] No file provided in request");
      return res.status(400).json({
        success: false,
        error: "No file provided",
      });
    }

    const buffer = req.file.buffer;
    const fileId = randomUUID();
    const fileName = req.file.originalname;
    const tempFileName = `${fileId}.${req.file.originalname.split(".").pop()}`;
    const tempFilePath = join(tmpdir(), tempFileName);
    console.log("[UPLOAD-FILE] File details", {
      fileId,
      fileName,
      fileType: req.file.mimetype,
      fileSize: buffer.length,
    });

    console.log("[UPLOAD-FILE] Writing file to temp location", {
      tempFilePath,
    });
    await writeFile(tempFilePath, buffer);

    // Upload file to Supabase Storage with team ID in path
    console.log("[UPLOAD-FILE] Uploading to Supabase Storage");
    const { data: storageData, error: storageError } = await supabase.storage
      .from("user-documents")
      .upload(`/${teamId}/${tempFileName}`, buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (storageError) {
      console.log("[UPLOAD-FILE] Storage upload failed", {
        error: storageError,
      });
      throw new Error(
        `Failed to upload file to storage: ${storageError.message}`,
      );
    }
    console.log("[UPLOAD-FILE] Storage upload successful", {
      path: storageData.path,
    });

    console.log("[UPLOAD-FILE] Processing file content");

    // Determine the file type based on extension
    const fileExt = req.file.originalname
      .substring(req.file.originalname.lastIndexOf("."))
      .toLowerCase();

    let loader;

    console.log(`[UPLOAD-FILE] Determining loader for extension: ${fileExt}`);
    switch (fileExt) {
      case ".pdf":
        loader = new PDFLoader(tempFilePath);
        break;
      case ".txt":
      case ".md": // Treat markdown as plain text for loading
        loader = new TextLoader(tempFilePath);
        break;
      case ".csv":
        loader = new CSVLoader(tempFilePath);
        break;
      case ".docx":
        loader = new DocxLoader(tempFilePath);
        break;
      default:
        // This should not be reached if middleware is working correctly
        console.error(
          `[UPLOAD-FILE] Unsupported file type received in controller: ${fileExt}`,
        );
        await unlink(tempFilePath); // Clean up temp file
        return res.status(400).json({
          success: false,
          error: "Unsupported file type.",
        });
    }

    console.log(`[UPLOAD-FILE] Loading documents using ${loader.constructor.name}`);
    const documents = await loader.load();

    console.log("[UPLOAD-FILE] Documents loaded", { docCount: documents.length });

    // Clean up temp file
    console.log("[UPLOAD-FILE] Cleaning up temp file");
    await unlink(tempFilePath);

    // Split text into chunks
    console.log("[UPLOAD-FILE] Splitting content into chunks");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunk_size ?? DEFAULT_CHUNK_SIZE,
      chunkOverlap: chunk_overlap ?? DEFAULT_CHUNK_OVERLAP,
    });
    const chunks = await splitter.splitDocuments(documents);
    console.log("[UPLOAD-FILE] Content split into chunks", {
      chunkCount: chunks.length,
    });

    // Add file_id metadata to each chunk
    console.log("[UPLOAD-FILE] Adding metadata to chunks");
    chunks.forEach((chunk) => {
      chunk.metadata.file_id = fileId;
      chunk.metadata.team_id = teamId;
    });

    try {
      console.log("[UPLOAD-FILE] Storing documents in vector store");
      const { success, insertedCount } = await storeDocumentsWithFileId(
        chunks,
        fileId,
        supabase,
      );

      if (!success) {
        throw new Error("Failed to store documents in vector store");
      }

      console.log(
        `[UPLOAD-FILE] Documents stored successfully. Total inserted: ${insertedCount}`,
      );

      console.log("[UPLOAD-FILE] Inserting file record");
      const fileType = fileExt.substring(1); // Remove leading dot
      await supabase.from("files").insert({
        file_id: fileId,
        type: fileType,
        file_name: fileName,
        team_id: teamId,
        storage_path: storageData.path,
      });
      console.log("[UPLOAD-FILE] File record inserted");

      // Update Loops contact
      // if (apiKeyData.profiles?.email) {
      if (apiKeyData?.profiles?.email) {
        try {
          console.log("[UPLOAD-FILE] Updating Loops contact");
          updateLoopsContact({
            email: apiKeyData.profiles.email,
            isFileUploaded: true,
          });
          console.log("[UPLOAD-FILE] Loops contact updated");
        } catch (error) {
          console.error("[UPLOAD-FILE] Error updating Loops contact:", error);
        }
      }

      console.log("[UPLOAD-FILE] Capturing PostHog event");
      client.capture({
        // distinctId: apiKeyData.profiles?.email as string,
        distinctId: apiKeyData?.profiles?.email as string,
        event: "file_upload_completed",
        properties: {
          file_name: fileName,
          file_type: fileType,
          file_size: buffer.length,
        },
      });

      console.log("[UPLOAD-FILE] Logging API usage");
      logApiUsageAsync({
        endpoint: "/upload_file",
        // userId: apiKeyData.user_id || "",
        userId: apiKeyData?.user_id || "",
        success: true,
      });

      console.log("[UPLOAD-FILE] Sending successful response");
      return res.json({
        success: true,
        message: `${fileType} file processed successfully`,
        file_name: fileName,
        file_id: fileId,
        chunks: chunks.length,
        chunk_size: chunk_size ?? DEFAULT_CHUNK_SIZE,
        chunk_overlap: chunk_overlap ?? DEFAULT_CHUNK_OVERLAP,
      });
    } catch (vectorError) {
      console.log("[UPLOAD-FILE] Error processing vectors", {
        error: vectorError instanceof Error
          ? vectorError.message
          : "Unknown error",
      });
      throw new Error(
        vectorError instanceof Error
          ? vectorError.message
          : "Error processing vectors",
      );
    }
  } catch (error) {
    console.error("[UPLOAD-FILE] Error processing file:", error);

    if (req.headers.authorization) {
      const apiKey = req.headers.authorization as string;
      console.log("[UPLOAD-FILE] Attempting to log error with user ID");
      const { data: apiKeyData } = await supabase
        .from("api_keys")
        .select("user_id")
        .match({ api_key: apiKey })
        .single();

      if (apiKeyData?.user_id) {
        logApiUsageAsync({
          endpoint: "/upload_file",
          userId: apiKeyData.user_id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        console.log("[UPLOAD-FILE] Error logged for user", {
          userId: apiKeyData.user_id,
        });
      }
    }

    console.log("[UPLOAD-FILE] Sending error response");
    return res.status(500).json({
      success: false,
      error: `Failed to process file${
        error instanceof Error ? `: ${error.message}` : ""
      }`,
    });
  }
};
