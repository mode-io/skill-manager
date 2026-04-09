import claudeLogo from "../../../../assets/harness-logos/claude-code-logo.svg";
import codexLogo from "../../../../assets/harness-logos/codex-logo.svg";
import cursorLogo from "../../../../assets/harness-logos/cursor-logo.svg";
import opencodeLogo from "../../../../assets/harness-logos/opencode-logo.svg";

export type HarnessLogoVariant = "claude" | "codex" | "cursor" | "opencode";

interface HarnessPresentation {
  logoSrc: string;
  variant: HarnessLogoVariant;
}

const HARNESS_PRESENTATION: Record<string, HarnessPresentation> = {
  claude: {
    logoSrc: claudeLogo,
    variant: "claude",
  },
  codex: {
    logoSrc: codexLogo,
    variant: "codex",
  },
  cursor: {
    logoSrc: cursorLogo,
    variant: "cursor",
  },
  opencode: {
    logoSrc: opencodeLogo,
    variant: "opencode",
  },
};

export function getHarnessPresentation(harness: string): HarnessPresentation | null {
  return HARNESS_PRESENTATION[harness] ?? null;
}
