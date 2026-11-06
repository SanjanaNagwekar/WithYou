type WithYouBrandProps = {
  className?: string;
  href?: string;
  label?: string;
};

export function WithYouBrand({
  className = '',
  href = '/',
  label = 'WithYou home',
}: WithYouBrandProps) {
  return (
    <a className={`signal-brand ${className}`.trim()} href={href} aria-label={label}>
      <span className="signal-brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      <span>WithYou</span>
    </a>
  );
}
