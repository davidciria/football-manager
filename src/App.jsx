import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
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
  logCard, applySubstitution, changeFormation, subOrdering, swapPlayers,
  initialLineupOf, outPlayers, canFillEmptySlot, onFieldCount, redCount, yellowCount,
  finalizeIntervals, eventsByMinute, halfElapsedSeconds, currentMinute, timerDisplay,
  effectiveMinute, playerTimeStats, clippedDuration, firstHalfBase,
  normalizeNotes, removeNote, newNote, notesByMinute, migrateMatchNotes, migrateHistory,
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
  --pitch-deep:#0B1A14;
  --pitch-mid:#12291F;
  --pitch-mid2:#1B3D2F;
  --pitch-line:#F2FAF5;
  --ink-soft:#9DBFAF;
  --ink-faint:#6F8F7E;
  --accent-amber:#F5B23F;
  --accent-amber-ink:#3A2405;
  --accent-sky:#5DB6F0;
  --card-yellow:#F5C518;
  --card-red:#FF5A4D;
  --hair:rgba(234,244,238,0.10);
  --hair-strong:rgba(234,244,238,0.18);

  /* Sistema de diseño */
  --surface-1:#12291F;
  --surface-2:#173127;
  --surface-3:#1E3D30;
  --app-bg:radial-gradient(1200px 620px at 50% -12%, #17362A 0%, #0B1A14 58%);
  --radius-sm:10px;
  --radius:14px;
  --radius-lg:18px;
  --shadow-1:0 1px 2px rgba(0,0,0,0.28);
  --shadow-2:0 8px 24px rgba(0,0,0,0.28);
  --pad:16px;
  --tap:44px;
}

.fm-root{
  font-family:'Manrope',system-ui,sans-serif;
  background:var(--pitch-deep);
  background-image:var(--app-bg);
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
  -webkit-user-select:none;
  user-select:none;
  -webkit-touch-callout:none;
  overflow:hidden;
}
.fm-root input, .fm-root textarea{-webkit-user-select:text;user-select:text;}
.fm-root *{box-sizing:border-box;}
.fm-num{font-family:'Teko',sans-serif;font-weight:700;letter-spacing:0.01em;color:currentColor;}
.fm-readonly-bar{
  background:rgba(93,182,240,0.14); border-bottom:1px solid rgba(93,182,240,0.4);
  color:#CFE9FF; font-size:12px; font-weight:700; padding:8px 18px; text-align:center;
}
.fm-role{
  display:inline-flex; align-items:center; font-size:10.5px; font-weight:800; letter-spacing:0.03em;
  padding:3px 9px; border-radius:100px; text-transform:uppercase; flex-shrink:0;
}
.fm-role-owner{background:rgba(245,178,63,0.18); color:var(--accent-amber);}
.fm-role-editor{background:rgba(93,182,240,0.18); color:var(--accent-sky);}
.fm-role-viewer{background:rgba(234,244,238,0.10); color:var(--ink-soft);}

.fm-scroll{
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
  overflow-x:hidden;
  padding-bottom:0;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  scroll-behavior:auto;
}

