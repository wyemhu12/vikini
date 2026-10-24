import { AppError } from "@/lib/utils/errors";

export class StrataDisabledError extends AppError {
  constructor(message: string = "Local LLM (Strata) is disabled") {
    super(message, 503, "LOCAL_LLM_DISABLED");
    this.name = "StrataDisabledError";
  }
}

export class StrataOfflineError extends AppError {
  constructor(message: string = "Local Strata server is offline") {
    super(message, 503, "LOCAL_LLM_OFFLINE");
    this.name = "StrataOfflineError";
  }
}

export class StrataQueueFullError extends AppError {
  constructor(message: string = "Local model queue is full") {
    super(message, 429, "LOCAL_LLM_BUSY");
    this.name = "StrataQueueFullError";
  }
}

export class StrataQueueTimeoutError extends AppError {
  constructor(message: string = "Timed out waiting in local model queue") {
    super(message, 504, "LOCAL_QUEUE_TIMEOUT");
    this.name = "StrataQueueTimeoutError";
  }
}

export interface StrataTokenOverflowInfo {
  limit: number;
  requested: number;
}

export class StrataContextOverflowError extends AppError {
  readonly isTokenLimit = true;
  readonly tokenInfo: StrataTokenOverflowInfo;

  constructor(tokenInfo: StrataTokenOverflowInfo, message?: string) {
    super(
      message ||
        `Prompt exceeds local 32K budget (requested ${tokenInfo.requested} / limit ${tokenInfo.limit} tokens)`,
      400,
      "LOCAL_CONTEXT_OVERFLOW"
    );
    this.name = "StrataContextOverflowError";
    this.tokenInfo = tokenInfo;
  }
}

export class StrataUnsupportedInputError extends AppError {
  constructor(
    code: string = "LOCAL_IMAGES_UNSUPPORTED",
    message: string = "Local model does not support image attachments on the current turn"
  ) {
    super(message, 400, code);
    this.name = "StrataUnsupportedInputError";
  }
}
