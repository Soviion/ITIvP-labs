import Icon from './Icon';
import Spinner from './Spinner';

// variant: primary | secondary | ghost | danger. При loading кнопка блокируется и показывает спиннер.
export default function Button({ variant = 'secondary', size, loading = false, icon, children, className = '', disabled, type = 'button', ...rest }) {
  const classes = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', !children && 'btn-icon', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner size={16} /> : icon && <Icon name={icon} size={16} />}
      {children && <span>{children}</span>}
    </button>
  );
}