/* ---- Header ---- */
.fm-header{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:calc(12px + env(safe-area-inset-top)) var(--pad) 12px;
  background:rgba(11,26,20,0.72);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
}
.fm-header-id{display:flex;align-items:center;gap:11px;min-width:0;}
.fm-header-mark{
  width:36px;height:36px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
  background:var(--accent-amber);color:var(--accent-amber-ink);font-size:19px;
}
.fm-header-txt{min-width:0;}
.fm-header-team{
  font-weight:800;font-size:14.5px;line-height:1.15;letter-spacing:-0.01em;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.fm-header-sub{
  font-size:11px;color:var(--ink-soft);font-weight:700;margin-top:1px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.fm-header-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.fm-iconbtn{
  background:transparent;border:1px solid var(--hair-strong);color:var(--pitch-line);
  width:var(--tap);height:var(--tap);border-radius:13px;display:flex;align-items:center;justify-content:center;
  flex-shrink:0;touch-action:manipulation;
}
.fm-iconbtn:active{background:var(--pitch-mid2);}
.fm-live-badge{
  display:inline-flex;align-items:center;gap:5px;flex-shrink:0;
  font-size:10.5px;font-weight:800;letter-spacing:0.06em;
  color:var(--accent-amber-ink);background:var(--accent-amber);border-radius:100px;padding:4px 9px;
}

/* Section title used inside each screen */
.fm-screen-head{padding:14px var(--pad) 2px;}
.fm-screen-title{font-family:'Teko',sans-serif;font-weight:600;font-size:27px;line-height:1;letter-spacing:0.01em;}
.fm-screen-desc{font-size:12.5px;color:var(--ink-soft);margin-top:3px;line-height:1.4;}

/* ---- Tab bar ---- */
.fm-tabbar{
  flex-shrink:0;
  display:flex;
  background:rgba(11,26,20,0.86);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border-top:1px solid var(--hair);
  padding:6px 4px calc(6px + env(safe-area-inset-bottom));
}
.fm-tab{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;
  background:transparent;border:none;color:var(--ink-faint);
  padding:6px 2px;font-family:'Manrope',sans-serif;font-size:10.5px;font-weight:700;
  letter-spacing:0.01em;touch-action:manipulation;border-radius:12px;transition:color .15s ease;
}
.fm-tab.active{color:var(--accent-amber);}
.fm-tab.active::after{content:"";width:16px;height:2.5px;border-radius:100px;background:var(--accent-amber);margin-top:1px;}
.fm-tab:active{background:rgba(234,244,238,0.05);}

/* ---- Generic layout ---- */
.fm-section{padding:14px var(--pad);}
.fm-h2{font-family:'Teko',sans-serif;font-weight:700;font-size:23px;letter-spacing:0.01em;margin:0 0 10px;color:#F2FAF5;}
.fm-label{font-size:11.5px;color:var(--ink-soft);font-weight:800;margin-bottom:7px;display:block;text-transform:uppercase;letter-spacing:0.05em;}
.fm-row{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.fm-card{
  background:var(--surface-1);border:1px solid var(--hair);border-radius:var(--radius-lg);
  padding:15px;box-shadow:var(--shadow-1);
}
.fm-list-row{
  display:flex;align-items:center;gap:12px;padding:13px 2px;border-bottom:1px solid var(--hair);
}
.fm-list-row:last-child{border-bottom:none;}

.fm-input{
  background:#0A1712;border:1px solid var(--hair-strong);color:#FFFFFF;
  border-radius:var(--radius-sm);padding:12px 13px;font-size:16px;font-family:'Manrope',sans-serif;
  width:100%;outline:none;font-weight:600;min-height:var(--tap);
}
.fm-input::placeholder{color:var(--ink-faint);}
.fm-input:focus{border-color:var(--accent-amber);box-shadow:0 0 0 3px rgba(245,178,63,0.20);}
.fm-textarea{min-height:80px;resize:vertical;line-height:1.5;}

.fm-btn{
  border:none;border-radius:var(--radius);padding:13px 16px;font-family:'Manrope',sans-serif;
  font-weight:700;font-size:14.5px;display:flex;align-items:center;justify-content:center;gap:7px;
  touch-action:manipulation;min-height:var(--tap);transition:transform .08s ease,filter .15s ease;
}
.fm-btn:active{transform:scale(0.985);}
.fm-btn-primary{background:var(--accent-amber);color:var(--accent-amber-ink);box-shadow:0 4px 14px rgba(245,178,63,0.22);}
.fm-btn-primary:active{background:#DE9A2D;}
.fm-btn-ghost{background:var(--surface-2);color:var(--pitch-line);border:1px solid var(--hair-strong);}
.fm-btn-ghost:active{background:var(--surface-3);}
.fm-btn-danger{background:transparent;color:#FF7A6E;border:1px solid rgba(255,90,77,0.5);}
.fm-btn-block{width:100%;}
.fm-btn-sm{padding:9px 13px;font-size:13px;border-radius:var(--radius-sm);min-height:36px;}
.fm-btn:disabled{opacity:0.4;}

.fm-chip{
  display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:100px;min-height:40px;
  font-size:13px;font-weight:800;border:1px solid var(--hair-strong);
  background:var(--surface-2);color:#EAF4EE;
  touch-action:manipulation;line-height:1;
}
.fm-chip:active{background:var(--surface-3);transform:scale(0.97);}
.fm-chip.on{background:var(--accent-amber);color:var(--accent-amber-ink);border-color:var(--accent-amber);}
.fm-chip svg{flex-shrink:0;}
.fm-tags{display:flex;flex-wrap:wrap;gap:8px;}
.fm-tag{
  padding:8px 13px;border-radius:100px;font-size:12.5px;font-weight:700;font-family:'Manrope',sans-serif;
  background:var(--surface-2);border:1px solid var(--hair-strong);color:#EAF4EE;cursor:pointer;
  touch-action:manipulation;
}
.fm-tag:active{background:var(--surface-3);transform:scale(0.97);}

/* ---- Guidance: pasos, ayudas y acciones fijas ---- */
.fm-step{display:flex;align-items:center;gap:9px;margin:0 0 12px;}
.fm-step-num{
  width:24px;height:24px;border-radius:50%;background:var(--accent-amber);color:var(--accent-amber-ink);
  font-size:12.5px;font-weight:800;display:flex;align-items:center;justify-content:center;
  flex-shrink:0;font-family:'Manrope',sans-serif;
}
.fm-step-title{font-family:'Teko',sans-serif;font-weight:600;font-size:21px;letter-spacing:0.01em;line-height:1;}
.fm-hint{font-size:12.5px;color:var(--ink-soft);line-height:1.5;margin:-4px 0 14px;}
.fm-info-banner{
  display:flex;gap:11px;align-items:flex-start;
  background:rgba(93,182,240,0.10);border:1px solid rgba(93,182,240,0.30);
  border-radius:var(--radius);padding:14px;margin-bottom:18px;color:#CFE9FF;font-size:13px;line-height:1.45;
}
.fm-info-banner svg{flex-shrink:0;margin-top:1px;}
.fm-info-banner b{color:#EAF6FF;}
.fm-sticky-actions{
  position:sticky;bottom:0;z-index:6;
  display:flex;gap:8px;align-items:center;
  padding:12px var(--pad);
  margin:16px calc(-1 * var(--pad)) -14px;
  background:rgba(11,26,20,0.9);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border-top:1px solid var(--hair);
}
.fm-sticky-actions .fm-btn{flex:1;min-width:0;}
.fm-sticky-actions .fm-btn.auto{flex:0 0 auto;}
.fm-sticky-actions.col{flex-direction:column;align-items:stretch;}
.fm-sticky-actions.col .fm-btn{flex:0 0 auto;width:100%;}
.fm-tool-name{
  font-size:12.5px;font-weight:700;color:var(--pitch-line);margin:8px 0 0;
}
.fm-tool-name span{color:var(--ink-soft);font-weight:600;}

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
.fm-mvp-row{display:flex;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--hair);}
.fm-mvp-row:last-child{border-bottom:none;}
.fm-mvp-row.leader{background:rgba(245,178,63,0.10);border-radius:12px;padding-left:10px;padding-right:10px;}
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
.fm-board-thumb{
  flex-shrink:0;border-radius:9px;border:1px solid var(--hair-strong);
  background:linear-gradient(180deg,var(--pitch-mid2) 0%, var(--surface-1) 100%);
}
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
  text-align:center;padding:44px 20px;color:var(--ink-soft);
}
.fm-empty svg{opacity:0.45;margin-bottom:12px;}
.fm-empty-title{font-weight:800;font-size:15.5px;color:var(--pitch-line);margin-bottom:5px;}
.fm-empty-text{font-size:13px;line-height:1.55;}

/* ---- Player number badge (shirt) ---- */
.fm-shirt{
  width:40px;height:40px;border-radius:50%;background:var(--surface-2);
  border:1.5px solid var(--hair-strong);display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
}
.fm-shirt .fm-num{font-size:19px;color:#FFFFFF;line-height:1;}

/* ---- Formation setup pitch ---- */
.fm-pitch-wrap{
  position:relative;width:100%;aspect-ratio:3/4;border-radius:var(--radius-lg);overflow:hidden;
  background:linear-gradient(180deg,var(--pitch-mid2) 0%, var(--surface-1) 100%);
  border:1px solid var(--hair-strong);
  margin:0 auto;
}
/* En la preparación el campo es el protagonista: ocupa el alto libre manteniendo
   la proporción, centrado y entero (sin cortar la etiqueta del portero). */
.fm-setup{padding-top:10px;}
.fm-setup .fm-formations{margin-bottom:10px;}
.fm-pitch-hero{
  width:auto;max-width:100%;aspect-ratio:3/4;margin:0 auto;
  /* Alto libre = viewport - (cabecera + título + datos + formación + barra + tabs) */
  height:clamp(300px, calc(100dvh - 405px), 600px);
}
/* Slots de la preparación: algo más compactos para que no se solapen en
   formaciones con muchas líneas (1-4-1-1, 1-2-2-2, 1-2-1-3...). */
.fm-pitch-hero .fm-slot{gap:2px;}
.fm-pitch-hero .fm-slot-badge{
  width:clamp(34px, 10.5vw, 46px);height:clamp(34px, 10.5vw, 46px);border-width:2px;
}
.fm-pitch-hero .fm-slot-badge .fm-num{font-size:clamp(14px, 4.6vw, 19px);}
.fm-pitch-hero .fm-slot-empty-icon{width:15px;height:15px;}
.fm-pitch-hero .fm-slot-label{
  font-size:clamp(8px, 2.3vw, 9.5px);padding:1px 6px;
  max-width:clamp(38px, 15vw, 58px);
}

/* Preparación compacta: menos cabecera para dar más campo. */
.fm-setup-head{padding-top:10px;padding-bottom:0;}
.fm-setup-head .fm-screen-title{font-size:23px;}
.fm-setup-head .fm-screen-desc{display:none;}
.fm-pitch-svg{position:absolute;inset:0;width:100%;height:100%;}
.fm-slot{
  position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:3px;
  background:none;border:none;padding:0;
}
.fm-slot-badge{
  width:clamp(42px, 13vw, 52px);height:clamp(42px, 13vw, 52px);border-radius:50%;display:flex;align-items:center;justify-content:center;
  border:2.5px solid rgba(234,244,238,0.45);background:rgba(8,20,15,0.92);
  box-shadow:0 2px 8px rgba(0,0,0,0.35);
}
.fm-slot-badge.filled{background:#08140F;border-color:var(--accent-amber);}
.fm-slot-badge .fm-num{font-size:clamp(17px, 5.4vw, 21px);color:#FFFFFF;font-weight:700;}
.fm-slot-empty-icon{color:#7C9C8A;}
.fm-slot-label{
  font-size:clamp(9px, 2.7vw, 10.5px);font-weight:800;color:#FFFFFF;background:rgba(8,20,15,0.9);
  padding:2px 7px;border-radius:100px;max-width:clamp(58px,20vw,82px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}

.fm-field-row{display:flex;gap:12px;}
.fm-field-row > div{flex:1;min-width:0;}
@media (max-width:600px){ .fm-field-row{flex-direction:column;gap:16px;} }
.fm-input[type="date"]{min-width:0;width:100%;max-width:100%;box-sizing:border-box;-webkit-appearance:none;appearance:none;}

/* ---- Formation picker ---- */
.fm-formations{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;margin-bottom:14px;-webkit-overflow-scrolling:touch;}
.fm-formation-opt{
  flex-shrink:0;background:var(--surface-2);border:1px solid var(--hair-strong);border-radius:var(--radius-sm);
  padding:10px 15px;text-align:center;color:#FFFFFF;min-height:44px;
}
.fm-formation-opt.active{border-color:var(--accent-amber);background:rgba(245,178,63,0.12);color:#FFFFFF;}
.fm-formation-opt .fm-num{font-size:19px;display:block;color:#FFFFFF;}

/* ---- Scoreboard (live) ---- */
.fm-scoreboard{
  background:var(--surface-1);border-bottom:1px solid var(--hair);padding:14px var(--pad) 16px;
}
.fm-sb-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;}
.fm-sb-opponent{font-size:12.5px;color:var(--ink-soft);font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:none;}
.fm-sb-phase{
  font-size:10.5px;font-weight:800;letter-spacing:0.03em;color:var(--accent-amber);
  background:rgba(245,178,63,0.14);padding:4px 10px;border-radius:100px;flex-shrink:0;
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
  width:40px;height:40px;border-radius:100px;border:1px solid var(--hair-strong);background:var(--surface-2);
  color:var(--pitch-line);display:flex;align-items:center;justify-content:center;flex-shrink:0;
  touch-action:manipulation;
}
.fm-round-btn:active{background:var(--surface-3);}
.fm-play-btn{
  width:56px;height:56px;border-radius:100px;background:var(--accent-amber);color:var(--accent-amber-ink);
  display:flex;align-items:center;justify-content:center;border:none;flex-shrink:0;
  box-shadow:0 6px 18px rgba(245,178,63,0.25);
}
@media (max-width:370px){
  .fm-sb-score{font-size:36px;gap:7px;}
  .fm-sb-timer{font-size:36px;}
  .fm-sb-score .vs{font-size:17px;}
  .fm-play-btn{width:48px;height:48px;}
}

/* ---- Bench strip ---- */
.fm-bench{padding:12px var(--pad) 4px;}
.fm-bench-scroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch;}
.fm-bench-card{
  flex-shrink:0;width:64px;display:flex;flex-direction:column;align-items:center;gap:5px;
}
.fm-bench-card .fm-shirt{background:var(--surface-2);}
.fm-bench-name{font-size:11px;text-align:center;color:#C7E2D6;font-weight:700;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;}

/* ---- Timeline ---- */
.fm-timeline{padding:6px var(--pad) 18px;}
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

/* ---- Notes ---- */
.fm-note-row{
  display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--hair);
  align-items:flex-start;
}
.fm-note-row:last-child{border-bottom:none;}
.fm-note-min{
  font-family:'Teko',sans-serif;font-weight:600;font-size:18px;color:var(--ink-soft);
  width:34px;flex-shrink:0;text-align:right;line-height:1.2;
}
.fm-note-icon{
  width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
  background:rgba(245,178,63,0.16);color:var(--accent-amber);
}
.fm-note-text{
  flex:1;min-width:0;font-size:13.5px;line-height:1.45;color:var(--pitch-line);
  white-space:pre-wrap;word-break:break-word;
}
.fm-match-notes-hint{
  display:flex;align-items:center;gap:6px;margin-top:6px;
  font-size:11.5px;color:var(--accent-amber);font-weight:600;
  overflow:hidden;
}
.fm-match-notes-hint span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

/* ---- Card icon (real card shape) ---- */
.fm-cardshape{width:15px;height:20px;border-radius:3px;flex-shrink:0;}
.fm-time-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;margin-top:4px;}
.fm-time-grid > div{display:flex;align-items:baseline;gap:5px;}
.fm-time-val{font-family:'Teko',sans-serif;font-weight:700;font-size:16px;line-height:1;}
.fm-time-lbl{font-size:10px;color:var(--ink-faint);font-weight:600;}

/* ---- Sheets / Modals ---- */
.fm-overlay{
  position:fixed;inset:0;background:rgba(4,10,7,0.72);z-index:120;
  display:flex;align-items:flex-end;justify-content:center;
  /* El área visible real (sin la barra del navegador ni el teclado) menos un
     margen para el notch. El portal a <body> garantiza que nada lo tape. */
  padding-top:calc(10px + env(safe-area-inset-top));
}
/* El portal saca la hoja de .fm-root, así que reintroducimos aquí el box-sizing
   y los tokens que antes heredaba del árbol de la app. */
.fm-overlay, .fm-overlay *{box-sizing:border-box;}
.fm-sheet{
  width:100%;max-width:520px;background:var(--surface-1);border-radius:22px 22px 0 0;
  padding:6px 0 0;
  /* Nunca más alto que el hueco disponible (viewport - teclado). */
  max-height:calc(100% - var(--kb-inset, 0px));
  display:flex;flex-direction:column;overflow:hidden;
  border-top:1px solid var(--hair);
  margin-bottom:var(--kb-inset,0px);
  animation:fm-sheet-up 0.22s ease-out;
  color:var(--pitch-line);font-family:'Manrope',system-ui,sans-serif;
}
@keyframes fm-sheet-up{from{transform:translateY(24px);opacity:0.4;}to{transform:translateY(0);opacity:1;}}
.fm-sheet-handle{width:36px;height:4px;background:var(--hair-strong);border-radius:100px;margin:10px auto 2px;flex-shrink:0;}
.fm-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px var(--pad) 6px;flex-shrink:0;}
.fm-sheet-title{font-family:'Teko',sans-serif;font-weight:600;font-size:23px;line-height:1;}
.fm-sheet-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:10px var(--pad) 14px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}
.fm-sheet-actions{
  padding:12px var(--pad) calc(12px + env(safe-area-inset-bottom));
  display:flex;flex-direction:column;gap:8px;flex-shrink:0;
  border-top:1px solid var(--hair);background:var(--surface-1);
}
.fm-sheet-actions .fm-btn{flex-shrink:0;}

.fm-modal-center{
  position:fixed;inset:0;background:rgba(4,10,7,0.72);z-index:130;
  display:flex;align-items:center;justify-content:center;
  padding:24px;padding-bottom:calc(24px + var(--fm-inset,0px));overflow-y:auto;
}
.fm-modal-box{
  width:100%;max-width:400px;background:var(--surface-1);border-radius:var(--radius-lg);padding:22px;
  border:1px solid var(--hair-strong);box-shadow:var(--shadow-2);
}

.fm-action-btn{
  display:flex;align-items:center;gap:12px;width:100%;background:var(--surface-2);
  border:1px solid var(--hair-strong);border-radius:var(--radius);padding:14px;color:var(--pitch-line);
  font-family:'Manrope',sans-serif;font-weight:700;font-size:14.5px;text-align:left;min-height:var(--tap);
}
.fm-action-btn:active{background:var(--surface-3);}
.fm-action-icon{
  width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
}

.fm-picker-row{
  display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--hair);
}
.fm-picker-row:last-child{border-bottom:none;}
.fm-picker-row:active{background:var(--surface-2);}
.fm-picker-row > *{min-width:0;}
.fm-picker-row .fm-picker-main{flex:1;min-width:0;}
.fm-picker-row .fm-picker-title{font-weight:700;font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fm-picker-row .fm-picker-sub{font-size:11.5px;color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fm-list-row > *{min-width:0;}
.fm-list-row .fm-list-name{flex:1;min-width:0;font-weight:700;font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

/* ---- Toast ---- */
.fm-toast{
  position:fixed;bottom:calc(84px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);
  background:var(--pitch-line);color:var(--pitch-deep);font-weight:800;font-size:13px;
  padding:11px 18px;border-radius:100px;z-index:80;box-shadow:var(--shadow-2);
  animation:fm-toast-in 0.18s ease-out;max-width:calc(100vw - 32px);text-align:center;
}
@keyframes fm-toast-in{from{opacity:0;transform:translate(-50%,8px);}to{opacity:1;transform:translate(-50%,0);}}

/* ---- History / Season ---- */
.fm-match-card{
  border:1px solid var(--hair);border-radius:var(--radius-lg);padding:15px;margin-bottom:10px;
  background:var(--surface-1);box-shadow:var(--shadow-1);
}
.fm-match-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
.fm-match-score{font-family:'Teko',sans-serif;font-weight:600;font-size:26px;}
.fm-result-tag{width:9px;height:9px;border-radius:50%;flex-shrink:0;}

.fm-stat-table{width:100%;border-collapse:collapse;}
.fm-stat-table th{
  text-align:left;font-size:10.5px;color:var(--ink-soft);font-weight:800;padding:0 8px 9px 0;
  border-bottom:1px solid var(--hair-strong);text-transform:uppercase;letter-spacing:0.03em;
}
.fm-stat-table td{padding:10px 8px 10px 0;border-bottom:1px solid var(--hair);font-size:13px;color:#F2FAF5;}
.fm-stat-table td.num, .fm-stat-table th.num{text-align:center;}

.fm-segmented{display:flex;background:var(--surface-1);border:1px solid var(--hair);border-radius:var(--radius);padding:3px;gap:2px;flex-wrap:wrap;}
.fm-segmented button{
  flex:1;min-width:58px;border:none;background:transparent;color:var(--ink-soft);font-weight:700;font-size:12.5px;
  padding:9px 4px;border-radius:10px;transition:color .12s ease;
}
.fm-segmented button.active{background:var(--accent-amber);color:var(--accent-amber-ink);}

.fm-loading{
  position:fixed;inset:0;background:var(--pitch-deep);display:flex;align-items:center;justify-content:center;
  color:var(--pitch-line);font-family:'Teko',sans-serif;font-size:22px;z-index:100;
}
`;

/* ============================================================================
   iOS Safari NO soporta interactive-widget=resizes-content: el teclado se
   superpone y Safari desplaza el visualViewport. La técnica fiable es NO tocar
   el layout y, en su lugar, exponer la altura del teclado en una variable CSS
   (--kb-inset) y usarla para subir el pie de la hoja por encima del teclado.
============================================================================ */
function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const sync = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty("--kb-inset", inset + "px");
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    // Safari a veces reporta el valor definitivo uno o dos frames después.
    const raf = requestAnimationFrame(sync);
    const t = setTimeout(sync, 250);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      cancelAnimationFrame(raf);
      clearTimeout(t);
      root.style.setProperty("--kb-inset", "0px");
    };
  }, []);
}

function useFocusReveal() {
  const scrollerRef = useRef(null);

  // Al enfocar un input dentro de la hoja, comprobamos si quedaría tapado por
  // el teclado y, solo entonces, desplazamos el scroller de la propia hoja lo
  // justo para dejarlo visible. No usamos scrollIntoView (mueve ancestros y
  // provoca el "salto" hacia arriba en iOS).
  const onFocusCapture = (e) => {
    const el = e.target;
    if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const run = () => {
      const vv = window.visualViewport;
      const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const r = el.getBoundingClientRect();
      const margin = 16;
      if (r.bottom > visibleBottom - margin) {
        scroller.scrollTop += Math.round(r.bottom - (visibleBottom - margin));
      } else if (r.top < (vv ? vv.offsetTop : 0) + margin) {
        scroller.scrollTop -= Math.round((vv ? vv.offsetTop : 0) + margin - r.top);
      }
    };
    // Tras el foco y tras el primer frame de la apertura del teclado.
    requestAnimationFrame(run);
    setTimeout(run, 200);
  };

  return { scrollerRef, onFocusCapture };
}

/* Hoja inferior reutilizable. Se monta con un portal en <body> para que ningún
   contenedor con scroll/backdrop-filter de la pantalla la atrape ni la deje por
   debajo de la barra de pestañas (problema típico en iPhone). El pie de acciones
   se eleva por encima del teclado con --kb-inset. */
function Sheet({ title, onClose, children, actions, headerExtra }) {
  const { scrollerRef, onFocusCapture } = useFocusReveal();
  useKeyboardInset();

  return createPortal(
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fm-sheet-handle" />
        <div className="fm-sheet-head">
          <div style={{ minWidth: 0 }}>
            <div className="fm-sheet-title">{title}</div>
            {headerExtra}
          </div>
          <button className="fm-iconbtn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="fm-sheet-body" ref={scrollerRef} onFocusCapture={onFocusCapture}>
          {children}
        </div>
        {actions && <div className="fm-sheet-actions">{actions}</div>}
      </div>
    </div>,
    document.body
  );
}

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

export default function App({ user = null, team = null, onLogout = null, onSwitchTeam = null, onRenameTeam = null }) {
  const readOnly = team?.role === "viewer";
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
      setActiveMatch(am ? migrateMatchNotes(am) : null);
      const loadedHistory = migrateHistory(hist || []);
      setHistory(loadedHistory);
      if (loadedHistory !== (hist || [])) storageSet("history", loadedHistory);
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
    if (readOnly) return;
    setSquad(next);
    storageSet("squad", next);
  }, [readOnly]);

  const addSquadPlayer = useCallback((partial) => {
    const player = { id: uid("p"), guest: false, ...partial };
    if (readOnly) return player;
    setSquad((prev) => {
      const next = [...prev, player];
      storageSet("squad", next);
      return next;
    });
    return player;
  }, [readOnly]);

  const updateTemplates = useCallback((next) => {
    if (readOnly) return;
    setTemplates(next);
    storageSet("templates", next);
  }, [readOnly]);

  const updateSettings = useCallback((next) => {
    if (readOnly) return;
    setSettings(next);
    storageSet("settings", next);
  }, [readOnly]);

  const updateBoards = useCallback((next) => {
    if (readOnly) return;
    setBoards(next);
    storageSet("boards", next);
  }, [readOnly]);

  const updateMatchInHistory = useCallback((matchId, updater) => {
    if (readOnly) return;
    setHistory((prev) => {
      const next = prev.map((m) => (m.id === matchId ? updater(m) : m));
      storageSet("history", next);
      return next;
    });
  }, [readOnly]);

  // Mutating the active match always snapshots first for undo.
  const mutateMatch = useCallback((mutator, opts = {}) => {
    if (readOnly) return;
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
  }, [readOnly]);

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
    if (readOnly) return;
    undoStack.current = [];
    setActiveMatch(matchInit);
    storageSet("active-match", matchInit);
  }, [readOnly]);

  const finishMatch = useCallback((finalMatch) => {
    if (readOnly) return;
    const nextHistory = [finalMatch, ...history];
    setHistory(nextHistory);
    storageSet("history", nextHistory);
    setActiveMatch(null);
    storageDelete("active-match");
    undoStack.current = [];
  }, [history, readOnly]);

  const discardMatch = useCallback(() => {
    if (readOnly) return;
    setActiveMatch(null);
    storageDelete("active-match");
    undoStack.current = [];
  }, [readOnly]);

  const deleteFromHistory = useCallback((id) => {
    if (readOnly) return;
    const next = history.filter((m) => m.id !== id);
    setHistory(next);
    storageSet("history", next);
  }, [history, readOnly]);

  // iOS: al cambiar de pestaña (o al empezar/terminar un partido) volvemos
  // arriba. Si no, el scroll se queda donde estabas y la nueva pantalla
  // aparece cortada o a mitad.
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [tab, activeMatch?.id]);

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
        team={team}
        liveMatch={activeMatch}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="fm-scroll" ref={scrollRef}>
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
            readOnly={readOnly}
            onGoToSquad={() => setTab("plantilla")}
          />
        )}
        {tab === "plantilla" && (
          <PlantillaTab squad={squad} onChange={updateSquad} showToast={showToast} readOnly={readOnly} />
        )}
        {tab === "pizarra" && (
          <PizarraTab squad={squad} boards={boards} onChange={updateBoards} showToast={showToast} readOnly={readOnly} />
        )}
        {tab === "historial" && (
          <HistorialTab history={history} squad={squad} onDelete={deleteFromHistory} onUpdateMatch={updateMatchInHistory} showToast={showToast} readOnly={readOnly} onGoToMatch={() => setTab("partido")} />
        )}
        {tab === "temporada" && (
          <TemporadaTab history={history} squad={squad} onGoToMatch={() => setTab("partido")} />
        )}
      </div>

      <TabBar tab={tab} setTab={setTab} hasActiveMatch={!!activeMatch} />

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          user={user}
          team={team}
          readOnly={readOnly}
          onLogout={onLogout}
          onSwitchTeam={onSwitchTeam}
          onRenameTeam={onRenameTeam}
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

function AppHeader({ settings, tab, team, liveMatch, onOpenSettings }) {
  const titles = { partido: "Partido", plantilla: "Plantilla", pizarra: "Pizarra", historial: "Partidos", temporada: "Estadísticas" };
  const live = tab === "partido" && liveMatch;
  return (
    <div className="fm-header">
      <div className="fm-header-id">
        <div className="fm-header-mark" aria-hidden="true">&#9917;</div>
        <div className="fm-header-txt">
          <div className="fm-header-team">{team ? team.name : settings.teamName}</div>
          <div className="fm-header-sub">{titles[tab]}</div>
        </div>
      </div>
      <div className="fm-header-actions">
        {live && <span className="fm-live-badge">{live.phase === "descanso" ? "DESCANSO" : "EN JUEGO"}</span>}
        <button className="fm-iconbtn" onClick={onOpenSettings} aria-label="Ajustes">
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
}

function TabBar({ tab, setTab, hasActiveMatch }) {
  const items = [
    { id: "partido", label: "Partido", icon: Shirt, dot: hasActiveMatch },
    { id: "plantilla", label: "Plantilla", icon: Users },
    { id: "pizarra", label: "Pizarra", icon: PenLine },
    { id: "historial", label: "Partidos", icon: ClipboardList },
    { id: "temporada", label: "Datos", icon: BarChart3 },
  ];
  return (
    <div className="fm-tabbar">
      {items.map((it) => (
        <button key={it.id} className={`fm-tab ${tab === it.id ? "active" : ""}`} onClick={() => setTab(it.id)} aria-label={it.label} aria-current={tab === it.id ? "page" : undefined}>
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
   SETTINGS MODAL
============================================================================ */

function SettingsModal({ settings, onSave, onClose, user, team, readOnly, onLogout, onSwitchTeam, onRenameTeam }) {
  const [halfMinutes, setHalfMinutes] = useState(settings.halfMinutes);
  const [name, setName] = useState(team ? team.name : settings.teamName);
  const [renamed, setRenamed] = useState(false);
  const canRename = !!onRenameTeam;

  const doRename = async () => {
    const v = name.trim();
    if (!v || !canRename) return;
    const ok = await onRenameTeam(v);
    if (ok) setRenamed(true);
  };

  return (
    <Sheet
      title="Ajustes"
      onClose={onClose}
      actions={!readOnly ? (
        <button className="fm-btn fm-btn-primary fm-btn-block" onClick={() => onSave({ halfMinutes: halfMinutes || 25 })}>
          <Check size={17} /> Guardar
        </button>
      ) : null}
    >
      {team && (
        <div style={{ marginBottom: 16 }}>
          <span className="fm-label">Equipo actual</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>{team.name}</span>
            <span className={`fm-role fm-role-${team.role}`}>
              {{ owner: "Propietario", editor: "Editor", viewer: "Solo lectura" }[team.role] || team.role}
            </span>
          </div>
          {canRename && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input className="fm-input" value={name} onChange={(e) => { setName(e.target.value); setRenamed(false); }} maxLength={40} style={{ flex: 1 }} enterKeyHint="done" />
              <button className="fm-btn fm-btn-ghost" onClick={doRename} disabled={!name.trim() || name.trim() === team.name}>
                {renamed ? <><Check size={16} /> Hecho</> : "Renombrar"}
              </button>
            </div>
          )}
          {onSwitchTeam && (
            <button className="fm-btn fm-btn-ghost fm-btn-block" onClick={() => onSwitchTeam()}>
              <ArrowLeftRight size={16} /> Cambiar de equipo
            </button>
          )}
        </div>
      )}
      {!readOnly && (
        <div style={{ marginBottom: 8 }}>
          <span className="fm-label">Duración de cada parte (minutos)</span>
          <input
            className="fm-input"
            type="number"
            inputMode="numeric"
            enterKeyHint="done"
            value={halfMinutes}
            onChange={(e) => setHalfMinutes(Math.max(1, parseInt(e.target.value || "0", 10)))}
          />
        </div>
      )}
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
    </Sheet>
  );
}

/* ============================================================================
   PLANTILLA TAB
============================================================================ */

function PlantillaTab({ squad, onChange, showToast, readOnly }) {
  const [editing, setEditing] = useState(null); // player object or "new"

  const addPlayer = () => {
    if (readOnly) return;
    const nextNum = (Math.max(0, ...squad.map((p) => p.number)) || 0) + 1;
    setEditing({ id: null, name: "", number: nextNum, guest: false });
  };

  const savePlayer = (player) => {
    if (readOnly) return;
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
    if (readOnly) return;
    onChange(squad.filter((p) => p.id !== id));
    setEditing(null);
    showToast("Jugador eliminado");
  };

  const sorted = [...squad].sort((a, b) => a.number - b.number);
  const guestCount = squad.filter((p) => p.guest).length;

  return (
    <>
    <div className="fm-screen-head">
      <div className="fm-screen-title">Plantilla</div>
      <div className="fm-screen-desc">Tu plantilla habitual y los invitados puntuales.</div>
    </div>
    <div className="fm-section">
      <div className="fm-row" style={{ marginBottom: 14 }}>
        <span className="fm-h2" style={{ margin: 0 }}>
          {squad.length} jugadores{guestCount > 0 ? ` · ${guestCount} invitado${guestCount > 1 ? "s" : ""}` : ""}
        </span>
        {!readOnly && (
          <button className="fm-btn fm-btn-primary fm-btn-sm" onClick={addPlayer}>
            <Plus size={15} /> Añadir
          </button>
        )}
      </div>

      <p className="fm-hint" style={{ marginTop: -6 }}>
        Toca un jugador para editar su nombre o dorsal. Los invitados son para partidos puntuales.
      </p>

      <div>
        {sorted.map((p) => (
          <div className="fm-list-row" key={p.id} onClick={() => !readOnly && setEditing(p)} style={readOnly ? { cursor: "default" } : undefined}>
            <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
            <div className="fm-list-name">{p.name}</div>
            {p.guest && <span className="fm-guest-tag">Invitado</span>}
            {!readOnly && <Pencil size={15} color="var(--ink-faint)" />}
          </div>
        ))}
      </div>

      {squad.length === 0 && (
        <div className="fm-empty">
          <Users size={34} />
          <div className="fm-empty-title">Sin jugadores todavía</div>
          {!readOnly && <div className="fm-empty-text">Añade tu plantilla para empezar a montar alineaciones.</div>}
        </div>
      )}

      {!readOnly && editing && (
        <PlayerEditSheet
          player={editing}
          onSave={savePlayer}
          onDelete={editing.id ? () => removePlayer(editing.id) : null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
    </>
  );
}

function PlayerEditSheet({ player, onSave, onDelete, onClose }) {
  const [name, setName] = useState(player.name);
  const [number, setNumber] = useState(player.number);
  const [guest, setGuest] = useState(!!player.guest);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Sheet
      title={player.id ? "Editar jugador" : "Nuevo jugador"}
      onClose={onClose}
      actions={
        <button className="fm-btn fm-btn-primary fm-btn-block" onClick={() => onSave({ id: player.id, name, number, guest })}>
          <Check size={17} /> Guardar
        </button>
      }
    >
      <div style={{ marginBottom: 14 }}>
        <span className="fm-label">Nombre</span>
        <input className="fm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del jugador" enterKeyHint="next" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <span className="fm-label">Dorsal</span>
        <input className="fm-input" style={{ width: 90 }} type="number" inputMode="numeric" enterKeyHint="done" value={number} onChange={(e) => setNumber(parseInt(e.target.value || "0", 10))} />
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
    </Sheet>
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

function MatchSetup({ squad, templates, onSaveTemplate, onDeleteTemplate, settings, onStartMatch, onAddPlayer, showToast, readOnly, onGoToSquad }) {
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
      notesLog: [],
      phase: "h1",
      runningSince: Date.now(),
      h1Seconds: 0, h2Seconds: 0,
      addedTime: { h1: 0, h2: 0 },
    };
    onStartMatch(match);
  };

  return (
    <>
    <div className="fm-screen-head fm-setup-head">
      <div className="fm-screen-title">Nuevo partido</div>
      <div className="fm-screen-desc">Monta la alineación y arranca el cronómetro.</div>
    </div>
    <div className="fm-section fm-setup">
      {squad.length === 0 && !readOnly && (
        <div className="fm-info-banner">
          <Users size={18} />
          <div>
            <b>Primero crea tu plantilla.</b> Añade a tus jugadores para poder montar la alineación.
            <div style={{ marginTop: 9 }}>
              <button className="fm-btn fm-btn-primary fm-btn-sm" onClick={onGoToSquad}><Plus size={15} /> Ir a Plantilla</button>
            </div>
          </div>
        </div>
      )}

      <div className="fm-card" style={{ marginBottom: 14, padding: 14 }}>
        {!readOnly ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <span className="fm-label" style={{ marginBottom: 5 }}>Rival</span>
              <input className="fm-input" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Nombre del equipo rival" enterKeyHint="next" />
            </div>
            <div className="fm-field-row" style={{ gap: 10 }}>
              <div>
                <span className="fm-label" style={{ marginBottom: 5 }}><CalendarDays size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Fecha</span>
                <input className="fm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <span className="fm-label" style={{ marginBottom: 5 }}><MapPin size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Lugar (opcional)</span>
                <input className="fm-input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Campo" enterKeyHint="done" />
              </div>
            </div>
          </>
        ) : (
          <div className="fm-hint" style={{ margin: 0 }}>Rival, fecha y lugar se definen al crear el partido.</div>
        )}
      </div>

      <div className="fm-row" style={{ alignItems: "center", marginBottom: 8 }}>
        <span className="fm-label" style={{ margin: 0 }}>Formación</span>
        {!readOnly && <button className="fm-btn fm-btn-ghost fm-btn-sm" onClick={() => setTplListOpen(true)}><FolderOpen size={14} /> Alineaciones</button>}
      </div>
      <div className="fm-formations">
        {Object.keys(FORMATIONS).map((key) => (
          <button key={key} className={`fm-formation-opt ${formationKey === key ? "active" : ""}`} onClick={() => !readOnly && applyFormation(key)} disabled={readOnly}>
            <span className="fm-num">{key}</span>
          </button>
        ))}
      </div>

      <div className="fm-pitch-wrap fm-pitch-hero">
        <PitchMarkings />
        {formation.slots.map((slot) => {
          const playerId = lineup[slot.id];
          const player = squad.find((p) => p.id === playerId);
          return (
            <button key={slot.id} className="fm-slot" style={{ left: `${slot.x}%`, top: `${slot.y}%` }} onClick={() => !readOnly && setPickerSlot(slot.id)} disabled={readOnly}>
              <div className={`fm-slot-badge ${player ? "filled" : ""}`}>
                {player ? <span className="fm-num">{player.number}</span> : <Plus size={18} className="fm-slot-empty-icon" />}
              </div>
              <span className="fm-slot-label">{player ? lastNameShort(player.name) : ROLE_SHORT[slot.role]}</span>
            </button>
          );
        })}
      </div>

      <p className="fm-hint" style={{ margin: "10px 0 12px", textAlign: "center" }}>
        {filledCount} de {formation.slots.length} posiciones · toca una para asignar jugador
      </p>

      <div style={{ marginBottom: 8 }}>
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

      {!readOnly && (
        <div className="fm-sticky-actions">
          <button className="fm-btn fm-btn-ghost auto" onClick={() => setSaveTplOpen(true)} disabled={filledCount === 0} aria-label="Guardar alineación" title="Guardar alineación">
            <Save size={18} />
          </button>
          <button className="fm-btn fm-btn-primary" onClick={handleStart} disabled={filledCount === 0}>
            <Play size={17} /> Iniciar partido
          </button>
        </div>
      )}

      {!readOnly && pickerSlot && (
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

      {!readOnly && saveTplOpen && (
        <SaveTemplateSheet
          onSave={(name) => {
            onSaveTemplate({ id: uid("tpl"), name, formation: formationKey, lineup });
            setSaveTplOpen(false);
            showToast("Alineación guardada");
          }}
          onClose={() => setSaveTplOpen(false)}
        />
      )}

      {!readOnly && tplListOpen && (
        <TemplateListSheet
          templates={templates}
          onLoad={loadTemplate}
          onDelete={onDeleteTemplate}
          onClose={() => setTplListOpen(false)}
        />
      )}
    </div>
    </>
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
    <Sheet title={`Posición: ${ROLE_LABEL[slot.role]}`} onClose={onClose}>
      {currentPlayerId && (
        <button className="fm-btn fm-btn-danger fm-btn-block" style={{ marginBottom: 10 }} onClick={onClear}>
          Quitar de esta posición
        </button>
      )}
      {sorted.length === 0 && <div className="fm-empty-text" style={{ padding: "16px 0" }}>No quedan jugadores libres.</div>}
      {sorted.map((p) => (
        <div key={p.id} className="fm-picker-row" onClick={() => onPick(p.id)}>
          <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
          <div className="fm-picker-main fm-picker-title" style={{ fontWeight: 700 }}>{p.name}</div>
          {p.guest && <span className="fm-guest-tag">Invitado</span>}
          {p.id === currentPlayerId && <Check size={17} color="var(--accent-amber)" />}
        </div>
      ))}

      {onAddPlayer && (
        addOpen ? (
          <div style={{ paddingTop: 10, borderTop: "1px solid var(--hair)", marginTop: 6 }}>
            <span className="fm-label">Nuevo jugador (falta alguien y viene un amigo)</span>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input className="fm-input" style={{ flex: 1 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre" enterKeyHint="next" />
              <input className="fm-input" style={{ width: 70 }} type="number" inputMode="numeric" enterKeyHint="done" value={newNumber} onChange={(e) => setNewNumber(parseInt(e.target.value || "0", 10))} />
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
    </Sheet>
  );
}

function SaveTemplateSheet({ onSave, onClose }) {
  const [name, setName] = useState("");
  return (
    <Sheet
      title="Guardar alineación"
      onClose={onClose}
      actions={
        <button className="fm-btn fm-btn-primary fm-btn-block" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
          <Check size={17} /> Guardar
        </button>
      }
    >
      <span className="fm-label">Nombre de la plantilla</span>
      <input className="fm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Titular contra rivales fuertes" enterKeyHint="done" />
    </Sheet>
  );
}

function TemplateListSheet({ templates, onLoad, onDelete, onClose }) {
  return (
    <Sheet title="Alineaciones guardadas" onClose={onClose}>
      {templates.length === 0 && <div className="fm-empty-text" style={{ padding: "16px 0" }}>Aún no has guardado ninguna alineación.</div>}
      {templates.map((t) => (
        <div key={t.id} className="fm-picker-row">
          <div className="fm-picker-main" onClick={() => onLoad(t)}>
            <div className="fm-picker-title">{t.name}</div>
            <div className="fm-picker-sub">{t.formation}</div>
          </div>
          <button className="fm-iconbtn" onClick={() => onDelete(t.id)} aria-label={`Borrar alineación ${t.name}`}><Trash2 size={16} color="var(--card-red)" /></button>
        </div>
      ))}
    </Sheet>
  );
}

/* ---------- Live match ---------- */

function LineupSlots({ formation, lineup, playerById, onSlot, readOnly }) {
  return formation.slots.map((slot) => {
    const player = playerById[lineup[slot.id]];
    return (
      <button key={slot.id} className="fm-slot" style={{ left: `${slot.x}%`, top: `${slot.y}%` }} onClick={() => !readOnly && onSlot(slot.id)} disabled={readOnly}>
        <div className={`fm-slot-badge ${player ? "filled" : ""}`}>
          {player ? <span className="fm-num">{player.number}</span> : <Plus size={18} className="fm-slot-empty-icon" />}
        </div>
        <span className="fm-slot-label">{player ? lastNameShort(player.name) : ROLE_SHORT[slot.role]}</span>
      </button>
    );
  });
}

function LiveMatch({ squad, activeMatch, mutateMatch, onFinishMatch, onDiscardMatch, onAddPlayer, showToast, readOnly }) {
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
  const effMinute = effectiveMinute(activeMatch, now);
  const onField = onFieldCount(activeMatch);
  const sentOff = redCount(activeMatch);
  const ordering = useMemo(() => subOrdering(activeMatch, squad, effMinute), [activeMatch, squad, effMinute]);
  const timeStats = useMemo(() => playerTimeStats(activeMatch, squad, now), [activeMatch, squad, now]);
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
          events: [...m.events, { id: uid("ev"), minute: effectiveMinute(m, Date.now()), displayMinute: currentMinute(m, Date.now()), type: "gol_rival" }],
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
      events: [...m.events, { id: uid("ev"), minute: effectiveMinute(m, Date.now()), displayMinute: currentMinute(m, Date.now()), type: "gol", playerId: scorerId, assistId: assistId || null }],
    }));
    vibrate(40);
    showToast("¡Gol registrado!");
    setActionSlot(null);
  };

  const logSimple = (type, playerId) => {
    mutateMatch((m) => ({
      ...m,
      events: [...m.events, { id: uid("ev"), minute: effectiveMinute(m, Date.now()), displayMinute: currentMinute(m, Date.now()), type, playerId }],
    }));
    const labels = { parada: "Parada registrada", amarilla: "Tarjeta amarilla registrada", roja: "Tarjeta roja registrada" };
    showToast(labels[type] || "Registrado");
    setActionSlot(null);
  };

  const doSubstitution = (slotId, outId, inId) => {
    const role = formation.slots.find((s) => s.id === slotId)?.role;
    mutateMatch((m) => applySubstitution(m, { slotId, outId, inId, minute: effectiveMinute(m, Date.now()), eventMinute: currentMinute(m, Date.now()), role }));
    showToast("Cambio registrado");
    setActionSlot(null);
  };

  const doMove = (slotId, targetSlotId) => {
    mutateMatch((m) => {
      const a = m.lineup[slotId];
      const b = m.lineup[targetSlotId];
      const next = swapPlayers(m, slotId, targetSlotId, effectiveMinute(m, Date.now()));
      if (next !== m) {
        return {
          ...next,
          events: [...(next.events || []), { id: uid("ev"), minute: effectiveMinute(m, Date.now()), displayMinute: currentMinute(m, Date.now()), type: "movimiento", playerId: a || b, fromSlot: slotId, toSlot: targetSlotId }],
        };
      }
      return m;
    });
    showToast("Posiciones intercambiadas");
    setActionSlot(null);
  };

  const handleCard = (type, playerId) => {
    let needsSub = false;
    let subSlotId = null;
    mutateMatch((m) => {
      const res = logCard(m, playerId, type, effectiveMinute(m, Date.now()), currentMinute(m, Date.now()));
      needsSub = res.needsSub;
      subSlotId = res.subSlotId;
      return res.match;
    });
    if (needsSub && subSlotId) {
      setActionSlot({ slotId: subSlotId, empty: true, forced: true, cardedId: playerId });
      showToast(type === "amarilla" ? "2ª amarilla: elige quién entra" : "Tarjeta azul: elige quién entra");
    } else {
      setActionSlot(null);
      showToast(type === "roja" ? "Expulsado: juegas con uno menos" : "Tarjeta registrada");
    }
  };

  const handleFormationChange = (key) => {
    setFormationOpen(false);
    if (key === activeMatch.formation) return;
    mutateMatch((m) => changeFormation(m, key, effectiveMinute(m, Date.now()), currentMinute(m, Date.now())));
    showToast(`Formación: ${key}`);
  };

  const handleFinish = (rivalGoalsFinal, notesLog, mvpVotes) => {
    const min = effectiveMinute(activeMatch, Date.now());
    let h1Seconds = activeMatch.h1Seconds;
    let h2Seconds = activeMatch.h2Seconds;
    if (activeMatch.runningSince) {
      const elapsed = (Date.now() - activeMatch.runningSince) / 1000;
      if (activeMatch.phase === "h1") h1Seconds += elapsed; else h2Seconds += elapsed;
    }
    const finalized = migrateMatchNotes(finalizeIntervals(activeMatch, min));
    const finalMatch = {
      ...finalized, h1Seconds, h2Seconds, runningSince: null,
      initialLineup: finalized.initialLineup || activeMatch.initialLineup || initialLineupOf(activeMatch),
      phase: "finalizado", rivalGoals: rivalGoalsFinal, notesLog: notesLog || [], mvpVotes: mvpVotes || {}, finalMinute: min,
    };
    onFinishMatch(finalMatch);
    showToast("Partido guardado");
  };

  return (
    <div className="fm-live">
      <div className="fm-scoreboard">
        <div className="fm-sb-top">
          <span className="fm-sb-opponent">vs {activeMatch.opponent}{activeMatch.venue ? ` · ${activeMatch.venue}` : ""}</span>
          <span className="fm-sb-phase">{phaseLabel(activeMatch.phase)}</span>
        </div>
        <div className="fm-sb-main">
          <div className="fm-sb-score">
            <span className="fm-num">{goalsFor}</span><span className="vs">–</span><span className="fm-num">{activeMatch.rivalGoals}</span>
          </div>
          {!readOnly && (
            <button className="fm-play-btn" onClick={togglePlay} disabled={activeMatch.phase === "finalizado"}>
              {activeMatch.phase === "descanso" ? <Play size={22} /> : isRunning ? <Pause size={22} /> : <Play size={22} />}
            </button>
          )}
          <div className="fm-sb-timer">
            <span className="fm-num">{timer.main}</span>
            {timer.added && <span className="added">{timer.added}</span>}
          </div>
        </div>
        <div className="fm-sb-controls">
          {!readOnly && (
            <div className="fm-sb-rival">
              <span style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 700, marginRight: 2 }}>Rival</span>
              <button className="fm-round-btn" onClick={() => rivalGoal(-1)}><Minus size={14} /></button>
              <button className="fm-round-btn" onClick={() => rivalGoal(1)}><Plus size={14} /></button>
            </div>
          )}
          {!readOnly && activeMatch.phase === "h1" && <button className="fm-chip" onClick={goToHalftime}><Pause size={13} /> Descanso</button>}
          {!readOnly && <button className="fm-chip" onClick={() => setFormationOpen(true)}><Shirt size={14} /> {activeMatch.formation}</button>}
          <button className="fm-chip" onClick={() => setOrderOpen(true)}><ArrowLeftRight size={14} /> Cambios</button>
          {!readOnly && <button className="fm-chip" onClick={() => setNotesOpen(true)}><PenLine size={14} /> Notas</button>}
          {!readOnly && <button className="fm-chip" onClick={() => setFinishOpen(true)}><Trophy size={14} /> Finalizar</button>}
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
          <LineupSlots formation={formation} lineup={activeMatch.lineup} playerById={playerById} onSlot={openSlotAction} readOnly={readOnly} />
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

      {!readOnly && (
        <div className="fm-section" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="fm-sticky-actions">
            <button className="fm-btn fm-btn-ghost auto" onClick={() => setDiscardConfirm(true)} aria-label="Descartar partido" title="Descartar partido">
              <Trash2 size={16} />
            </button>
            <button className="fm-btn fm-btn-primary" onClick={() => setFinishOpen(true)}>
              <Trophy size={17} /> Finalizar partido
            </button>
          </div>
        </div>
      )}

      {!readOnly && actionSlot && (
        <SlotActionSheet
          actionSlot={actionSlot}
          match={activeMatch}
          formation={formation}
          playerById={playerById}
          bench={bench}
          ordering={ordering}
          timeStats={timeStats}
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
        <Sheet title="Cambiar formación" onClose={() => setFormationOpen(false)}>
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
        </Sheet>
      )}

      {orderOpen && (
        <Sheet
          title="Tiempos y cambios"
          headerExtra={<div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>Totales y desde el último cambio · sin descuento ni descanso</div>}
          onClose={() => setOrderOpen(false)}
        >
          <span className="fm-label">En el campo ({ordering.field.length}) · más tiempo en el campo primero</span>
          {ordering.field.map(({ player }) => {
            const s = timeStats[player.id] || { played: 0, bench: 0, onSince: 0, offSince: 0 };
            return (
              <div key={player.id} className="fm-picker-row" style={{ alignItems: "stretch" }}>
                <div className="fm-shirt" style={{ alignSelf: "center" }}><span className="fm-num">{player.number}</span></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{player.name}</div>
                  <div className="fm-time-grid">
                    <div><span className="fm-time-val" style={{ color: "var(--accent-amber)" }}>{s.played}'</span><span className="fm-time-lbl">total en campo</span></div>
                    <div><span className="fm-time-val" style={{ color: "var(--sky, #5DB6F0)" }}>{s.bench}'</span><span className="fm-time-lbl">total banquillo</span></div>
                    <div><span className="fm-time-val" style={{ color: "var(--accent-amber)" }}>{s.onSince}'</span><span className="fm-time-lbl">en campo (últ. cambio)</span></div>
                    <div><span className="fm-time-val" style={{ color: "var(--sky, #5DB6F0)" }}>{s.offSince}'</span><span className="fm-time-lbl">banquillo (últ. cambio)</span></div>
                  </div>
                </div>
              </div>
            );
          })}
          {ordering.field.length === 0 && <div className="fm-empty-text" style={{ padding: "12px 0" }}>Nadie en el campo.</div>}

          <span className="fm-label" style={{ marginTop: 16 }}>Banquillo ({ordering.bench.length}) · más tiempo esperando</span>
          {ordering.bench.map(({ player }) => {
            const s = timeStats[player.id] || { played: 0, bench: 0, onSince: 0, offSince: 0 };
            return (
              <div key={player.id} className="fm-picker-row" style={{ alignItems: "stretch" }}>
                <div className="fm-shirt" style={{ alignSelf: "center" }}><span className="fm-num">{player.number}</span></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{player.name}</div>
                  <div className="fm-time-grid">
                    <div><span className="fm-time-val" style={{ color: "var(--accent-amber)" }}>{s.played}'</span><span className="fm-time-lbl">total en campo</span></div>
                    <div><span className="fm-time-val" style={{ color: "var(--sky, #5DB6F0)" }}>{s.bench}'</span><span className="fm-time-lbl">total banquillo</span></div>
                    <div><span className="fm-time-val" style={{ color: "var(--accent-amber)" }}>{s.onSince}'</span><span className="fm-time-lbl">en campo (últ. cambio)</span></div>
                    <div><span className="fm-time-val" style={{ color: "var(--sky, #5DB6F0)" }}>{s.offSince}'</span><span className="fm-time-lbl">banquillo (últ. cambio)</span></div>
                  </div>
                </div>
              </div>
            );
          })}
          {ordering.bench.length === 0 && <div className="fm-empty-text" style={{ padding: "12px 0" }}>Sin suplentes disponibles.</div>}

          {suspended.length > 0 && (
            <>
              <span className="fm-label" style={{ marginTop: 16 }}>Expulsados (no pueden jugar)</span>
              {suspended.map((p) => {
                const s = timeStats[p.id] || { played: 0 };
                return (
                  <div key={p.id} className="fm-picker-row" style={{ opacity: 0.7 }}>
                    <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
                    <div className="fm-picker-main" style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <span className="fm-num" style={{ fontSize: 16, color: "var(--card-red)" }}>{s.played}'</span>
                  </div>
                );
              })}
            </>
          )}
        </Sheet>
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
          match={activeMatch}
          onUpdate={(next) => mutateMatch(() => next, { skipUndo: true })}
          onClose={() => setNotesOpen(false)}
          readOnly={readOnly}
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
      <span className="fm-tl-min fm-num">{ev.displayMinute ?? ev.minute}'</span>
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

function SlotActionSheet({ actionSlot, match, formation, playerById, bench, ordering, timeStats, now, onGoal, onSimple, onCard, onSub, onMove, onAddPlayer, onClose }) {
  const [mode, setMode] = useState("menu"); // menu | assist | sub | move
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState(() => (Math.max(0, ...Object.values(playerById).map((p) => p.number)) || 0) + 1);
  const { slotId, playerId, empty } = actionSlot;
  const slot = formation.slots.find((s) => s.id === slotId);
  const player = playerId ? playerById[playerId] : null;
  const min = currentMinute(match, now);
  const pStats = playerId ? (timeStats && timeStats[playerId]) : null;
  const minutesPlayed = pStats ? pStats.played : (playerId ? minutesForPlayer(match, playerId, min) : 0);

  if (empty) {
    const canFill = canFillEmptySlot(match, formation);
    const carded = actionSlot.cardedId ? playerById[actionSlot.cardedId] : null;
    const benchList = ordering ? ordering.bench : (bench || []).map((p) => ({ player: p, minutes: 0 }));
    return (
      <Sheet title={carded ? `Entra por ${lastNameShort(carded.name)}` : ROLE_LABEL[slot.role]} onClose={onClose}>
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
                <div className="fm-picker-main fm-picker-title">{p.name}</div>
                {minutes > 0 && <span className="fm-num" style={{ fontSize: 17, color: "var(--ink-soft)" }}>{minutes}'</span>}
                {p.guest && <span className="fm-guest-tag">Invitado</span>}
              </div>
            ))}

            {onAddPlayer && (
              addOpen ? (
                <div style={{ paddingTop: 10, borderTop: "1px solid var(--hair)", marginTop: 6 }}>
                  <span className="fm-label">Nuevo jugador (viene un amigo a última hora)</span>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input className="fm-input" style={{ flex: 1 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre" enterKeyHint="next" />
                    <input className="fm-input" style={{ width: 70 }} type="number" inputMode="numeric" enterKeyHint="done" value={newNumber} onChange={(e) => setNewNumber(parseInt(e.target.value || "0", 10))} />
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
      </Sheet>
    );
  }

  if (mode === "assist") {
    const others = Object.entries(match.lineup).filter(([sId, pid]) => pid !== playerId).map(([sId, pid]) => playerById[pid]).filter(Boolean);
    return (
      <Sheet title="¿Asistencia?" onClose={onClose}>
        <button className="fm-action-btn" style={{ marginBottom: 8 }} onClick={() => onGoal(playerId, null)}>
          <span className="fm-action-icon" style={{ background: "rgba(234,244,238,0.08)" }}><X size={16} /></span>
          Sin asistencia
        </button>
        {others.map((p) => (
          <div key={p.id} className="fm-picker-row" onClick={() => onGoal(playerId, p.id)}>
            <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
            <div className="fm-picker-main fm-picker-title">{p.name}</div>
          </div>
        ))}
      </Sheet>
    );
  }

  if (mode === "sub") {
    return (
      <Sheet
        title={`Cambio: sale ${lastNameShort(player.name)}`}
        headerExtra={<div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          {minutesPlayed}' total en campo{pStats && pStats.onSince > 0 ? ` · ${pStats.onSince}' desde que entró` : ""} · entra el que más tiempo lleva esperando
        </div>}
        onClose={onClose}
      >
        {(ordering ? ordering.bench : (bench || []).map((player) => ({ player, minutes: 0 }))).length === 0 && (
          <div className="fm-empty-text" style={{ padding: "16px 0" }}>No quedan suplentes.</div>
        )}
        {(ordering ? ordering.bench : (bench || []).map((player) => ({ player, minutes: 0 }))).map(({ player: p, minutes }) => (
          <div key={p.id} className="fm-picker-row" onClick={() => onSub(slotId, playerId, p.id)}>
            <div className="fm-shirt"><span className="fm-num">{p.number}</span></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                {timeStats && timeStats[p.id] && timeStats[p.id].played > 0 ? `${timeStats[p.id].played}' jugados · ` : ""}{minutes}' en el banquillo
              </div>
            </div>
            <span className="fm-num" style={{ fontSize: 17, color: "var(--accent-sky)" }}>{timeStats && timeStats[p.id] ? timeStats[p.id].bench : minutes}'</span>
          </div>
        ))}
      </Sheet>
    );
  }

  if (mode === "move") {
    const targets = formation.slots.filter((s) => s.id !== slotId);
    return (
      <Sheet
        title={`Mover a ${lastNameShort(player.name)}`}
        headerExtra={<div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Elige la posición: se intercambian los jugadores</div>}
        onClose={onClose}
      >
        {targets.map((s) => {
          const occupantId = match.lineup[s.id];
          const occupant = occupantId ? playerById[occupantId] : null;
          return (
            <div key={s.id} className="fm-picker-row" onClick={() => onMove(slotId, s.id)}>
              <span className={`fm-badge-role role-${s.role}`}>{ROLE_SHORT[s.role]}</span>
              <div style={{ flex: 1, fontSize: 14 }}>
                {occupant
                  ? <>Intercambiar con <b>{occupant.name}</b></>
                  : <>Mover aquí <span style={{ color: "var(--ink-faint)" }}>(posición libre)</span></>}
              </div>
            </div>
          );
        })}
      </Sheet>
    );
  }

  return (
    <Sheet
      title={player.name}
      headerExtra={<div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
        {ROLE_LABEL[slot.role]} · {minutesPlayed}' total en campo
        {pStats && pStats.onSince > 0 ? ` · ${pStats.onSince}' desde que entró` : ""}
      </div>}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="fm-action-btn" onClick={() => setMode("assist")}>
          <span className="fm-action-icon" style={{ background: "rgba(245,178,63,0.15)" }}><Target size={17} color="var(--accent-amber)" /></span>
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
    </Sheet>
  );
}

function NotesList({ notes, onDelete }) {
  const ordered = notesByMinute(notes);
  if (ordered.length === 0) {
    return <div className="fm-empty-text" style={{ padding: "10px 0" }}>Todavía no hay notas.</div>;
  }
  return ordered.map((n) => (
    <div key={n.id} className="fm-note-row">
      <span className="fm-note-min fm-num">{n.minute == null || n.minute === "" ? "—" : `${n.minute}'`}</span>
      <div className="fm-note-icon"><PenLine size={14} /></div>
      <span className="fm-note-text">{n.text}</span>
      {onDelete && (
        <button className="fm-iconbtn" style={{ width: 30, height: 30 }} onClick={() => onDelete(n.id)} aria-label="Borrar nota">
          <Trash2 size={14} color="var(--card-red)" />
        </button>
      )}
    </div>
  ));
}

function NoteComposer({ defaultMinute, onAdd }) {
  const [text, setText] = useState("");
  const [minute, setMinute] = useState(() => (defaultMinute == null ? "" : String(defaultMinute)));

  const add = () => {
    const entry = newNote({ text, minute: minute === "" ? null : Math.max(0, parseInt(minute, 10) || 0) });
    if (!entry) return;
    onAdd(entry);
    setText("");
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: "0 0 auto", width: 84 }}>
          <span className="fm-label">Minuto</span>
          <input
            className="fm-input"
            type="number"
            inputMode="numeric"
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            placeholder="—"
          />
        </div>
        <div style={{ flex: 1 }}>
          <span className="fm-label">Nota</span>
          <input
            className="fm-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe una nota…"
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          />
        </div>
      </div>
      <button className="fm-btn fm-btn-primary fm-btn-block" onClick={add} disabled={!text.trim()}>
        <Plus size={16} /> Añadir nota
      </button>
    </div>
  );
}

function NotesSheet({ match, now, onUpdate, onClose, readOnly }) {
  const entries = normalizeNotes(match);

  const add = (entry) => onUpdate({ ...match, notesLog: [...entries, entry] });
  const del = (id) => onUpdate(removeNote(match, id));

  return (
    <Sheet
      title="Notas del partido"
      onClose={onClose}
      actions={
        <button className="fm-btn fm-btn-primary fm-btn-block" onClick={onClose}><Check size={17} /> Hecho</button>
      }
    >
      {!readOnly && <NoteComposer defaultMinute={currentMinute(match, Date.now())} onAdd={add} />}

      <span className="fm-label">Registradas ({entries.length})</span>
      <NotesList notes={entries} onDelete={readOnly ? undefined : del} />
    </Sheet>
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
            <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14 }}>
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
  const [notesLog, setNotesLog] = useState(() => normalizeNotes(match));
  const [mvpVotes, setMvpVotes] = useState(match.mvpVotes || {});
  const playerIds = Object.keys(match.intervals || {});

  const addNoteEntry = (entry) => setNotesLog((prev) => [...prev, entry]);
  const removeNoteEntry = (id) => setNotesLog((prev) => prev.filter((n) => n.id !== id));

  return (
    <Sheet
      title="Finalizar partido"
      onClose={onClose}
      actions={
        <button className="fm-btn fm-btn-primary fm-btn-block" onClick={() => onConfirm(rivalGoals, notesLog, mvpVotes)}>
          <Trophy size={17} /> Guardar resultado
        </button>
      }
    >
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

      <span className="fm-label">Notas (opcional · asociadas al minuto)</span>
      <NoteComposer defaultMinute={currentMinute(match, Date.now())} onAdd={addNoteEntry} />
      {notesLog.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <NotesList notes={notesLog} onDelete={removeNoteEntry} />
        </div>
      )}

      <span className="fm-label"><Star size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Votación MVP (opcional — puedes completarla más tarde desde el historial)</span>
      <MvpVoting playerIds={playerIds} playerById={playerById} votes={mvpVotes} onChange={setMvpVotes} />
    </Sheet>
  );
}

/* ============================================================================
   HISTORIAL TAB
============================================================================ */

function HistorialTab({ history, squad, onDelete, onUpdateMatch, showToast, readOnly, onGoToMatch }) {
  const [openMatchId, setOpenMatchId] = useState(null);
  const playerById = useMemo(() => Object.fromEntries(squad.map((p) => [p.id, p])), [squad]);
  const openMatch = history.find((m) => m.id === openMatchId) || null;

  const summary = useMemo(() => {
    let w = 0, d = 0, l = 0, gf = 0, ga = 0;
    history.forEach((m) => {
      const g = m.events.filter((e) => e.type === "gol").length;
      gf += g; ga += m.rivalGoals;
      if (g > m.rivalGoals) w += 1; else if (g === m.rivalGoals) d += 1; else l += 1;
    });
    return { w, d, l, gf, ga };
  }, [history]);

  if (history.length === 0) {
    return (
      <>
      <div className="fm-screen-head">
        <div className="fm-screen-title">Partidos</div>
        <div className="fm-screen-desc">Aquí verás cada partido jugado con su cronología y notas.</div>
      </div>
      <div className="fm-section">
        <div className="fm-empty">
          <ClipboardList size={34} />
          <div className="fm-empty-title">Todavía no hay partidos</div>
          <div className="fm-empty-text">Cuando termines un partido aparecerá aquí, con goles, cambios y minutos jugados.</div>
          {!readOnly && onGoToMatch && (
            <button className="fm-btn fm-btn-primary fm-btn-sm" style={{ marginTop: 16 }} onClick={onGoToMatch}>
              <Play size={15} /> Preparar un partido
            </button>
          )}
        </div>
      </div>
      </>
    );
  }

  return (
    <>
    <div className="fm-screen-head">
      <div className="fm-screen-title">Partidos</div>
      <div className="fm-screen-desc">Toca un partido para ver la cronología, las notas y el MVP.</div>
    </div>
    <div className="fm-section">
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <SeasonStatBox label="Jugados" value={history.length} />
        <SeasonStatBox label="G / E / P" value={`${summary.w}/${summary.d}/${summary.l}`} />
        <SeasonStatBox label="Goles" value={`${summary.gf}:${summary.ga}`} />
      </div>

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
            {(() => {
              const notes = notesByMinute(normalizeNotes(m));
              if (notes.length === 0) return null;
              return (
                <div className="fm-match-notes-hint">
                  <PenLine size={12} />
                  <span>{notes.length} nota{notes.length > 1 ? "s" : ""} · {notes[notes.length - 1].text}</span>
                </div>
              );
            })()}
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
          readOnly={readOnly}
        />
      )}
    </div>
    </>
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
      text += `- ${g.displayMinute ?? g.minute}' ${scorer}${assist}\n`;
    });
  }
  const cards = match.events.filter((e) => e.type === "amarilla" || e.type === "roja");
  if (cards.length) {
    text += "\nTarjetas:\n";
    cards.forEach((c) => { text += `- ${c.displayMinute ?? c.minute}' ${playerById[c.playerId]?.name || "?"} (${c.type === "amarilla" ? "amarilla" : "roja"})\n`; });
  }
  if (match.mvpVotes && Object.keys(match.mvpVotes).length > 0) {
    const max = Math.max(...Object.values(match.mvpVotes));
    const leaders = Object.entries(match.mvpVotes).filter(([, v]) => v === max).map(([id]) => playerById[id]?.name).filter(Boolean);
    if (leaders.length) text += `\n⭐ MVP: ${leaders.join(" / ")}\n`;
  }
  const notes = notesByMinute(normalizeNotes(match));
  if (notes.length) {
    text += "\nNotas:\n";
    notes.forEach((n) => { text += `- ${n.minute == null ? "—" : `${n.minute}'`} ${n.text}\n`; });
  }
  return text;
}

function MatchDetailSheet({ match, playerById, onUpdateVotes, onDelete, onClose, readOnly }) {
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
    <Sheet
      title={`vs ${match.opponent}`}
      headerExtra={<div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{formatDateEs(match.date)} · {match.formation}</div>}
      onClose={onClose}
      actions={
        <>
          <button className="fm-btn fm-btn-primary fm-btn-block" onClick={share}><Share2 size={16} /> Compartir resumen</button>
          {!readOnly && (
            confirmDelete ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="fm-btn fm-btn-danger" style={{ flex: 1 }} onClick={onDelete}>Confirmar eliminación</button>
                <button className="fm-btn fm-btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Cancelar</button>
              </div>
            ) : (
              <button className="fm-btn fm-btn-ghost fm-btn-block" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Eliminar partido</button>
            )
          )}
        </>
      }
    >
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
        {readOnly ? (
          (() => {
            const votes = match.mvpVotes || {};
            const total = Object.values(votes).reduce((a, b) => a + b, 0);
            if (total === 0) return <div className="fm-empty-text" style={{ padding: "8px 0" }}>Sin votos.</div>;
            const max = Math.max(...Object.values(votes));
            const rows = Object.entries(votes)
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1]);
            return rows.map(([pid, v]) => (
              <div key={pid} className="fm-mvp-row">
                <div className="fm-shirt"><span className="fm-num">{playerById[pid]?.number ?? "?"}</span></div>
                <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14 }}>
                  {playerById[pid]?.name || "—"}
                  {v === max && <Star size={13} color="var(--accent-amber)" style={{ marginLeft: 6, verticalAlign: -2 }} fill="var(--accent-amber)" />}
                </div>
                <span className="fm-mvp-count">{v}</span>
              </div>
            ));
          })()
        ) : (
          <MvpVoting
            playerIds={Object.keys(match.intervals || {})}
            playerById={playerById}
            votes={match.mvpVotes || {}}
            onChange={onUpdateVotes}
          />
        )}
      </div>

      {(() => {
        const notes = notesByMinute(normalizeNotes(match));
        if (notes.length === 0) return null;
        return (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <span className="fm-label"><PenLine size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Notas ({notes.length})</span>
            <NotesList notes={notes} />
          </div>
        );
      })()}
    </Sheet>
  );
}

