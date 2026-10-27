"use client";

type DemoAccount = {
  label: string;
  email: string;
  password: string;
};

export function DemoLogin({
  accounts,
  onSelect,
}: {
  accounts: DemoAccount[];
  onSelect: (email: string, password: string) => void;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {accounts.map((account) => (
        <button
          key={account.email}
          type="button"
          onClick={() => onSelect(account.email, account.password)}
          className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 transition hover:border-copper hover:text-copper"
        >
          Entrar como {account.label}
        </button>
      ))}
    </div>
  );
}
