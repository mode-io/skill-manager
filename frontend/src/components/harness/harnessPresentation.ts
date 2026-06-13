import claudeLogo from "../../assets/harness-logos/claude-code-logo.svg";
import codexLogo from "../../assets/harness-logos/codex-logo.svg";
import cursorLogo from "../../assets/harness-logos/cursor-logo.svg";
import openclawLogo from "../../assets/harness-logos/openclaw-logo.svg";
import opencodeLogo from "../../assets/harness-logos/opencode-logo.svg";
import agyLogo from "../../assets/harness-logos/agy-logo.svg";

export type HarnessLogoKey = "claude" | "codex" | "cursor" | "opencode" | "openclaw" | "agy";

interface HarnessPresentation {
  logoSrc: string;
  variant: HarnessLogoKey;
}

const HARNESS_LOGO_ASSETS: Record<HarnessLogoKey, HarnessPresentation> = {
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
  openclaw: {
    logoSrc: openclawLogo,
    variant: "openclaw",
  },
  agy: {
    logoSrc: agyLogo,
    variant: "agy",
  },
};

export function getHarnessPresentation(logoKey: string | null | undefined): HarnessPresentation | null {
  if (!logoKey) {
    return null;
  }
  return HARNESS_LOGO_ASSETS[logoKey as HarnessLogoKey] ?? null;
}