/* ============================================================================
   TEMPORADA TAB
============================================================================ */

function TemporadaTab({ history, squad, onGoToMatch }) {
  const [metric, setMetric] = useState("goles");

  const playerById = useMemo(() => Object.fromEntries(squad.map((p) => [p.id, p])), [squad]);

  const emptyStat = (player) => ({
    player, partidos: 0, goles: 0, asistencias: 0, paradas: 0,
    minutos: 0, minutosPorRol: { POR: 0, DEF: 0, MED: 0, DEL: 0 }, mvpAwards: 0, mvpVotesTotal: 0,
    amarillas: 0, rojas: 0, azules: 0,
  });

  const stats = useMemo(() => {
    const map = {};
    squad.forEach((p) => { map[p.id] = emptyStat(p); });
    history.forEach((m) => {
      const playedIds = new Set();
      const finalMin = m.finalMinute || effectiveMinute(m, Date.now());
      const h1Base = firstHalfBase(m);
      const capMin = finalMin;
      Object.entries(m.intervals || {}).forEach(([pid, intervals]) => {
        if (!map[pid]) map[pid] = emptyStat(playerById[pid] || { name: "Desconocido", number: "?" });
        intervals.forEach((iv) => {
          const end = iv.end == null ? finalMin : iv.end;
          const dur = clippedDuration(iv.start, end, m.halfMinutes || 25, capMin, h1Base);
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
      <>
      <div className="fm-screen-head">
        <div className="fm-screen-title">Estadísticas</div>
        <div className="fm-screen-desc">Se calculan a partir de los partidos finalizados.</div>
      </div>
      <div className="fm-section">
        <div className="fm-empty">
          <BarChart3 size={34} />
          <div className="fm-empty-title">Aún sin estadísticas</div>
          <div className="fm-empty-text">Las estadísticas de temporada se calculan a partir de los partidos finalizados.</div>
          {onGoToMatch && (
            <button className="fm-btn fm-btn-primary fm-btn-sm" style={{ marginTop: 16 }} onClick={onGoToMatch}>
              <Play size={15} /> Preparar un partido
            </button>
          )}
        </div>
      </div>
      </>
    );
  }

  return (
    <>
    <div className="fm-screen-head">
      <div className="fm-screen-title">Estadísticas</div>
      <div className="fm-screen-desc">Rendimiento del equipo y de cada jugador.</div>
    </div>
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
              <Bar dataKey="value" fill="#F5B23F" radius={[6, 6, 0, 0]} isAnimationActive={false}>
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
    </>
  );
}

function SeasonStatBox({ label, value }) {
  return (
    <div className="fm-card" style={{ flex: 1, padding: "12px 6px", textAlign: "center", borderRadius: "var(--radius)" }}>
      <div className="fm-num" style={{ fontSize: 24 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--ink-soft)", fontWeight: 800, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
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

function PizarraTab({ squad, boards, onChange, showToast, readOnly }) {
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

  const strokesRef = useRef(strokes);
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  const resize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    sizeRef.current = { w: rect.width, h: rect.height, dpr };
    // Usamos la lista actual (vía ref) para que al girar el móvil o redimensionar
    // no se redibuje una versión antigua: las pizarras cargadas seguían viéndose.
    redraw(strokesRef.current);
  }, [redraw]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("orientationchange", resize);
    return () => { ro.disconnect(); window.removeEventListener("orientationchange", resize); };
  }, [resize]);

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
    const loaded = b.strokes || [];
    strokesRef.current = loaded;
    setStrokes(loaded);
    setBoardId(b.id);
    setBoardName(b.name);
    setDirty(false);
    setListOpen(false);
    // Redibujamos al instante (no esperamos al efecto) para que la pizarra
    // cargada aparezca siempre, incluso si el canvas se monta/redimensiona
    // justo al abrir la hoja.
    redraw(loaded);
    requestAnimationFrame(resize);
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
    <>
    <div className="fm-screen-head">
      <div className="fm-screen-title">Pizarra</div>
      <div className="fm-screen-desc">Dibuja jugadas y guárdalas para el equipo.</div>
    </div>
    <div className="fm-section">
      <div className="fm-row" style={{ marginBottom: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{boardName}{dirty ? " ·" : ""}</span>
        {dirty && <span style={{ fontSize: 11, color: "var(--accent-amber)", fontWeight: 700 }}>Sin guardar</span>}
      </div>

      <div className="fm-board-toolbar" style={readOnly ? { display: "none" } : undefined}>
        {tools.map((t) => (
          <button key={t.id} title={t.label} className={`fm-tool-btn ${tool === t.id ? "active" : ""}`} onClick={() => setTool(t.id)} aria-label={t.label}>
            <t.icon size={19} />
          </button>
        ))}
        <button className="fm-tool-btn" onClick={undo} aria-label="Deshacer" title="Deshacer"><RotateCcw size={19} /></button>
        <button className="fm-tool-btn" onClick={() => setClearConfirm(true)} aria-label="Borrar todo" title="Borrar todo"><Trash2 size={19} /></button>
      </div>
      {!readOnly && (
        <p className="fm-tool-name">
          Herramienta: <span>{tools.find((t) => t.id === tool)?.label}</span> · dibuja con el dedo o el lápiz
        </p>
      )}

      {!readOnly && (
        <div className="fm-color-row">
          {BOARD_COLORS.map((c) => (
            <button key={c.id} className={`fm-color-dot ${color === c.value ? "active" : ""}`} style={{ background: c.value }} onClick={() => setColor(c.value)} aria-label={c.id} />
          ))}
        </div>
      )}

      {!readOnly && tool === "token" && (
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

      <div className="fm-board-wrap" ref={wrapRef} style={{ marginTop: 10, touchAction: readOnly ? "auto" : "none" }}>
        <canvas
          ref={canvasRef}
          className="fm-board-canvas"
          onPointerDown={readOnly ? undefined : onPointerDown}
          onPointerMove={readOnly ? undefined : onPointerMove}
          onPointerUp={readOnly ? undefined : onPointerUp}
          onPointerLeave={readOnly ? undefined : onPointerUp}
        />
      </div>

      {!readOnly && (
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
      )}

      {readOnly && (
        <div style={{ marginTop: 14 }}>
          <button className="fm-btn fm-btn-ghost fm-btn-block" onClick={() => setListOpen(true)}>
            <FolderOpen size={16} /> Pizarras guardadas ({boards.length})
          </button>
        </div>
      )}

      {saveOpen && !readOnly && (
        <SaveBoardSheet initialName={boardId ? boardName : ""} onSave={saveBoard} onClose={() => setSaveOpen(false)} />
      )}

      {listOpen && (
        <BoardListSheet boards={boards} onLoad={loadBoard} onDelete={deleteBoard} onClose={() => setListOpen(false)} readOnly={readOnly} />
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
    </>
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
    <Sheet
      title="Guardar pizarra"
      onClose={onClose}
      actions={
        <button className="fm-btn fm-btn-primary fm-btn-block" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
          <Check size={17} /> Guardar
        </button>
      }
    >
      <span className="fm-label">Nombre</span>
      <input className="fm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Saque de banda ofensivo" enterKeyHint="done" />
    </Sheet>
  );
}

function BoardThumb({ strokes, size = 56 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = size, h = Math.round((size * 4) / 3);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    drawPitchOnCanvas(ctx, w, h);
    (strokes || []).forEach((s) => drawStroke(ctx, w, h, s));
    ctx.restore();
  }, [strokes, size]);
  return <canvas ref={ref} className="fm-board-thumb" style={{ width: size, height: Math.round((size * 4) / 3) }} />;
}

function BoardListSheet({ boards, onLoad, onDelete, onClose, readOnly }) {
  return (
    <Sheet title="Pizarras guardadas" onClose={onClose}>
      {boards.length === 0 && <div className="fm-empty-text" style={{ padding: "16px 0" }}>Aún no hay pizarras guardadas.</div>}
      {boards.map((b) => (
        <div key={b.id} className="fm-picker-row">
          <BoardThumb strokes={b.strokes} />
          <div className="fm-picker-main" onClick={() => onLoad(b)}>
            <div className="fm-picker-title">{b.name}</div>
            <div className="fm-picker-sub">{b.strokes?.length || 0} elementos{b.strokes?.length ? ` · ${b.strokes.filter((s) => s.type === "pen").length} trazos` : ""}</div>
          </div>
          {!readOnly && (
            <button className="fm-iconbtn" onClick={() => onDelete(b.id)} aria-label={`Borrar pizarra ${b.name}`}><Trash2 size={16} color="var(--card-red)" /></button>
          )}
        </div>
      ))}
    </Sheet>
  );
}
