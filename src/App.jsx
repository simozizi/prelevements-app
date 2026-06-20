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
    id: "r_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
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

  useEffect(function () {
    const interval = setInterval(function () {
      const k = todayKey();
      setDateKey(function (prev) {
        return prev !== k ? k : prev;
      });
    }, 30000);
    return function () {
      clearInterval(interval);
    };
  }, []);

  useEffect(function () {
    setRows(null);
    const ref = doc(db, "prelevements", dateKey);
    const unsubscribe = onSnapshot(
      ref,
      function (snap) {
        setConnected(true);
        if (snap.exists()) {
          const data = snap.data();
          setRows(Array.isArray(data.rows) ? data.rows : []);
        } else {
          setRows([]);
        }
      },
      function (error) {
        console.error("Firestore error:", error);
        setConnected(false);
        setRows(function (prev) {
          return prev !== null && prev !== undefined ? prev : [];
        });
      }
    );
    return function () {
      unsubscribe();
    };
  }, [dateKey]);

  const persist = useCallback(
    async function (nextRows) {
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
        savingTimeout.current = setTimeout(function () {
          setSaving(false);
        }, 400);
      }
    },
    [dateKey]
  );

  const updateRows = function (updater) {
    setRows(function (prev) {
      const base = prev || [];
      const next = typeof updater === "function" ? updater(base) : updater;
      persist(next);
      return next;
    });
  };

  const addRow = function () {
    updateRows(function (prev) {
      return prev.concat([emptyRow()]);
    });
  };

  const updateRow = function (id, field, value) {
    updateRows(function (prev) {
      return prev.map(function (r) {
        if (r.id === id) {
          const copy = Object.assign({}, r);
          copy[field] = value;
          return copy;
        }
        return r;
      });
    });
  };

  const deleteRow = function (id) {
    updateRows(function (prev) {
      return prev.filter(function (r) {
        return r.id !== id;
      });
    });
  };

  const sortedRows = rows
    ? rows.slice().sort(function (a, b) {
        if (!a.heure && !b.heure) return 0;
        if (!a.heure) return 1;
        if (!b.heure) return -1;
        return a.heure.localeCompare(b.heure);
      })
    : [];

  const totalCount = rows ? rows.length : 0;
  const doneCount = rows
    ? rows.filter(function (r) {
        return r.fait;
      }).length
    : 0;
  const unassignedCount = rows
    ? rows.filter(function (r) {
        return !r.infirmiere;
      }).length
    : 0;

  return (
    <div style={styles.page}>
      <style>{fontImport}</style>
      <div style={styles.wrap}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.mark}>LP</div>
            <div>
              <h1 style={styles.title}>Prélèvements à domicile</h1>
              <p style={styles.subtitle}>Laboplus · Maarif et Ghandi</p>
            </div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.dateLabel}>{formatDateLong(dateKey)}</div>
            <div style={styles.syncRow}>
              <RefreshCw
                size={11}
                style={{
                  animation: saving ? "spin 0.8s linear infinite" : "none",
                  opacity: saving ? 1 : 0.4,
                }}
              />
              <span>
                {!connected
                  ? "Hors ligne — réessai…"
                  : saving
                  ? "Synchronisation…"
                  : "À jour pour toutes"}
              </span>
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
            <span style={Object.assign({}, styles.statNum, { color: "#16433B" })}>
              {doneCount}
            </span>
            <span style={styles.statLabel}>faits</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <span
              style={Object.assign({}, styles.statNum, {
                color: unassignedCount > 0 ? "#C9402A" : "#16433B",
              })}
            >
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
            {sortedRows.map(function (row) {
              return (
                <RowCard
                  key={row.id}
                  row={row}
                  onChange={function (field, value) {
                    updateRow(row.id, field, value);
                  }}
                  onDelete={function () {
                    deleteRow(row.id);
                  }}
                />
              );
            })}
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

