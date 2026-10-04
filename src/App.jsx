import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play, Pause, Plus, X, Check,
  Users, BarChart3, Trophy, ArrowLeftRight, Send, Hand, Target,
  ClipboardList, Share2, Settings, Shirt, Trash2, Pencil,
  RotateCcw, CircleDot, Minus, Flag, CalendarDays, MapPin,
  Star, Eraser, ArrowRight, FolderOpen, Save, PenLine, Circle, UserPlus,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import {
  FORMATIONS, ROLE_LABEL, ROLE_SHORT,
  logCard, applySubstitution, changeFormation, subOrdering,
  initialLineupOf, outPlayers, canFillEmptySlot, onFieldCount, redCount, yellowCount,
  finalizeIntervals, eventsByMinute, halfElapsedSeconds, currentMinute, timerDisplay,
} from "./matchLogic.js";

/* ============================================================================
   DESIGN TOKENS
   Pitch-side scoreboard aesthetic: deep grass green, condensed "Teko" numerals
   for anything time/score/shirt-number related, Manrope for UI text. High
   contrast for outdoor sunlight, big tap targets for one-handed sideline use.
============================================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');

:root{
  --pitch-deep:#0E2019;
  --pitch-mid:#153A2C;
  --pitch-mid2:#1E4D3B;
  --pitch-line:#F2FAF5;
  --ink-soft:#A9CBBB;
  --ink-faint:#7C9C8A;
  --accent-amber:#F5B23F;
  --accent-amber-ink:#3A2405;
  --accent-sky:#5DB6F0;
  --card-yellow:#F5C518;
  --card-red:#FF5A4D;
  --hair:rgba(234,244,238,0.12);
  --hair-strong:rgba(234,244,238,0.24);
}

.fm-root{
  font-family:'Manrope',system-ui,sans-serif;
  background:var(--pitch-deep);
  color:var(--pitch-line);
  height:100vh;
  height:100dvh;
  width:100%;
  display:flex;
  flex-direction:column;
  position:relative;
  -webkit-tap-highlight-color:transparent;
  -webkit-text-size-adjust:100%;
  text-size-adjust:100%;
  overflow:hidden;
}
.fm-root *{box-sizing:border-box;}
.fm-num{font-family:'Teko',sans-serif;font-weight:700;letter-spacing:0.01em;color:currentColor;}

.fm-scroll{
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
  padding-bottom:16px;
  overscroll-behavior:contain;
}

/* ---- Header ---- */
.fm-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:calc(16px + env(safe-area-inset-top)) 18px 12px;
  border-bottom:1px solid var(--hair);
}
.fm-header h1{
  font-family:'Teko',sans-serif;font-weight:600;font-size:26px;
  letter-spacing:0.02em;margin:0;line-height:1;
}
.fm-header .fm-sub{font-size:11px;color:var(--ink-soft);margin-top:3px;}
.fm-iconbtn{
  background:transparent;border:1px solid var(--hair-strong);color:var(--pitch-line);
  width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  flex-shrink:0;touch-action:manipulation;
}
.fm-iconbtn:active{background:var(--pitch-mid2);}

/* ---- Tab bar ---- */
.fm-tabbar{
  flex-shrink:0;
  display:flex;
  background:#122E23;
  border-top:1px solid var(--hair-strong);
  padding:8px 6px calc(8px + env(safe-area-inset-bottom));
}
.fm-tab{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;
  background:transparent;border:none;color:#A9CBBB;
  padding:6px 2px;font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;
  letter-spacing:0.01em;touch-action:manipulation;
}
.fm-tab.active{color:var(--accent-amber);}

