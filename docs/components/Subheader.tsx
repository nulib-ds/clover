/**
 * The line under the navbar: whose project Clover is. It scrolls away with the page while
 * the navbar stays held (`navbar.component` in `theme.config.tsx` renders it after
 * Nextra's navbar, outside the navbar's sticky box). Styled in `docs/styles/layout.css`.
 */
const Subheader = () => (
  <div className="site-subheader">
    <p>
      Clover is a project of{" "}
      <a href="https://www.library.northwestern.edu/">
        Northwestern University Libraries
      </a>
      .
    </p>
  </div>
);

export default Subheader;
