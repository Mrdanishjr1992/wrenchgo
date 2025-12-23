import { create } from "zustand";
import type { Job, JobStatus, Mechanic } from "../ui/types";
import { jobs as mockJobs, mechanics } from "../data/mock";

type JobsState = {
  jobs: Job[];
  acceptQuote: (jobId: string, mechanic?: Mechanic) => void;
  setStatus: (jobId: string, status: JobStatus) => void;
};

export const useJobsStore = create<JobsState>((set) => ({
  jobs: mockJobs,

  acceptQuote: (jobId, mechanic) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: "accepted",
              mechanic: mechanic ?? mechanics[0], // placeholder
              updatedAt: new Date().toISOString(),
            }
          : j
      ),
    })),

  setStatus: (jobId, status) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId ? { ...j, status, updatedAt: new Date().toISOString() } : j
      ),
    })),
}));
