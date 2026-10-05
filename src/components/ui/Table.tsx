/** Ruled ledger table. Use className "num" on numeric cells and "ctr" on centred ones. */
export function Table({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-md border border-rule ${className}`}>
      <table className="ledger">{children}</table>
    </div>
  );
}
