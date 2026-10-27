"use client";

type DemoAccount = {
  label: string;
  email: string;
  password: string;
};

export function DemoLogin({ accounts }: { accounts: DemoAccount[] }) {
  function enter(email: string, password: string) {
    const emailInput =
      document.querySelector<HTMLInputElement>("#email");
    const passwordInput =
      document.querySelector<HTMLInputElement>("#password");
    const form = document.querySelector<HTMLFormElement>("#login-form");
    if (!emailInput || !passwordInput || !form) return;

    emailInput.value = email;
    passwordInput.value = password;
    form.requestSubmit();
  }

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {accounts.map((account) => (
        <button
          key={account.email}
          type="button"
          onClick={() => enter(account.email, account.password)}
          className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 transition hover:border-copper hover:text-copper"
        >
          Entrar como {account.label}
        </button>
      ))}
    </div>
  );
}
