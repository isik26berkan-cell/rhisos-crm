import { Input } from "@/components/ui/input";
import { fmtNum, parseNum } from "@/lib/format";

export function CurrencyInput({ value, onChange, suffix = "TL", ...props }) {
  return (
    <div className="relative">
      <Input
        {...props}
        inputMode="numeric"
        value={value ? fmtNum(value) : ""}
        onChange={(e) => onChange(parseNum(e.target.value))}
        className="bg-zinc-50 border-zinc-200 rounded-xl h-11 pr-12 tabular-nums font-medium focus-visible:ring-zinc-900"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 font-medium pointer-events-none">
        {suffix}
      </span>
    </div>
  );
}
