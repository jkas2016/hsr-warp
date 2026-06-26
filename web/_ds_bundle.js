/* @ds-bundle: {"format":3,"namespace":"HSRWarpDesignSystem_4a0d44","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Dialog","sourcePath":"components/core/Dialog.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"LuckBar","sourcePath":"components/core/LuckBar.jsx"},{"name":"PityPill","sourcePath":"components/core/PityPill.jsx"},{"name":"ProgressBar","sourcePath":"components/core/ProgressBar.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"StatCard","sourcePath":"components/core/StatCard.jsx"},{"name":"Tabs","sourcePath":"components/core/Tabs.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"ThemeToggle","sourcePath":"components/core/ThemeToggle.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"2f8e2be30fa6","components/core/Button.jsx":"1246725c2e67","components/core/Card.jsx":"39d187cde727","components/core/Dialog.jsx":"44f2fb29f08b","components/core/Input.jsx":"99ba9228379d","components/core/LuckBar.jsx":"6c1a8f7af246","components/core/PityPill.jsx":"705babbe7eab","components/core/ProgressBar.jsx":"90769c6def9e","components/core/Select.jsx":"3a45046af2c3","components/core/StatCard.jsx":"12379ed45355","components/core/Tabs.jsx":"82dd77515c22","components/core/Tag.jsx":"4ed5cbe33fa7","components/core/ThemeToggle.jsx":"3761b99e63b6","ui_kits/dashboard/BannerCards.jsx":"811ce7751266","ui_kits/dashboard/BannersView.jsx":"8e970bdc0b8c","ui_kits/dashboard/ChartsGrid.jsx":"feb7dc462667","ui_kits/dashboard/Dashboard.jsx":"518eb6382067","ui_kits/dashboard/FiveDetail.jsx":"0c53ae6b71b2","ui_kits/dashboard/FivesTable.jsx":"024f68ba2334","ui_kits/dashboard/HeroSummary.jsx":"96fa96aa9bc8","ui_kits/dashboard/HistoryView.jsx":"bb7cb8349cba","ui_kits/dashboard/OverviewView.jsx":"8f1b6e6d097d","ui_kits/dashboard/QueryPanel.jsx":"ac1399c3e1e9","ui_kits/dashboard/RefreshBar.jsx":"511f4a6b5703","ui_kits/dashboard/VersionsView.jsx":"7588388ff23a","ui_kits/dashboard/data.js":"88c070a5ad73","ui_kits/dashboard/util.js":"3eda8b2ccb0b"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.HSRWarpDesignSystem_4a0d44 = window.HSRWarpDesignSystem_4a0d44 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Pill badge for status. Tinted (translucent fill + colored border/text)
 * is the house style; `solid` fills with the accent for emphasis chips.
 */
function Badge({
  variant = 'neutral',
  solid = false,
  style,
  children,
  ...rest
}) {
  const map = {
    gold: {
      c: 'var(--gold)',
      f: 'rgba(245,197,66,.15)',
      b: 'rgba(245,197,66,.4)'
    },
    green: {
      c: 'var(--green)',
      f: 'var(--green-fill)',
      b: 'var(--green-line)'
    },
    red: {
      c: 'var(--red)',
      f: 'var(--red-fill)',
      b: 'var(--red-line)'
    },
    orange: {
      c: 'var(--orange)',
      f: 'var(--orange-fill)',
      b: 'rgba(255,158,69,.4)'
    },
    purple: {
      c: 'var(--purple)',
      f: 'var(--purple-fill)',
      b: 'rgba(164,116,255,.4)'
    },
    neutral: {
      c: 'var(--muted)',
      f: 'var(--panel-2)',
      b: 'var(--line)'
    }
  };
  const t = map[variant] || map.neutral;
  const styles = solid ? {
    background: t.c,
    color: 'var(--on-accent)',
    border: `1px solid ${t.c}`
  } : {
    background: t.f,
    color: t.c,
    border: `1px solid ${t.b}`
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-block',
      fontFamily: 'var(--font-sans)',
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 9px',
      borderRadius: 'var(--r-pill)',
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
      ...styles,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Primary action button. `primary` is a gradient-gold pill with a soft glow
 * and a shimmer sweep on hover — the single hero action. Secondary/ghost are
 * quieter; danger is a red-tinted destructive action.
 */
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  onClick,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const sizes = {
    sm: {
      padding: '8px 14px',
      fontSize: 13
    },
    md: {
      padding: '11px 20px',
      fontSize: 14
    },
    lg: {
      padding: '13px 26px',
      fontSize: 15
    }
  };
  const variants = {
    primary: {
      background: 'var(--grad-gold)',
      color: 'var(--on-accent)',
      border: '1px solid var(--gold-deep)',
      boxShadow: hover && !disabled ? 'var(--glow-gold)' : 'none'
    },
    secondary: {
      background: 'var(--panel-2)',
      color: 'var(--txt)',
      border: '1px solid var(--line-2)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--txt)',
      border: '1px solid var(--line-2)'
    },
    danger: {
      background: 'var(--red-fill)',
      color: 'var(--red)',
      border: '1px solid var(--red-line)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      letterSpacing: '.2px',
      lineHeight: 1,
      borderRadius: 'var(--r-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transform: hover && !disabled ? 'translateY(-1px)' : 'none',
      transition: 'transform .15s ease, box-shadow .18s ease, filter .15s ease',
      filter: hover && !disabled && variant !== 'primary' ? 'brightness(1.1)' : 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      ...sizes[size],
      ...variants[variant],
      ...style
    }
  }, rest), variant === 'primary' && !disabled && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--grad-sheen)',
      transform: hover ? 'translateX(100%)' : 'translateX(-100%)',
      transition: 'transform .7s ease',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8
    }
  }, children));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Surface container — glassy gradient fill, soft border, depth shadow.
 * `interactive` adds a hover lift; `glow` paints an accent halo on hover
 * (dark theme) and a tinted top-border accent.
 */
function Card({
  as = 'div',
  padding = 18,
  interactive = false,
  glow,
  accent,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  ...rest
}) {
  const Tag = as;
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement(Tag, _extends({
    onMouseEnter: e => {
      setHover(true);
      onMouseEnter && onMouseEnter(e);
    },
    onMouseLeave: e => {
      setHover(false);
      onMouseLeave && onMouseLeave(e);
    },
    style: {
      position: 'relative',
      background: 'var(--card-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      border: '1px solid var(--card-border)',
      borderRadius: 'var(--r-lg)',
      boxShadow: interactive && hover ? `var(--shadow-hover)${glow ? ', ' + glow : ''}` : 'var(--shadow-card)',
      transform: interactive && hover ? 'translateY(-3px)' : 'none',
      transition: 'transform .22s cubic-bezier(.2,.7,.3,1), box-shadow .22s ease',
      padding,
      ...(accent ? {
        borderTop: `2px solid ${accent}`
      } : null),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Dialog.jsx
try { (() => {
/**
 * Centered modal dialog over a blurred backdrop. Glass card, pop shadow.
 * Closes on backdrop click and Escape. Render nothing when `open` is false.
 */
function Dialog({
  open,
  onClose,
  title,
  children,
  width = 460,
  style
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') onClose && onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'grid',
      placeItems: 'center',
      padding: 20,
      background: 'rgba(6,9,16,.55)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      animation: 'dlgFade .18s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      maxWidth: width,
      background: 'var(--card-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      border: '1px solid var(--card-border)',
      borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow-pop)',
      padding: 22,
      animation: 'dlgPop .22s cubic-bezier(.2,.7,.3,1)',
      ...style
    }
  }, (title || onClose) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 18,
      fontWeight: 600,
      letterSpacing: '-.2px'
    }
  }, title), onClose && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "\uB2EB\uAE30",
    style: {
      appearance: 'none',
      border: 'none',
      background: 'var(--panel-2)',
      color: 'var(--muted)',
      width: 28,
      height: 28,
      borderRadius: 'var(--r-pill)',
      cursor: 'pointer',
      fontSize: 14,
      lineHeight: 1,
      display: 'grid',
      placeItems: 'center',
      flex: 'none'
    }
  }, "\u2715")), children), /*#__PURE__*/React.createElement("style", null, `@keyframes dlgFade{from{opacity:0}to{opacity:1}}
        @keyframes dlgPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}`));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Text input — raised fill, hairline border, gold focus ring.
 */
