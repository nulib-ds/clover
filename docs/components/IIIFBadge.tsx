import Link from "next/link";
import React from "react";
import styles from "docs/components/IIIFBadge.module.css";

const Badge = ({ children, href, text = ["Presentation API"] }) => {
  return (
    <Link href={href} target="_blank" className={styles.badge}>
      <span className={styles.content}>
        <IIIFLogo /> {text.join(` or `)} ↗
      </span>
    </Link>
  );
};

const IIIFLogo: React.FC = () => {
  const red = "#ed1d33";
  const blue = "#2873ab";

  return (
    <svg
      viewBox="0 0 493.35999 441.33334"
      id="iiif-logo"
      version="1.1"
      style={{
        height: "1rem",
      }}
    >
      <title>IIIF Logo</title>
      <g transform="matrix(1.3333333,0,0,-1.3333333,0,441.33333)">
        <g transform="scale(0.1)">
          <path
            style={{ fill: blue }}
            d="M 65.2422,2178.75 775.242,1915 773.992,15 65.2422,276.25 v 1902.5"
          />
          <path
            style={{ fill: blue }}
            d="m 804.145,2640.09 c 81.441,-240.91 -26.473,-436.2 -241.04,-436.2 -214.558,0 -454.511,195.29 -535.9527,436.2 -81.4335,240.89 26.4805,436.18 241.0387,436.18 214.567,0 454.512,-195.29 535.954,-436.18"
          />
          <path
            style={{ fill: red }}
            d="M 1678.58,2178.75 968.578,1915 969.828,15 1678.58,276.25 v 1902.5"
          />
          <path
            style={{ fill: red }}
            d="m 935.082,2640.09 c -81.437,-240.91 26.477,-436.2 241.038,-436.2 214.56,0 454.51,195.29 535.96,436.2 81.43,240.89 -26.48,436.18 -241.04,436.18 -214.57,0 -454.52,-195.29 -535.958,-436.18"
          />
          <path
            style={{ fill: blue }}
            d="m 1860.24,2178.75 710,-263.75 -1.25,-1900 -708.75,261.25 v 1902.5"
          />
          <path
            style={{ fill: blue }}
            d="m 2603.74,2640.09 c 81.45,-240.91 -26.47,-436.2 -241.03,-436.2 -214.58,0 -454.52,195.29 -535.96,436.2 -81.44,240.89 26.48,436.18 241.03,436.18 214.57,0 454.51,-195.29 535.96,-436.18"
          />
          <path
            style={{ fill: red }}
            d="m 3700.24,3310 v -652.5 c 0,0 -230,90 -257.5,-142.5 -2.5,-247.5 0,-336.25 0,-336.25 l 257.5,83.75 V 1690 l -258.61,-92.5 V 262.5 L 2735.24,0 v 2360 c 0,0 -15,850 965,950"
          />
        </g>
      </g>
    </svg>
  );
};

export default Badge;
