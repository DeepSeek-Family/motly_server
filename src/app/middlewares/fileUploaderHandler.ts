import { RequestHandler } from "express";
import fs from "fs";
import { StatusCodes } from "http-status-codes";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import ApiError from "../../errors/ApiErrors";

const fileUploadHandler = (): RequestHandler => {
  //create upload folder
  const baseUploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(baseUploadDir)) {
    fs.mkdirSync(baseUploadDir);
  }

  //folder create for different file
  const createDir = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
  };

  //create filename
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      let uploadDir;
      switch (file.fieldname) {
        case "image":
          uploadDir = path.join(baseUploadDir, "image");
          break;
        case "carImages":
          uploadDir = path.join(baseUploadDir, "carImages");
          break;
        case "icon":
          uploadDir = path.join(baseUploadDir, "icon");
          break;
        default:
          throw new ApiError(StatusCodes.BAD_REQUEST, "File is not supported");
      }
      createDir(uploadDir);
      cb(null, uploadDir);
    },

    filename: (_req, file, cb) => {
      const fileExt = path.extname(file.originalname);
      const fileName =
        file.originalname
          .replace(fileExt, "")
          .toLowerCase()
          .split(" ")
          .join("-") +
        "-" +
        Date.now();
      cb(null, fileName + fileExt);
    },
  });

  //file filter — keep req loose to avoid @types/express v4/v5 mismatch
  const filterFilter = (_req: any, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (
      file.fieldname === "image" ||
      file.fieldname === "carImages" ||
      file.fieldname === "icon"
    ) {
      if (
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/png" ||
        file.mimetype === "image/jpg"
      ) {
        cb(null, true);
      } else {
        cb(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            "Only .jpeg, .png, .jpg file supported"
          )
        );
      }
    } else {
      cb(new ApiError(StatusCodes.BAD_REQUEST, "This file is not supported"));
    }
  };

  const upload = multer({ storage: storage, fileFilter: filterFilter }).fields([
    { name: "image", maxCount: 7 },
    { name: "carImages", maxCount: 7 },
    { name: "icon", maxCount: 1 },
  ]);
  return upload as unknown as RequestHandler;
};

export default fileUploadHandler;
