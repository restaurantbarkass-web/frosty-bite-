import { HfInference } from "@huggingface/inference";

let hf: HfInference | null = null;

export function getHF() {
  if (!hf) {
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new Error("HF_TOKEN environment variable is required.");
    }
    hf = new HfInference(token);
  }
  return hf;
}
