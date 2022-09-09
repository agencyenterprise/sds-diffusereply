import * as dotenv from "dotenv";
dotenv.config();

import Replicate from "replicate-js";

const ReplicateClient = new Replicate();

const {
  TXT2IMG_SETTING_HEIGHT,
  TXT2IMG_SETTING_WIDTH,
  TXT2IMG_SETTING_GUIDANCE,
  TXT2IMG_SETTING_STEPS,
  TXT2IMG_SETTINGS_PROMPTSTR,
  TXT2IMG_SETTING_OUTPUTS,
  TXT2IMG_PROMPT_PRE,
  TXT2IMG_PROMPT_POST
} = process.env;

const modifier_list = [
  "fantasy, matte painting, concept art",
  "scifi, bladerunner, concept art",
  "ghibli, matte painting, concept art"
];

const getRandomModifier = () =>
  modifier_list[Math.floor(Math.random() * modifier_list.length)];

const processPrompt = prompt =>
  `${
    TXT2IMG_PROMPT_PRE ? `${TXT2IMG_PROMPT_PRE}, ` : ""
  }${prompt}, ${getRandomModifier()}${
    TXT2IMG_PROMPT_POST ? `, ${TXT2IMG_PROMPT_POST}` : ""
  }`;

export const callTextToImageReplicate = async (prompt_text, init_image) => {
  const stableDiffusionModel = await ReplicateClient.models.get(
    "stability-ai/stable-diffusion"
  );

  const stableDiffusionImage = await stableDiffusionModel.predict({
    prompt: processPrompt(prompt_text),
    num_outputs: TXT2IMG_SETTING_OUTPUTS,
    width: TXT2IMG_SETTING_WIDTH,
    height: TXT2IMG_SETTING_HEIGHT,
    prompt_strength: TXT2IMG_SETTINGS_PROMPTSTR,
    num_inference_steps: TXT2IMG_SETTING_STEPS,
    guidance_scale: TXT2IMG_SETTING_GUIDANCE,

    ...(init_image && { init_image })
  });
  return stableDiffusionImage;
};
