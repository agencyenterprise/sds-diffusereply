import * as dotenv from "dotenv";
import axios from "axios";

import { logError } from "./util.js";

dotenv.config();

const { TXT2IMG_API_URL } = process.env;

export const callTextToImageReplicate = async (prompt_text, init_image) => {
  try {
    const urlSearchParams = new URLSearchParams({
      preset: init_image ? "single-high-image" : "single-high",
      prompt: prompt_text,
      ...(init_image && { init_image })
    });
    const response = await axios.get(
      `${TXT2IMG_API_URL}/queue/sdgen?${urlSearchParams}`
    );
    return response.data;
  } catch (e) {
    logError(e.message);
  }
};