function Input({
  style,
  onFocus,
  onBlur,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("input", _extends({
    onFocus: e => {
      e.currentTarget.style.borderColor = 'var(--gold)';
      onFocus && onFocus(e);
    },
    onBlur: e => {
      e.currentTarget.style.borderColor = 'var(--line)';
      onBlur && onBlur(e);
    },
    style: {
      padding: '10px 12px',
      borderRadius: 'var(--r-md)',
      border: '1px solid var(--line)',
      background: 'var(--panel-2)',
      color: 'var(--txt)',
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      outline: 'none',
      transition: 'border-color .12s ease',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/LuckBar.jsx
try { (() => {
/**
 * Signature luck meter — green→gold→red gradient track with a soft moving
 * shimmer and a glowing white marker. Maps average pity (1..125) onto
 * 0..100% (62.5 = center, dead-average). Lower pity = further left = luckier.
 */
function LuckBar({
  avgPity,
  markerPct,
  height = 12,
  style
}) {
  const pct = markerPct != null ? markerPct : Math.max(2, Math.min(98, avgPity / 125 * 100));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      borderRadius: 'var(--r-pill)',
      background: 'var(--grad-luck)',
      position: 'relative',
      overflow: 'visible',
      boxShadow: '0 0 18px rgba(245,197,66,.22)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: -4,
      width: 2,
      height: height + 8,
      background: 'rgba(255,255,255,.45)',
      borderRadius: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: `${pct}%`,
      top: -5,
      width: 4,
      height: height + 10,
      background: '#fff',
      borderRadius: 3,
      boxShadow: '0 0 8px rgba(255,255,255,.9), var(--shadow-pill)',
      transform: 'translateX(-50%)',
      transition: 'left .6s cubic-bezier(.2,.7,.3,1)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 'var(--r-pill)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--grad-sheen)',
      animation: 'luckSheen 3.2s ease-in-out infinite'
    }
  })), /*#__PURE__*/React.createElement("style", null, `@keyframes luckSheen{0%{transform:translateX(-100%)}55%,100%{transform:translateX(100%)}}
        @media (prefers-reduced-motion: reduce){[style*="luckSheen"]{animation:none}}`));
}
Object.assign(__ds_scope, { LuckBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/LuckBar.jsx", error: String((e && e.message) || e) }); }

// components/core/PityPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Pity pill — a colored numeric chip whose color encodes luck:
 * green (<60, lucky) → orange (60–80, getting close) → red (>80, near hard pity).
 * Pass an explicit `color` to override the auto mapping.
 */
function PityPill({
  value,
  color,
  style,
  children,
  ...rest
}) {
  const auto = value < 60 ? 'var(--green)' : value <= 80 ? 'var(--orange)' : 'var(--red)';
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-block',
      minWidth: 32,
      textAlign: 'center',
      fontFamily: 'var(--font-sans)',
      fontWeight: 700,
      fontSize: 12,
      padding: '3px 8px',
      borderRadius: 'var(--r-pill)',
      color: 'var(--on-accent)',
      background: color || auto,
      ...style
    }
  }, rest), children ?? value);
}
Object.assign(__ds_scope, { PityPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/PityPill.jsx", error: String((e && e.message) || e) }); }

// components/core/ProgressBar.jsx
try { (() => {
/**
 * Pity progress bar — inset track with a colored, softly-glowing fill.
 * Color auto-ramps green→orange→red by percent unless `color` is given.
 */
function ProgressBar({
  value,
  max = 90,
  color,
  height = 9,
  style
}) {
  const pct = Math.min(100, value / max * 100);
  const auto = value < 60 ? 'var(--green)' : value <= 80 ? 'var(--orange)' : 'var(--red)';
  const fill = color || auto;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      borderRadius: 'var(--r-pill)',
      background: 'var(--panel-2)',
      border: '1px solid var(--line)',
      overflow: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${pct}%`,
      borderRadius: 'var(--r-pill)',
      background: fill,
      boxShadow: `0 0 12px ${fill}`,
      transition: 'width .5s cubic-bezier(.2,.7,.3,1)'
    }
  }));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Native select styled to match the dark dashboard — raised fill,
 * hairline border, custom gold caret.
 */
function Select({
  style,
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("select", _extends({
    style: {
      padding: '8px 34px 8px 12px',
      borderRadius: 'var(--r-md)',
      border: '1px solid var(--line)',
      background: 'var(--panel-2)',
      color: 'var(--txt)',
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      cursor: 'pointer',
      appearance: 'none',
      outline: 'none',
      backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'><path d=\'M2 4l4 4 4-4\' stroke=\'%23f5c542\' stroke-width=\'1.6\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>")',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/StatCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Compact metric tile: uppercase label, big display-font value, optional
 * muted unit. The summary-row workhorse. `accent` paints a top border;
 * `interactive` enables the Card hover lift.
 */
function StatCard({
  label,
  value,
  unit,
  valueColor,
  accent,
  interactive = true,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, _extends({
    interactive: interactive,
    accent: accent,
    style: style
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--muted)',
      fontSize: 11.5,
      textTransform: 'uppercase',
      letterSpacing: '.7px',
      fontWeight: 600
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 30,
      fontWeight: 700,
      marginTop: 8,
      lineHeight: 1.05,
      letterSpacing: '-.5px',
      color: valueColor || 'var(--txt)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, value, unit && /*#__PURE__*/React.createElement("small", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      color: 'var(--muted)',
      fontWeight: 500,
      marginLeft: 5,
      letterSpacing: 0
    }
  }, unit)));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Tabs.jsx
try { (() => {
/**
 * Tab bar with an animated gold sliding underline. Controlled via value/onChange.
 * Tabs: [{ id, label }]. The indicator measures the active tab and slides.
 */
function Tabs({
  tabs,
  value,
  onChange,
  style
}) {
  const wrapRef = React.useRef(null);
  const btnRefs = React.useRef({});
  const [ind, setInd] = React.useState({
    left: 0,
    width: 0
  });
  const measure = React.useCallback(() => {
    const el = btnRefs.current[value];
    const wrap = wrapRef.current;
    if (el && wrap) {
      const a = el.getBoundingClientRect(),
        b = wrap.getBoundingClientRect();
      setInd({
        left: a.left - b.left,
        width: a.width
      });
    }
  }, [value]);
  React.useEffect(() => {
    measure();
  }, [measure, tabs]);
  React.useEffect(() => {
    window.addEventListener('resize', measure);
    const t = setTimeout(measure, 60); // after webfont swap
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(t);
    };
  }, [measure]);
  return /*#__PURE__*/React.createElement("div", {
    ref: wrapRef,
    style: {
      position: 'relative',
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--line)',
      ...style
    }
  }, tabs.map(t => {
    const on = t.id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      ref: el => {
        btnRefs.current[t.id] = el;
      },
      type: "button",
      onClick: () => onChange && onChange(t.id),
      "aria-selected": on,
      style: {
        appearance: 'none',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '11px 16px 13px',
        fontFamily: 'var(--font-display)',
        fontSize: 14.5,
        fontWeight: 600,
        letterSpacing: '-.1px',
        color: on ? 'var(--txt)' : 'var(--muted)',
        transition: 'color .2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7
      },
      onMouseEnter: e => {
        if (!on) e.currentTarget.style.color = 'var(--txt)';
      },
      onMouseLeave: e => {
        if (!on) e.currentTarget.style.color = 'var(--muted)';
      }
    }, t.label, t.badge != null && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-sans)',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--muted)',
        background: 'var(--panel-2)',
        borderRadius: 'var(--r-pill)',
        padding: '1px 7px'
      }
    }, t.badge));
  }), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      bottom: -1,
      height: 2.5,
      borderRadius: 2,
      left: ind.left,
      width: ind.width,
      background: 'var(--grad-gold)',
      boxShadow: 'var(--glow-gold)',
      transition: 'left .28s cubic-bezier(.2,.7,.3,1), width .28s cubic-bezier(.2,.7,.3,1)'
    }
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Small neutral chip for inline metadata — banner names, labels.
 * Quieter than Badge: muted text on a raised fill, no semantic color.
 */
function Tag({
  style,
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-block',
      fontFamily: 'var(--font-sans)',
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 'var(--r-pill)',
      background: 'var(--panel-2)',
      color: 'var(--muted)',
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/core/ThemeToggle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SunIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  width: "15",
  height: "15",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, p), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "4"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
}));
const MoonIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, p), /*#__PURE__*/React.createElement("path", {
  d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
}));

/**
 * Segmented dark/light theme switch. Sets `data-theme` on a target element
 * (default <html>) and persists to localStorage. Controlled or uncontrolled.
 */
function ThemeToggle({
  value,
  onChange,
  target,
  storageKey = 'hsrwarp-theme',
  style
}) {
  const getEl = React.useCallback(() => target || (typeof document !== 'undefined' ? document.documentElement : null), [target]);
  const [theme, setTheme] = React.useState(() => {
    if (value) return value;
    try {
      return localStorage.getItem(storageKey) || 'dark';
    } catch (e) {
      return 'dark';
    }
  });
  const active = value || theme;
  React.useEffect(() => {
    const el = getEl();
    if (!el) return;
    el.setAttribute('data-theme', active);
    try {
      localStorage.setItem(storageKey, active);
    } catch (e) {}
  }, [active, getEl, storageKey]);
  const set = t => {
    if (!value) setTheme(t);
    onChange && onChange(t);
  };
  const opt = (key, Icon, label) => {
    const on = active === key;
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => set(key),
      "aria-pressed": on,
      "aria-label": label,
      style: {
        position: 'relative',
        zIndex: 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 'var(--r-pill)',
        border: 'none',
        background: 'transparent',
        color: on ? 'var(--on-accent)' : 'var(--muted)',
        fontFamily: 'var(--font-sans)',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'color .2s ease'
      }
    }, /*#__PURE__*/React.createElement(Icon, null), " ", label);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      padding: 3,
      borderRadius: 'var(--r-pill)',
      background: 'var(--panel-2)',
      border: '1px solid var(--line)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      top: 3,
      bottom: 3,
      width: 'calc(50% - 3px)',
      borderRadius: 'var(--r-pill)',
      background: 'var(--grad-gold)',
      boxShadow: 'var(--glow-gold)',
      left: active === 'dark' ? 3 : 'calc(50% + 0px)',
      transition: 'left .25s cubic-bezier(.2,.7,.3,1)'
    }
  }), opt('dark', MoonIcon, 'Dark'), opt('light', SunIcon, 'Light'));
}
Object.assign(__ds_scope, { ThemeToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ThemeToggle.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/BannerCards.jsx
try { (() => {
// Per-banner status cards: colored dot + big pity number + ProgressBar,
// then total / 5★ / avg-pity / 50/50 rows. Hover-lifting glass cards with a
// banner-colored top accent.
function BannerCards({
  D
}) {
  const {
    Card,
    ProgressBar,
    Badge
  } = window.HSRWarpDesignSystem_4a0d44;
  const {
    num,
    pityColor
  } = window.WarpUtil;
  const glowFor = c => `0 0 26px ${c}55`;
  return /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: 26
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h2"
  }, "\uBC30\uB108\uBCC4 \uD604\uD669"), /*#__PURE__*/React.createElement("div", {
    className: "banner-row"
  }, D.banners.map(b => /*#__PURE__*/React.createElement(Card, {
    key: b.type,
    interactive: true,
    accent: b.color,
    glow: glowFor(b.color),
    padding: 20
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 15,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: b.color,
      boxShadow: `0 0 10px ${b.color}`
    }
  }), b.short, " \uC6CC\uD504"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 38,
      fontWeight: 700,
      lineHeight: 1,
      color: pityColor(b.currentPity),
      fontVariantNumeric: 'tabular-nums'
    }
  }, b.currentPity), /*#__PURE__*/React.createElement("small", {
    style: {
      fontSize: 13,
      color: 'var(--muted)',
      fontWeight: 500
    }
  }, "/ ", b.cap, " \uCC9C\uC7A5")), /*#__PURE__*/React.createElement(ProgressBar, {
    value: b.currentPity,
    max: b.cap,
    style: {
      margin: '11px 0 14px'
    }
  }), /*#__PURE__*/React.createElement(Row, {
    k: "\uCD1D \uBF51\uAE30",
    v: num(b.total)
  }), /*#__PURE__*/React.createElement(Row, {
    k: "5\u2605 \uD68D\uB4DD",
    v: b.count5
  }), /*#__PURE__*/React.createElement(Row, {
    k: "\uD3C9\uADE0 \uCC9C\uC7A5",
    v: b.avgPity5 ? b.avgPity5.toFixed(1) : '-'
  }), b.kind === 'limited' && /*#__PURE__*/React.createElement(Row, {
    k: "\uD53D\uC2B9 / \uD53D\uB6AB / \uD655\uC815",
    v: `${b.cWins} / ${b.cLoss} / ${b.gWins}`
  }), b.kind === 'limited' && b.guaranteed && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "red"
  }, "\uB2E4\uC74C 5\u2605 \uD655\uC815"))))));
}
function Row({
  k,
  v
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      padding: '4px 0',
      color: 'var(--muted)',
      borderTop: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("span", null, k), /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--txt)',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums'
    }
  }, v));
}
window.BannerCards = BannerCards;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/BannerCards.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/BannersView.jsx
try { (() => {
// Banners tab — pick a banner (segmented control) and see a deep dive:
// big pity status, a pity-distribution histogram, 50/50 split, and that
// banner's full 5★ list (click → detail).
function BannersView({
  D,
  theme,
  onFiveClick
}) {
  const {
    Card,
    ProgressBar,
    Badge,
    StatCard
  } = window.HSRWarpDesignSystem_4a0d44;
  const {
    num,
    pityColor,
    pityBins
  } = window.WarpUtil;
  const [sel, setSel] = React.useState('캐릭터');
  const b = D.banners.find(x => x.short === sel);
  const fives = D.fives.filter(f => f.banner === sel);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 4,
      padding: 4,
      borderRadius: 'var(--r-pill)',
      background: 'var(--panel-2)',
      border: '1px solid var(--line)'
    }
  }, D.banners.map(x => {
    const on = x.short === sel;
    return /*#__PURE__*/React.createElement("button", {
      key: x.type,
      onClick: () => setSel(x.short),
      style: {
        appearance: 'none',
        border: 'none',
        cursor: 'pointer',
        borderRadius: 'var(--r-pill)',
        padding: '8px 16px',
        fontFamily: 'var(--font-display)',
        fontSize: 13.5,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        background: on ? 'var(--card-bg)' : 'transparent',
        boxShadow: on ? 'var(--shadow-card)' : 'none',
        color: on ? 'var(--txt)' : 'var(--muted)',
        transition: 'all .18s ease'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: x.color,
        boxShadow: on ? `0 0 8px ${x.color}` : 'none'
      }
    }), x.short);
  })), /*#__PURE__*/React.createElement("div", {
    className: "banner-detail",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    accent: b.color,
    padding: 22
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "\uD604\uC7AC \uCC9C\uC7A5 \xB7 ", b.short, " \uC6CC\uD504"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 56,
      fontWeight: 700,
      lineHeight: 1,
      color: pityColor(b.currentPity),
      fontVariantNumeric: 'tabular-nums'
    }
  }, b.currentPity), /*#__PURE__*/React.createElement("small", {
    style: {
      fontSize: 15,
      color: 'var(--muted)'
    }
  }, "/ ", b.cap, " \uCC9C\uC7A5")), /*#__PURE__*/React.createElement(ProgressBar, {
    value: b.currentPity,
    max: b.cap,
    style: {
      margin: '14px 0 6px'
    }
  }), b.kind === 'limited' && b.guaranteed ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "red"
  }, "\uB2E4\uC74C 5\u2605 \uD655\uC815 (\uD53D\uB6AB \uC0C1\uD0DC)")) : b.kind === 'limited' ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "green"
  }, "\uB2E4\uC74C 5\u2605 50/50")) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(Mini, {
    k: "\uCD1D \uBF51\uAE30",
    v: num(b.total)
  }), /*#__PURE__*/React.createElement(Mini, {
    k: "5\u2605 \uD68D\uB4DD",
    v: `${b.count5}개`
  }), /*#__PURE__*/React.createElement(Mini, {
    k: "\uD3C9\uADE0 \uCC9C\uC7A5",
    v: `${b.avgPity5.toFixed(1)}회`
  }), /*#__PURE__*/React.createElement(Mini, {
    k: "\uC18C\uBE44 \uC131\uC625",
    v: num(b.total * 160)
  }))), /*#__PURE__*/React.createElement(Card, {
    padding: 18
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl",
    style: {
      marginBottom: 12
    }
  }, "5\u2605 \uCC9C\uC7A5 \uBD84\uD3EC"), /*#__PURE__*/React.createElement(BannerPityChart, {
    bins: pityBins(D.fives, sel),
    cap: b.cap,
    theme: theme,
    sel: sel
  }), b.kind === 'limited' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Split, {
    label: "\uD53D\uC2B9",
    v: b.cWins,
    color: "var(--gold)",
    total: b.cWins + b.cLoss + b.gWins
  }), /*#__PURE__*/React.createElement(Split, {
    label: "\uD53D\uB6AB",
    v: b.cLoss,
    color: "var(--red)",
    total: b.cWins + b.cLoss + b.gWins
  }), /*#__PURE__*/React.createElement(Split, {
    label: "\uD655\uC815",
    v: b.gWins,
    color: "var(--green)",
    total: b.cWins + b.cLoss + b.gWins
  })))), /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h2"
  }, b.short, " \uC6CC\uD504 5\u2605 \uAE30\uB85D ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted)',
      fontWeight: 400
    }
  }, "(", fives.length, "\uAC1C)")), /*#__PURE__*/React.createElement(FivesTable, {
    rows: fives,
    onRowClick: onFiveClick
  })));
}
function Mini({
  k,
  v
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel-2)',
      borderRadius: 'var(--r-md)',
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: '.5px',
      fontWeight: 600
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 18,
      fontWeight: 600,
      marginTop: 3,
      fontVariantNumeric: 'tabular-nums'
    }
  }, v));
}
function Split({
  label,
  v,
  color,
  total
}) {
  const pct = total ? Math.round(v / total * 100) : 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12,
      marginBottom: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--muted)'
    }
  }, label), /*#__PURE__*/React.createElement("b", {
    style: {
      color
    }
  }, v)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 3,
      background: 'var(--panel-2)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${pct}%`,
      background: color,
      borderRadius: 3
    }
  })));
}
function BannerPityChart({
  bins,
  cap,
  theme,
  sel
}) {
  const ref = React.useRef();
  React.useEffect(() => {
    if (!window.Chart) return;
    const cs = getComputedStyle(document.documentElement);
    const muted = cs.getPropertyValue('--muted').trim(),
      grid = cs.getPropertyValue('--line').trim();
    const n = Math.ceil(cap / 10);
    const labels = Array.from({
      length: n
    }, (_, i) => `${i * 10 + 1}-${(i + 1) * 10}`);
    const data = bins.slice(0, n);
    const soft = cap === 80 ? 6 : 7;
    const c = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: data.map((_, i) => i < soft ? '#52d39a' : '#ff9e45'),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 600
        },
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            grid: {
              color: grid
            },
            ticks: {
              precision: 0,
              color: muted
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: muted
            }
          }
        }
      }
    });
    return () => c.destroy();
  }, [theme, sel, cap]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 200
    }
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: ref
  }));
}
window.BannersView = BannersView;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/BannersView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/ChartsGrid.jsx
try { (() => {
// Chart.js analysis grid — rarity doughnut, char-banner pity histogram,
// 50/50 stacked bars, monthly pulls. Reads themed colors from CSS vars and
// rebuilds when the theme flips.
function ChartsGrid({
  D,
  theme
}) {
  const {
    Card
  } = window.HSRWarpDesignSystem_4a0d44;
  const refs = {
    rarity: React.useRef(),
    pity: React.useRef(),
    ff: React.useRef(),
    month: React.useRef()
  };
  React.useEffect(() => {
    if (!window.Chart) return;
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    const muted = v('--muted'),
      grid = v('--line'),
      panel = v('--panel');
    const GOLD = '#f5c542',
      PURPLE = '#a474ff',
      BLUE = '#5aa9ff',
      GREEN = '#52d39a',
      RED = '#ff6b6b',
      ORANGE = '#ff9e45';
    Chart.defaults.color = muted;
    Chart.defaults.font.family = 'Space Grotesk, Noto Sans KR, sans-serif';
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 700
      }
    };
    const noLeg = {
      plugins: {
        legend: {
          display: false
        }
      }
    };
    const made = [];
    const pityBins = window.WarpUtil.pityBins(D.fives, '캐릭터');
    made.push(new Chart(refs.rarity.current, {
      type: 'doughnut',
      data: {
        labels: ['5★', '4★', '3★'],
        datasets: [{
          data: [D.rarity.c5, D.rarity.c4, D.rarity.c3],
          backgroundColor: [GOLD, PURPLE, BLUE],
          borderColor: panel,
          borderWidth: 4,
          hoverOffset: 6
        }]
      },
      options: {
        ...base,
        plugins: {
          legend: {
            position: 'bottom'
          }
        },
        cutout: '64%'
      }
    }));
    made.push(new Chart(refs.pity.current, {
      type: 'bar',
      data: {
        labels: ['1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90'],
        datasets: [{
          data: pityBins,
          backgroundColor: pityBins.map((_, i) => i < 7 ? GREEN : ORANGE),
          borderRadius: 6
        }]
      },
      options: {
        ...base,
        ...noLeg,
        scales: {
          y: {
            grid: {
              color: grid
            },
            ticks: {
              precision: 0
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    }));
    const lim = Object.keys(D.fiveFiveBins);
    made.push(new Chart(refs.ff.current, {
      type: 'bar',
      data: {
        labels: lim,
        datasets: [{
          label: '픽승',
          data: lim.map(k => D.fiveFiveBins[k].win),
          backgroundColor: GOLD,
          borderRadius: 4
        }, {
          label: '픽뚫',
          data: lim.map(k => D.fiveFiveBins[k].loss),
          backgroundColor: RED,
          borderRadius: 4
        }, {
          label: '확정',
          data: lim.map(k => D.fiveFiveBins[k].guar),
          backgroundColor: GREEN,
          borderRadius: 4
        }]
      },
      options: {
        ...base,
        indexAxis: 'y',
        plugins: {
          legend: {
            position: 'bottom'
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: {
              color: grid
            },
            ticks: {
              precision: 0
            }
          },
          y: {
            stacked: true,
            grid: {
              display: false
            }
          }
        }
      }
    }));
    const M = D.monthly;
    made.push(new Chart(refs.month.current, {
      type: 'bar',
      data: {
        labels: M.map(m => m.month.slice(2)),
        datasets: [{
          label: '3★',
          data: M.map(m => m.c3),
          backgroundColor: BLUE,
          borderRadius: 4
        }, {
          label: '4★',
          data: M.map(m => m.c4),
          backgroundColor: PURPLE,
          borderRadius: 4
        }, {
          label: '5★',
          data: M.map(m => m.c5),
          backgroundColor: GOLD,
          borderRadius: 4
        }]
      },
      options: {
        ...base,
        plugins: {
          legend: {
            position: 'bottom'
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: {
              display: false
            }
          },
          y: {
            stacked: true,
            grid: {
              color: grid
            }
          }
        }
      }
    }));
    return () => made.forEach(c => c.destroy());
  }, [theme]);
  const wrap = {
    position: 'relative',
    height: 230
  };
  const h3 = {
    fontSize: 13,
    marginBottom: 12,
    color: 'var(--muted)',
    fontWeight: 600,
    marginTop: 0,
    fontFamily: 'var(--font-display)'
  };
  return /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: 26
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h2"
  }, "\uBD84\uC11D \uCC28\uD2B8"), /*#__PURE__*/React.createElement("div", {
    className: "charts-row"
  }, /*#__PURE__*/React.createElement(Card, {
    padding: 18
  }, /*#__PURE__*/React.createElement("h3", {
    style: h3
  }, "\uD76C\uADC0\uB3C4 \uBD84\uD3EC"), /*#__PURE__*/React.createElement("div", {
    style: wrap
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: refs.rarity
  }))), /*#__PURE__*/React.createElement(Card, {
    padding: 18
  }, /*#__PURE__*/React.createElement("h3", {
    style: h3
  }, "\uCE90\uB9AD\uD130 \uBC30\uB108 5\u2605 \uCC9C\uC7A5 \uBD84\uD3EC"), /*#__PURE__*/React.createElement("div", {
    style: wrap
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: refs.pity
  }))), /*#__PURE__*/React.createElement(Card, {
    padding: 18
  }, /*#__PURE__*/React.createElement("h3", {
    style: h3
  }, "50/50 \uACB0\uACFC (\uD55C\uC815 \uBC30\uB108)"), /*#__PURE__*/React.createElement("div", {
    style: wrap
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: refs.ff
  }))), /*#__PURE__*/React.createElement(Card, {
    padding: 18
  }, /*#__PURE__*/React.createElement("h3", {
    style: h3
  }, "\uC6D4\uBCC4 \uBF51\uAE30"), /*#__PURE__*/React.createElement("div", {
    style: wrap
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: refs.month
  })))));
}
window.ChartsGrid = ChartsGrid;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/ChartsGrid.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Dashboard.jsx
try { (() => {
// Top-level app. Header (logo + RefreshBar + ThemeToggle), tab nav, and the
// active view with a cross-fade. Owns theme, loaded, current view, and the
// selected 5★ for the detail modal.
function Dashboard() {
  const {
    ThemeToggle,
    Tabs
  } = window.HSRWarpDesignSystem_4a0d44;
  const D = window.WARP_DATA;
  const [loaded, setLoaded] = React.useState(false);
  const [view, setView] = React.useState('overview');
  const [five, setFive] = React.useState(null);
  const [theme, setTheme] = React.useState(() => {
    try {
      return localStorage.getItem('hsrwarp-theme') || 'dark';
    } catch (e) {
      return 'dark';
    }
  });
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const tabs = [{
    id: 'overview',
    label: '개요'
  }, {
    id: 'banners',
    label: '배너별'
  }, {
    id: 'history',
    label: '기록',
    badge: D.fives.length
  }, {
    id: 'versions',
    label: '버전 비교'
  }];
  function refresh(done) {
    setTimeout(done, 1100);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-train.svg",
    alt: "",
    width: "46",
    height: "46",
    style: {
      borderRadius: 12,
      boxShadow: 'var(--glow-gold)'
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 24,
      fontWeight: 700,
      margin: 0,
      letterSpacing: '-.4px'
    }
  }, "Honkai: Star Rail ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gold-ink)'
    }
  }, "\uC6CC\uD504 \uB300\uC2DC\uBCF4\uB4DC")), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--muted)',
      fontSize: 13,
      marginTop: 3
    }
  }, loaded ? 'UID 840855779 · 모든 분석은 로컬에서만 처리됩니다.' : '완전 로컬 · 매달 자동 갱신 · 기록은 외부로 전송되지 않습니다.')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, loaded && /*#__PURE__*/React.createElement(RefreshBar, {
    onRefresh: refresh
  }), /*#__PURE__*/React.createElement(ThemeToggle, {
    value: theme,
    onChange: setTheme
  }))), !loaded ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(QueryPanel, {
    onLoaded: () => setLoaded(true)
  }), /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "empty-glyph"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-train.svg",
    alt: "",
    width: "64",
    height: "64",
    style: {
      borderRadius: 16
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 19,
      fontWeight: 600,
      marginTop: 18
    }
  }, "\uC544\uC9C1 \uBD88\uB7EC\uC628 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--muted)',
      fontSize: 13.5,
      marginTop: 6,
      maxWidth: 380,
      lineHeight: 1.6
    }
  }, "\uAC8C\uC784\uC5D0\uC11C ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--txt)'
    }
  }, "\uC804\uC5B8 \u2192 \uAE30\uB85D"), " \uD654\uBA74\uC744 \uC5F0 \uB4A4 \uC704\uC758 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--gold-ink)'
    }
  }, "\uC870\uD68C"), " \uBC84\uD2BC\uC744 \uB204\uB974\uBA74 \uCC9C\uC7A5 \xB7 \uC6B4 \xB7 \uD53D\uB6AB \uD1B5\uACC4\uAC00 \uC5EC\uAE30\uC5D0 \uB098\uD0C0\uB0A9\uB2C8\uB2E4."))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    tabs: tabs,
    value: view,
    onChange: setView
  })), /*#__PURE__*/React.createElement("div", {
    key: view,
    className: "view",
    style: {
      marginTop: 22
    }
  }, view === 'overview' && /*#__PURE__*/React.createElement(OverviewView, {
    D: D,
    theme: theme,
    onSeeAll: () => setView('history'),
    onFiveClick: setFive
  }), view === 'banners' && /*#__PURE__*/React.createElement(BannersView, {
    D: D,
    theme: theme,
    onFiveClick: setFive
  }), view === 'history' && /*#__PURE__*/React.createElement(HistoryView, {
    D: D,
    onFiveClick: setFive
  }), view === 'versions' && /*#__PURE__*/React.createElement(VersionsView, {
    D: D,
    theme: theme
  })), /*#__PURE__*/React.createElement("div", {
    className: "foot"
  }, "\uBF51\uAE30 1\uD68C = \uC131\uC625 160 \uAE30\uC900 \xB7 \uBE44\uACF5\uC2DD \uB3C4\uAD6C\uC774\uBA70 \uD638\uC694\uBC84\uC2A4\uC640 \uBB34\uAD00 \xB7 \uB370\uC774\uD130 \uD615\uC2DD SRGF v1.0", /*#__PURE__*/React.createElement("br", null), "50/50 \uD310\uC815: 5\u2605 \uD68D\uB4DD \uC2DC\uC810\uC758 \uBC30\uB108 \uD53D\uC5C5(rate-up) \uB300\uC0C1\uC774\uBA74 \u2018\uD53D\uC2B9\u2019, \uC544\uB2C8\uBA74 \u2018\uD53D\uB6AB\u2019.")), /*#__PURE__*/React.createElement(FiveDetail, {
    five: five,
    onClose: () => setFive(null)
  }));
}
window.Dashboard = Dashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/FiveDetail.jsx
try { (() => {
// 5★ detail modal — opens when a history row is clicked. Shows the warp's
// context: banner, pity vs theoretical average, 50/50 outcome, version, time.
function FiveDetail({
  five,
  onClose
}) {
  const {
    Dialog,
    PityPill,
    Tag,
    ProgressBar,
    Badge
  } = window.HSRWarpDesignSystem_4a0d44;
  const {
    RESULT
  } = window.WarpUtil;
  const f = five;
  if (!f) return /*#__PURE__*/React.createElement(Dialog, {
    open: false,
    onClose: onClose
  });
  const meta = window.WARP_DATA.banners.find(b => b.short === f.banner) || {
    cap: 90,
    expAvg: 62.5
  };
  const r = f.result ? RESULT[f.result] : null;
  const diff = meta.expAvg ? Math.round(meta.expAvg - f.pity) : null;
  const lucky = diff != null && diff > 0;
  const Stat = ({
    k,
    children
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '.6px',
      color: 'var(--muted)',
      fontWeight: 600,
      marginBottom: 6
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, children));
  return /*#__PURE__*/React.createElement(Dialog, {
    open: !!f,
    onClose: onClose,
    width: 480,
    title: /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: f.isPickup === false ? 'var(--muted)' : 'var(--gold-ink)'
      }
    }, f.name), " \xB7 5\u2605 \uC0C1\uC138")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Tag, null, f.banner, " \uC6CC\uD504"), r && /*#__PURE__*/React.createElement(Badge, {
    variant: f.result === 'loss' ? 'red' : f.result === 'win' ? 'gold' : 'green',
    solid: f.result === 'win'
  }, r.label), f.isPickup === false && /*#__PURE__*/React.createElement(Badge, {
    variant: "neutral"
  }, "\uC0C1\uC2DC / \uD53D\uB6AB")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      flexWrap: 'wrap',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    k: "\uCC9C\uC7A5"
  }, /*#__PURE__*/React.createElement(PityPill, {
    value: f.pity
  }), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--muted)',
      fontWeight: 500
    }
  }, "/ ", meta.cap, "\uD68C")), /*#__PURE__*/React.createElement(Stat, {
    k: "\uBC84\uC804"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)'
    }
  }, f.version)), /*#__PURE__*/React.createElement(Stat, {
    k: "\uD68D\uB4DD \uC2DC\uAC01"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5
    }
  }, f.time))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '.6px',
      color: 'var(--muted)',
      fontWeight: 600
    }
  }, "\uCC9C\uC7A5 \uC9C4\uD589"), /*#__PURE__*/React.createElement(ProgressBar, {
    value: f.pity,
    max: meta.cap
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      padding: '12px 14px',
      borderRadius: 'var(--r-md)',
      background: lucky ? 'var(--green-fill)' : diff != null ? 'var(--red-fill)' : 'var(--panel-2)',
      border: `1px solid ${lucky ? 'var(--green-line)' : diff != null ? 'var(--red-line)' : 'var(--line)'}`,
      fontSize: 13,
      color: 'var(--txt)',
      lineHeight: 1.6
    }
  }, diff != null ? /*#__PURE__*/React.createElement(React.Fragment, null, "\uC774 5\u2605\uB294 ", /*#__PURE__*/React.createElement("b", null, f.pity, "\uD68C"), "\uC5D0 \uB5B4\uC2B5\uB2C8\uB2E4 \u2014 \uC774 \uBC30\uB108\uC758 \uC774\uB860 \uD3C9\uADE0 ", /*#__PURE__*/React.createElement("b", null, meta.expAvg, "\uD68C"), " \uB300\uBE44", ' ', /*#__PURE__*/React.createElement("b", {
    style: {
      color: lucky ? 'var(--green)' : 'var(--red)'
    }
  }, lucky ? `${diff}회 적게` : `${-diff}회 많이`), " \uC37C\uC2B5\uB2C8\uB2E4.", r && f.result === 'loss' && ' 50/50에서 픽업이 아닌 5★가 나와 다음 한정은 확정입니다.', r && f.result === 'win' && ' 50/50 승부에서 픽업을 뽑았습니다.', r && f.result === 'guaranteed' && ' 직전 픽뚫로 인한 확정 획득입니다.') : '상시(스텔라) 워프 획득으로 50/50 판정 대상이 아닙니다.'));
}
window.FiveDetail = FiveDetail;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/FiveDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/FivesTable.jsx
try { (() => {
// 5★ acquisition history table. Rows are passed in (filtered by the parent).
// Clicking a row calls onRowClick(f) — used to open the detail modal.
function FivesTable({
  rows,
  onRowClick
}) {
  const {
    Tag,
    PityPill,
    Card
  } = window.HSRWarpDesignSystem_4a0d44;
  const {
    RESULT
  } = window.WarpUtil;
  return /*#__PURE__*/React.createElement(Card, {
    padding: 6
  }, /*#__PURE__*/React.createElement("table", {
    className: "tbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uC774\uB984"), /*#__PURE__*/React.createElement("th", null, "\uBC30\uB108"), /*#__PURE__*/React.createElement("th", null, "\uCC9C\uC7A5"), /*#__PURE__*/React.createElement("th", null, "\uACB0\uACFC"), /*#__PURE__*/React.createElement("th", null, "\uBC84\uC804"), /*#__PURE__*/React.createElement("th", null, "\uD68D\uB4DD \uC2DC\uAC01"))), /*#__PURE__*/React.createElement("tbody", null, rows.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 6,
    style: {
      color: 'var(--muted)',
      textAlign: 'center',
      padding: '22px 0'
    }
  }, "\uD574\uB2F9 \uC870\uAC74\uC758 5\u2605 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.")), rows.map((f, i) => {
    const r = f.result ? RESULT[f.result] : null;
    return /*#__PURE__*/React.createElement("tr", {
      key: i,
      onClick: () => onRowClick && onRowClick(f),
      style: {
        cursor: onRowClick ? 'pointer' : 'default'
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        fontWeight: 600,
        color: f.isPickup === false ? 'var(--muted)' : 'var(--gold-ink)'
      }
    }, f.name), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Tag, null, f.banner)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(PityPill, {
      value: f.pity
    })), /*#__PURE__*/React.createElement("td", null, r ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        fontSize: 12,
        color: r.color
      }
    }, r.label) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted)'
      }
    }, "-")), /*#__PURE__*/React.createElement("td", {
      style: {
        color: 'var(--muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5
      }
    }, f.version), /*#__PURE__*/React.createElement("td", {
      style: {
        color: 'var(--muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5
      }
    }, f.time));
  }))));
}
window.FivesTable = FivesTable;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/FivesTable.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/HeroSummary.jsx
try { (() => {
// Hero bento + summary stat row. The luck card is "featured" (gradient
// accent + glow + big animated number); 50/50 and avg-pity sit beside it.
function HeroSummary({
  D
}) {
  const {
    Card,
    LuckBar,
    StatCard,
    Badge
  } = window.HSRWarpDesignSystem_4a0d44;
  const {
    num,
    useCountUp
  } = window.WarpUtil;
  const cb = D.charBanner;
  const luck = useCountUp(D.luck.charAvgPity, {
    decimals: 1
  });
  const win = useCountUp(cb.win5050);
  const avg = useCountUp(cb.avgPity5, {
    decimals: 1
  });
  const [showBar, setShowBar] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setShowBar(true), 350);
    return () => clearTimeout(t);
  }, []);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("section", {
    className: "hero-bento"
  }, /*#__PURE__*/React.createElement(Card, {
    interactive: true,
    glow: "var(--glow-gold)",
    accent: "var(--gold)",
    padding: 22,
    style: {
      gridColumn: 'span 2',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "\uC6B4 \uC9C0\uD45C \xB7 \uCE90\uB9AD\uD130 \uD3C9\uADE0 \uCC9C\uC7A5"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 14,
      flexWrap: 'wrap',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 64,
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: '-1.5px',
      color: 'var(--green)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, luck, /*#__PURE__*/React.createElement("small", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 19,
      color: 'var(--muted)',
      fontWeight: 500,
      marginLeft: 4
    }
  }, "\uD68C")), /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--green-fill)',
      color: 'var(--green)',
      border: '1px solid var(--green-line)',
      borderRadius: 'var(--r-pill)',
      padding: '5px 12px',
      fontSize: 13,
      fontWeight: 700
    }
  }, "+", D.luck.charLuckPct, "% \uD589\uC6B4")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted)',
      marginTop: 10
    }
  }, "\uC774\uB860 \uD3C9\uADE0 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--txt)'
    }
  }, "62.5\uD68C"), " \uB300\uBE44 \uC801\uAC8C \uC4F0\uACE0 \uBF51\uC558\uC2B5\uB2C8\uB2E4 \u2014 5\u2605 ", cb.count5, "\uAC1C \uAE30\uC900."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      paddingTop: 22
    }
  }, /*#__PURE__*/React.createElement(LuckBar, {
    markerPct: showBar ? D.luck.markerPct : 50
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 11,
      color: 'var(--muted)',
      marginTop: 8,
      fontFamily: 'var(--font-mono)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\uD589\uC6B4 \u25C2 \uC801\uAC8C"), /*#__PURE__*/React.createElement("span", null, "\uD3C9\uADE0 62.5"), /*#__PURE__*/React.createElement("span", null, "\uB9CE\uC774 \u25B8 \uBD88\uC6B4")))), /*#__PURE__*/React.createElement(Card, {
    interactive: true,
    accent: "var(--gold)",
    padding: 22,
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "\uD53D\uC2B9\uB960 \xB7 \uCE90\uB9AD\uD130 50/50"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 46,
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: '-1px',
      color: 'var(--gold-ink)',
      marginTop: 2,
      fontVariantNumeric: 'tabular-nums'
    }
  }, win, /*#__PURE__*/React.createElement("small", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 16,
      color: 'var(--muted)',
      fontWeight: 500,
      marginLeft: 3
    }
  }, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--muted)',
      marginTop: 8
    }
  }, "\uC2B9\uBD80 ", cb.contested, "\uD68C \uC911 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--gold-ink)'
    }
  }, cb.cWins, "\uC2B9"), " \xB7 ", cb.cLoss, "\uD328 \xB7 \uD655\uC815 ", cb.gWins, "\uD68C"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "green"
  }, "\uB2E4\uC74C 5\u2605 50/50"))), /*#__PURE__*/React.createElement(Card, {
    interactive: true,
    accent: "var(--purple)",
    padding: 22,
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "\uD3C9\uADE0 \uCC9C\uC7A5 \xB7 \uCE90\uB9AD\uD130"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 46,
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: '-1px',
      marginTop: 2,
      fontVariantNumeric: 'tabular-nums'
    }
  }, avg, /*#__PURE__*/React.createElement("small", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 16,
      color: 'var(--muted)',
      fontWeight: 500,
      marginLeft: 3
    }
  }, "\uD68C")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--muted)',
      marginTop: 8
    }
  }, "\uCD5C\uACE0 \uC6B4 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--green)'
    }
  }, cb.bestPity, "\uD68C"), " \xB7 \uCD5C\uC545 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--red)'
    }
  }, cb.worstPity, "\uD68C")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      paddingTop: 16,
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      background: 'var(--green)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      background: 'var(--orange)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      background: 'var(--red)',
      opacity: .5
    }
  })))), /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-row"
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "\uCD1D \uBF51\uAE30",
    value: num(useCountUp(D.total)),
    unit: "\uD68C"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "\uC18C\uBE44 \uC131\uC625",
    value: num(useCountUp(D.jade)),
    unit: '≈ ' + num(D.jade / 160) + '연차'
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "5\u2605",
    value: useCountUp(D.count5),
    unit: "\uAC1C",
    accent: "var(--gold)",
    valueColor: "var(--gold-ink)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "4\u2605",
    value: useCountUp(D.count4),
    unit: "\uAC1C",
    accent: "var(--purple)",
    valueColor: "var(--purple)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "5\u2605 \uD655\uB960",
    value: useCountUp(D.rate5, {
      decimals: 2
    }),
    unit: "%"
  }))));
}
window.HeroSummary = HeroSummary;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/HeroSummary.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/HistoryView.jsx
try { (() => {
// History tab — full 5★ list with banner + result filter chips. Rows click
// through to the detail modal (item 6).
function HistoryView({
  D,
  onFiveClick
}) {
  const [banner, setBanner] = React.useState('전체');
  const [result, setResult] = React.useState('전체');
  const banners = ['전체', '캐릭터', '광추', '일반'];
  const results = [['전체', null], ['픽승', 'win'], ['픽뚫', 'loss'], ['확정', 'guaranteed']];
  const rows = D.fives.filter(f => (banner === '전체' || f.banner === banner) && (result === '전체' || f.result === results.find(r => r[0] === result)[1]));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18,
      flexWrap: 'wrap',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(ChipGroup, {
    label: "\uBC30\uB108",
    options: banners,
    value: banner,
    onChange: setBanner
  }), /*#__PURE__*/React.createElement(ChipGroup, {
    label: "\uACB0\uACFC",
    options: results.map(r => r[0]),
    value: result,
    onChange: setResult
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--muted)',
      marginBottom: 12
    }
  }, "\uCD1D ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--txt)'
    }
  }, rows.length), "\uAC1C \xB7 \uD589\uC744 \uD074\uB9AD\uD558\uBA74 \uC0C1\uC138\uAC00 \uC5F4\uB9BD\uB2C8\uB2E4."), /*#__PURE__*/React.createElement(FivesTable, {
    rows: rows,
    onRowClick: onFiveClick
  }));
}
function ChipGroup({
  label,
  options,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '.6px',
      color: 'var(--muted)',
      fontWeight: 600
    }
  }, label), options.map(o => {
    const on = o === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o,
      onClick: () => onChange(o),
      style: {
        appearance: 'none',
        cursor: 'pointer',
        borderRadius: 'var(--r-pill)',
        padding: '6px 13px',
        fontFamily: 'var(--font-sans)',
        fontSize: 12.5,
        fontWeight: 600,
        border: `1px solid ${on ? 'var(--gold-line)' : 'var(--line)'}`,
        background: on ? 'var(--gold-fill)' : 'transparent',
        color: on ? 'var(--gold-ink)' : 'var(--muted)',
        transition: 'all .15s ease'
      }
    }, o);
  }));
}
window.HistoryView = HistoryView;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/HistoryView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/OverviewView.jsx
try { (() => {
// Overview tab — hero bento, summary stats, banner cards, charts, recent 5★.
// Entrance is handled by the parent .view CSS animation (base state visible,
// so content never gets stuck hidden if a timer is throttled).
function OverviewView({
  D,
  theme,
  onSeeAll,
  onFiveClick
}) {
  const recent = D.fives.slice(0, 5);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(HeroSummary, {
    D: D
  }), /*#__PURE__*/React.createElement(BannerCards, {
    D: D
  }), /*#__PURE__*/React.createElement(ChartsGrid, {
    D: D,
    theme: theme
  }), /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: 26
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h2",
    style: {
      margin: 0
    }
  }, "\uCD5C\uADFC 5\u2605"), /*#__PURE__*/React.createElement("button", {
    className: "linkbtn",
    onClick: onSeeAll
  }, "\uC804\uCCB4 \uAE30\uB85D \uBCF4\uAE30 \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(FivesTable, {
    rows: recent,
    onRowClick: onFiveClick
  }))));
}
window.OverviewView = OverviewView;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/OverviewView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/QueryPanel.jsx
try { (() => {
// First-run query card — game-path input + gold 조회 button. The fetch shows
// per-banner progress bars filling (item 5), then calls onLoaded().
function QueryPanel({
  onLoaded
}) {
  const {
    Input,
    Button,
    Card
  } = window.HSRWarpDesignSystem_4a0d44;
  const [path, setPath] = React.useState('C:\\Program Files\\Star Rail\\Games');
  const [busy, setBusy] = React.useState(false);
  const [prog, setProg] = React.useState(null); // {캐릭터, 광추, 일반}

  const targets = {
    캐릭터: 24,
    광추: 11,
    일반: 3
  };
  function run() {
    if (busy) return;
    setBusy(true);
    const order = ['캐릭터', '광추', '일반'];
    const cur = {
      캐릭터: 0,
      광추: 0,
      일반: 0
    };
    let idx = 0,
      finished = false;
    setProg({
      ...cur
    });
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(id);
      setProg({
        ...targets
      });
      setBusy(false);
      onLoaded();
    };
    const id = setInterval(() => {
      if (finished) return;
      const k = order[idx];
      cur[k] = Math.min(targets[k], cur[k] + Math.ceil(targets[k] / 8));
      setProg({
        ...cur
      });
      if (cur[k] >= targets[k]) {
        idx += 1;
        if (idx >= order.length) {
          clearInterval(id);
          setTimeout(finish, 380);
        }
      }
    }, 95);
    // Wall-clock safety net: a single timeout fires reliably even when the
    // page is backgrounded and the fast interval gets throttled to ~1s/tick.
    setTimeout(finish, 2600);
  }
  return /*#__PURE__*/React.createElement(Card, {
    padding: 18,
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    value: path,
    onChange: e => setPath(e.target.value),
    placeholder: "\uAC8C\uC784 \uACBD\uB85C (\u2026\\Star Rail Games)",
    style: {
      flex: 1,
      minWidth: 280
    }
  }), /*#__PURE__*/React.createElement(Button, {
    onClick: run,
    disabled: busy
  }, busy ? '조회 중…' : '조회')), !busy && !prog && /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--muted)',
      fontSize: 12.5,
      marginTop: 9
    }
  }, "\uAC8C\uC784\uC5D0\uC11C ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--txt)'
    }
  }, "\uC804\uC5B8 \uAE30\uB85D"), " \uD654\uBA74\uC744 \uCD5C\uADFC 24\uC2DC\uAC04 \uB0B4 \uD55C \uBC88 \uC5F0 \uB4A4 \uC870\uD68C\uD558\uC138\uC694. \uAE30\uC874 \uB370\uC774\uD130\uB294 \uC548\uC804\uD558\uAC8C \uBCF4\uC874\uB418\uBA70 \uC2E0\uADDC\uB9CC \uCD94\uAC00\uB429\uB2C8\uB2E4."), prog && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'grid',
      gap: 9
    }
  }, ['캐릭터', '광추', '일반'].map(k => {
    const pct = Math.round(prog[k] / targets[k] * 100);
    const live = busy && prog[k] < targets[k];
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 52,
        fontSize: 12.5,
        color: 'var(--muted)'
      }
    }, k), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        height: 7,
        borderRadius: 'var(--r-pill)',
        background: 'var(--panel-2)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        width: `${pct}%`,
        borderRadius: 'var(--r-pill)',
        background: 'var(--grad-gold)',
        transition: 'width .12s linear'
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: live ? 'var(--gold-ink)' : 'var(--green)',
        width: 54,
        textAlign: 'right'
      }
    }, live ? `+${prog[k]}…` : `+${prog[k]} ✓`));
  })));
}
window.QueryPanel = QueryPanel;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/QueryPanel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/RefreshBar.jsx
try { (() => {
// Collapsed refresh control shown after data is loaded. A compact chip with
// last-updated time + ↻ 새로고침; clicking 경로 expands the path input inline.
function RefreshBar({
  onRefresh
}) {
  const {
    Input,
    Button
  } = window.HSRWarpDesignSystem_4a0d44;
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [path, setPath] = React.useState('C:\\Program Files\\Star Rail\\Games');
  function run() {
    if (busy) return;
    setBusy(true);
    onRefresh(() => {
      setBusy(false);
      setOpen(false);
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 'var(--r-pill)',
      padding: '7px 8px 7px 16px',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--green)',
      boxShadow: '0 0 8px var(--green)',
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--muted)'
    }
  }, "\uB9C8\uC9C0\uB9C9 \uAC31\uC2E0 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--txt)',
      fontFamily: 'var(--font-mono)'
    }
  }, "02:18")), open && /*#__PURE__*/React.createElement(Input, {
    value: path,
    onChange: e => setPath(e.target.value),
    placeholder: "\uAC8C\uC784 \uACBD\uB85C",
    style: {
      flex: 1,
      minWidth: 200,
      padding: '7px 11px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: open ? 0 : 'auto',
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setOpen(o => !o)
  }, open ? '경로 닫기' : '경로'), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: run,
    disabled: busy
  }, busy ? '갱신 중…' : '↻ 새로고침')));
}
window.RefreshBar = RefreshBar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/RefreshBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/VersionsView.jsx
try { (() => {
// Versions tab — per-patch comparison (item 4). A range Select filters which
// versions show; a row click highlights it; a bar chart compares average pity
// against the 62.5 theoretical line (shorter = luckier).
function VersionsView({
  D,
  theme
}) {
  const {
    Card,
    Select
  } = window.HSRWarpDesignSystem_4a0d44;
  const {
    num
  } = window.WarpUtil;
  const [range, setRange] = React.useState('전체');
  const [sel, setSel] = React.useState(null);
  const all = D.versions;
  const rows = all.filter(v => range === '전체' ? true : range === '4.x' ? v.v.startsWith('4') : v.v.startsWith('3'));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--muted)'
    }
  }, "\uBE44\uAD50 \uBC94\uC704"), /*#__PURE__*/React.createElement(Select, {
    value: range,
    onChange: e => setRange(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "\uC804\uCCB4"
  }, "\uC804\uCCB4"), /*#__PURE__*/React.createElement("option", {
    value: "4.x"
  }, "4.x"), /*#__PURE__*/React.createElement("option", {
    value: "3.x"
  }, "3.x")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--muted)',
      marginLeft: 'auto'
    }
  }, "\uD589\uC744 \uD074\uB9AD\uD574 \uD574\uB2F9 \uD328\uCE58\uB97C \uAC15\uC870\uD558\uC138\uC694.")), /*#__PURE__*/React.createElement(Card, {
    padding: 18,
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl",
    style: {
      marginBottom: 12
    }
  }, "\uCE90\uB9AD\uD130 \uD3C9\uADE0 \uCC9C\uC7A5 \uBE44\uAD50 ", /*#__PURE__*/React.createElement("span", {
    style: {
      textTransform: 'none',
      letterSpacing: 0,
      fontWeight: 400
    }
  }, "\xB7 \uC9E7\uC744\uC218\uB85D \uD589\uC6B4 (\uAE30\uC900 62.5)")), /*#__PURE__*/React.createElement(VersionPityChart, {
    rows: rows,
    sel: sel,
    theme: theme
  })), /*#__PURE__*/React.createElement(Card, {
    padding: 6
  }, /*#__PURE__*/React.createElement("table", {
    className: "tbl"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "\uBC84\uC804"), /*#__PURE__*/React.createElement("th", null, "\uAE30\uAC04"), /*#__PURE__*/React.createElement("th", null, "\uBF51\uAE30"), /*#__PURE__*/React.createElement("th", null, "5\u2605"), /*#__PURE__*/React.createElement("th", null, "\uCE90\uB9AD \uD3C9\uADE0\uCC9C\uC7A5"), /*#__PURE__*/React.createElement("th", null, "\uD53D\uC2B9 / \uD53D\uB6AB"))), /*#__PURE__*/React.createElement("tbody", null, rows.map(v => {
    const on = sel === v.v;
    const lucky = v.charAvgPity < 62.5;
    return /*#__PURE__*/React.createElement("tr", {
      key: v.v,
      onClick: () => setSel(on ? null : v.v),
      style: {
        cursor: 'pointer',
        background: on ? 'var(--gold-fill)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("b", {
      style: {
        fontFamily: 'var(--font-display)',
        color: on ? 'var(--gold-ink)' : 'var(--txt)'
      }
    }, v.v)), /*#__PURE__*/React.createElement("td", {
      style: {
        color: 'var(--muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12
      }
    }, v.period), /*#__PURE__*/React.createElement("td", {
      style: {
        fontVariantNumeric: 'tabular-nums'
      }
    }, num(v.total)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-block',
        minWidth: 28,
        textAlign: 'center',
        fontWeight: 700,
        fontSize: 12,
        padding: '3px 8px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--gold)',
        color: 'var(--on-accent)'
      }
    }, v.count5)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: lucky ? 'var(--green)' : 'var(--red)',
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums'
      }
    }, v.charAvgPity.toFixed(1))), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--gold-ink)',
        fontWeight: 600
      }
    }, v.cWins), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted)'
      }
    }, "/"), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--red)',
        fontWeight: 600
      }
    }, v.cLoss)));
  })))));
}
function VersionPityChart({
  rows,
  sel,
  theme
}) {
  const ref = React.useRef();
  React.useEffect(() => {
    if (!window.Chart) return;
    const cs = getComputedStyle(document.documentElement);
    const muted = cs.getPropertyValue('--muted').trim(),
      grid = cs.getPropertyValue('--line').trim();
    const colors = rows.map(v => {
      const lucky = v.charAvgPity < 62.5;
      const base = lucky ? '#52d39a' : '#ff6b6b';
      return sel && sel !== v.v ? base + '66' : base;
    });
    const c = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: rows.map(v => v.v),
        datasets: [{
          data: rows.map(v => v.charAvgPity),
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 600
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.parsed.y.toFixed(1)}회`
            }
          }
        },
        scales: {
          y: {
            grid: {
              color: grid
            },
            ticks: {
              color: muted
            },
            suggestedMax: 90,
            afterBuildTicks: a => {
              if (!a.ticks.some(t => t.value === 62.5)) a.ticks.push({
                value: 62.5
              });
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: muted,
              font: {
                family: 'Space Grotesk'
              }
            }
          }
        }
      }
    });
    return () => c.destroy();
  }, [rows, sel, theme]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 210
    }
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: ref
  }));
}
window.VersionsView = VersionsView;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/VersionsView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/data.js
try { (() => {
// Pre-computed, realistic analysis for the demo dashboard. Mirrors the shape
// the real web/analyze.js produces. `fives` is the source for the history /
// banner / version views; headline numbers are kept for the hero.
window.WARP_DATA = {
  info: {
    uid: '840855779',
    export: '2026.06.21 02:18'
  },
  total: 2184,
  jade: 349440,
  count5: 41,
  count4: 312,
  count3: 1831,
  rate5: 1.88,
  luck: {
    charAvgPity: 58.2,
    charLuckPct: 7,
    markerPct: 46.6
  },
  charBanner: {
    win5050: 62,
    contested: 21,
    cWins: 13,
    cLoss: 8,
    gWins: 7,
    count5: 28,
    avgPity5: 58.2,
    bestPity: 9,
    worstPity: 89,
    currentGuaranteed: false,
    currentPity: 41
  },
  banners: [{
    type: '11',
    short: '캐릭터',
    color: '#a474ff',
    cap: 90,
    kind: 'limited',
    currentPity: 41,
    total: 1284,
    count5: 28,
    avgPity5: 58.2,
    cWins: 13,
    cLoss: 8,
    gWins: 7,
    guaranteed: false,
    expAvg: 62.5
  }, {
    type: '12',
    short: '광추',
    color: '#5aa9ff',
    cap: 80,
    kind: 'limited',
    currentPity: 12,
    total: 612,
    count5: 9,
    avgPity5: 51.4,
    cWins: 5,
    cLoss: 2,
    gWins: 2,
    guaranteed: true,
    expAvg: 53.5
  }, {
    type: '1',
    short: '일반',
    color: '#52d39a',
    cap: 90,
    kind: 'standard',
    currentPity: 27,
    total: 288,
    count5: 4,
    avgPity5: 64.0,
    cWins: 0,
    cLoss: 0,
    gWins: 0,
    guaranteed: false,
    expAvg: 62.5
  }],
  rarity: {
    c5: 41,
    c4: 312,
    c3: 1831
  },
  fiveFiveBins: {
    '캐릭터': {
      win: 13,
      loss: 8,
      guar: 7
    },
    '광추': {
      win: 5,
      loss: 2,
      guar: 2
    }
  },
  monthly: [{
    month: '2026.01',
    c3: 142,
    c4: 24,
    c5: 3,
    total: 169,
    jade: 27040
  }, {
    month: '2026.02',
    c3: 168,
    c4: 28,
    c5: 4,
    total: 200,
    jade: 32000
  }, {
    month: '2026.03',
    c3: 121,
    c4: 21,
    c5: 2,
    total: 144,
    jade: 23040
  }, {
    month: '2026.04',
    c3: 198,
    c4: 34,
    c5: 5,
    total: 237,
    jade: 37920
  }, {
    month: '2026.05',
    c3: 213,
    c4: 36,
    c5: 6,
    total: 255,
    jade: 40800
  }, {
    month: '2026.06',
    c3: 96,
    c4: 17,
    c5: 3,
    total: 116,
    jade: 18560
  }],
  // Per-version comparison (recent patches). period = 시작 ~ 끝.
  versions: [{
    v: '3.7',
    period: '2025-11-04 ~ 2025-12-16',
    total: 176,
    count5: 4,
    charAvgPity: 71.5,
    cWins: 1,
    cLoss: 2
  }, {
    v: '3.8',
    period: '2025-12-16 ~ 2026-02-12',
    total: 268,
    count5: 5,
    charAvgPity: 60.2,
    cWins: 2,
    cLoss: 1
  }, {
    v: '4.0',
    period: '2026-02-12 ~ 2026-03-24',
    total: 312,
    count5: 6,
    charAvgPity: 49.0,
    cWins: 3,
    cLoss: 1
  }, {
    v: '4.1',
    period: '2026-03-24 ~ 2026-04-21',
    total: 244,
    count5: 5,
    charAvgPity: 64.4,
    cWins: 2,
    cLoss: 2
  }, {
    v: '4.2',
    period: '2026-04-21 ~ 2026-06-01',
    total: 398,
    count5: 8,
    charAvgPity: 55.1,
    cWins: 3,
    cLoss: 1
  }, {
    v: '4.3',
    period: '2026-06-01 ~ 현재',
    total: 192,
    count5: 4,
    charAvgPity: 50.8,
    cWins: 2,
    cLoss: 1
  }],
  // Full 5★ history (latest first). banner ∈ 캐릭터/광추/일반.
  fives: [{
    name: '아글라야',
    banner: '캐릭터',
    pity: 41,
    result: 'win',
    isPickup: true,
    time: '2026-06-12 21:04',
    version: '4.3'
  }, {
    name: '운리',
    banner: '광추',
    pity: 12,
    result: 'guaranteed',
    isPickup: true,
    time: '2026-06-08 19:32',
    version: '4.3'
  }, {
    name: '캐스토리스',
    banner: '캐릭터',
    pity: 74,
    result: 'loss',
    isPickup: false,
    time: '2026-05-29 23:11',
    version: '4.2'
  }, {
    name: '하늘걸음 노래',
    banner: '광추',
    pity: 33,
    result: 'win',
    isPickup: true,
    time: '2026-05-24 18:40',
    version: '4.2'
  }, {
    name: '백로',
    banner: '캐릭터',
    pity: 63,
    result: 'win',
    isPickup: true,
    time: '2026-05-18 14:50',
    version: '4.2'
  }, {
    name: '브로냐의 노래',
    banner: '광추',
    pity: 38,
    result: 'win',
    isPickup: true,
    time: '2026-05-12 20:07',
    version: '4.2'
  }, {
    name: '천공의 노래',
    banner: '일반',
    pity: 71,
    result: null,
    isPickup: null,
    time: '2026-04-30 18:22',
    version: '4.1'
  }, {
    name: '계림',
    banner: '캐릭터',
    pity: 9,
    result: 'win',
    isPickup: true,
    time: '2026-04-22 22:41',
    version: '4.1'
  }, {
    name: '플리나',
    banner: '캐릭터',
    pity: 89,
    result: 'loss',
    isPickup: false,
    time: '2026-04-09 13:05',
    version: '4.1'
  }, {
    name: '여명의 그림자',
    banner: '광추',
    pity: 61,
    result: 'loss',
    isPickup: false,
    time: '2026-04-02 11:18',
    version: '4.1'
  }, {
    name: '한아비',
    banner: '캐릭터',
    pity: 55,
    result: 'guaranteed',
    isPickup: true,
    time: '2026-03-21 21:18',
    version: '4.0'
  }, {
    name: '재상',
    banner: '캐릭터',
    pity: 48,
    result: 'win',
    isPickup: true,
    time: '2026-03-02 19:56',
    version: '4.0'
  }, {
    name: '은랑',
    banner: '캐릭터',
    pity: 37,
    result: 'win',
    isPickup: true,
    time: '2026-02-22 16:33',
    version: '4.0'
  }, {
    name: '치트의 노래',
    banner: '광추',
    pity: 49,
    result: 'guaranteed',
    isPickup: true,
    time: '2026-02-14 20:51',
    version: '4.0'
  }, {
    name: '경류',
    banner: '일반',
    pity: 58,
    result: null,
    isPickup: null,
    time: '2026-02-03 09:27',
    version: '3.8'
  }, {
    name: '아벤투린',
    banner: '캐릭터',
    pity: 66,
    result: 'win',
    isPickup: true,
    time: '2026-01-25 22:09',
    version: '3.8'
  }, {
    name: '로빈',
    banner: '캐릭터',
    pity: 52,
    result: 'loss',
    isPickup: false,
    time: '2026-01-11 19:44',
    version: '3.8'
  }, {
    name: '재의 그림자',
    banner: '광추',
    pity: 71,
    result: 'win',
    isPickup: true,
    time: '2025-12-28 15:02',
    version: '3.8'
  }, {
    name: '부귀',
    banner: '캐릭터',
    pity: 83,
    result: 'guaranteed',
    isPickup: true,
    time: '2025-12-09 21:37',
    version: '3.7'
  }, {
    name: '아를란',
    banner: '일반',
    pity: 69,
    result: null,
    isPickup: null,
    time: '2025-11-28 12:15',
    version: '3.7'
  }, {
    name: '미샤',
    banner: '캐릭터',
    pity: 44,
    result: 'loss',
    isPickup: false,
    time: '2025-11-15 18:58',
    version: '3.7'
  }, {
    name: '단항·음월',
    banner: '캐릭터',
    pity: 79,
    result: 'win',
    isPickup: true,
    time: '2025-11-06 23:24',
    version: '3.7'
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/data.js", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/util.js
try { (() => {
// Shared helpers for the dashboard kit.
window.WarpUtil = function () {
  const num = n => Math.round(n).toLocaleString('ko-KR');
  const pityColor = p => p < 60 ? 'var(--green)' : p <= 80 ? 'var(--orange)' : 'var(--red)';
  const RESULT = {
    win: {
      label: '픽승',
      color: 'var(--gold-ink)'
    },
    loss: {
      label: '픽뚫',
      color: 'var(--red)'
    },
    guaranteed: {
      label: '확정',
      color: 'var(--green)'
    }
  };

  // 9 pity buckets (1-10 … 81-90) for a banner's 5★ list.
  function pityBins(fives, banner) {
    const bins = Array(9).fill(0);
    fives.filter(f => f.banner === banner).forEach(f => {
      bins[Math.min(8, Math.floor((f.pity - 1) / 10))]++;
    });
    return bins;
  }

  // Animated count-up. Returns the current displayed number; eases out.
  // A timeout safety-net guarantees the final value lands even if rAF is
  // throttled (e.g. the tab/preview is backgrounded mid-animation).
  function useCountUp(target, {
    duration = 900,
    decimals = 0,
    start = true
  } = {}) {
    const [val, setVal] = React.useState(start ? 0 : target);
    React.useEffect(() => {
      if (!start) {
        setVal(target);
        return;
      }
      let raf,
        done = false,
        t0;
      const finish = () => {
        if (!done) {
          done = true;
          setVal(target);
        }
      };
      const ease = x => 1 - Math.pow(1 - x, 3);
      const tick = t => {
        if (done) return;
        if (t0 == null) t0 = t;
        const p = Math.min(1, (t - t0) / duration);
        setVal(target * ease(p));
        if (p < 1) raf = requestAnimationFrame(tick);else finish();
      };
      raf = requestAnimationFrame(tick);
      const safety = setTimeout(finish, duration + 400);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(safety);
      };
    }, [target, duration, start]);
    return decimals ? Number(val).toFixed(decimals) : Math.round(val);
  }

  // Reveal-on-mount wrapper styles (fade + rise), staggered by index.
  function reveal(i = 0, on = true) {
    return {
      opacity: on ? 1 : 0,
      transform: on ? 'none' : 'translateY(14px)',
      transition: `opacity .5s ease ${i * 70}ms, transform .55s cubic-bezier(.2,.7,.3,1) ${i * 70}ms`
    };
  }
  return {
    num,
    pityColor,
    RESULT,
    pityBins,
    useCountUp,
    reveal
  };
}();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/util.js", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.LuckBar = __ds_scope.LuckBar;

__ds_ns.PityPill = __ds_scope.PityPill;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.ThemeToggle = __ds_scope.ThemeToggle;

})();
