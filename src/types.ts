export type BountyCategory = "Web App" | "API / Backend" | "AI Agent Tool" | string;

export type BountyStatus =
  | "OPEN_FOR_CLAIM"
  | "IN_PROGRESS"
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
  testsPassed: number;
  testsTotal: number;
  currentStage: string;
}
