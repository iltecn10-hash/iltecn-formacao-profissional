import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary px-14 py-12 text-white lg:flex">
        <div>
          <p className="text-sm font-semibold tracking-wide text-primary-light/90">
            ILTECN
          </p>
          <h1 className="mt-16 max-w-md font-heading text-4xl font-bold leading-tight">
            Você está chegando para o seu primeiro dia de trabalho.
          </h1>
          <p className="mt-6 max-w-sm text-primary-light/90">
            Aqui você recebe tarefas reais de escritório e do Supermercado Bom
            Preço, resolve problemas com as ferramentas certas e recebe
            avaliação pelo que entregou.
          </p>
        </div>

        <div className="flex items-end justify-between border-t border-white/15 pt-6 text-sm text-primary-light/80">
          <span>Aprender fazendo. Preparar para o futuro.</span>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
        />
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <p className="text-sm font-semibold text-primary">ILTECN</p>
            <p className="text-xs text-muted">Formação Profissional</p>
          </div>

          <h2 className="font-heading text-2xl font-bold text-foreground">
            Entrar na sua formação
          </h2>
          <p className="mt-2 text-sm text-muted">
            Use o e-mail e a senha cadastrados pela sua escola.
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
