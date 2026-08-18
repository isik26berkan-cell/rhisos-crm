import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/CurrencyInput";
import { fmtNum, fmtDate } from "@/lib/format";
import { PAYMENT_TYPES } from "@/lib/calculations";
import { PlusCircle } from "lucide-react";
import { useState } from "react";

const typeBadge = (type) => {
  const map = {
    [PAYMENT_TYPES.ORG]: "bg-amber-50 text-amber-700 border-amber-200",
    [PAYMENT_TYPES.DOWN]: "bg-zinc-100 text-zinc-700 border-zinc-200",
    [PAYMENT_TYPES.PRE]: "bg-sky-50 text-sky-700 border-sky-200",
    [PAYMENT_TYPES.POST]: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return map[type] || "bg-zinc-100 text-zinc-700";
};

function ExtraPopover({ period, current, onSave }) {
  const [val, setVal] = useState(current || 0);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid={`btn-extra-${period}`}
          className="text-zinc-300 hover:text-[#FF5A5F] transition-colors"
          title="Ek ödeme ekle"
        >
          <PlusCircle size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 rounded-xl">
        <p className="text-xs font-medium text-zinc-600 mb-2">
          {period}. döneme ek / ara ödeme
        </p>
        <CurrencyInput value={val} onChange={setVal} />
        <Button
          size="sm"
          className="w-full mt-3 rounded-lg bg-zinc-900"
          data-testid={`btn-extra-save-${period}`}
          onClick={() => {
            onSave(period, val);
            setOpen(false);
          }}
        >
          Kaydet
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function PaymentTable({ rows, onEditAmount, onAddExtra }) {
  return (
    <div
      className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden"
      data-testid="table-odeme-plani"
    >
      <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Ödeme Planı
        </h2>
        <span className="text-xs text-zinc-400">{rows.length} satır</span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-zinc-100">
              <TableHead className="text-[11px] uppercase tracking-wide text-zinc-400">Dönem</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-zinc-400">Taksit Tarihi</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-zinc-400 text-right">Aylık Ödeme</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-zinc-400 text-right">Toplam Ödeme</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-zinc-400 text-right">Kalan Borç</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-zinc-400">Ödeme Türü</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow
                key={i}
                data-testid={`plan-row-${r.period}`}
                className={`border-zinc-100 ${
                  r.isDeliveryMonth
                    ? "bg-[rgba(255,90,95,0.06)] border-l-4 border-l-[#FF5A5F]"
                    : "hover:bg-zinc-50/60"
                }`}
              >
                <TableCell className="font-medium tabular-nums">
                  {r.period}
                  {r.isDeliveryMonth && (
                    <span className="ml-2 text-[10px] font-semibold text-[#FF5A5F] uppercase">
                      Teslim Ayı
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-zinc-600">
                  {fmtDate(r.date)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.editable ? (
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        data-testid={`edit-amount-${r.period}`}
                        defaultValue={fmtNum(r.baseAmount)}
                        onBlur={(e) => onEditAmount(r.period, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        className="h-8 w-28 text-right rounded-lg bg-zinc-50 tabular-nums text-sm"
                      />
                      <ExtraPopover
                        period={r.period}
                        current={r.additionalPayment}
                        onSave={onAddExtra}
                      />
                    </div>
                  ) : (
                    fmtNum(r.amount)
                  )}
                  {r.additionalPayment > 0 && (
                    <div className="text-[10px] text-[#FF5A5F]">
                      +{fmtNum(r.additionalPayment)} ek
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-zinc-600">
                  {r.cumulative === null ? "—" : fmtNum(r.cumulative)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {fmtNum(r.remaining)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium rounded-md ${typeBadge(
                      r.paymentType
                    )}`}
                  >
                    {r.paymentType}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
