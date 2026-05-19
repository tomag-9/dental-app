export default function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  error = null,
  disabled = false,
  rows = null,
  options = null,
  helpText = null,
  className = ''
}) {
  const inputClasses = `
    w-full px-3 py-2 border border-input rounded-lg bg-card text-foreground
    placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent
    disabled:bg-muted disabled:cursor-not-allowed disabled:opacity-50
    transition-colors text-sm
    ${error ? 'border-destructive focus:ring-destructive' : ''}
    ${className}
  `;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      {type === 'textarea' ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows || 3}
          className={inputClasses}
        />
      ) : type === 'select' ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={inputClasses}
        >
          <option value="">{placeholder || 'Vybrať...'}</option>
          {options?.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={inputClasses}
        />
      )}

      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}

      {helpText && (
        <p className="text-xs text-muted-foreground mt-1">{helpText}</p>
      )}
    </div>
  );
}