/* ---- Generic layout ---- */
.fm-section{padding:16px 18px;}
.fm-h2{font-family:'Teko',sans-serif;font-weight:700;font-size:23px;letter-spacing:0.01em;margin:0 0 10px;color:#F2FAF5;}
.fm-label{font-size:12px;color:#B7D6C6;font-weight:700;margin-bottom:6px;display:block;text-transform:uppercase;letter-spacing:0.04em;}
.fm-row{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.fm-list-row{
  display:flex;align-items:center;gap:12px;padding:13px 2px;border-bottom:1px solid var(--hair);
}
.fm-list-row:last-child{border-bottom:none;}

.fm-input{
  background:#0A1812;border:1px solid rgba(234,244,238,0.28);color:#FFFFFF;
  border-radius:10px;padding:11px 12px;font-size:16px;font-family:'Manrope',sans-serif;
  width:100%;outline:none;font-weight:600;
}
.fm-input::placeholder{color:#7C9C8A;}
.fm-input:focus{border-color:var(--accent-amber);box-shadow:0 0 0 3px rgba(245,178,63,0.20);}
.fm-textarea{min-height:80px;resize:vertical;line-height:1.5;}

.fm-btn{
  border:none;border-radius:11px;padding:13px 16px;font-family:'Manrope',sans-serif;
  font-weight:700;font-size:14.5px;display:flex;align-items:center;justify-content:center;gap:7px;
  touch-action:manipulation;
}
.fm-btn-primary{background:var(--accent-amber);color:var(--accent-amber-ink);}
.fm-btn-primary:active{background:#DE9A2D;}
.fm-btn-ghost{background:transparent;color:var(--pitch-line);border:1px solid var(--hair-strong);}
.fm-btn-ghost:active{background:var(--pitch-mid2);}
.fm-btn-danger{background:transparent;color:#FF7A6E;border:1px solid rgba(255,90,77,0.5);}
.fm-btn-block{width:100%;}
.fm-btn-sm{padding:8px 12px;font-size:13px;border-radius:9px;}
.fm-btn:disabled{opacity:0.4;}

.fm-chip{
  display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;
  font-size:13px;font-weight:800;border:1.5px solid rgba(234,244,238,0.30);
  background:#1B4636;color:#F2FAF5;box-shadow:0 1px 3px rgba(0,0,0,0.25);
  touch-action:manipulation;line-height:1;
}
.fm-chip:active{background:#245743;transform:scale(0.97);}
.fm-chip.on{background:var(--accent-amber);color:var(--accent-amber-ink);border-color:var(--accent-amber);}
.fm-chip svg{flex-shrink:0;}

.fm-badge-role{
  width:27px;height:27px;border-radius:7px;display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:800;flex-shrink:0;color:#0A1812;
}
.role-POR{background:#F5B23F;}
.role-DEF{background:#5DB6F0;}
.role-MED{background:#9FD8BE;}
.role-DEL{background:#FF8A7E;}

.fm-guest-tag{
  font-size:10px;font-weight:800;color:var(--accent-sky);background:rgba(79,169,232,0.14);
  padding:3px 8px;border-radius:100px;flex-shrink:0;
}

/* ---- MVP voting ---- */
.fm-mvp-row{display:flex;align-items:center;gap:12px;padding:10px 2px;border-bottom:1px solid var(--hair);}
.fm-mvp-row:last-child{border-bottom:none;}
.fm-mvp-row.leader{background:rgba(242,169,59,0.08);border-radius:10px;padding-left:8px;padding-right:8px;}
.fm-mvp-count{
  font-family:'Teko',sans-serif;font-weight:700;font-size:23px;min-width:26px;text-align:center;color:#FFFFFF;
}
.fm-mvp-empty{text-align:center;padding:30px 20px;color:var(--ink-soft);font-size:13px;}

/* ---- Whiteboard / Pizarra ---- */
.fm-board-wrap{
  position:relative;width:100%;aspect-ratio:3/4;border-radius:16px;overflow:hidden;
  background:linear-gradient(180deg,var(--pitch-mid2) 0%, var(--pitch-mid) 100%);
  border:1px solid var(--hair-strong);touch-action:none;
}
.fm-board-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
.fm-board-toolbar{
  display:flex;gap:6px;overflow-x:auto;padding:12px 0 4px;
}
.fm-tool-btn{
  flex-shrink:0;width:42px;height:42px;border-radius:11px;background:var(--pitch-mid);
  border:1.5px solid var(--hair-strong);color:var(--pitch-line);display:flex;align-items:center;justify-content:center;
  touch-action:manipulation;
}
.fm-tool-btn.active{border-color:var(--accent-amber);background:rgba(245,178,63,0.18);color:var(--accent-amber);}
.fm-color-row{display:flex;gap:8px;padding:8px 0;}
.fm-color-dot{
  width:30px;height:30px;border-radius:50%;border:2px solid rgba(0,0,0,0.35);flex-shrink:0;
}
.fm-color-dot.active{border-color:#FFFFFF;box-shadow:0 0 0 2px rgba(255,255,255,0.4);}
.fm-token-row{display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px;}
.fm-token-chip{
  flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:none;
  opacity:0.5;
}
.fm-token-chip.active{opacity:1;}
.fm-token-chip .fm-shirt{width:36px;height:36px;}
.fm-token-chip .fm-shirt .fm-num{font-size:16px;}
.fm-token-chip-label{font-size:10.5px;color:#C7E2D6;font-weight:700;}

.fm-empty{
  text-align:center;padding:40px 20px;color:var(--ink-soft);
}
.fm-empty svg{opacity:0.5;margin-bottom:10px;}
.fm-empty-title{font-weight:700;color:var(--pitch-line);margin-bottom:4px;}
.fm-empty-text{font-size:13px;line-height:1.5;}

/* ---- Player number badge (shirt) ---- */
.fm-shirt{
  width:40px;height:40px;border-radius:50%;background:#0A1812;
  border:2px solid rgba(234,244,238,0.32);display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
}
.fm-shirt .fm-num{font-size:19px;color:#FFFFFF;line-height:1;}

/* ---- Formation setup pitch ---- */
.fm-pitch-wrap{
  position:relative;width:100%;aspect-ratio:3/4;border-radius:16px;overflow:hidden;
  background:linear-gradient(180deg,var(--pitch-mid2) 0%, var(--pitch-mid) 100%);
  border:1px solid var(--hair-strong);
}
.fm-pitch-svg{position:absolute;inset:0;width:100%;height:100%;}
.fm-slot{
  position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:3px;
  background:none;border:none;padding:0;
}
.fm-slot-badge{
  width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  border:2.5px solid rgba(234,244,238,0.45);background:rgba(8,20,15,0.92);
  box-shadow:0 2px 8px rgba(0,0,0,0.35);
}
.fm-slot-badge.filled{background:#08140F;border-color:var(--accent-amber);}
.fm-slot-badge .fm-num{font-size:21px;color:#FFFFFF;font-weight:700;}
.fm-slot-empty-icon{color:#7C9C8A;}
.fm-slot-label{
  font-size:10.5px;font-weight:800;color:#FFFFFF;background:rgba(8,20,15,0.9);
  padding:2px 8px;border-radius:100px;max-width:82px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}

/* ---- Formation picker ---- */
.fm-formations{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;margin-bottom:14px;}
.fm-formation-opt{
  flex-shrink:0;background:var(--pitch-mid);border:1.5px solid var(--hair-strong);border-radius:12px;
  padding:9px 14px;text-align:center;
}
.fm-formation-opt.active{border-color:var(--accent-amber);background:rgba(242,169,59,0.10);}
.fm-formation-opt .fm-num{font-size:19px;display:block;}

/* ---- Scoreboard (live) ---- */
.fm-scoreboard{
  background:var(--pitch-mid);border-bottom:1px solid var(--hair);padding:14px 18px 16px;
}
.fm-sb-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.fm-sb-opponent{font-size:12.5px;color:var(--ink-soft);font-weight:600;}
.fm-sb-phase{
  font-size:10.5px;font-weight:800;letter-spacing:0.03em;color:var(--accent-amber);
  background:rgba(242,169,59,0.12);padding:3px 9px;border-radius:100px;
}
.fm-sb-main{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.fm-sb-score{
  display:flex;align-items:center;gap:10px;font-family:'Teko',sans-serif;font-weight:600;
  font-size:44px;line-height:1;
}
.fm-sb-score .vs{font-size:20px;color:var(--ink-faint);}
.fm-sb-timer{
  font-family:'Teko',sans-serif;font-weight:600;font-size:44px;line-height:1;
  display:flex;align-items:baseline;gap:6px;
}
.fm-sb-timer .added{font-size:16px;color:var(--accent-amber);}
.fm-sb-controls{display:flex;align-items:center;gap:8px;margin-top:14px;flex-wrap:wrap;}
.fm-sb-rival{display:flex;align-items:center;gap:6px;}
.fm-round-btn{
  width:36px;height:36px;border-radius:50%;border:1px solid var(--hair-strong);background:transparent;
  color:var(--pitch-line);display:flex;align-items:center;justify-content:center;flex-shrink:0;
  touch-action:manipulation;
}
.fm-round-btn:active{background:var(--pitch-mid2);}
.fm-play-btn{
  width:52px;height:52px;border-radius:50%;background:var(--accent-amber);color:var(--accent-amber-ink);
  display:flex;align-items:center;justify-content:center;border:none;flex-shrink:0;
}

/* ---- Bench strip ---- */
.fm-bench{padding:12px 18px 4px;}
.fm-bench-scroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;}
.fm-bench-card{
  flex-shrink:0;width:64px;display:flex;flex-direction:column;align-items:center;gap:5px;
}
.fm-bench-card .fm-shirt{background:#0A1812;}
.fm-bench-name{font-size:11px;text-align:center;color:#C7E2D6;font-weight:700;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;}

/* ---- Timeline ---- */
.fm-timeline{padding:6px 18px 18px;}
.fm-tl-item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--hair);}
.fm-tl-item:last-child{border-bottom:none;}
.fm-tl-min{
  font-family:'Teko',sans-serif;font-weight:600;font-size:18px;color:var(--ink-soft);
  width:34px;flex-shrink:0;text-align:right;
}
.fm-tl-icon{
  width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.fm-tl-text{font-size:13.5px;line-height:1.4;flex:1;}
.fm-tl-text b{font-weight:700;}
.fm-tl-sub{font-size:11.5px;color:var(--ink-soft);}

/* ---- Card icon (real card shape) ---- */
.fm-cardshape{width:15px;height:20px;border-radius:3px;flex-shrink:0;}

/* ---- Sheets / Modals ---- */
.fm-overlay{
  position:fixed;inset:0;background:rgba(4,10,7,0.72);z-index:50;
  display:flex;align-items:flex-end;justify-content:center;
}
.fm-sheet{
  width:100%;max-width:520px;background:var(--pitch-mid);border-radius:20px 20px 0 0;
  padding:6px 0 calc(18px + env(safe-area-inset-bottom));
  margin-bottom:var(--fm-inset,0px);
  max-height:calc(100% - var(--fm-inset,0px) - 12px);
  max-height:min(86dvh, calc(100% - var(--fm-inset,0px) - 12px));
  display:flex;flex-direction:column;overflow:hidden;
  animation:fm-sheet-up 0.22s ease-out;
}
@keyframes fm-sheet-up{from{transform:translateY(24px);opacity:0.4;}to{transform:translateY(0);opacity:1;}}
.fm-sheet-handle{width:36px;height:4px;background:var(--hair-strong);border-radius:100px;margin:10px auto 4px;flex-shrink:0;}
.fm-sheet-head{display:flex;align-items:center;justify-content:space-between;padding:10px 18px 4px;flex-shrink:0;}
.fm-sheet-title{font-family:'Teko',sans-serif;font-weight:600;font-size:22px;}
.fm-sheet-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:8px 18px 4px;overscroll-behavior:contain;}
.fm-sheet-actions{padding:12px 18px 0;display:flex;flex-direction:column;gap:8px;flex-shrink:0;}

.fm-modal-center{
  position:fixed;inset:0;background:rgba(4,10,7,0.72);z-index:60;
  display:flex;align-items:center;justify-content:center;
  padding:24px;padding-bottom:calc(24px + var(--fm-inset,0px));overflow-y:auto;
}
.fm-modal-box{
  width:100%;max-width:400px;background:var(--pitch-mid);border-radius:18px;padding:22px;
  border:1px solid var(--hair-strong);
}

.fm-action-btn{
  display:flex;align-items:center;gap:12px;width:100%;background:var(--pitch-deep);
  border:1px solid var(--hair-strong);border-radius:12px;padding:13px 14px;color:var(--pitch-line);
  font-family:'Manrope',sans-serif;font-weight:700;font-size:14.5px;text-align:left;
}
.fm-action-btn:active{background:var(--pitch-mid2);}
.fm-action-icon{
  width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
}

.fm-picker-row{
  display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--hair);
}
.fm-picker-row:last-child{border-bottom:none;}
.fm-picker-row:active{background:var(--pitch-mid2);}

/* ---- Toast ---- */
.fm-toast{
  position:fixed;bottom:96px;left:50%;transform:translateX(-50%);
  background:var(--pitch-line);color:var(--pitch-deep);font-weight:700;font-size:13px;
  padding:10px 18px;border-radius:100px;z-index:80;box-shadow:0 8px 24px rgba(0,0,0,0.35);
  animation:fm-toast-in 0.18s ease-out;white-space:nowrap;
}
@keyframes fm-toast-in{from{opacity:0;transform:translate(-50%,8px);}to{opacity:1;transform:translate(-50%,0);}}

/* ---- History / Season ---- */
.fm-match-card{
  border:1px solid var(--hair-strong);border-radius:14px;padding:14px;margin-bottom:10px;
  background:var(--pitch-mid);
}
.fm-match-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;}
.fm-match-score{font-family:'Teko',sans-serif;font-weight:600;font-size:26px;}
.fm-result-tag{width:8px;height:8px;border-radius:50%;flex-shrink:0;}

.fm-stat-table{width:100%;border-collapse:collapse;}
.fm-stat-table th{
  text-align:left;font-size:10.5px;color:#B7D6C6;font-weight:700;padding:0 8px 8px 0;
  border-bottom:1px solid var(--hair-strong);
}
.fm-stat-table td{padding:9px 8px 9px 0;border-bottom:1px solid var(--hair);font-size:13px;color:#F2FAF5;}
.fm-stat-table td.num, .fm-stat-table th.num{text-align:center;}

.fm-segmented{display:flex;background:#0A1812;border-radius:11px;padding:3px;gap:2px;flex-wrap:wrap;}
.fm-segmented button{
  flex:1;min-width:58px;border:none;background:transparent;color:#C7E2D6;font-weight:700;font-size:12.5px;
  padding:8px 4px;border-radius:8px;
}
.fm-segmented button.active{background:var(--accent-amber);color:var(--accent-amber-ink);}

.fm-loading{
  position:fixed;inset:0;background:var(--pitch-deep);display:flex;align-items:center;justify-content:center;
  color:var(--pitch-line);font-family:'Teko',sans-serif;font-size:22px;z-index:100;
}
`;

/* ============================================================================
   CONSTANTS
============================================================================ */

const DEFAULT_SQUAD = [
  { id: "p1", name: "Jugador 1", number: 1, guest: false },
  { id: "p2", name: "Jugador 2", number: 2, guest: false },
  { id: "p3", name: "Jugador 3", number: 3, guest: false },
  { id: "p4", name: "Jugador 4", number: 4, guest: false },
  { id: "p5", name: "Jugador 5", number: 5, guest: false },
  { id: "p6", name: "Jugador 6", number: 6, guest: false },
  { id: "p7", name: "Jugador 7", number: 7, guest: false },
  { id: "p8", name: "Jugador 8", number: 8, guest: false },
  { id: "p9", name: "Jugador 9", number: 9, guest: false },
  { id: "p10", name: "Jugador 10", number: 10, guest: false },
  { id: "p11", name: "Jugador 11", number: 11, guest: false },
];

const DEFAULT_SETTINGS = { teamName: "Mi Equipo", halfMinutes: 25 };

/* ============================================================================
   STORAGE HELPERS
============================================================================ */

async function storageGet(key, fallback) {
  try {
    const res = await window.storage.get(key, false);
    if (!res) return fallback;
    return JSON.parse(res.value);
  } catch (e) {
    return fallback;
  }
}
async function storageSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
    return true;
  } catch (e) {
    return false;
  }
}
async function storageDelete(key) {
  try {
    await window.storage.delete(key, false);
  } catch (e) {
    /* ignore */
  }
}

/* ============================================================================
   SMALL UTILITIES
============================================================================ */

let _uidCounter = 0;
function uid(prefix) {
  _uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${_uidCounter}`;
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function lastNameShort(name) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDateEs(iso) {
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  } catch (e) {
    return iso;
  }
}

function vibrate(ms) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch (e) {
    /* ignore */
  }
}

/* ---- Timer math ---- (halfElapsedSeconds, currentMinute y timerDisplay
   viven en matchLogic.js para poder testearse) */
function phaseLabel(phase) {
  return { pre: "Antes del partido", h1: "1ª parte", descanso: "Descanso", h2: "2ª parte", finalizado: "Finalizado" }[phase] || "";
}

/* ---- Minutes played ---- */
function minutesForPlayer(match, playerId, liveMinute) {
  const intervals = (match.intervals && match.intervals[playerId]) || [];
  let total = 0;
  for (const iv of intervals) {
    const end = iv.end == null ? liveMinute : iv.end;
    total += Math.max(0, end - iv.start);
  }
  return total;
}

/* ---- Match event helpers ---- */
function eventVisual(type) {
  switch (type) {
    case "gol": return { icon: Target, bg: "rgba(242,169,59,0.18)", color: "var(--accent-amber)" };
    case "asistencia": return { icon: Send, bg: "rgba(79,169,232,0.18)", color: "var(--accent-sky)" };
    case "parada": return { icon: Hand, bg: "rgba(143,182,162,0.18)", color: "var(--pitch-line)" };
    case "amarilla": return { icon: null, bg: "rgba(245,197,24,0.15)", color: "var(--card-yellow)" };
    case "roja": return { icon: null, bg: "rgba(228,72,60,0.15)", color: "var(--card-red)" };
    case "azul": return { icon: null, bg: "rgba(79,169,232,0.18)", color: "var(--accent-sky)" };
    case "cambio": return { icon: ArrowLeftRight, bg: "rgba(234,244,238,0.10)", color: "var(--ink-soft)" };
    case "formacion": return { icon: Shirt, bg: "rgba(234,244,238,0.10)", color: "var(--ink-soft)" };
    case "gol_rival": return { icon: Flag, bg: "rgba(228,72,60,0.15)", color: "var(--card-red)" };
    default: return { icon: CircleDot, bg: "rgba(234,244,238,0.10)", color: "var(--ink-soft)" };
  }
}

/* ============================================================================
   ROOT APP
============================================================================ */

export default function App({ user = null, onLogout = null }) {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("partido");
  const [squad, setSquad] = useState(DEFAULT_SQUAD);
  const [templates, setTemplates] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [history, setHistory] = useState([]);
  const [boards, setBoards] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const undoStack = useRef([]);

  useEffect(() => {
    (async () => {
      const [sq, tpl, am, hist, set, brd] = await Promise.all([
        storageGet("squad", null),
        storageGet("templates", []),
        storageGet("active-match", null),
        storageGet("history", []),
        storageGet("settings", null),
        storageGet("boards", []),
      ]);
      if (sq) setSquad(sq); else await storageSet("squad", DEFAULT_SQUAD);
      setTemplates(tpl || []);
      setActiveMatch(am || null);
      setHistory(hist || []);
      setBoards(brd || []);
      if (set) setSettings(set); else await storageSet("settings", DEFAULT_SETTINGS);
      setLoading(false);
    })();
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const updateSquad = useCallback((next) => {
    setSquad(next);
    storageSet("squad", next);
  }, []);

  const addSquadPlayer = useCallback((partial) => {
    const player = { id: uid("p"), guest: false, ...partial };
    setSquad((prev) => {
      const next = [...prev, player];
      storageSet("squad", next);
      return next;
    });
    return player;
  }, []);

  const updateTemplates = useCallback((next) => {
    setTemplates(next);
    storageSet("templates", next);
  }, []);

  const updateSettings = useCallback((next) => {
    setSettings(next);
    storageSet("settings", next);
  }, []);

  const updateBoards = useCallback((next) => {
    setBoards(next);
    storageSet("boards", next);
  }, []);

  const updateMatchInHistory = useCallback((matchId, updater) => {
    setHistory((prev) => {
      const next = prev.map((m) => (m.id === matchId ? updater(m) : m));
      storageSet("history", next);
      return next;
    });
  }, []);

  // Mutating the active match always snapshots first for undo.
  const mutateMatch = useCallback((mutator, opts = {}) => {
    setActiveMatch((prev) => {
      if (!prev) return prev;
      if (!opts.skipUndo) {
        undoStack.current.push(JSON.stringify(prev));
        if (undoStack.current.length > 25) undoStack.current.shift();
      }
      const next = mutator(prev);
      storageSet("active-match", next);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    const snap = undoStack.current.pop();
    if (!snap) {
      showToast("Nada que deshacer");
      return;
    }
    const restored = JSON.parse(snap);
    setActiveMatch(restored);
    storageSet("active-match", restored);
    showToast("Acción deshecha");
  }, [showToast]);

  const startMatch = useCallback((matchInit) => {
    undoStack.current = [];
    setActiveMatch(matchInit);
    storageSet("active-match", matchInit);
  }, []);

  const finishMatch = useCallback((finalMatch) => {
    const nextHistory = [finalMatch, ...history];
    setHistory(nextHistory);
    storageSet("history", nextHistory);
    setActiveMatch(null);
    storageDelete("active-match");
    undoStack.current = [];
  }, [history]);

  const discardMatch = useCallback(() => {
    setActiveMatch(null);
    storageDelete("active-match");
    undoStack.current = [];
  }, []);

  const deleteFromHistory = useCallback((id) => {
    const next = history.filter((m) => m.id !== id);
    setHistory(next);
    storageSet("history", next);
  }, [history]);

  if (loading) {
    return (
      <div className="fm-root">
        <style>{CSS}</style>
        <div className="fm-loading">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="fm-root">
      <style>{CSS}</style>

      <AppHeader
        settings={settings}
        tab={tab}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="fm-scroll">
        {tab === "partido" && (
          <PartidoTab
            squad={squad}
            templates={templates}
            onSaveTemplate={(t) => updateTemplates([t, ...templates])}
            onDeleteTemplate={(id) => updateTemplates(templates.filter((t) => t.id !== id))}
            settings={settings}
            activeMatch={activeMatch}
            onStartMatch={startMatch}
            mutateMatch={mutateMatch}
            onFinishMatch={finishMatch}
            onDiscardMatch={discardMatch}
            onAddPlayer={addSquadPlayer}
            showToast={showToast}
          />
        )}
        {tab === "plantilla" && (
          <PlantillaTab squad={squad} onChange={updateSquad} showToast={showToast} />
        )}
        {tab === "pizarra" && (
          <PizarraTab squad={squad} boards={boards} onChange={updateBoards} showToast={showToast} />
        )}
        {tab === "historial" && (
          <HistorialTab history={history} squad={squad} onDelete={deleteFromHistory} onUpdateMatch={updateMatchInHistory} showToast={showToast} />
        )}
        {tab === "temporada" && (
          <TemporadaTab history={history} squad={squad} />
        )}
      </div>

      <TabBar tab={tab} setTab={setTab} hasActiveMatch={!!activeMatch} />

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          user={user}
          onLogout={onLogout}
          onSave={(s) => { updateSettings(s); setSettingsOpen(false); showToast("Ajustes guardados"); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {toast && <div className="fm-toast">{toast}</div>}
    </div>
  );
}

/* ============================================================================
   HEADER + TAB BAR
============================================================================ */

function AppHeader({ settings, tab, onOpenSettings }) {
  const titles = { partido: "Partido", plantilla: "Plantilla", pizarra: "Pizarra", historial: "Historial", temporada: "Temporada" };
  return (
    <div className="fm-header">
      <div>
        <h1>{titles[tab]}</h1>
        <div className="fm-sub">{settings.teamName}</div>
      </div>
      <button className="fm-iconbtn" onClick={onOpenSettings} aria-label="Ajustes">
        <Settings size={18} />
      </button>
    </div>
  );
}

function TabBar({ tab, setTab, hasActiveMatch }) {
  const items = [
    { id: "partido", label: "Partido", icon: Shirt, dot: hasActiveMatch },
    { id: "plantilla", label: "Plantilla", icon: Users },
    { id: "pizarra", label: "Pizarra", icon: PenLine },
    { id: "historial", label: "Historial", icon: ClipboardList },
    { id: "temporada", label: "Temporada", icon: BarChart3 },
  ];
  return (
    <div className="fm-tabbar">
      {items.map((it) => (
        <button key={it.id} className={`fm-tab ${tab === it.id ? "active" : ""}`} onClick={() => setTab(it.id)}>
          <span style={{ position: "relative" }}>
            <it.icon size={20} />
            {it.dot && (
              <span style={{ position: "absolute", top: -2, right: -4, width: 7, height: 7, borderRadius: "50%", background: "var(--accent-amber)" }} />
            )}
          </span>
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================================
   EQUIPO COMPARTIDO
============================================================================ */

function ShareSection({ user }) {
  const [info, setInfo] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/share", { credentials: "same-origin" });
      if (res.ok) setInfo(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const join = async () => {
    const value = code.trim().toUpperCase();
    if (!value) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/share/join", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: body.error || "No se pudo unir al equipo" });
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch {
      setMsg({ type: "err", text: "Error de conexión" });
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!window.confirm("¿Seguro que quieres salir del equipo compartido? Dejarás de ver los datos compartidos.")) return;
    setBusy(true);
    try {
      await fetch("/api/share/leave", { method: "POST", credentials: "same-origin" });
      window.location.reload();
    } catch {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!info?.code) return;
    try {
      await navigator.clipboard.writeText(info.code.toUpperCase());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setMsg({ type: "ok", text: "Código: " + info.code.toUpperCase() });
    }
  };

  if (!user) return null;

  const members = info?.members || [];
  const others = members.filter((e) => e !== user.email);
  const shared = others.length > 0 || (info && !info.isOwner);

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--hair)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Users size={16} color="var(--accent-amber)" />
        <span style={{ fontWeight: 800, fontSize: 15 }}>Equipo compartido</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5, marginBottom: 14 }}>
        Compartid la plantilla, los partidos y las pizarras entre varias personas. Todos podrán ver y editar los mismos datos.
      </div>

      {/* Estado actual */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
          background: shared ? "rgba(245,178,63,0.12)" : "rgba(234,244,238,0.05)",
          border: `1px solid ${shared ? "rgba(245,178,63,0.45)" : "var(--hair-strong)"}`,
          borderRadius: 12, padding: "10px 12px",
        }}
      >
        <span
          style={{
            width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
            background: shared ? "var(--accent-amber)" : "var(--ink-faint)",
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13.5 }}>
            {shared ? "Compartiendo" : "Solo tú"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            {members.length > 1
              ? `Miembros: ${members.join(", ")}`
              : "Los datos son privados (solo tu cuenta)."}
          </div>
        </div>
      </div>

      {/* Paso 1: compartir mi código */}
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
            background: "var(--accent-amber)", color: "var(--accent-amber-ink)",
            fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          1
        </div>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>Invita a alguien con tu código</div>
      </div>
      {info?.code && (
        <div style={{ display: "flex", gap: 8, marginBottom: 6, marginLeft: 32 }}>
          <div
            className="fm-num"
            style={{
              flex: 1, background: "#0A1812", border: "1px solid rgba(234,244,238,0.28)",
              borderRadius: 10, padding: "10px 12px", fontSize: 24, letterSpacing: "0.16em",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF",
            }}
          >
            {info.code.toUpperCase()}
          </div>
          <button className="fm-btn fm-btn-primary" onClick={copy} style={{ minWidth: 92 }}>
            {copied ? <><Check size={16} /> Copiado</> : "Copiar"}
          </button>
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 20, marginLeft: 32, lineHeight: 1.45 }}>
        Tu compañero debe abrir Ajustes → Equipo compartido y pegar este código para unirse a tus datos.
      </div>

      {/* Paso 2: unirme con un código */}
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
            background: "var(--pitch-mid2)", color: "#FFFFFF",
            fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          2
        </div>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>O únete con el código de un compañero</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginLeft: 32 }}>
        <input
          className="fm-input"
          placeholder="Ej: A1B2C3D4"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          style={{ flex: 1, textTransform: "uppercase", letterSpacing: "0.12em" }}
          maxLength={12}
        />
        <button className="fm-btn fm-btn-primary" onClick={join} disabled={busy || !code.trim()} style={{ minWidth: 92 }}>
          Unirme
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8, marginLeft: 32, lineHeight: 1.45 }}>
        Al unirte verás los datos de esa persona (y ella los tuyos).
      </div>

      {msg && (
        <div
          style={{
            fontSize: 12.5, marginTop: 12, marginLeft: 32, fontWeight: 700,
            color: msg.type === "err" ? "var(--card-red)" : "var(--accent-sky)",
          }}
        >
          {msg.text}
        </div>
      )}

      {info && !info.isOwner && (
        <button
          className="fm-btn fm-btn-ghost fm-btn-block"
          style={{ marginTop: 18 }}
          onClick={leave}
          disabled={busy}
        >
          <ArrowRight size={16} /> Salir del equipo compartido
        </button>
      )}
    </div>
  );
}

/* ============================================================================
   SETTINGS MODAL
============================================================================ */

function SettingsModal({ settings, onSave, onClose, user, onLogout }) {
  const [teamName, setTeamName] = useState(settings.teamName);
  const [halfMinutes, setHalfMinutes] = useState(settings.halfMinutes);
  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div className="fm-sheet-title">Ajustes</div>
          <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fm-sheet-body">
          <div style={{ marginBottom: 16 }}>
            <span className="fm-label">Nombre del equipo</span>
            <input className="fm-input" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <span className="fm-label">Duración de cada parte (minutos)</span>
            <input
              className="fm-input"
              type="number"
              inputMode="numeric"
              value={halfMinutes}
              onChange={(e) => setHalfMinutes(Math.max(1, parseInt(e.target.value || "0", 10)))}
            />
          </div>
          {user && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--hair)" }}>
              <span className="fm-label">Cuenta</span>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 10, wordBreak: "break-all" }}>
                {user.email}
              </div>
              <button
                className="fm-btn fm-btn-ghost fm-btn-block"
                onClick={() => onLogout && onLogout()}
              >
                <ArrowRight size={16} /> Cerrar sesión
              </button>
            </div>
          )}
          <ShareSection user={user} />
        </div>
        <div className="fm-sheet-actions">
          <button className="fm-btn fm-btn-primary fm-btn-block" onClick={() => onSave({ teamName: teamName.trim() || "Mi Equipo", halfMinutes: halfMinutes || 25 })}>
            <Check size={17} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   PLANTILLA TAB
============================================================================ */

function PlantillaTab({ squad, onChange, showToast }) {
  const [editing, setEditing] = useState(null); // player object or "new"

  const addPlayer = () => {
    const nextNum = (Math.max(0, ...squad.map((p) => p.number)) || 0) + 1;
    setEditing({ id: null, name: "", number: nextNum, guest: false });
  };

  const savePlayer = (player) => {
    if (!player.name.trim()) { showToast("Ponle un nombre al jugador"); return; }
    if (player.id) {
      onChange(squad.map((p) => (p.id === player.id ? player : p)));
      showToast("Jugador actualizado");
    } else {
      onChange([...squad, { ...player, id: uid("p") }]);
      showToast("Jugador añadido");
    }
    setEditing(null);
  };

  const removePlayer = (id) => {
    onChange(squad.filter((p) => p.id !== id));
    setEditing(null);
    showToast("Jugador eliminado");
  };

  const sorted = [...squad].sort((a, b) => a.number - b.number);
  const guestCount = squad.filter((p) => p.guest).length;

  return (
    <div className="fm-section">
      <div className="fm-row" style={{ marginBottom: 14 }}>
        <span className="fm-h2" style={{ margin: 0 }}>
          {squad.length} jugadores{guestCount > 0 ? ` · ${guestCount} invitado${guestCount > 1 ? "s" : ""}` : ""}
        </span>
        <button className="fm-btn fm-btn-primary fm-btn-sm" onClick={addPlayer}>
          <Plus size={15} /> Añadir
        </button>
      </div>

      <div>
        {sorted.map((p) => (
          <div className="fm-list-row" key={p.id} onClick={() => setEditing(p)}>
            <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.name}</div>
            </div>
            {p.guest && <span className="fm-guest-tag">Invitado</span>}
            <Pencil size={15} color="var(--ink-faint)" />
          </div>
        ))}
      </div>

      {squad.length === 0 && (
        <div className="fm-empty">
          <Users size={34} />
          <div className="fm-empty-title">Sin jugadores todavía</div>
          <div className="fm-empty-text">Añade tu plantilla para empezar a montar alineaciones.</div>
        </div>
      )}

      {editing && (
        <PlayerEditSheet
          player={editing}
          onSave={savePlayer}
          onDelete={editing.id ? () => removePlayer(editing.id) : null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function PlayerEditSheet({ player, onSave, onDelete, onClose }) {
  const [name, setName] = useState(player.name);
  const [number, setNumber] = useState(player.number);
  const [guest, setGuest] = useState(!!player.guest);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div className="fm-sheet-title">{player.id ? "Editar jugador" : "Nuevo jugador"}</div>
          <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fm-sheet-body">
          <div style={{ marginBottom: 14 }}>
            <span className="fm-label">Nombre</span>
            <input className="fm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del jugador" autoFocus />
          </div>
          <div style={{ marginBottom: 14 }}>
            <span className="fm-label">Dorsal</span>
            <input className="fm-input" style={{ width: 90 }} type="number" inputMode="numeric" value={number} onChange={(e) => setNumber(parseInt(e.target.value || "0", 10))} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <span className="fm-label">Tipo de jugador</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className={`fm-chip ${!guest ? "on" : ""}`} style={{ flex: 1, justifyContent: "center" }} onClick={() => setGuest(false)}>
                Habitual
              </button>
              <button className={`fm-chip ${guest ? "on" : ""}`} style={{ flex: 1, justifyContent: "center" }} onClick={() => setGuest(true)}>
                Invitado (amigo puntual)
              </button>
            </div>
          </div>
          {onDelete && (
            confirmDelete ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="fm-btn fm-btn-danger" style={{ flex: 1 }} onClick={onDelete}>Confirmar eliminación</button>
                <button className="fm-btn fm-btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Cancelar</button>
              </div>
            ) : (
              <button className="fm-btn fm-btn-danger fm-btn-block" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> Eliminar jugador
              </button>
            )
          )}
        </div>
        <div className="fm-sheet-actions">
          <button className="fm-btn fm-btn-primary fm-btn-block" onClick={() => onSave({ id: player.id, name, number, guest })}>
            <Check size={17} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   PARTIDO TAB (setup + live)
============================================================================ */

function PartidoTab(props) {
  const { activeMatch } = props;
  if (activeMatch) {
    return <LiveMatch {...props} />;
  }
  return <MatchSetup {...props} />;
}

/* ---------- Setup ---------- */

function MatchSetup({ squad, templates, onSaveTemplate, onDeleteTemplate, settings, onStartMatch, onAddPlayer, showToast }) {
  const [formationKey, setFormationKey] = useState("1-2-3-1");
  const [lineup, setLineup] = useState({});
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState(todayISO());
  const [venue, setVenue] = useState("");
  const [pickerSlot, setPickerSlot] = useState(null);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [tplListOpen, setTplListOpen] = useState(false);

  const formation = FORMATIONS[formationKey];
  const assignedIds = useMemo(() => new Set(Object.values(lineup)), [lineup]);
  const bench = squad.filter((p) => !assignedIds.has(p.id));
  const filledCount = Object.keys(lineup).filter((k) => lineup[k]).length;

  const applyFormation = (key) => {
    // keep players that still fit into the new formation's slot ids where possible
    setFormationKey(key);
    const newSlots = new Set(FORMATIONS[key].slots.map((s) => s.id));
    setLineup((prev) => {
      const next = {};
      Object.keys(prev).forEach((slotId) => { if (newSlots.has(slotId)) next[slotId] = prev[slotId]; });
      return next;
    });
  };

  const assignPlayer = (slotId, playerId) => {
    setLineup((prev) => {
      const next = { ...prev };
      // remove player from any other slot first
      Object.keys(next).forEach((k) => { if (next[k] === playerId) delete next[k]; });
      next[slotId] = playerId;
      return next;
    });
    setPickerSlot(null);
  };

  const clearSlot = (slotId) => {
    setLineup((prev) => { const next = { ...prev }; delete next[slotId]; return next; });
    setPickerSlot(null);
  };

  const loadTemplate = (tpl) => {
    setFormationKey(tpl.formation);
    const validIds = new Set(squad.map((p) => p.id));
    const next = {};
    Object.entries(tpl.lineup).forEach(([slot, pid]) => { if (validIds.has(pid)) next[slot] = pid; });
    setLineup(next);
    setTplListOpen(false);
    showToast(`Alineación "${tpl.name}" cargada`);
  };

  const handleStart = () => {
    if (filledCount === 0) { showToast("Asigna al menos un jugador"); return; }
    const intervals = {};
    Object.entries(lineup).forEach(([slotId, pid]) => {
      const role = formation.slots.find((s) => s.id === slotId)?.role;
      intervals[pid] = [{ start: 0, end: null, role }];
    });
    const match = {
      id: uid("m"),
      date, opponent: opponent.trim() || "Rival", venue: venue.trim(),
      formation: formationKey,
      halfMinutes: settings.halfMinutes,
      lineup, intervals,
      initialLineup: { ...lineup },
      events: [],
      rivalGoals: 0,
      mvpVotes: {},
      notes: "",
      phase: "h1",
      runningSince: Date.now(),
      h1Seconds: 0, h2Seconds: 0,
      addedTime: { h1: 0, h2: 0 },
    };
    onStartMatch(match);
  };

  return (
    <div className="fm-section">
      <span className="fm-label">FORMACIÓN</span>
      <div className="fm-formations">
        {Object.keys(FORMATIONS).map((key) => (
          <button key={key} className={`fm-formation-opt ${formationKey === key ? "active" : ""}`} onClick={() => applyFormation(key)}>
            <span className="fm-num">{key}</span>
          </button>
        ))}
      </div>

      <div className="fm-pitch-wrap">
        <PitchMarkings />
        {formation.slots.map((slot) => {
          const playerId = lineup[slot.id];
          const player = squad.find((p) => p.id === playerId);
          return (
            <button key={slot.id} className="fm-slot" style={{ left: `${slot.x}%`, top: `${slot.y}%` }} onClick={() => setPickerSlot(slot.id)}>
              <div className={`fm-slot-badge ${player ? "filled" : ""}`}>
                {player ? <span className="fm-num">{player.number}</span> : <Plus size={18} className="fm-slot-empty-icon" />}
              </div>
              <span className="fm-slot-label">{player ? lastNameShort(player.name) : ROLE_SHORT[slot.role]}</span>
            </button>
          );
        })}
      </div>

      <div className="fm-row" style={{ margin: "12px 0 20px" }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{filledCount} de {formation.slots.length} posiciones cubiertas</span>
        <button className="fm-btn fm-btn-ghost fm-btn-sm" onClick={() => setTplListOpen(true)}>Alineaciones guardadas</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <span className="fm-label">Banquillo ({bench.length})</span>
        {bench.length > 0 ? (
          <div className="fm-bench-scroll">
            {bench.map((p) => (
              <div className="fm-bench-card" key={p.id}>
                <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
                <div className="fm-bench-name">{lastNameShort(p.name)}</div>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Todos en el campo</div>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <span className="fm-label">Rival</span>
        <input className="fm-input" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Nombre del equipo rival" />
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
        <div style={{ flex: 1 }}>
          <span className="fm-label"><CalendarDays size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Fecha</span>
          <input className="fm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <span className="fm-label"><MapPin size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Lugar (opcional)</span>
          <input className="fm-input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Campo" />
        </div>
      </div>

      <button className="fm-btn fm-btn-ghost fm-btn-block" style={{ marginBottom: 10 }} onClick={() => setSaveTplOpen(true)} disabled={filledCount === 0}>
        Guardar esta alineación como plantilla
      </button>
      <button className="fm-btn fm-btn-primary fm-btn-block" onClick={handleStart}>
        <Play size={17} /> Iniciar partido
      </button>

      {pickerSlot && (
        <SlotPickerSheet
          slot={formation.slots.find((s) => s.id === pickerSlot)}
          squad={squad}
          currentPlayerId={lineup[pickerSlot]}
          assignedIds={assignedIds}
          onPick={(pid) => assignPlayer(pickerSlot, pid)}
          onClear={() => clearSlot(pickerSlot)}
          onAddPlayer={(partial) => { const p = onAddPlayer(partial); assignPlayer(pickerSlot, p.id); }}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {saveTplOpen && (
        <SaveTemplateSheet
          onSave={(name) => {
            onSaveTemplate({ id: uid("tpl"), name, formation: formationKey, lineup });
            setSaveTplOpen(false);
            showToast("Alineación guardada");
          }}
          onClose={() => setSaveTplOpen(false)}
        />
      )}

      {tplListOpen && (
        <TemplateListSheet
          templates={templates}
          onLoad={loadTemplate}
          onDelete={onDeleteTemplate}
          onClose={() => setTplListOpen(false)}
        />
      )}
    </div>
  );
}

function PitchMarkings() {
  return (
    <svg className="fm-pitch-svg" viewBox="0 0 100 133" preserveAspectRatio="none">
      <rect x="3" y="3" width="94" height="127" fill="none" stroke="var(--hair-strong)" strokeWidth="0.5" />
      <line x1="3" y1="66.5" x2="97" y2="66.5" stroke="var(--hair-strong)" strokeWidth="0.5" />
      <circle cx="50" cy="66.5" r="12" fill="none" stroke="var(--hair-strong)" strokeWidth="0.5" />
      <circle cx="50" cy="66.5" r="0.8" fill="var(--hair-strong)" />
      <rect x="25" y="3" width="50" height="16" fill="none" stroke="var(--hair-strong)" strokeWidth="0.5" />
      <rect x="25" y="114" width="50" height="16" fill="none" stroke="var(--hair-strong)" strokeWidth="0.5" />
      <rect x="38" y="3" width="24" height="7" fill="none" stroke="var(--hair-strong)" strokeWidth="0.5" />
      <rect x="38" y="123" width="24" height="7" fill="none" stroke="var(--hair-strong)" strokeWidth="0.5" />
    </svg>
  );
}

function SlotPickerSheet({ slot, squad, currentPlayerId, assignedIds, onPick, onClear, onAddPlayer, onClose }) {
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState((Math.max(0, ...squad.map((p) => p.number)) || 0) + 1);

  const available = squad.filter((p) => !assignedIds.has(p.id) || p.id === currentPlayerId);
  const sorted = [...available].sort((a, b) => a.number - b.number);

  const submitAdd = () => {
    if (!newName.trim()) return;
    onAddPlayer({ name: newName.trim(), number: newNumber, guest: true });
  };

  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div className="fm-sheet-title">Posición: {ROLE_LABEL[slot.role]}</div>
          <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fm-sheet-body">
          {currentPlayerId && (
            <button className="fm-btn fm-btn-danger fm-btn-block" style={{ marginBottom: 10 }} onClick={onClear}>
              Quitar de esta posición
            </button>
          )}
          {sorted.length === 0 && <div className="fm-empty-text" style={{ padding: "16px 0" }}>No quedan jugadores libres.</div>}
          {sorted.map((p) => (
            <div key={p.id} className="fm-picker-row" onClick={() => onPick(p.id)}>
              <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>{p.name}</div>
              {p.guest && <span className="fm-guest-tag">Invitado</span>}
              {p.id === currentPlayerId && <Check size={17} color="var(--accent-amber)" />}
            </div>
          ))}

          {onAddPlayer && (
            addOpen ? (
              <div style={{ paddingTop: 10, borderTop: "1px solid var(--hair)", marginTop: 6 }}>
                <span className="fm-label">Nuevo jugador (falta alguien y viene un amigo)</span>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input className="fm-input" style={{ flex: 1 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre" autoFocus />
                  <input className="fm-input" style={{ width: 70 }} type="number" inputMode="numeric" value={newNumber} onChange={(e) => setNewNumber(parseInt(e.target.value || "0", 10))} />
                </div>
                <button className="fm-btn fm-btn-primary fm-btn-block" disabled={!newName.trim()} onClick={submitAdd}>
                  <UserPlus size={16} /> Añadir y asignar aquí
                </button>
              </div>
            ) : (
              <button className="fm-btn fm-btn-ghost fm-btn-block" style={{ marginTop: 6 }} onClick={() => setAddOpen(true)}>
                <UserPlus size={16} /> Nuevo jugador
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function SaveTemplateSheet({ onSave, onClose }) {
  const [name, setName] = useState("");
  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div className="fm-sheet-title">Guardar alineación</div>
          <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fm-sheet-body">
          <span className="fm-label">Nombre de la plantilla</span>
          <input className="fm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Titular contra rivales fuertes" autoFocus />
        </div>
        <div className="fm-sheet-actions">
          <button className="fm-btn fm-btn-primary fm-btn-block" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
            <Check size={17} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateListSheet({ templates, onLoad, onDelete, onClose }) {
  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div className="fm-sheet-title">Alineaciones guardadas</div>
          <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fm-sheet-body">
          {templates.length === 0 && <div className="fm-empty-text" style={{ padding: "16px 0" }}>Aún no has guardado ninguna alineación.</div>}
          {templates.map((t) => (
            <div key={t.id} className="fm-picker-row">
              <div style={{ flex: 1 }} onClick={() => onLoad(t)}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{t.formation}</div>
              </div>
              <button className="fm-iconbtn" onClick={() => onDelete(t.id)}><Trash2 size={16} color="var(--card-red)" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Live match ---------- */

function LiveMatch({ squad, activeMatch, mutateMatch, onFinishMatch, onDiscardMatch, onAddPlayer, showToast }) {
  const [now, setNow] = useState(Date.now());
  const [actionSlot, setActionSlot] = useState(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [formationOpen, setFormationOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  useEffect(() => {
    if (activeMatch.phase !== "h1" && activeMatch.phase !== "h2") return;
    if (!activeMatch.runningSince) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeMatch.phase, activeMatch.runningSince]);

  const formation = FORMATIONS[activeMatch.formation];
  const playerById = useMemo(() => Object.fromEntries(squad.map((p) => [p.id, p])), [squad]);
  const assignedIds = new Set(Object.values(activeMatch.lineup));
  const outSet = useMemo(() => outPlayers(activeMatch), [activeMatch]);
  const bench = squad.filter((p) => !assignedIds.has(p.id) && !outSet.has(p.id));
  const suspended = squad.filter((p) => outSet.has(p.id));
  const minute = currentMinute(activeMatch, now);
  const onField = onFieldCount(activeMatch);
  const sentOff = redCount(activeMatch);
  const ordering = useMemo(() => subOrdering(activeMatch, squad, minute), [activeMatch, squad, minute]);
  const timer = timerDisplay(activeMatch, now);
  const goalsFor = activeMatch.events.filter((e) => e.type === "gol").length;
  const isRunning = !!activeMatch.runningSince && (activeMatch.phase === "h1" || activeMatch.phase === "h2");

  const togglePlay = () => {
    if (activeMatch.phase === "descanso") {
      mutateMatch((m) => ({ ...m, phase: "h2", runningSince: Date.now() }));
      setNow(Date.now());
      return;
    }
    mutateMatch((m) => {
      if (m.runningSince) {
        const elapsed = (Date.now() - m.runningSince) / 1000;
        const key = m.phase === "h1" ? "h1Seconds" : "h2Seconds";
        return { ...m, [key]: m[key] + elapsed, runningSince: null };
      }
      return { ...m, runningSince: Date.now() };
    });
    setNow(Date.now());
  };

  const goToHalftime = () => {
    mutateMatch((m) => {
      const elapsed = m.runningSince ? (Date.now() - m.runningSince) / 1000 : 0;
      return { ...m, phase: "descanso", h1Seconds: m.h1Seconds + elapsed, runningSince: null };
    });
    setNow(Date.now());
    vibrate(15);
  };

  const rivalGoal = (delta) => {
    mutateMatch((m) => {
      if (delta > 0) {
        return {
          ...m,
          rivalGoals: m.rivalGoals + 1,
          events: [...m.events, { id: uid("ev"), minute: currentMinute(m, Date.now()), type: "gol_rival" }],
        };
      }
      if (m.rivalGoals === 0) return m;
      const idx = [...m.events].reverse().findIndex((e) => e.type === "gol_rival");
      const events = idx === -1 ? m.events : m.events.filter((_, i) => i !== m.events.length - 1 - idx);
      return { ...m, rivalGoals: m.rivalGoals - 1, events };
    });
    if (delta > 0) vibrate(30);
  };

  const openSlotAction = (slotId) => {
    const pid = activeMatch.lineup[slotId];
    if (!pid) { setActionSlot({ slotId, empty: true }); return; }
    setActionSlot({ slotId, playerId: pid });
  };

  const logGoal = (scorerId, assistId) => {
    mutateMatch((m) => ({
      ...m,
      events: [...m.events, { id: uid("ev"), minute: currentMinute(m, Date.now()), type: "gol", playerId: scorerId, assistId: assistId || null }],
    }));
    vibrate(40);
    showToast("¡Gol registrado!");
    setActionSlot(null);
  };

  const logSimple = (type, playerId) => {
    mutateMatch((m) => ({
      ...m,
      events: [...m.events, { id: uid("ev"), minute: currentMinute(m, Date.now()), type, playerId }],
    }));
    const labels = { parada: "Parada registrada", amarilla: "Tarjeta amarilla registrada", roja: "Tarjeta roja registrada" };
    showToast(labels[type] || "Registrado");
    setActionSlot(null);
  };

  const doSubstitution = (slotId, outId, inId) => {
    const role = formation.slots.find((s) => s.id === slotId)?.role;
    mutateMatch((m) => applySubstitution(m, { slotId, outId, inId, minute: currentMinute(m, Date.now()), role }));
    showToast("Cambio registrado");
    setActionSlot(null);
  };

  const doMove = (slotId, targetSlotId) => {
    mutateMatch((m) => {
      const min = currentMinute(m, Date.now());
      const lineup = { ...m.lineup };
      const a = lineup[slotId];
      const b = lineup[targetSlotId];
      const roleA = formation.slots.find((s) => s.id === targetSlotId)?.role; // a's new role
      const roleB = formation.slots.find((s) => s.id === slotId)?.role; // b's new role
      const intervals = { ...m.intervals };
      const closeAndReopen = (pid, newRole) => {
        const arr = [...(intervals[pid] || [])];
        if (arr.length && arr[arr.length - 1].end == null) {
          arr[arr.length - 1] = { ...arr[arr.length - 1], end: min };
        }
        arr.push({ start: min, end: null, role: newRole });
        intervals[pid] = arr;
      };
      if (a) closeAndReopen(a, roleA);
      if (b) closeAndReopen(b, roleB);
      lineup[slotId] = b || null;
      if (b == null) delete lineup[slotId];
      if (a) lineup[targetSlotId] = a; else delete lineup[targetSlotId];
      return { ...m, lineup, intervals };
    });
    showToast("Posición actualizada");
    setActionSlot(null);
  };

  const handleCard = (type, playerId) => {
    const res = logCard(activeMatch, playerId, type, minute);
    mutateMatch(() => res.match);
    if (res.needsSub && res.subSlotId) {
      setActionSlot({ slotId: res.subSlotId, empty: true, forced: true, cardedId: playerId });
      showToast(type === "amarilla" ? "2ª amarilla: elige quién entra" : "Tarjeta azul: elige quién entra");
    } else {
      setActionSlot(null);
      showToast(type === "roja" ? "Expulsado: juegas con uno menos" : "Tarjeta registrada");
    }
  };

  const handleFormationChange = (key) => {
    setFormationOpen(false);
    if (key === activeMatch.formation) return;
    mutateMatch(() => changeFormation(activeMatch, key, minute));
    showToast(`Formación: ${key}`);
  };

  const handleFinish = (rivalGoalsFinal, notes, mvpVotes) => {
    const min = currentMinute(activeMatch, Date.now());
    let h1Seconds = activeMatch.h1Seconds;
    let h2Seconds = activeMatch.h2Seconds;
    if (activeMatch.runningSince) {
      const elapsed = (Date.now() - activeMatch.runningSince) / 1000;
      if (activeMatch.phase === "h1") h1Seconds += elapsed; else h2Seconds += elapsed;
    }
    const finalized = finalizeIntervals(activeMatch, min);
    const finalMatch = {
      ...finalized, h1Seconds, h2Seconds, runningSince: null,
      initialLineup: finalized.initialLineup || activeMatch.initialLineup || initialLineupOf(activeMatch),
      phase: "finalizado", rivalGoals: rivalGoalsFinal, notes, mvpVotes: mvpVotes || {}, finalMinute: min,
    };
    onFinishMatch(finalMatch);
    showToast("Partido guardado");
  };

  return (
    <div>
      <div className="fm-scoreboard">
        <div className="fm-sb-top">
          <span className="fm-sb-opponent">vs {activeMatch.opponent}{activeMatch.venue ? ` · ${activeMatch.venue}` : ""}</span>
          <span className="fm-sb-phase">{phaseLabel(activeMatch.phase)}</span>
        </div>
        <div className="fm-sb-main">
          <div className="fm-sb-score">
            <span className="fm-num">{goalsFor}</span><span className="vs">–</span><span className="fm-num">{activeMatch.rivalGoals}</span>
          </div>
          <button className="fm-play-btn" onClick={togglePlay} disabled={activeMatch.phase === "finalizado"}>
            {activeMatch.phase === "descanso" ? <Play size={22} /> : isRunning ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <div className="fm-sb-timer">
            <span className="fm-num">{timer.main}</span>
            {timer.added && <span className="added">{timer.added}</span>}
          </div>
        </div>
        <div className="fm-sb-controls">
          <div className="fm-sb-rival">
            <span style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 700, marginRight: 2 }}>Rival</span>
            <button className="fm-round-btn" onClick={() => rivalGoal(-1)}><Minus size={14} /></button>
            <button className="fm-round-btn" onClick={() => rivalGoal(1)}><Plus size={14} /></button>
          </div>
          {activeMatch.phase === "h1" && <button className="fm-chip" onClick={goToHalftime}><Pause size={13} /> Descanso</button>}
          <button className="fm-chip" onClick={() => setFormationOpen(true)}><Shirt size={14} /> {activeMatch.formation}</button>
          <button className="fm-chip" onClick={() => setOrderOpen(true)}><ArrowLeftRight size={14} /> Cambios</button>
          <button className="fm-chip" onClick={() => setNotesOpen(true)}><PenLine size={14} /> Notas</button>
        </div>
      </div>

      <div className="fm-section" style={{ paddingBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span className="fm-label" style={{ margin: 0 }}>Alineación · {formation.label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: sentOff > 0 ? "var(--card-red)" : "var(--ink-soft)" }}>
            {onField}/{formation.slots.length}
            {sentOff > 0 ? ` · ${sentOff} expulsado${sentOff > 1 ? "s" : ""}` : ""}
          </span>
        </div>
        <div className="fm-pitch-wrap">
          <PitchMarkings />
          {formation.slots.map((slot) => {
            const pid = activeMatch.lineup[slot.id];
            const player = playerById[pid];
            return (
              <button key={slot.id} className="fm-slot" style={{ left: `${slot.x}%`, top: `${slot.y}%` }} onClick={() => openSlotAction(slot.id)}>
                <div className={`fm-slot-badge ${player ? "filled" : ""}`}>
                  {player ? <span className="fm-num">{player.number}</span> : <Plus size={18} className="fm-slot-empty-icon" />}
                </div>
                <span className="fm-slot-label">{player ? lastNameShort(player.name) : ROLE_SHORT[slot.role]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="fm-bench">
        <span className="fm-label">Banquillo ({bench.length})</span>
        <div className="fm-bench-scroll">
          {bench.map((p) => (
            <div className="fm-bench-card" key={p.id}>
              <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
              <div className="fm-bench-name">{lastNameShort(p.name)}</div>
            </div>
          ))}
          {bench.length === 0 && <div style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "8px 0" }}>Sin suplentes disponibles</div>}
        </div>
        {suspended.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--card-red)", fontWeight: 700 }}>
            Sin poder jugar: {suspended.map((p) => lastNameShort(p.name)).join(", ")}
          </div>
        )}
      </div>

      <div className="fm-timeline">
        <span className="fm-label">Cronología</span>
        {[...activeMatch.events].reverse().map((ev) => (
          <TimelineRow key={ev.id} ev={ev} playerById={playerById} />
        ))}
        {activeMatch.events.length === 0 && <div style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "10px 0" }}>Todavía no hay eventos.</div>}
      </div>

      <div className="fm-section" style={{ paddingTop: 4 }}>
        <button className="fm-btn fm-btn-primary fm-btn-block" onClick={() => setFinishOpen(true)}>
          <Trophy size={17} /> Finalizar partido
        </button>
        <button className="fm-btn fm-btn-ghost fm-btn-block" style={{ marginTop: 8 }} onClick={() => setDiscardConfirm(true)}>
          Descartar partido
        </button>
      </div>

      {actionSlot && (
        <SlotActionSheet
          actionSlot={actionSlot}
          match={activeMatch}
          formation={formation}
          playerById={playerById}
          bench={bench}
          ordering={ordering}
          now={now}
          onGoal={logGoal}
          onSimple={logSimple}
          onCard={handleCard}
          onSub={doSubstitution}
          onMove={doMove}
          onAddPlayer={onAddPlayer}
          onClose={() => setActionSlot(null)}
        />
      )}

      {formationOpen && (
        <div className="fm-overlay" onClick={() => setFormationOpen(false)}>
          <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fm-sheet-handle" />
            <div className="fm-sheet-head">
              <div className="fm-sheet-title">Cambiar formación</div>
              <button className="fm-iconbtn" onClick={() => setFormationOpen(false)}><X size={18} /></button>
            </div>
            <div className="fm-sheet-body">
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 12, lineHeight: 1.45 }}>
                Se mantienen los mismos jugadores en el campo; se recolocan según la nueva formación.
              </div>
              {Object.keys(FORMATIONS).map((key) => (
                <div
                  key={key}
                  className={`fm-picker-row ${key === activeMatch.formation ? "leader" : ""}`}
                  onClick={() => handleFormationChange(key)}
                >
                  <span className="fm-num" style={{ fontSize: 20 }}>{key}</span>
                  <div style={{ flex: 1 }} />
                  {key === activeMatch.formation && <Check size={16} color="var(--accent-amber)" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {orderOpen && (
        <div className="fm-overlay" onClick={() => setOrderOpen(false)}>
          <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fm-sheet-handle" />
            <div className="fm-sheet-head">
              <div className="fm-sheet-title">Orden de cambios</div>
              <button className="fm-iconbtn" onClick={() => setOrderOpen(false)}><X size={18} /></button>
            </div>
            <div className="fm-sheet-body">
              <span className="fm-label">En el campo · más minutos jugados</span>
              {ordering.field.map(({ player, minutes }) => (
                <div key={player.id} className="fm-picker-row">
                  <div className="fm-shirt"><span className="fm-num">{player.number}</span></div>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{player.name}</div>
                  <span className="fm-num" style={{ fontSize: 18, color: "var(--ink-soft)" }}>{minutes}'</span>
                </div>
              ))}
              <span className="fm-label" style={{ marginTop: 16 }}>Banquillo · más tiempo esperando</span>
              {ordering.bench.map(({ player, minutes }) => (
                <div key={player.id} className="fm-picker-row">
                  <div className="fm-shirt"><span className="fm-num">{player.number}</span></div>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{player.name}</div>
                  <span className="fm-num" style={{ fontSize: 18, color: "var(--ink-soft)" }}>{minutes}'</span>
                </div>
              ))}
              {ordering.bench.length === 0 && <div className="fm-empty-text" style={{ padding: "12px 0" }}>Sin suplentes disponibles.</div>}
            </div>
          </div>
        </div>
      )}

      {finishOpen && (
        <FinishMatchModal
          match={activeMatch}
          goalsFor={goalsFor}
          playerById={playerById}
          onConfirm={handleFinish}
          onClose={() => setFinishOpen(false)}
        />
      )}

      {notesOpen && (
        <NotesSheet
          notes={activeMatch.notes}
          onSave={(n) => { mutateMatch((m) => ({ ...m, notes: n }), { skipUndo: true }); setNotesOpen(false); }}
          onClose={() => setNotesOpen(false)}
        />
      )}

      {discardConfirm && (
        <div className="fm-modal-center" onClick={() => setDiscardConfirm(false)}>
          <div className="fm-modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>¿Descartar este partido?</div>
            <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 18, lineHeight: 1.5 }}>
              Se perderán todos los eventos registrados. Esta acción no se puede deshacer.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="fm-btn fm-btn-ghost" style={{ flex: 1 }} onClick={() => setDiscardConfirm(false)}>Cancelar</button>
              <button className="fm-btn fm-btn-danger" style={{ flex: 1 }} onClick={onDiscardMatch}>Descartar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ ev, playerById }) {
  const vis = eventVisual(ev.type);
  let text = null;
  let sub = null;
  const nameOf = (id) => (playerById[id] ? playerById[id].name : "—");

  if (ev.type === "gol") {
    text = <><b>{nameOf(ev.playerId)}</b> marca un gol</>;
    if (ev.assistId) sub = `Asistencia de ${nameOf(ev.assistId)}`;
  } else if (ev.type === "asistencia") {
    text = <><b>{nameOf(ev.playerId)}</b> asistencia</>;
  } else if (ev.type === "parada") {
    text = <><b>{nameOf(ev.playerId)}</b> hace una parada</>;
  } else if (ev.type === "amarilla") {
    text = <><b>{nameOf(ev.playerId)}</b> ve tarjeta amarilla</>;
  } else if (ev.type === "roja") {
    text = <><b>{nameOf(ev.playerId)}</b> ve tarjeta roja</>;
  } else if (ev.type === "azul") {
    text = <><b>{nameOf(ev.playerId)}</b> ve tarjeta azul{ev.reason === "doble_amarilla" ? " (2ª amarilla)" : ""}</>;
  } else if (ev.type === "formacion") {
    text = <>Cambio de formación a <b>{ev.formation}</b></>;
  } else if (ev.type === "cambio") {
    text = ev.playerOutId
      ? <><b>{nameOf(ev.playerInId)}</b> entra por <b>{nameOf(ev.playerOutId)}</b></>
      : <><b>{nameOf(ev.playerInId)}</b> entra al campo</>;
  } else if (ev.type === "movimiento") {
    text = "Cambio de posición";
  } else if (ev.type === "gol_rival") {
    text = "Gol del rival";
  }

  return (
    <div className="fm-tl-item">
      <span className="fm-tl-min fm-num">{ev.minute}'</span>
      <div className="fm-tl-icon" style={{ background: vis.bg }}>
        {ev.type === "amarilla" || ev.type === "roja" || ev.type === "azul" ? (
          <div className="fm-cardshape" style={{ background: ev.type === "amarilla" ? "var(--card-yellow)" : ev.type === "roja" ? "var(--card-red)" : "var(--accent-sky)" }} />
        ) : (
          <vis.icon size={15} color={vis.color} />
        )}
      </div>
      <div>
        <div className="fm-tl-text">{text}</div>
        {sub && <div className="fm-tl-sub">{sub}</div>}
      </div>
    </div>
  );
}

function SlotActionSheet({ actionSlot, match, formation, playerById, bench, ordering, now, onGoal, onSimple, onCard, onSub, onMove, onAddPlayer, onClose }) {
  const [mode, setMode] = useState("menu"); // menu | assist | sub | move
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState(() => (Math.max(0, ...Object.values(playerById).map((p) => p.number)) || 0) + 1);
  const { slotId, playerId, empty } = actionSlot;
  const slot = formation.slots.find((s) => s.id === slotId);
  const player = playerId ? playerById[playerId] : null;
  const min = currentMinute(match, now);
  const minutesPlayed = playerId ? minutesForPlayer(match, playerId, min) : 0;

  if (empty) {
    const canFill = canFillEmptySlot(match, formation);
    const carded = actionSlot.cardedId ? playerById[actionSlot.cardedId] : null;
    const benchList = ordering ? ordering.bench : (bench || []).map((p) => ({ player: p, minutes: 0 }));
    return (
      <div className="fm-overlay" onClick={onClose}>
        <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="fm-sheet-handle" />
          <div className="fm-sheet-head">
            <div className="fm-sheet-title">
              {carded ? `Entra por ${lastNameShort(carded.name)}` : ROLE_LABEL[slot.role]}
            </div>
            <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="fm-sheet-body">
            {carded && (
              <div style={{ fontSize: 12.5, color: "var(--accent-sky)", marginBottom: 10, lineHeight: 1.45 }}>
                {lastNameShort(carded.name)} no puede seguir jugando (tarjeta azul). Elige al compañero que entra.
              </div>
            )}
            {!canFill ? (
              <div className="fm-empty-text" style={{ padding: "16px 0" }}>
                Jugador expulsado: el equipo juega con uno menos y no se puede sustituir.
              </div>
            ) : (
              <>
                <span className="fm-label">Hacer entrar desde el banquillo</span>
                {benchList.length === 0 && <div className="fm-empty-text" style={{ padding: "16px 0" }}>No quedan suplentes.</div>}
                {benchList.map(({ player: p, minutes }) => (
                  <div key={p.id} className="fm-picker-row" onClick={() => onSub(slotId, actionSlot.cardedId || null, p.id)}>
                    <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
                    <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>{p.name}</div>
                    {minutes > 0 && <span className="fm-num" style={{ fontSize: 17, color: "var(--ink-soft)" }}>{minutes}'</span>}
                    {p.guest && <span className="fm-guest-tag">Invitado</span>}
                  </div>
                ))}

                {onAddPlayer && (
                  addOpen ? (
                    <div style={{ paddingTop: 10, borderTop: "1px solid var(--hair)", marginTop: 6 }}>
                      <span className="fm-label">Nuevo jugador (viene un amigo a última hora)</span>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input className="fm-input" style={{ flex: 1 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre" autoFocus />
                        <input className="fm-input" style={{ width: 70 }} type="number" inputMode="numeric" value={newNumber} onChange={(e) => setNewNumber(parseInt(e.target.value || "0", 10))} />
                      </div>
                      <button
                        className="fm-btn fm-btn-primary fm-btn-block"
                        disabled={!newName.trim()}
                        onClick={() => {
                          const p = onAddPlayer({ name: newName.trim(), number: newNumber, guest: true });
                          onSub(slotId, actionSlot.cardedId || null, p.id);
                        }}
                      >
                        <UserPlus size={16} /> Añadir y hacer entrar
                      </button>
                    </div>
                  ) : (
                    <button className="fm-btn fm-btn-ghost fm-btn-block" style={{ marginTop: 6 }} onClick={() => setAddOpen(true)}>
                      <UserPlus size={16} /> Nuevo jugador
                    </button>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === "assist") {
    const others = Object.entries(match.lineup).filter(([sId, pid]) => pid !== playerId).map(([sId, pid]) => playerById[pid]).filter(Boolean);
    return (
      <div className="fm-overlay" onClick={onClose}>
        <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="fm-sheet-handle" />
          <div className="fm-sheet-head">
            <div className="fm-sheet-title">¿Asistencia?</div>
            <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="fm-sheet-body">
            <button className="fm-action-btn" style={{ marginBottom: 8 }} onClick={() => onGoal(playerId, null)}>
              <span className="fm-action-icon" style={{ background: "rgba(234,244,238,0.08)" }}><X size={16} /></span>
              Sin asistencia
            </button>
            {others.map((p) => (
              <div key={p.id} className="fm-picker-row" onClick={() => onGoal(playerId, p.id)}>
                <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
                <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (mode === "sub") {
    return (
      <div className="fm-overlay" onClick={onClose}>
        <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="fm-sheet-handle" />
          <div className="fm-sheet-head">
            <div>
              <div className="fm-sheet-title">Cambio: sale {lastNameShort(player.name)}</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{minutesPlayed}' en el campo · entra el que más tiempo lleva esperando</div>
            </div>
            <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="fm-sheet-body">
            {(ordering ? ordering.bench : (bench || []).map((player) => ({ player, minutes: 0 }))).length === 0 && (
              <div className="fm-empty-text" style={{ padding: "16px 0" }}>No quedan suplentes.</div>
            )}
            {(ordering ? ordering.bench : (bench || []).map((player) => ({ player, minutes: 0 }))).map(({ player: p, minutes }) => (
              <div key={p.id} className="fm-picker-row" onClick={() => onSub(slotId, playerId, p.id)}>
                <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
                <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>{p.name}</div>
                <span className="fm-num" style={{ fontSize: 17, color: "var(--ink-soft)" }}>{minutes}'</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (mode === "move") {
    const targets = formation.slots.filter((s) => s.id !== slotId);
    return (
      <div className="fm-overlay" onClick={onClose}>
        <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="fm-sheet-handle" />
          <div className="fm-sheet-head">
            <div className="fm-sheet-title">Mover a {player.name}</div>
            <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="fm-sheet-body">
            {targets.map((s) => {
              const occupantId = match.lineup[s.id];
              const occupant = occupantId ? playerById[occupantId] : null;
              return (
                <div key={s.id} className="fm-picker-row" onClick={() => onMove(slotId, s.id)}>
                  <span className={`fm-badge-role role-${s.role}`}>{ROLE_SHORT[s.role]}</span>
                  <div style={{ flex: 1, fontSize: 14 }}>
                    {occupant ? <><b>{occupant.name}</b> · posición libre tras el cambio</> : "Posición vacía"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div>
            <div className="fm-sheet-title">{player.name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{ROLE_LABEL[slot.role]} · {minutesPlayed}' jugados</div>
          </div>
          <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fm-sheet-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="fm-action-btn" onClick={() => setMode("assist")}>
            <span className="fm-action-icon" style={{ background: "rgba(242,169,59,0.15)" }}><Target size={17} color="var(--accent-amber)" /></span>
            Gol
          </button>
          <button className="fm-action-btn" onClick={() => onSimple("asistencia", playerId)}>
            <span className="fm-action-icon" style={{ background: "rgba(79,169,232,0.15)" }}><Send size={17} color="var(--accent-sky)" /></span>
            Asistencia
          </button>
          {slot.role === "POR" && (
            <button className="fm-action-btn" onClick={() => onSimple("parada", playerId)}>
              <span className="fm-action-icon" style={{ background: "rgba(143,182,162,0.15)" }}><Hand size={17} color="var(--pitch-line)" /></span>
              Parada
            </button>
          )}
          <button className="fm-action-btn" onClick={() => onCard("amarilla", playerId)}>
            <span className="fm-action-icon" style={{ background: "rgba(245,197,24,0.15)" }}><div className="fm-cardshape" style={{ background: "var(--card-yellow)" }} /></span>
            {yellowCount(match, playerId) >= 1 ? "Tarjeta amarilla (2ª = azul)" : "Tarjeta amarilla"}
          </button>
          <button className="fm-action-btn" onClick={() => onCard("roja", playerId)}>
            <span className="fm-action-icon" style={{ background: "rgba(228,72,60,0.15)" }}><div className="fm-cardshape" style={{ background: "var(--card-red)" }} /></span>
            Tarjeta roja
          </button>
          <button className="fm-action-btn" onClick={() => onCard("azul", playerId)}>
            <span className="fm-action-icon" style={{ background: "rgba(79,169,232,0.15)" }}><div className="fm-cardshape" style={{ background: "var(--accent-sky)" }} /></span>
            Tarjeta azul (sustituir)
          </button>
          <button className="fm-action-btn" onClick={() => setMode("sub")}>
            <span className="fm-action-icon" style={{ background: "rgba(234,244,238,0.08)" }}><ArrowLeftRight size={17} /></span>
            Sustituir por el banquillo
          </button>
          <button className="fm-action-btn" onClick={() => setMode("move")}>
            <span className="fm-action-icon" style={{ background: "rgba(234,244,238,0.08)" }}><Shirt size={17} /></span>
            Mover de posición
          </button>
        </div>
      </div>
    </div>
  );
}

function NotesSheet({ notes, onSave, onClose }) {
  const [text, setText] = useState(notes || "");
  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div className="fm-sheet-title">Notas del partido</div>
          <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fm-sheet-body">
          <textarea className="fm-input fm-textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Anotaciones tácticas, para el descanso, para después del partido…" autoFocus />
        </div>
        <div className="fm-sheet-actions">
          <button className="fm-btn fm-btn-primary fm-btn-block" onClick={() => onSave(text)}><Check size={17} /> Guardar notas</button>
        </div>
      </div>
    </div>
  );
}

function MvpVoting({ playerIds, playerById, votes, onChange }) {
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(0, ...Object.values(votes));
  const sorted = [...playerIds]
    .filter((id) => playerById[id])
    .sort((a, b) => (votes[b] || 0) - (votes[a] || 0) || playerById[a].name.localeCompare(playerById[b].name));

  const bump = (id, delta) => {
    const next = { ...votes };
    const v = Math.max(0, (next[id] || 0) + delta);
    if (v === 0) delete next[id]; else next[id] = v;
    onChange(next);
  };

  if (sorted.length === 0) {
    return <div className="fm-mvp-empty">No hay jugadores que hayan disputado minutos en este partido.</div>;
  }

  return (
    <div>
      {sorted.map((id) => {
        const p = playerById[id];
        const count = votes[id] || 0;
        const isLeader = maxVotes > 0 && count === maxVotes;
        return (
          <div key={id} className={`fm-mvp-row ${isLeader ? "leader" : ""}`}>
            <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
            <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>
              {p.name}
              {isLeader && <Star size={13} color="var(--accent-amber)" style={{ marginLeft: 6, verticalAlign: -2 }} fill="var(--accent-amber)" />}
            </div>
            <button className="fm-round-btn" onClick={() => bump(id, -1)}><Minus size={14} /></button>
            <span className="fm-mvp-count">{count}</span>
            <button className="fm-round-btn" onClick={() => bump(id, 1)}><Plus size={14} /></button>
          </div>
        );
      })}
      {totalVotes > 0 && (
        <div style={{ fontSize: 11.5, color: "var(--ink-soft)", padding: "10px 2px 0" }}>{totalVotes} voto{totalVotes > 1 ? "s" : ""} registrado{totalVotes > 1 ? "s" : ""}</div>
      )}
    </div>
  );
}

function FinishMatchModal({ match, goalsFor, playerById, onConfirm, onClose }) {
  const [rivalGoals, setRivalGoals] = useState(match.rivalGoals);
  const [notes, setNotes] = useState(match.notes || "");
  const [mvpVotes, setMvpVotes] = useState(match.mvpVotes || {});
  const playerIds = Object.keys(match.intervals || {});
  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div className="fm-sheet-title">Finalizar partido</div>
          <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fm-sheet-body">
          <div style={{ textAlign: "center", margin: "6px 0 18px" }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6 }}>vs {match.opponent}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <span className="fm-num" style={{ fontSize: 42 }}>{goalsFor}</span>
              <span style={{ color: "var(--ink-faint)" }}>–</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button className="fm-round-btn" onClick={() => setRivalGoals((v) => Math.max(0, v - 1))}><Minus size={14} /></button>
                <span className="fm-num" style={{ fontSize: 42, minWidth: 30, textAlign: "center" }}>{rivalGoals}</span>
                <button className="fm-round-btn" onClick={() => setRivalGoals((v) => v + 1)}><Plus size={14} /></button>
              </div>
            </div>
          </div>

          <span className="fm-label">Notas finales (opcional)</span>
          <textarea className="fm-input fm-textarea" style={{ marginBottom: 18 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Resumen, aspectos a mejorar…" />

          <span className="fm-label"><Star size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Votación MVP (opcional — puedes completarla más tarde desde el historial)</span>
          <MvpVoting playerIds={playerIds} playerById={playerById} votes={mvpVotes} onChange={setMvpVotes} />
        </div>
        <div className="fm-sheet-actions">
          <button className="fm-btn fm-btn-primary fm-btn-block" onClick={() => onConfirm(rivalGoals, notes, mvpVotes)}>
            <Trophy size={17} /> Guardar resultado
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   HISTORIAL TAB
============================================================================ */

function HistorialTab({ history, squad, onDelete, onUpdateMatch, showToast }) {
  const [openMatchId, setOpenMatchId] = useState(null);
  const playerById = useMemo(() => Object.fromEntries(squad.map((p) => [p.id, p])), [squad]);
  const openMatch = history.find((m) => m.id === openMatchId) || null;

  if (history.length === 0) {
    return (
      <div className="fm-section">
        <div className="fm-empty">
          <ClipboardList size={34} />
          <div className="fm-empty-title">Todavía no hay partidos</div>
          <div className="fm-empty-text">Cuando termines un partido aparecerá aquí, con goles, cambios y minutos jugados.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fm-section">
      {history.map((m) => {
        const goalsFor = m.events.filter((e) => e.type === "gol").length;
        const result = goalsFor > m.rivalGoals ? "win" : goalsFor === m.rivalGoals ? "draw" : "loss";
        const color = result === "win" ? "var(--accent-amber)" : result === "draw" ? "var(--ink-soft)" : "var(--card-red)";
        return (
          <div key={m.id} className="fm-match-card" onClick={() => setOpenMatchId(m.id)}>
            <div className="fm-match-top">
              <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 700 }}>{formatDateEs(m.date)}</span>
              <span className="fm-result-tag" style={{ background: color }} />
            </div>
            <div className="fm-row">
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>vs {m.opponent}</span>
              <span className="fm-match-score">{goalsFor} – {m.rivalGoals}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2 }}>{m.formation}{m.venue ? ` · ${m.venue}` : ""}</div>
          </div>
        );
      })}

      {openMatch && (
        <MatchDetailSheet
          match={openMatch}
          playerById={playerById}
          onUpdateVotes={(votes) => onUpdateMatch(openMatch.id, (m) => ({ ...m, mvpVotes: votes }))}
          onDelete={() => { onDelete(openMatch.id); setOpenMatchId(null); showToast("Partido eliminado"); }}
          onClose={() => setOpenMatchId(null)}
        />
      )}
    </div>
  );
}

function buildShareText(match, playerById) {
  const goalsFor = match.events.filter((e) => e.type === "gol").length;
  let text = `⚽ ${match.opponent}\n${formatDateEs(match.date)}\nResultado: ${goalsFor} – ${match.rivalGoals}\n\n`;
  const goals = match.events.filter((e) => e.type === "gol");
  if (goals.length) {
    text += "Goles:\n";
    goals.forEach((g) => {
      const scorer = playerById[g.playerId]?.name || "?";
      const assist = g.assistId ? ` (asist. ${playerById[g.assistId]?.name})` : "";
      text += `- ${g.minute}' ${scorer}${assist}\n`;
    });
  }
  const cards = match.events.filter((e) => e.type === "amarilla" || e.type === "roja");
  if (cards.length) {
    text += "\nTarjetas:\n";
    cards.forEach((c) => { text += `- ${c.minute}' ${playerById[c.playerId]?.name || "?"} (${c.type === "amarilla" ? "amarilla" : "roja"})\n`; });
  }
  if (match.mvpVotes && Object.keys(match.mvpVotes).length > 0) {
    const max = Math.max(...Object.values(match.mvpVotes));
    const leaders = Object.entries(match.mvpVotes).filter(([, v]) => v === max).map(([id]) => playerById[id]?.name).filter(Boolean);
    if (leaders.length) text += `\n⭐ MVP: ${leaders.join(" / ")}\n`;
  }
  if (match.notes) text += `\nNotas: ${match.notes}\n`;
  return text;
}

function MatchDetailSheet({ match, playerById, onUpdateVotes, onDelete, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const goalsFor = match.events.filter((e) => e.type === "gol").length;
  const formation = FORMATIONS[match.formation];
  const initialLineup = initialLineupOf(match);

  const share = async () => {
    const text = buildShareText(match, playerById);
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch (e) { /* fall through to clipboard */ }
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) { /* ignore */ }
  };

  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div>
            <div className="fm-sheet-title">vs {match.opponent}</div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{formatDateEs(match.date)} · {match.formation}</div>
          </div>
          <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fm-sheet-body">
          <div style={{ textAlign: "center", margin: "6px 0 16px" }}>
            <span className="fm-num" style={{ fontSize: 40 }}>{goalsFor} – {match.rivalGoals}</span>
          </div>

          <div style={{ marginBottom: 18 }}>
            <span className="fm-label">Alineación titular</span>
            {formation.slots.map((s) => {
              const p = playerById[initialLineup[s.id]];
              if (!p) return null;
              return (
                <div key={s.id} className="fm-tl-item" style={{ padding: "7px 0" }}>
                  <span className={`fm-badge-role role-${s.role}`}>{ROLE_SHORT[s.role]}</span>
                  <div className="fm-tl-text">{p.name} <span style={{ color: "var(--ink-faint)" }}>#{p.number}</span></div>
                </div>
              );
            })}
          </div>

          <span className="fm-label">Cronología</span>
          {eventsByMinute(match.events).map((ev) => <TimelineRow key={ev.id} ev={ev} playerById={playerById} />)}
          {match.events.length === 0 && <div className="fm-empty-text" style={{ padding: "8px 0 18px" }}>Sin eventos registrados.</div>}

          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <span className="fm-label"><Star size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Votación MVP</span>
            <MvpVoting
              playerIds={Object.keys(match.intervals || {})}
              playerById={playerById}
              votes={match.mvpVotes || {}}
              onChange={onUpdateVotes}
            />
          </div>

          {match.notes && (
            <div style={{ marginTop: 8 }}>
              <span className="fm-label">Notas</span>
              <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--pitch-line)" }}>{match.notes}</div>
            </div>
          )}
        </div>
        <div className="fm-sheet-actions">
          <button className="fm-btn fm-btn-primary fm-btn-block" onClick={share}><Share2 size={16} /> Compartir resumen</button>
          {confirmDelete ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="fm-btn fm-btn-danger" style={{ flex: 1 }} onClick={onDelete}>Confirmar eliminación</button>
              <button className="fm-btn fm-btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Cancelar</button>
            </div>
          ) : (
            <button className="fm-btn fm-btn-ghost fm-btn-block" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Eliminar partido</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   TEMPORADA TAB
============================================================================ */

function TemporadaTab({ history, squad }) {
  const [metric, setMetric] = useState("goles");

  const playerById = useMemo(() => Object.fromEntries(squad.map((p) => [p.id, p])), [squad]);

  const emptyStat = (player) => ({
    player, partidos: 0, goles: 0, asistencias: 0, paradas: 0, amarillas: 0, rojas: 0,
    minutos: 0, minutosPorRol: { POR: 0, DEF: 0, MED: 0, DEL: 0 }, mvpAwards: 0, mvpVotesTotal: 0,
    amarillas: 0, rojas: 0, azules: 0,
  });

  const stats = useMemo(() => {
    const map = {};
    squad.forEach((p) => { map[p.id] = emptyStat(p); });
    history.forEach((m) => {
      const playedIds = new Set();
      const finalMin = m.finalMinute || currentMinute(m, Date.now());
      Object.entries(m.intervals || {}).forEach(([pid, intervals]) => {
        if (!map[pid]) map[pid] = emptyStat(playerById[pid] || { name: "Desconocido", number: "?" });
        intervals.forEach((iv) => {
          const end = iv.end == null ? finalMin : iv.end;
          const dur = Math.max(0, end - iv.start);
          if (dur > 0) playedIds.add(pid);
          map[pid].minutos += dur;
          const role = iv.role && map[pid].minutosPorRol[iv.role] != null ? iv.role : "DEF";
          map[pid].minutosPorRol[role] += dur;
        });
      });
      playedIds.forEach((pid) => { if (map[pid]) map[pid].partidos += 1; });
      m.events.forEach((ev) => {
        if (!map[ev.playerId] && ev.playerId) map[ev.playerId] = emptyStat(playerById[ev.playerId] || { name: "Desconocido", number: "?" });
        if (ev.type === "gol") {
          map[ev.playerId].goles += 1;
          if (ev.assistId) { if (!map[ev.assistId]) map[ev.assistId] = emptyStat(playerById[ev.assistId] || { name: "Desconocido", number: "?" }); map[ev.assistId].asistencias += 1; }
        } else if (ev.type === "asistencia") map[ev.playerId].asistencias += 1;
        else if (ev.type === "parada") map[ev.playerId].paradas += 1;
        else if (ev.type === "amarilla") map[ev.playerId].amarillas += 1;
        else if (ev.type === "roja") map[ev.playerId].rojas += 1;
        else if (ev.type === "azul") map[ev.playerId].azules += 1;
      });
      const votes = m.mvpVotes || {};
      const voteVals = Object.values(votes);
      if (voteVals.length > 0) {
        const max = Math.max(...voteVals);
        Object.entries(votes).forEach(([pid, count]) => {
          if (!map[pid]) map[pid] = emptyStat(playerById[pid] || { name: "Desconocido", number: "?" });
          map[pid].mvpVotesTotal += count;
          if (count === max) map[pid].mvpAwards += 1;
        });
      }
    });
    return Object.values(map)
      .map((s) => ({ ...s, sanciones: s.amarillas + s.rojas + s.azules }))
      .sort((a, b) => b.goles - a.goles || b.asistencias - a.asistencias);
  }, [history, squad, playerById]);

  const record = useMemo(() => {
    let w = 0, d = 0, l = 0, gf = 0, ga = 0;
    history.forEach((m) => {
      const goalsFor = m.events.filter((e) => e.type === "gol").length;
      gf += goalsFor; ga += m.rivalGoals;
      if (goalsFor > m.rivalGoals) w += 1; else if (goalsFor === m.rivalGoals) d += 1; else l += 1;
    });
    return { w, d, l, gf, ga };
  }, [history]);

  const chartData = useMemo(() => {
    return [...stats]
      .filter((s) => s[metric] > 0)
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, 8)
      .map((s) => ({ name: lastNameShort(s.player.name), value: s[metric] }));
  }, [stats, metric]);

  const positionChartData = useMemo(() => {
    return [...stats]
      .filter((s) => s.minutos > 0)
      .sort((a, b) => b.minutos - a.minutos)
      .slice(0, 8)
      .map((s) => ({
        name: lastNameShort(s.player.name),
        POR: s.minutosPorRol.POR, DEF: s.minutosPorRol.DEF, MED: s.minutosPorRol.MED, DEL: s.minutosPorRol.DEL,
      }));
  }, [stats]);

  if (history.length === 0) {
    return (
      <div className="fm-section">
        <div className="fm-empty">
          <BarChart3 size={34} />
          <div className="fm-empty-title">Aún sin estadísticas</div>
          <div className="fm-empty-text">Las estadísticas de temporada se calculan a partir de los partidos finalizados.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fm-section">
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <SeasonStatBox label="Jugados" value={history.length} />
        <SeasonStatBox label="G / E / P" value={`${record.w}/${record.d}/${record.l}`} />
        <SeasonStatBox label="Goles" value={`${record.gf}:${record.ga}`} />
      </div>

      <span className="fm-label">Ranking</span>
      <div className="fm-segmented" style={{ marginBottom: 12 }}>
        {[["goles", "Goles"], ["asistencias", "Asist."], ["minutos", "Minutos"], ["paradas", "Paradas"], ["mvpAwards", "MVP"], ["sanciones", "Tarjetas"]].map(([k, l]) => (
          <button key={k} className={metric === k ? "active" : ""} onClick={() => setMetric(k)}>{l}</button>
        ))}
      </div>

      {chartData.length > 0 ? (
        <div style={{ height: 220, marginBottom: 26 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(234,244,238,0.08)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#C7E2D6", fontSize: 11.5 }} axisLine={{ stroke: "rgba(234,244,238,0.15)" }} tickLine={false} />
              <YAxis tick={{ fill: "#C7E2D6", fontSize: 11.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0A1812", border: "1px solid rgba(234,244,238,0.28)", borderRadius: 8, fontSize: 12.5 }} labelStyle={{ color: "#F2FAF5" }} cursor={{ fill: "rgba(234,244,238,0.08)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill="#F5B23F" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="fm-empty-text" style={{ padding: "18px 0 22px" }}>Todavía no hay datos para esta categoría.</div>
      )}

      <span className="fm-label">Minutos por posición</span>
      {positionChartData.length > 0 ? (
        <>
          <div style={{ height: 240, marginBottom: 6 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={positionChartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(234,244,238,0.08)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#C7E2D6", fontSize: 11.5 }} axisLine={{ stroke: "rgba(234,244,238,0.15)" }} tickLine={false} />
                <YAxis tick={{ fill: "#C7E2D6", fontSize: 11.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#153A2C", border: "1px solid rgba(234,244,238,0.18)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#F2FAF5" }} cursor={{ fill: "rgba(234,244,238,0.06)" }} />
                <Bar dataKey="POR" stackId="pos" fill="#F5B23F" radius={[0, 0, 0, 0]} />
                <Bar dataKey="DEF" stackId="pos" fill="#5DB6F0" />
                <Bar dataKey="MED" stackId="pos" fill="#9FD8BE" />
                <Bar dataKey="DEL" stackId="pos" fill="#FF8A7E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
            {[["POR", "#F5B23F"], ["DEF", "#5DB6F0"], ["MED", "#9FD8BE"], ["DEL", "#FF8A7E"]].map(([r, c]) => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-soft)", fontWeight: 700 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: c, display: "inline-block" }} />
                {ROLE_LABEL[r]}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="fm-empty-text" style={{ padding: "18px 0 22px" }}>Todavía no hay minutos registrados.</div>
      )}

      <span className="fm-label">Tabla completa</span>
      <div style={{ overflowX: "auto" }}>
        <table className="fm-stat-table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th className="num">PJ</th>
              <th className="num">G</th>
              <th className="num">A</th>
              <th className="num">Par.</th>
              <th className="num">TA</th>
              <th className="num">TR</th>
              <th className="num">AZ</th>
              <th className="num">Min</th>
              <th className="num">MVP</th>
            </tr>
          </thead>
          <tbody>
            {stats.filter((s) => s.partidos > 0 || s.goles || s.asistencias || s.paradas || s.amarillas || s.rojas || s.azules).map((s) => (
              <tr key={s.player.id || s.player.name}>
                <td>{s.player.name}</td>
                <td className="num">{s.partidos}</td>
                <td className="num">{s.goles}</td>
                <td className="num">{s.asistencias}</td>
                <td className="num">{s.paradas}</td>
                <td className="num">{s.amarillas}</td>
                <td className="num">{s.rojas}</td>
                <td className="num" style={{ color: s.azules > 0 ? "var(--accent-sky)" : undefined }}>{s.azules}</td>
                <td className="num">{s.minutos}</td>
                <td className="num">{s.mvpAwards > 0 ? `★${s.mvpAwards}` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeasonStatBox({ label, value }) {
  return (
    <div style={{ flex: 1, background: "var(--pitch-mid)", border: "1px solid var(--hair-strong)", borderRadius: 12, padding: "10px 4px", textAlign: "center" }}>
      <div className="fm-num" style={{ fontSize: 22 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--ink-soft)", fontWeight: 700, marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* ============================================================================
   PIZARRA TAB (tactics whiteboard)
============================================================================ */

const BOARD_COLORS = [
  { id: "chalk", value: "#EAF4EE" },
  { id: "amber", value: "#F2A93B" },
  { id: "sky", value: "#4FA9E8" },
  { id: "red", value: "#E4483C" },
];

function pctFromPointer(e, el) {
  const rect = el.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

function drawPitchOnCanvas(ctx, w, h) {
  const line = "rgba(234,244,238,0.18)";
  ctx.save();
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1, w * 0.003);
  ctx.strokeRect(w * 0.03, h * 0.02, w * 0.94, h * 0.96);
  ctx.beginPath();
  ctx.moveTo(w * 0.03, h * 0.5);
  ctx.lineTo(w * 0.97, h * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, w * 0.13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, w * 0.008, 0, Math.PI * 2);
  ctx.fillStyle = line;
  ctx.fill();
  ctx.strokeRect(w * 0.25, h * 0.02, w * 0.5, h * 0.12);
  ctx.strokeRect(w * 0.25, h * 0.86, w * 0.5, h * 0.12);
  ctx.strokeRect(w * 0.38, h * 0.02, w * 0.24, h * 0.05);
  ctx.strokeRect(w * 0.38, h * 0.93, w * 0.24, h * 0.05);
  ctx.restore();
}

function drawArrowhead(ctx, x1, y1, x2, y2, size, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 7), y2 - size * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 7), y2 - size * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStroke(ctx, w, h, stroke) {
  if (stroke.type === "pen") {
    if (stroke.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(2, w * 0.007);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    stroke.points.forEach((p, i) => {
      const px = (p.x / 100) * w, py = (p.y / 100) * h;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  } else if (stroke.type === "arrow") {
    const x1 = (stroke.x1 / 100) * w, y1 = (stroke.y1 / 100) * h;
    const x2 = (stroke.x2 / 100) * w, y2 = (stroke.y2 / 100) * h;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(2, w * 0.007);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
    drawArrowhead(ctx, x1, y1, x2, y2, Math.max(10, w * 0.03), stroke.color);
  } else if (stroke.type === "token") {
    const cx = (stroke.x / 100) * w, cy = (stroke.y / 100) * h;
    const r = Math.max(14, w * 0.045);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = stroke.kind === "ball" ? "#EAF4EE" : "#0E2019";
    ctx.fill();
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.strokeStyle = stroke.color;
    ctx.stroke();
    if (stroke.label) {
      ctx.fillStyle = stroke.kind === "ball" ? "#0E2019" : "#FFFFFF";
      ctx.font = `800 ${Math.round(r * 0.95)}px Manrope, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(stroke.label, cx, cy + 1);
    }
    ctx.restore();
  }
}

function PizarraTab({ squad, boards, onChange, showToast }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [strokes, setStrokes] = useState([]);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(BOARD_COLORS[0].value);
  const [selectedToken, setSelectedToken] = useState(null); // {kind:'player'|'ball'|'rival', id, label}
  const [boardId, setBoardId] = useState(null);
  const [boardName, setBoardName] = useState("Pizarra sin guardar");
  const [dirty, setDirty] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  const dragRef = useRef(null); // { type, points/x1,y1 }
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const redraw = useCallback((strokeList) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(sizeRef.current.dpr, sizeRef.current.dpr);
    drawPitchOnCanvas(ctx, w, h);
    strokeList.forEach((s) => drawStroke(ctx, w, h, s));
    ctx.restore();
  }, []);

  const resize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    sizeRef.current = { w: rect.width, h: rect.height, dpr };
    redraw(strokes);
  }, [redraw, strokes]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("orientationchange", resize);
    return () => { ro.disconnect(); window.removeEventListener("orientationchange", resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { redraw(strokes); }, [strokes, redraw]);

  const commitStroke = (stroke) => {
    setStrokes((prev) => [...prev, stroke]);
    setDirty(true);
  };

  const onPointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pctFromPointer(e, canvas);

    if (tool === "token") {
      if (!selectedToken) { showToast("Elige antes un jugador, balón o rival"); return; }
      commitStroke({ id: uid("s"), type: "token", kind: selectedToken.kind, label: selectedToken.label, color, x, y });
      return;
    }
    if (tool === "eraser") {
      eraseNear(x, y);
      return;
    }
    if (tool === "pen") {
      dragRef.current = { type: "pen", points: [{ x, y }] };
    } else if (tool === "arrow") {
      dragRef.current = { type: "arrow", x1: x, y1: y, x2: x, y2: y };
    }
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    const { x, y } = pctFromPointer(e, canvas);
    if (dragRef.current.type === "pen") {
      dragRef.current.points.push({ x, y });
      redraw(strokes);
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.scale(sizeRef.current.dpr, sizeRef.current.dpr);
      drawStroke(ctx, sizeRef.current.w, sizeRef.current.h, { type: "pen", color, points: dragRef.current.points });
      ctx.restore();
    } else if (dragRef.current.type === "arrow") {
      dragRef.current.x2 = x; dragRef.current.y2 = y;
      redraw(strokes);
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.scale(sizeRef.current.dpr, sizeRef.current.dpr);
      drawStroke(ctx, sizeRef.current.w, sizeRef.current.h, { type: "arrow", color, ...dragRef.current });
      ctx.restore();
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.type === "pen" && drag.points.length > 1) {
      commitStroke({ id: uid("s"), type: "pen", color, points: drag.points });
    } else if (drag.type === "arrow") {
      const dist = Math.hypot(drag.x2 - drag.x1, drag.y2 - drag.y1);
      if (dist > 2) commitStroke({ id: uid("s"), type: "arrow", color, x1: drag.x1, y1: drag.y1, x2: drag.x2, y2: drag.y2 });
      else redraw(strokes);
    } else {
      redraw(strokes);
    }
  };

  const eraseNear = (x, y) => {
    let bestIdx = -1, bestDist = 6; // tolerance in % units
    strokes.forEach((s, i) => {
      let d = Infinity;
      if (s.type === "token") d = Math.hypot(s.x - x, s.y - y);
      else if (s.type === "arrow") d = distToSegment(x, y, s.x1, s.y1, s.x2, s.y2);
      else if (s.type === "pen") d = Math.min(...s.points.map((p) => Math.hypot(p.x - x, p.y - y)));
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    if (bestIdx >= 0) {
      setStrokes((prev) => prev.filter((_, i) => i !== bestIdx));
      setDirty(true);
    }
  };

  const undo = () => {
    if (strokes.length === 0) return;
    setStrokes((prev) => prev.slice(0, -1));
    setDirty(true);
  };

  const startNewBoard = () => {
    setStrokes([]); setBoardId(null); setBoardName("Pizarra sin guardar"); setDirty(false); setClearConfirm(false);
  };

  const saveBoard = (name) => {
    if (boardId) {
      const next = boards.map((b) => (b.id === boardId ? { ...b, name, strokes, updatedAt: Date.now() } : b));
      onChange(next);
    } else {
      const nb = { id: uid("board"), name, strokes, updatedAt: Date.now() };
      onChange([nb, ...boards]);
      setBoardId(nb.id);
    }
    setBoardName(name);
    setDirty(false);
    setSaveOpen(false);
    showToast("Pizarra guardada");
  };

  const loadBoard = (b) => {
    setStrokes(b.strokes || []);
    setBoardId(b.id);
    setBoardName(b.name);
    setDirty(false);
    setListOpen(false);
    showToast(`Pizarra "${b.name}" cargada`);
  };

  const deleteBoard = (id) => {
    onChange(boards.filter((b) => b.id !== id));
    if (id === boardId) startNewBoard();
  };

  const tools = [
    { id: "pen", icon: PenLine, label: "Bolígrafo" },
    { id: "arrow", icon: ArrowRight, label: "Flecha" },
    { id: "token", icon: Circle, label: "Jugador" },
    { id: "eraser", icon: Eraser, label: "Borrar" },
  ];

  return (
    <div className="fm-section">
      <div className="fm-row" style={{ marginBottom: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{boardName}{dirty ? " ·" : ""}</span>
        {dirty && <span style={{ fontSize: 11, color: "var(--accent-amber)", fontWeight: 700 }}>Sin guardar</span>}
      </div>

      <div className="fm-board-toolbar">
        {tools.map((t) => (
          <button key={t.id} className={`fm-tool-btn ${tool === t.id ? "active" : ""}`} onClick={() => setTool(t.id)} aria-label={t.label}>
            <t.icon size={19} />
          </button>
        ))}
        <button className="fm-tool-btn" onClick={undo} aria-label="Deshacer"><RotateCcw size={19} /></button>
        <button className="fm-tool-btn" onClick={() => setClearConfirm(true)} aria-label="Borrar todo"><Trash2 size={19} /></button>
      </div>

      <div className="fm-color-row">
        {BOARD_COLORS.map((c) => (
          <button key={c.id} className={`fm-color-dot ${color === c.value ? "active" : ""}`} style={{ background: c.value }} onClick={() => setColor(c.value)} aria-label={c.id} />
        ))}
      </div>

      {tool === "token" && (
        <div className="fm-token-row">
          <button className={`fm-token-chip ${selectedToken?.kind === "ball" ? "active" : ""}`} onClick={() => setSelectedToken({ kind: "ball", label: "" })}>
            <div className="fm-shirt" style={{ background: "#EAF4EE" }} />
            <span className="fm-token-chip-label">Balón</span>
          </button>
          <button className={`fm-token-chip ${selectedToken?.kind === "rival" ? "active" : ""}`} onClick={() => setSelectedToken({ kind: "rival", label: "X" })}>
            <div className="fm-shirt"><span className="fm-num" style={{ color: "var(--card-red)" }}>X</span></div>
            <span className="fm-token-chip-label">Rival</span>
          </button>
          {[...squad].sort((a, b) => a.number - b.number).map((p) => (
            <button key={p.id} className={`fm-token-chip ${selectedToken?.id === p.id ? "active" : ""}`} onClick={() => setSelectedToken({ kind: "player", id: p.id, label: String(p.number) })}>
              <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
              <span className="fm-token-chip-label">{lastNameShort(p.name)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="fm-board-wrap" ref={wrapRef} style={{ marginTop: 10 }}>
        <canvas
          ref={canvasRef}
          className="fm-board-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="fm-btn fm-btn-primary" style={{ flex: 1 }} onClick={() => setSaveOpen(true)}>
          <Save size={16} /> Guardar
        </button>
        <button className="fm-btn fm-btn-ghost" style={{ flex: 1 }} onClick={() => setListOpen(true)}>
          <FolderOpen size={16} /> Cargar
        </button>
        <button className="fm-btn fm-btn-ghost" style={{ flex: 1 }} onClick={startNewBoard}>
          <Plus size={16} /> Nueva
        </button>
      </div>

      {saveOpen && (
        <SaveBoardSheet initialName={boardId ? boardName : ""} onSave={saveBoard} onClose={() => setSaveOpen(false)} />
      )}

      {listOpen && (
        <BoardListSheet boards={boards} onLoad={loadBoard} onDelete={deleteBoard} onClose={() => setListOpen(false)} />
      )}

      {clearConfirm && (
        <div className="fm-modal-center" onClick={() => setClearConfirm(false)}>
          <div className="fm-modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>¿Borrar todo el dibujo?</div>
            <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 18, lineHeight: 1.5 }}>
              Se borrará lo dibujado en esta pizarra. Si la habías guardado, no se modificará hasta que pulses "Guardar" de nuevo.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="fm-btn fm-btn-ghost" style={{ flex: 1 }} onClick={() => setClearConfirm(false)}>Cancelar</button>
              <button className="fm-btn fm-btn-danger" style={{ flex: 1 }} onClick={() => { setStrokes([]); setDirty(true); setClearConfirm(false); }}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function SaveBoardSheet({ initialName, onSave, onClose }) {
  const [name, setName] = useState(initialName || "");
  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div className="fm-sheet-title">Guardar pizarra</div>
          <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fm-sheet-body">
          <span className="fm-label">Nombre</span>
          <input className="fm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Saque de banda ofensivo" autoFocus />
        </div>
        <div className="fm-sheet-actions">
          <button className="fm-btn fm-btn-primary fm-btn-block" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
            <Check size={17} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function BoardListSheet({ boards, onLoad, onDelete, onClose }) {
  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div className="fm-sheet-title">Pizarras guardadas</div>
          <button className="fm-iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="fm-sheet-body">
          {boards.length === 0 && <div className="fm-empty-text" style={{ padding: "16px 0" }}>Aún no has guardado ninguna pizarra.</div>}
          {boards.map((b) => (
            <div key={b.id} className="fm-picker-row">
              <div style={{ flex: 1 }} onClick={() => onLoad(b)}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{b.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{b.strokes?.length || 0} elementos</div>
              </div>
              <button className="fm-iconbtn" onClick={() => onDelete(b.id)}><Trash2 size={16} color="var(--card-red)" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