function RowCard(props) {
  const row = props.row;
  const onChange = props.onChange;
  const onDelete = props.onDelete;
  const labInfo = LABS.find(function (l) {
    return l.id === row.labo;
  });
  const isUnassigned = !row.infirmiere;

  return (
    <div style={Object.assign({}, styles.card, row.fait ? styles.cardDone : {})}>
      <div style={styles.cardTopRow}>
        <div style={styles.heureWrap}>
          <Clock size={14} color="#9A8F7C" />
          <input
            type="time"
            value={row.heure}
            onChange={function (e) {
              onChange("heure", e.target.value);
            }}
            style={styles.timeInput}
          />
        </div>

        <button
          onClick={function () {
            onChange("fait", !row.fait);
          }}
          style={Object.assign({}, styles.doneToggle, row.fait ? styles.doneToggleActive : {})}
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
          onChange={function (e) {
            onChange("patient", e.target.value);
          }}
          style={styles.textInput}
        />
      </div>

      <div style={styles.fieldGroup}>
        <Phone size={14} color="#9A8F7C" style={styles.fieldIcon} />
        <input
          type="tel"
          placeholder="Téléphone"
          value={row.tel}
          onChange={function (e) {
            onChange("tel", e.target.value);
          }}
          style={styles.textInput}
        />
      </div>

      <div style={styles.bottomRow}>
        <div style={styles.selectWrap}>
          <Building2 size={13} color="#9A8F7C" />
          <select
            value={row.labo}
            onChange={function (e) {
              onChange("labo", e.target.value);
            }}
            style={Object.assign({}, styles.select, {
              color: labInfo ? (labInfo.id === "maarif" ? "#16433B" : "#C9402A") : "#B7AE9B",
            })}
          >
            <option value="">Labo…</option>
            {LABS.map(function (l) {
              return (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              );
            })}
          </select>
        </div>

        <div
          style={Object.assign(
            {},
            styles.selectWrap,
            { flex: 1.4 },
            isUnassigned ? styles.selectWrapWarn : {}
          )}
        >
          <select
            value={row.infirmiere}
            onChange={function (e) {
              onChange("infirmiere", e.target.value);
            }}
            style={Object.assign({}, styles.select, {
              fontWeight: 700,
              color: isUnassigned ? "#C9402A" : "#16433B",
            })}
          >
            <option value="">Assigner à…</option>
            {NURSES.map(function (n) {
              return (
                <option key={n} value={n}>
                  {n}
                </option>
              );
            })}
          </select>
        </div>

        <button onClick={onDelete} style={styles.deleteBtn} aria-label="Supprimer">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

const fontImport =
  "@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=DM+Mono:wght@400;500&display=swap');" +
  "@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }" +
  "* { box-sizing: border-box; }" +
  "body { margin: 0; }" +
  "input[type='time']::-webkit-calendar-picker-indicator { filter: invert(0.5); }";

const styles = {
  page: { minHeight: "100vh", background: "#F6F4EF", fontFamily: "'Archivo', sans-serif", padding: "20px 14px 60px" },
  wrap: { maxWidth: 520, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #16433B", paddingBottom: 16, marginBottom: 16, gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  mark: { width: 42, height: 42, background: "#16433B", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: "#F6F4EF", fontWeight: 800, fontSize: 16, flexShrink: 0 },
  title: { fontSize: 19, fontWeight: 800, color: "#16433B", letterSpacing: "-0.2px", lineHeight: 1.15, margin: 0 },
  subtitle: { fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#8A8170", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.5px" },
  headerRight: { textAlign: "right", flexShrink: 0 },
  dateLabel: { fontSize: 13, fontWeight: 700, color: "#16433B" },
  syncRow: { display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", marginTop: 4, fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: "#9A8F7C" },
  statsStrip: { display: "flex", alignItems: "center", background: "#FFFFFF", border: "1.5px solid #E5DFD0", borderRadius: 12, padding: "12px 4px", marginBottom: 18 },
  statItem: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  statNum: { fontSize: 20, fontWeight: 800, color: "#16433B", fontFamily: "'DM Mono', monospace" },
  statLabel: { fontSize: 10, color: "#9A8F7C", textTransform: "uppercase", letterSpacing: "0.4px" },
  statDivider: { width: 1.5, height: 28, background: "#E5DFD0" },
  loadingBox: { textAlign: "center", padding: "50px 20px", color: "#9A8F7C", fontFamily: "'DM Mono', monospace", fontSize: 13 },
  emptyBox: { textAlign: "center", padding: "40px 24px", background: "#FFFFFF", border: "1.5px dashed #D8D0BC", borderRadius: 14, marginBottom: 16 },
  emptyTitle: { fontSize: 14.5, fontWeight: 700, color: "#16433B", marginTop: 10 },
  emptyText: { fontSize: 12.5, color: "#9A8F7C", marginTop: 4 },
  list: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 },
  card: { background: "#FFFFFF", border: "1.5px solid #E5DFD0", borderRadius: 14, padding: 14, transition: "background 0.2s, border-color 0.2s" },
  cardDone: { background: "#F0F4F0", borderColor: "#C7DBC9" },
  cardTopRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  heureWrap: { display: "flex", alignItems: "center", gap: 6, background: "#F6F4EF", border: "1.5px solid #E5DFD0", borderRadius: 8, padding: "6px 10px" },
  timeInput: { border: "none", background: "transparent", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: "#16433B", outline: "none", width: 76 },
  doneToggle: { display: "flex", alignItems: "center", gap: 5, border: "1.5px solid #D8D0BC", background: "#FFFFFF", color: "#9A8F7C", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Archivo', sans-serif" },
  doneToggleActive: { background: "#16433B", borderColor: "#16433B", color: "#F6F4EF" },
  fieldGroup: { display: "flex", alignItems: "center", gap: 8, borderBottom: "1.5px solid #EDE8DA", padding: "8px 2px" },
  fieldIcon: { flexShrink: 0 },
  textInput: { flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#2B2820" },
  bottomRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 },
  selectWrap: { display: "flex", alignItems: "center", gap: 6, flex: 1, background: "#F6F4EF", border: "1.5px solid #E5DFD0", borderRadius: 8, padding: "7px 8px" },
  selectWrapWarn: { background: "#FBEDEA", borderColor: "#F0C5BA" },
  select: { flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "'Archivo', sans-serif", fontSize: 12.5, width: "100%" },
  deleteBtn: { flexShrink: 0, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #E5DFD0", background: "#FFFFFF", color: "#B7AE9B", borderRadius: 8, cursor: "pointer" },
  addBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#16433B", color: "#F6F4EF", border: "none", borderRadius: 12, padding: "14px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Archivo', sans-serif" },
  footnote: { textAlign: "center", fontSize: 11.5, color: "#9A8F7C", marginTop: 16, lineHeight: 1.5, fontFamily: "'DM Mono', monospace" },
};
