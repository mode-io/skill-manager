import { type ReactNode } from "react";

import { CardSelectCheckbox } from "../../../../components/cards/CardSelectCheckbox";
import { OverflowTooltipText } from "../../../../components/ui/OverflowTooltipText";

interface CardTitleRowProps {
  name: string;
  checked: boolean;
  onToggleChecked: () => void;
  menu?: ReactNode;
}

export function CardTitleRow({
  name,
  checked,
  onToggleChecked,
  menu,
}: CardTitleRowProps) {
  return (
    <div className="skill-card__head">
      <OverflowTooltipText as="h3" className="skill-card__name">
        {name}
      </OverflowTooltipText>
      <span aria-hidden="true" />
      {menu ?? <span aria-hidden="true" />}
      <CardSelectCheckbox
        checked={checked}
        onToggle={onToggleChecked}
        label={checked ? `Deselect ${name}` : `Select ${name}`}
      />
    </div>
  );
}
