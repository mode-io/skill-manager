export type SlashTargetId = "opencode" | "claude" | "cursor" | "codex";

export type SlashSyncStatus =
  | "synced"
  | "removed"
  | "not_selected"
  | "blocked_manual_file"
  | "failed";

export interface SlashTargetDto {
  id: SlashTargetId;
  label: string;
  rootPath: string;
  outputDir: string;
  invocationPrefix: string;
  defaultSelected: boolean;
}

export interface SlashSyncEntryDto {
  target: SlashTargetId;
  path: string;
  status: SlashSyncStatus;
  error?: string | null;
}

export interface SlashCommandDto {
  name: string;
  description: string;
  prompt: string;
  syncTargets: SlashSyncEntryDto[];
}

export interface SlashCommandListDto {
  storePath: string;
  syncStatePath: string;
  targets: SlashTargetDto[];
  defaultTargets: SlashTargetId[];
  commands: SlashCommandDto[];
  reviewCommands: SlashCommandReviewDto[];
}

export interface SlashCommandMutationRequest {
  name: string;
  description: string;
  prompt: string;
  targets?: SlashTargetId[];
}

export interface SlashCommandUpdateRequest {
  description: string;
  prompt: string;
  targets?: SlashTargetId[];
}

export interface SlashSyncRequest {
  targets?: SlashTargetId[];
}

export interface SlashCommandReviewDto {
  reviewRef: string;
  target: SlashTargetId;
  targetLabel: string;
  name: string;
  path: string;
  description: string;
  prompt: string;
  commandExists: boolean;
  canImport: boolean;
  error?: string | null;
}

export interface SlashCommandImportRequest {
  target: SlashTargetId;
  name: string;
}

export interface SlashCommandMutationResponse {
  ok: boolean;
  command: SlashCommandDto | null;
  sync: SlashSyncEntryDto[];
}

export interface SlashCommandDeleteResponse {
  ok: boolean;
  sync: SlashSyncEntryDto[];
}
