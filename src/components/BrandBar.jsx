export default function BrandBar({ subtitle, children, home = '#/admin' }) {
  return (
    <header className="topbar">
      <a className="brand" href={home} aria-label="The BK Consulting Group">
        <span className="brand-mark" aria-hidden="true">BK</span>
        <span className="brand-name">The BK Consulting Group<small>{subtitle}</small></span>
      </a>
      <span className="topbar-spacer" />
      {children}
    </header>
  );
}
