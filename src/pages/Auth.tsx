import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passwordSchema = z.string().min(6, "Mínimo de 6 caracteres").max(72);

type Tab = "login" | "signup";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    document.title = "Entrar | GomaPet";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Acesse o Dashboard Comercial GomaPet.");

    // Fonts
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate("/", { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const validate = () => {
    const e = emailSchema.safeParse(email);
    const p = passwordSchema.safeParse(password);
    if (!e.success) {
      toast({ title: "Erro", description: e.error.issues[0].message, variant: "destructive" });
      return false;
    }
    if (!p.success) {
      toast({ title: "Erro", description: p.error.issues[0].message, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast({ title: "Falha no login", description: error.message, variant: "destructive" });
    else navigate("/", { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(false);
    if (error) toast({ title: "Falha no cadastro", description: error.message, variant: "destructive" });
    else toast({ title: "Conta criada", description: "Verifique seu email para confirmar." });
  };

  const handleForgotPassword = async () => {
    const e = emailSchema.safeParse(email);
    if (!e.success) {
      toast({
        title: "Informe seu email",
        description: "Digite o email para receber o link de recuperação.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Email enviado", description: "Verifique sua caixa de entrada." });
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Inter', sans-serif",
        background:
          "radial-gradient(1200px 600px at 10% -10%, rgba(41,179,71,.25), transparent 60%), radial-gradient(900px 500px at 110% 110%, rgba(237,217,154,.15), transparent 60%), linear-gradient(135deg, #0e2e18 0%, #0a1f10 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* paw decorations */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(237,217,154,.04) 2px, transparent 3px), radial-gradient(circle at 80% 70%, rgba(41,179,71,.05) 2px, transparent 3px)",
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
        {/* Brand header */}
        <header style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 84,
              height: 84,
              borderRadius: 22,
              background: "linear-gradient(135deg, #29B347, #1D8A35)",
              boxShadow: "0 12px 30px rgba(41,179,71,.4), inset 0 1px 0 rgba(255,255,255,.2)",
              marginBottom: 16,
              padding: 6,
            }}
          >
            <img
              src="/logo.png"
              alt="GomaPet"
              style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 16 }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <h1
            style={{
              fontFamily: "'Fredoka', sans-serif",
              fontSize: 32,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.5px",
              margin: 0,
            }}
          >
            Goma<span style={{ color: "#EDD99A" }}>Pet</span>
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginTop: 6, letterSpacing: ".3px" }}>
            Dashboard Comercial
          </p>
        </header>

        {/* Card */}
        <div
          style={{
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 18,
            padding: 28,
            backdropFilter: "blur(12px)",
            boxShadow: "0 20px 60px rgba(0,0,0,.4)",
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "rgba(0,0,0,.25)",
              borderRadius: 10,
              padding: 4,
              marginBottom: 22,
            }}
          >
            {(["login", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  transition: "all .2s",
                  background: tab === t ? "linear-gradient(135deg, #29B347, #1D8A35)" : "transparent",
                  color: tab === t ? "#fff" : "rgba(255,255,255,.6)",
                  boxShadow: tab === t ? "0 4px 12px rgba(41,179,71,.35)" : "none",
                }}
              >
                {t === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form
            onSubmit={tab === "login" ? handleLogin : handleSignup}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <Field
              icon={<Mail size={16} />}
              type="email"
              label="Email"
              placeholder="voce@gomapet.com"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <Field
              icon={<Lock size={16} />}
              type="password"
              label="Senha"
              placeholder="••••••••"
              value={password}
              onChange={setPassword}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                background: "linear-gradient(135deg, #29B347, #1D8A35)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                fontFamily: "inherit",
                letterSpacing: ".3px",
                boxShadow: "0 8px 20px rgba(41,179,71,.35)",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "transform .15s",
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(.98)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : tab === "login" ? "Entrar" : "Criar conta"}
            </button>

            {tab === "login" && (
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(237,217,154,.85)",
                  fontSize: 12.5,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "center",
                  padding: 4,
                }}
              >
                Esqueci minha senha
              </button>
            )}
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 11.5, color: "rgba(255,255,255,.4)", marginTop: 18 }}>
          © {new Date().getFullYear()} GomaPet · Todos os direitos reservados
        </p>
      </div>
    </main>
  );
}

function Field({
  icon,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,.75)",
          marginBottom: 7,
          letterSpacing: ".3px",
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "rgba(237,217,154,.7)",
            display: "flex",
          }}
        >
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          style={{
            width: "100%",
            padding: "11px 14px 11px 38px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.1)",
            background: "rgba(0,0,0,.25)",
            color: "#fff",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
            transition: "border-color .15s, box-shadow .15s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(41,179,71,.6)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(41,179,71,.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,.1)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>
    </div>
  );
}
