interface TagBadgeProps {
  label: string;
  variant?: 'domain' | 'mood' | 'keyword' | 'user';
  className?: string;
}

export default function TagBadge({ label, variant = 'keyword', className = '' }: TagBadgeProps) {
  const baseClass =
    'px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all';

  const variantClasses: Record<string, string> = {
    domain: 'bg-[#2B5F3F]/5 border-[#2B5F3F]/20 text-[#2B5F3F]',
    mood: 'bg-[#D4A853]/5 border-[#D4A853]/20 text-[#D4A853]',
    keyword: 'bg-[#F7F5F0] border-[#E8E5DD] text-[#4A4A5A]',
    user: 'bg-[#D4A853]/10 border-[#D4A853]/30 text-[#B8923F]',
  };

  return (
    <span className={`inline-flex items-center ${baseClass} ${variantClasses[variant] || variantClasses.keyword} ${className}`}>
      {label}
    </span>
  );
}
