/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Usuario, RolUsuario } from "@/lib/types";
import { useSucursalStore, type Sucursal } from "@/store/useSucursalStore";

// UI
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Icons
import {
    Users,
    ChevronLeft,
    Plus,
    Loader2,
    ShieldAlert,
    Pencil,
    Trash2,
    User,
} from "lucide-react";

type DialogMode = "create" | "edit";

export default function EmployeesSettingsPage() {
    const [usuarios, setUsuarios] = React.useState<Usuario[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { availableSucursales } = useSucursalStore();

    // Estados para Crear/Editar
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [dialogMode, setDialogMode] = React.useState<DialogMode>("create");
    const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null);
    const [saving, setSaving] = React.useState(false);

    // Estados para Eliminar
    const [userToDelete, setUserToDelete] = React.useState<Usuario | null>(null);
    const [deleting, setDeleting] = React.useState(false);

    // Estado del formulario incluyendo ROL
    const [form, setForm] = React.useState({
        nombre: "",
        email: "",
        password: "",
        rol: "ADMIN" as RolUsuario,
        sucursalId: "1", // Por defecto Sede Principal
    });

    const loadUsers = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/settings/users");
            const json = await res.json();
            if (json.ok) setUsuarios(json.data);
        } catch {
            toast.error("Error cargando usuarios");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    // --- ACCIONES DE UI ---
    const openCreateMode = () => {
        setDialogMode("create");
        setSelectedUserId(null);
        setForm({ nombre: "", email: "", password: "", rol: "ADMIN", sucursalId: "1" });
        setIsDialogOpen(true);
    };

    const openEditMode = (user: Usuario) => {
        setDialogMode("edit");
        setSelectedUserId(user.id);
        const userSucursal = user.sucursalId ? String(user.sucursalId) : "1";
        setForm({ nombre: user.nombre, email: user.email, password: "", rol: user.rol, sucursalId: userSucursal });
        setIsDialogOpen(true);
    };

    // --- SUBMIT (CREAR / EDITAR) ---
    async function handleSaveUser(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        const isEdit = dialogMode === "edit";
        const method = isEdit ? "PUT" : "POST";
        const payload = isEdit
            ? { id: selectedUserId, ...form, sucursalId: Number(form.sucursalId) }
            : { ...form, sucursalId: Number(form.sucursalId) };

        try {
            const res = await fetch("/api/settings/users", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (!res.ok || !json.ok) throw new Error(json.error || "Error al guardar usuario");

            toast.success(isEdit ? "Usuario actualizado" : "Usuario creado exitosamente");

            if (isEdit) {
                setUsuarios((prev) => prev.map((u) => (u.id === selectedUserId ? json.data : u)));
            } else {
                setUsuarios((prev) => [json.data, ...prev]);
            }

            setIsDialogOpen(false);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    }

    // --- ELIMINAR ---
    async function handleDeleteUser() {
        if (!userToDelete) return;
        setDeleting(true);

        try {
            const res = await fetch(`/api/settings/users?id=${userToDelete.id}`, {
                method: "DELETE",
            });
            const json = await res.json();

            if (!res.ok || !json.ok) throw new Error(json.error || "Error al eliminar usuario");

            toast.success("Usuario eliminado");
            setUsuarios((prev) => prev.filter((u) => u.id !== userToDelete.id));
            setUserToDelete(null);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-10 text-foreground selection:bg-primary/20">
            {/* HEADER & BACK BUTTON */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-3">
                    <Link
                        href="/settings/security"
                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Volver a Seguridad
                    </Link>
                    <div className="flex items-center gap-2 text-primary font-semibold tracking-wider uppercase text-[10px] bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/20">
                        <Users className="h-3 w-3" />
                        Control de Accesos
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground pb-2">
                        Usuarios y Permisos
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Gestioná tu equipo y sus niveles de acceso al sistema.
                    </p>
                </div>

                <Button
                    onClick={openCreateMode}
                    className="rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 font-bold gap-2 px-6 h-12 text-sm w-full md:w-auto"
                >
                    <Plus className="h-4 w-4 stroke-[2.5px]" />
                    Nuevo Usuario
                </Button>
            </header>

            {/* CONTENIDO: LISTA DE USUARIOS */}
            <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl rounded-[2rem] overflow-hidden p-1">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-4 opacity-70">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground animate-pulse">
                            Cargando equipo...
                        </p>
                    </div>
                ) : usuarios.length === 0 ? (
                    <div className="px-6 py-12 text-center text-muted-foreground text-sm">
                        No hay usuarios registrados aún.
                    </div>
                ) : (
                    <>
                        {/* === VISTA DESKTOP (TABLA) === */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 bg-muted/20">
                                    <tr>
                                        <th className="px-6 py-4 rounded-tl-[1.5rem]">Usuario</th>
                                        <th className="px-6 py-4">Rol</th>
                                        <th className="px-6 py-4">Estado</th>
                                        <th className="px-6 py-4 text-right rounded-tr-[1.5rem]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {usuarios.map((user) => (
                                        <tr key={user.id} className="hover:bg-muted/10 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-muted border border-border/50 grid place-items-center font-bold text-muted-foreground">
                                                        {user.nombre.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-foreground">{user.nombre}</p>
                                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                    user.rol === "ADMIN"
                                                        ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                                        : "bg-[color:var(--theme-ocean-primary)]/10 text-[color:var(--theme-ocean-primary)] border-[color:var(--theme-ocean-primary)]/20"
                                                )}>
                                                    {user.rol === "ADMIN" ? <ShieldAlert className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                                    {user.rol}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("h-2 w-2 rounded-full", user.activo ? "bg-[color:var(--status-success-strong)] shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-[color:var(--status-danger)]")} />
                                                    <span className="text-xs font-semibold text-muted-foreground">
                                                        {user.activo ? "Activo" : "Inactivo"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEditMode(user)}
                                                        className="rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                                        title="Editar usuario"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setUserToDelete(user)}
                                                        className="rounded-xl text-muted-foreground hover:text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)]/10 transition-colors"
                                                        title="Eliminar usuario"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* === VISTA MOBILE (LISTA DE TARJETAS) === */}
                        <div className="flex flex-col md:hidden divide-y divide-border/50">
                            {usuarios.map((user) => (
                                <div key={user.id} className="p-4 flex flex-col gap-4 hover:bg-muted/10 transition-colors">
                                    <div className="flex items-start justify-between gap-3">

                                        {/* Info Usuario */}
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="h-10 w-10 shrink-0 rounded-full bg-muted border border-border/50 grid place-items-center font-bold text-muted-foreground">
                                                {user.nombre.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="font-bold text-foreground truncate">{user.nombre}</p>
                                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                            </div>
                                        </div>

                                        {/* Botones Acciones */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEditMode(user)}
                                                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setUserToDelete(user)}
                                                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)]/10 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                    </div>

                                    {/* Badges de Estado y Rol */}
                                    <div className="flex items-center gap-4 pt-1">
                                        <div className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                            user.rol === "ADMIN"
                                                ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                                : "bg-[color:var(--theme-ocean-primary)]/10 text-[color:var(--theme-ocean-primary)] border-[color:var(--theme-ocean-primary)]/20"
                                        )}>
                                            {user.rol === "ADMIN" ? <ShieldAlert className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                            {user.rol}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className={cn("h-2 w-2 rounded-full", user.activo ? "bg-[color:var(--status-success-strong)] shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-[color:var(--status-danger)]")} />
                                            <span className="text-xs font-semibold text-muted-foreground">
                                                {user.activo ? "Activo" : "Inactivo"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </Card>

            {/* MODAL CREAR/EDITAR USUARIO */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px] w-[95vw] rounded-3xl p-0 overflow-hidden border-border/50 bg-background/90 backdrop-blur-xl">
                    <form onSubmit={handleSaveUser}>
                        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20">
                            <DialogTitle className="text-xl font-extrabold tracking-tight">
                                {dialogMode === "create" ? "Nuevo Usuario" : "Editar Usuario"}
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                {dialogMode === "create"
                                    ? "Creá una cuenta de acceso al sistema."
                                    : "Modificá los datos del usuario. Dejá la contraseña en blanco si no querés cambiarla."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="p-6 space-y-4">
                            <Field label="Nombre completo">
                                <input
                                    required
                                    className="w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="Ej: Ana García"
                                    value={form.nombre}
                                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                />
                            </Field>

                            <Field label="Correo electrónico">
                                <input
                                    required
                                    type="email"
                                    className="w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="ana@ejemplo.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                />
                            </Field>

                            <Field label="Rol del sistema">
                                <select
                                    required
                                    className="w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                                    value={form.rol}
                                    onChange={(e) => setForm({ ...form, rol: e.target.value as RolUsuario })}
                                >
                                    <option value="ADMIN">Administrador (Acceso total)</option>
                                    <option value="EMPLEADO">
                                        Empleado (POS & Notificaciones)
                                    </option>
                                </select>
                            </Field>

                            <Field label="Sucursal Asignada">
                                <select
                                    required
                                    className="w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                                    value={form.sucursalId}
                                    onChange={(e) => setForm({ ...form, sucursalId: e.target.value })}
                                    disabled={availableSucursales.length === 0}
                                >
                                    {availableSucursales.length > 0 ? (
                                        availableSucursales.map(s => (
                                            <option key={s.id} value={String(s.id)}>
                                                {s.nombre} {s.esPrincipal ? "(Principal)" : ""}
                                            </option>
                                        ))
                                    ) : (
                                        <option value="1">Sede Principal</option>
                                    )}
                                </select>
                            </Field>

                            <Field label="Contraseña">
                                <input
                                    required={dialogMode === "create"}
                                    type="password"
                                    minLength={6}
                                    className="w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder={dialogMode === "create" ? "••••••••" : "Dejar en blanco para mantener actual"}
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                />
                            </Field>
                        </div>

                        <DialogFooter className="p-4 border-t border-border/50 bg-muted/20 flex gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsDialogOpen(false)}
                                className="rounded-xl w-full sm:w-auto"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={saving}
                                className="rounded-xl font-bold w-full sm:w-auto"
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                {saving ? "Guardando..." : "Guardar Usuario"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ALERT DIALOG ELIMINAR */}
            <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
                <AlertDialogContent className="rounded-3xl w-[95vw] sm:max-w-lg border-border/50 bg-background/90 backdrop-blur-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-extrabold tracking-tight text-[color:var(--status-danger)]">
                            ¿Eliminar usuario?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground">
                            Estás por eliminar permanentemente el acceso de <strong className="text-foreground">{userToDelete?.nombre}</strong>. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteUser();
                            }}
                            disabled={deleting}
                            className="rounded-xl bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] text-[color:var(--ui-fx-white)] font-bold"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            {deleting ? "Eliminando..." : "Sí, eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// Componente helper para los inputs
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="grid gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 ml-1">
                {label}
            </span>
            {children}
        </label>
    );
}
