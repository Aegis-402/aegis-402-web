export type BountyCategory = "Web App" | "API / Backend" | "AI Agent Tool" | string;

export type BountyStatus =
  | "OPEN_FOR_CLAIM"
  | "IN_PROGRESS"
  | "PROVISIONING"
  | "READY_FOR_REVIEW"
  | "SETTLED"
  | "REFUNDED";

export interface Bounty {
  id: string;
  title: string;
  description: string;
  escrowAmount: number;
  currency: string;
  status: BountyStatus;
  category: BountyCategory;
  payPalAuthorizationId?: string;
  payPalCaptureId?: string;
  workerAgentId?: string;
  leaseToken?: string;
  leaseExpiresAt?: number;
  deliverableUrl?: string;
  /** Hex sha256 of the plaintext code tarball (bytes live on the arbiter, never the hub). */
  artifactSha256?: string;
  artifactByteSize?: number;
  /** Arbiter sandbox lifecycle (PROVISIONING phase). */
  provisionStartedAt?: number;
  provisionError?: string;
  latestProgress?: string;
  verificationSummary?: {
    verdict?: string;
    artifactSha256?: string;
    sandboxId?: string;
    completedAt?: number;
    /** Compact per-gate breakdown (scores + failing items, capped). */
    gateDetail?: {
      overallScore?: number;
      contract?: {
        score?: number;
        passed?: boolean;
        passedEndpoints?: number;
        totalEndpoints?: number;
        p95LatencyMs?: number;
        slaPassed?: boolean;
        failedProbes?: Array<{ endpoint?: string; statusCode?: number; errors?: string[] }>;
      };
      security?: {
        score?: number;
        passed?: boolean;
        vulnerabilitiesFound?: number;
        antiCheatPassed?: boolean;
        failedChecks?: Array<{ name?: string; type?: string; details?: string }>;
      };
      ai?: {
        score?: number;
        passed?: boolean;
        evaluator?: string;
        summary?: string;
        failedRequirements?: Array<{ requirement?: string; observations?: string }>;
      };
    };
  };
  testsPassed: number;
  testsTotal: number;
  currentStage: string;
  claimCount?: number;
  workerHistory?: string[];
  rejectionReason?: string;
  settledAt?: number;
  payoutBatchId?: string;
  payoutStatus?: string;
  platformFee?: number;
  developerPayout?: number;
  invoiceId?: string;
  invoiceStatus?: string;
  voidFee?: number;
  problemStatement?: string;
  requirements?: string[];
  acceptanceCriteria?: string[];
  techConstraints?: string;
  timeline?: string;
  referenceLinks?: string[];
}
