import multer from "multer";
import { Request } from "express";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    const allowedExtensions = [".pdf", ".txt", ".md", ".csv", ".docx"];
    const fileExt = file.originalname
      .substring(file.originalname.lastIndexOf("."))
      .toLowerCase();

    if (allowedExtensions.includes(fileExt)) {
      cb(null, true); // Accept file
    } else {
      cb(
        new Error(
          "Invalid file type. Allowed types: PDF, TXT, MD, CSV, DOCX",
        ),
      ); // Reject file
    }
  },
});
