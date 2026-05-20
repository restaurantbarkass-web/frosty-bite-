import { HfInference } from "@huggingface/inference";

let hf: HfInference | null = null;

export function getHF() {
  if (!hf) {
    const token = process.env.HF_TOKEN || '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';
    if (!token) {
      // Return a dummy or throw. Avatar service seems to handle missing token.
      console.warn("HF_TOKEN missing, HuggingFace inference will be disabled.");
      return null;
    }
    hf = new HfInference(token);
  }
  return hf;
}
