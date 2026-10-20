import Link from "next/link";
import React from "react";

import styles from "docs/components/CallToAction.module.css";

/*
 * `size` was a Stitches variant, whose type came from `VariantProps<typeof …>`. There is no
 * styled component to read a type from now, so the one variant is stated directly.
 */
interface CallToActionProps {
  size?: "small";
  href: string;
  text: string;
  id?: HTMLElement["id"];
  target?: HTMLAnchorElement["target"];
}

const CallToAction: React.FC<CallToActionProps> = ({
  href,
  size,
  text,
  id,
  target,
}) => {
  return (
    <Link
      className={`${styles.cta} ${size === "small" ? styles.small : ""}`}
      href={href}
      id={id}
      target={target}
    >
      {text} <span>→</span>
    </Link>
  );
};

export default CallToAction;
