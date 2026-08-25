import multer from "multer";

const storage =
  multer.memoryStorage();

export const upload =
  multer({
    storage,

    limits: {
      fileSize:
        20 *
        1024 *
        1024,
    },

    fileFilter(
      req,
      file,
      cb
    ) {
      const allowed =
        [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/jpg",
          "image/webp",
        ];

      if (
        allowed.includes(
          file.mimetype
        )
      ) {
        cb(null, true);
      } else {
        cb(
          new Error(
            "Only PDF and image files are allowed"
          )
        );
      }
    },
  });