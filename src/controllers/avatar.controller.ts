import { Request, Response } from "express";
import { avatarQueue } from "../queues/avatar.queue";

export async function generateAvatar(req: Request, res: Response) {
  const { prompt, vibe, imageUrl, userId } = req.body;
  console.log(`[Avatar Controller] Queuing job for user: ${userId}`);

  try {
    const job = await avatarQueue.add("generate", {
      prompt,
      vibe,
      imageUrl,
      userId
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    });

    res.status(202).json({ 
      message: "Generation started", 
      jobId: job.id 
    });
  } catch (error: any) {
    console.error("[Avatar Controller] Queue Error:", error);
    res.status(500).json({ error: "Failed to queue generation job", details: error.message });
  }
}

export async function getJobStatus(req: Request, res: Response) {
  const jobId = req.params.jobId;
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: "Invalid Job ID" });
  }

  try {
    const job = await avatarQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const state = await job.getState();
    const result = job.returnvalue;

    res.json({
      id: job.id,
      state,
      progress: job.progress,
      result
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch job status", details: error.message });
  }
}
