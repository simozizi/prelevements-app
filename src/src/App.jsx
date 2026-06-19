import { useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { Plus, Trash2, Check, Clock, MapPin, Building2, RefreshCw, Phone } from "lucide-react";
import { db } from "./firebase.js";

const NURSES = ["Meryem", "Sanaa", "Dounia", "Fatim Zahra", "Wiam", "Yasmine"];
const LABS = [
  { id: "maarif", name: "Laboplus Maarif" },
  { id: "ghandi", name: "Laboplus Ghandi" },
];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLong(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const str = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function emptyRow() {
  return {
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    heure: "",
    patient: "",
    tel: "",
    labo: "",
    infirmiere: "",
    fait: false,
  };
}

export default function App() {
  const [dateKey, setDateKey] = useState(todayKey());
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(true);
  const savingTimeout = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const k = todayKey();
      setDateKey((prev) => (prev !== k ? k : prev));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setRows(null);
    const ref = doc(db, "prelevements", dateKey);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setConnected(true);
        if (snap.exists()) {
          const data = snap.data();
          setRows(Array.isArray(data.rows) ? data.rows : []);
        } else {
          setRows([]);
        }
      },
      (error) => {
        console.error("Firestore error:", error);
        setConnected(false);
        setRows((prev) => prev ?? []);
      }
    );
    return () => unsubscribe();
  }, [dateKey]);

  const persist = useCallback(
    async (nextRows) => {
      setSaving(true);
      try {
        const ref = doc(db, "prelevements", dateKey);
        await setDoc(ref, { rows: nextRows, updatedAt: Date.now() });
        setConnected(true);
      } catch (e) {
        console.error("Erreur de sauvegarde:", e);
        setConnected(false);
      } finally {
        clearTimeout(savingTimeout.current);
        savingTimeout.current = setTimeout(() => setSaving(false), 400);
      }
    },
    [dateKey]
  );

  const updateRows = (updater) => {
    setRows((prev) => {
      const base = prev || [];
      const next = typeof updater === "function" ? updater(base) : updater;
      persist(next);
      return next;
    });
  };

  const addRow = () => updateRows((prev) => [...prev, emptyRow()]);
  const updateRow = (id, field, value) =>
    updateRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const deleteRow = (id) => updateRows((prev) => prev.filter((r) => r.id !== id));

  const sortedRows = rows
    ? [...rows].sort((a, b) => {
        if (!a.heure && !b.heure) return 0;
        if (!a.heure) return 1;
        if (!b.heure) return -1;
        return a.heure.localeCompare(b.heure);
      })
    : [];

  const totalCount = rows ? rows.length : 0;
  const doneCount = rows ? rows.filter((r) => r.fait).length : 0;
  const unassignedCount = rows ? rows.filter((r) => !r.infirmiere).length : 0;

  return (
    <div style={styles.page}>
      <style>{fontImport}</style>
      <div style={styles.wrap}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.mark}>LP</div>
            <div>
              <h1 style={styles.title}>Prélèvements à domicile</h1>
              <p style={styles.subtitle}>Laboplus · Maarif &amp; Ghandi</p>
            </div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.dateLabel}>{formatDateLong(dateKey)}</div>
            <div style={styles.syncRow}>
              <RefreshCw
                size={11}
                style={{ animation: saving ? "spin 0.8s linear infinite" : "none", opacity: saving ? 1 : 0.4 }}
              />
              <span>{!connected ? "Hors ligne — réessai…" : saving ? "Synchronisation…" : "À jour pour toutes"}</span>
            </div>
          </div>
        </div>

        <div style={styles.statsStrip}>
          <div style={styles.statItem}>
            <span style={styles.statNum}>{totalCount}</span>
            <span style={styles.statLabel}>prélèvements</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <span style={{ ...styles.statNum, color: "#16433B" }}>{doneCount}</span>
            <span style={styles.statLabel}>faits</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <span style={{ ...styles.statNum, color: unassignedCount > 0 ? "#C9402A" : "#16433B" }}>
              {unassignedCount}
            </span>
            <span style={styles.statLabel}>sans infirmière</span>
          </div>
        </div>

        {rows === null && <div style={styles.loadingBox}>Chargement du tableau partagé…</div>}

        {rows !== null && rows.length === 0 && (
          <div style={styles.emptyBox}>
            <Clock size={28} color="#9A8F7C" />
            <p style={styles.emptyTitle}>Aucun prélèvement pour aujourd'hui</p>
            <p style={styles.emptyText}>Ajoutez la première ligne dès qu'une demande arrive.</p>
          </div>
        )}

        {rows !== null && sortedRows.length > 0 && (
          <div style={styles.list}>
            {sortedRows.map((row) => (
              <RowCard
                key={row.id}
                row={row}
                onChange={(field, value) => updateRow(row.id, field, value)}
                onDelete={() => deleteRow(row.id)}
              />
            ))}
          </div>
        )}

        {rows !== null && (
          <button style={styles.addBtn} onClick={addRow}>
            <Plus size={18} strokeWidth={2.5} />
            Ajouter un prélèvement
          </button>
        )}

        <p style={styles.footnote}>
          Le tableau se vide automatiquement à minuit. Toute l'équipe voit les mêmes données en direct.
        </p>
      </div>
    </div>
  );
}

