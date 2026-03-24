import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { useCatalog } from "../hooks/useCatalog";
import { useMutation } from "../hooks/useMutation";
import { SkillCard } from "../components/SkillCard";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import "../styles/my-skills.css";

export function MySkillsPage(): JSX.Element {
  const { catalog, harnesses, toggleBinding, updateSkill } = useCatalog();
  const toggle = useMutation(toggleBinding);
  const update = useMutation(updateSkill);
  const navigate = useNavigate();

  const shared = catalog.filter((e) => e.ownership === "shared");

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My Skills</h1>
          <p className="subtitle">{shared.length} skill{shared.length !== 1 ? "s" : ""} in shared store</p>
        </div>
      </div>

      {(toggle.error || update.error) && (
        <ErrorBanner message={(toggle.error || update.error)!} onDismiss={() => { toggle.clearError(); update.clearError(); }} />
      )}

      {shared.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No skills in your shared store"
          description="Visit the Marketplace to install skills or the Setup page to centralize existing ones."
          action={{ label: "Go to Marketplace", onClick: () => navigate("/marketplace") }}
        />
      ) : (
        <div className="skill-grid">
          {shared.map((entry) => (
            <SkillCard
              key={entry.skillRef}
              entry={entry}
              harnesses={harnesses}
              onToggle={toggle.execute}
              onUpdate={update.execute}
            />
          ))}
        </div>
      )}
    </>
  );
}
