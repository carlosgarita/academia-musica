"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Academy = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  status: string | null;
  currency: string;
  badgeIds?: string[];
  rubricIds?: string[];
  scaleIds?: string[];
};

type Badge = { id: string; name: string };
type Rubric = { id: string; name: string };
type Scale = { id: string; name: string; numeric_value: number };

export default function EditAcademyPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [academy, setAcademy] = useState<Academy | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [currency, setCurrency] = useState<"CRC" | "EUR">("CRC");
  const [badges, setBadges] = useState<Badge[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [scales, setScales] = useState<Scale[]>([]);
  const [badgeIds, setBadgeIds] = useState<Set<string>>(new Set());
  const [rubricIds, setRubricIds] = useState<Set<string>>(new Set());
  const [scaleIds, setScaleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [acRes, bRes, rRes, sRes] = await Promise.all([
          fetch(`/api/academies/${id}`),
          fetch("/api/super-admin/badges"),
          fetch("/api/super-admin/rubrics"),
          fetch("/api/super-admin/scales"),
        ]);
        const acData = await acRes.json();
        if (!acRes.ok) throw new Error(acData.error || "Error al cargar");
        const a = acData.academy;
        setAcademy(a);
        setName(a.name || "");
        setAddress(a.address || "");
        setPhone(a.phone || "");
        setWebsite(a.website || "");
        setCurrency(a.currency === "EUR" ? "EUR" : "CRC");
        setBadgeIds(new Set(a.badgeIds || []));
        setRubricIds(new Set(a.rubricIds || []));
        setScaleIds(new Set(a.scaleIds || []));
        const b = await bRes.json();
        const r = await rRes.json();
        const s = await sRes.json();
        setBadges(b.badges || []);
        setRubrics(r.rubrics || []);
        setScales(s.scales || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const toggleBadge = (bid: string) => {
    setBadgeIds((prev) => {
      const next = new Set(prev);
      if (next.has(bid)) next.delete(bid);
      else next.add(bid);
      return next;
    });
  };
  const toggleRubric = (rid: string) => {
    setRubricIds((prev) => {
      const next = new Set(prev);
      if (next.has(rid)) next.delete(rid);
      else next.add(rid);
      return next;
    });
  };
  const toggleScale = (sid: string) => {
    setScaleIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/academies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address: address || null,
          phone: phone || null,
          website: website || null,
          currency,
          badgeIds: Array.from(badgeIds),
          rubricIds: Array.from(rubricIds),
          scaleIds: Array.from(scaleIds),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      router.push("/super-admin/academies");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12">
        <p className="text-gray-600">Cargando academia...</p>
      </div>
    );
  }

  if (error && !academy) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-2 text-sm text-red-600 hover:text-red-800"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Editar Academia</h1>
        <p className="mt-1 text-sm text-gray-500">{academy?.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Dirección</label>
            <input
              type="text"
              maxLength={200}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Dirección Web
            </label>
            <input
              type="text"
              maxLength={200}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="ejemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Moneda</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "CRC" | "EUR")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="CRC">Colón (Costa Rica)</option>
              <option value="EUR">Euro</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Usada para facturación y montos en esta academia
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            Badges, rúbricas y escalas asignados
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Selecciona los badges, rúbricas y escalas que tendrá esta academia.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Badges</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50">
                {badges.length === 0 ? (
                  <p className="text-xs text-gray-500">Ninguno creado</p>
                ) : (
                  badges.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={badgeIds.has(b.id)}
                        onChange={() => toggleBadge(b.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{b.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Rúbricas</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50">
                {rubrics.length === 0 ? (
                  <p className="text-xs text-gray-500">Ninguna creada</p>
                ) : (
                  rubrics.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rubricIds.has(r.id)}
                        onChange={() => toggleRubric(r.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{r.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Escalas</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50">
                {scales.length === 0 ? (
                  <p className="text-xs text-gray-500">Ninguna creada</p>
                ) : (
                  scales.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scaleIds.has(s.id)}
                        onChange={() => toggleScale(s.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{s.name}</span>
                      <span className="text-xs text-gray-400">({s.numeric_value})</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