function RowCard({ row, onChange, onDelete }) {
  const labInfo = LABS.find((l) => l.id === row.labo);
  const isUnassigned = !row.infirmiere;

  return (
    <div style={{ ...styles.card, ...(row.fait ? styles.cardDone : {}) }}>
      <div style={styles.cardTopRow}>
        <div style={styles.heureWrap}>
          <Clock size={14} color="#9A8F7C" />
          <input
            type="time"
            value={row.heure}
            onChange={(e) => onChange("heure", e.target.value)}
            style={styles.timeInput}
          />
        </div>

        <button
          onClick={() => onChange("fait", !row.fait)}
          style={{ ...styles.doneToggle, ...(row.fait ? styles.doneToggleActive : {}) }}
          aria-label={row.fait ? "Marquer non fait" : "Marquer fait"}
        >
          <Check size={15} strokeWidth={3} />
          {row.fait ? "Fait" : "À faire"}
        </button>
      </div>

      <div style={styles.fieldGroup}>
        <MapPin size={14} color="#9A8F7C" style={styles.fieldIcon} />
        <input
          type="text"
          placeholder="Patient / adresse"
          value={row.patient}
          onChange={(e) => onChange("patient", e.target.value)}
          style={styles.textInput}
        />
      </div>

      <div style={styles.fieldGroup}>
        <Phone size={14} color="#9A8F7C" style={styles.fieldIcon} />
        <input
          type="tel"
          placeholder="Téléphone"
          value={row.tel}
          onChange={(e) => onChange("tel", e.target.value)}
          style={styles.textInput}
        />
      </div>

      <div style={styles.bottomRow}>
        <div style={styles.selectWrap}>
          <Building2 size={13} color="#9A8F7C" />
          <select
            value={row.labo}
            onChange={(e) => onChange("labo", e.target.value)}
            style={{
              ...styles.select,
              color: labInfo ? (labInfo.id === "maarif" ? "#16433B" : "#C9402A") : "#B7AE9B",
            }}
          >
            <option value="">Labo…</option>
            {LABS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ ...styles.selectWrap, flex: 1.4, ...(isUnassigned ? styles.selectWrapWarn : {}) }}>
          <select
            value={row.infirmiere}
            onChange={(e) => onChange("infirmiere", e.target.value)}
            style={{ ...styles.select, fontWeight: 700, color: isUnassigned ? "#C9402A" : "#16433B" }}
          >
            <option value="">Assigner à…</option>
            {NURSES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <button onClick={onDelete} style={styles.deleteBtn} aria-label="Supprimer">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

const fontImport = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=DM+Mono:wght@400;500&display=swap');
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  * { box-sizing: border-box; }
  body { margin: 0; }
  input[type="time"]::-webkit-calendar-picker-indicator
