import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Lock, KeyRound } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.string().min(6, "Mínimo de 6 caracteres").max(72);

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = "Redefinir senha | Painel de Vendas";
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = passwordSchema.safeParse(password);
    if (!p.success) {
      toast({ title: "Erro", description: p.error.issues[0].message, variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha atualizada", description: "Você já pode entrar com a nova senha." });
      navigate("/", { replace: true });
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground mt-2">Defina uma nova senha para sua conta</p>
        </header>

        <Card className="p-6 shadow-2xl border-border/50">
          {!ready ? (
            <p className="text-sm text-muted-foreground text-center">Validando link de recuperação...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="new-password" type="password" className="pl-10" placeholder="Mínimo 6 caracteres"
                    value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="confirm-password" type="password" className="pl-10" placeholder="Repita a senha"
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar senha"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
