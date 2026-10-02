import React from "react";

// Code-native illustrations stay sharp at every breakpoint.
function Frame({ x, y, color = "#242733" }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={color} strokeWidth="2.2" fill="none">
      <rect width="20" height="12" rx="5" />
      <rect x="25" width="20" height="12" rx="5" />
      <path d="M20 5Q22.5 2 25 5M0 4H-4M45 4H49" strokeLinecap="round" />
    </g>
  );
}

export function OpticalPracticeIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 320 200" fill="none" className={className} aria-hidden="true">
      <path fill="#E7ECFE" d="M0 0H320V200H0z" />
      <path fill="#D3DEFC" d="M0 174H320V200H0z" />
      <path d="M140 106V65C140 28 170 12 205 12C240 12 277 30 277 65V106Z" fill="#FFFDF7" />
      <path d="M209 16V103M145 67H273" stroke="#D3DEFC" strokeWidth="3" />
      <path d="M226 27L253 52M232 28L259 53" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <rect x="17" y="37" width="102" height="137" rx="4" fill="#FFFDF7" stroke="#242733" strokeWidth="2" />
      <path d="M19 80H117M19 122H117M69 39V172" stroke="#D3DEFC" strokeWidth="2" />
      <Frame x={25} y={58} /><Frame x={76} y={58} color="#405AE9" />
      <Frame x={25} y={99} color="#405AE9" /><Frame x={76} y={99} />
      <Frame x={25} y={140} /><Frame x={76} y={140} color="#405AE9" />
      <path d="M25 20Q46 0 67 20Q46 40 25 20Z" stroke="#405AE9" strokeWidth="2" />
      <circle cx="46" cy="20" r="6" fill="#405AE9" />
      <path d="M81 18H116M81 24H105" stroke="#899BDF" strokeWidth="3" strokeLinecap="round" />
      <path d="M240 115C211 115 211 95 217 82C221 66 248 69 251 83L255 102Z" fill="#242733" />
      <path d="M225 98V120H240V96" fill="#DFA989" />
      <ellipse cx="230" cy="87" rx="17" ry="21" fill="#E9B89B" />
      <path d="M213 84C211 61 248 60 250 83C239 84 232 72 227 74L213 84Z" fill="#242733" />
      <circle cx="222" cy="88" r="6" stroke="#242733" strokeWidth="1.6" />
      <circle cx="238" cy="88" r="6" stroke="#242733" strokeWidth="1.6" />
      <path d="M228 87H232M226 102Q230 105 234 102" stroke="#242733" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M200 134Q200 111 224 112L233 120L241 112Q265 113 271 134" fill="#405AE9" />
      <path d="M145 133H303V184H145z" fill="#405AE9" stroke="#242733" strokeWidth="2" />
      <path d="M143 125H307V135H143z" fill="#FFFDF7" stroke="#242733" strokeWidth="2" />
      <path d="M159 148H181M159 155H174" stroke="#B5C5FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M196 137V182" stroke="#2C44BB" strokeWidth="2" />
      <Frame x={244} y={151} color="#FFFDF7" />
      <rect x="174" y="91" width="28" height="32" rx="2" fill="#242733" />
      <rect x="178" y="95" width="20" height="24" rx="1" fill="#E7ECFE" />
      <path d="M187 123V126" stroke="#242733" strokeWidth="3" />
      <path d="M126 193V118M127 157Q109 136 123 128Q135 144 127 157M127 140Q145 122 138 112Q125 120 127 140M127 174Q142 157 145 163Q146 177 127 181" fill="#7B92D7" stroke="#3B50A0" strokeWidth="1.5" />
      <path d="M115 179H140L137 199H119Z" fill="#FFFDF7" stroke="#242733" strokeWidth="2" />
      <path d="M17 185H105M24 192H77" stroke="#B0BFE9" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MapPin({ x, y, label, dark = false }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cy="35" rx="17" ry="5" fill="#242733" opacity=".12" />
      <path d="M0 34C0 34-20 12-20 0A20 20 0 0 1 20 0C20 12 0 34 0 34Z" fill={dark ? "#242733" : "#405AE9"} stroke="#FFFDF7" strokeWidth="3" />
      <text y="5" textAnchor="middle" fill="#FFFDF7" fontSize="12" fontWeight="700" fontFamily="inherit">{label}</text>
    </g>
  );
}

export function LocationMapIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 220 310" fill="none" className={className} aria-hidden="true">
      <path fill="#CCD7FB" d="M0 0H220V310H0z" />
      <path d="M0 220C43 188 55 239 90 215C125 191 144 221 171 217C195 213 205 185 220 189V252C180 277 147 242 126 267C99 298 61 248 0 285Z" fill="#B8C8F5" />
      <g fill="#E9EDFF" stroke="#B9C9F0" strokeWidth="1.3">
        <path d="M18 19H73V68H18zM92 20H138V55H92zM158 17H206V74H158zM13 103H48V150H13zM66 99H114V159H66zM142 108H206V156H142zM16 183H70V219H16zM110 195H159V236H110zM175 180H207V218H175z" />
      </g>
      <path d="M-10 84L232 95M81-10L58 319M-8 170L229 180M151-8L131 319" stroke="#FFFDF7" strokeWidth="12" />
      <path d="M-10 84L232 95M81-10L58 319" stroke="#DFE5FC" strokeWidth="1.2" strokeDasharray="5 5" />
      <path d="M53 139L77 89L164 90L166 129L138 163" stroke="#405AE9" strokeWidth="2.5" strokeDasharray="4 4" strokeLinecap="round" />
      <MapPin x={53} y={107} label="01" /><MapPin x={138} y={132} label="02" dark />
      <g transform="translate(18 245)">
        <rect width="184" height="47" rx="3" fill="#FFFDF7" />
        <circle cx="19" cy="24" r="5" fill="#405AE9" />
        <text x="33" y="21" fill="#242733" fontFamily="inherit" fontSize="11" fontWeight="700">Locațiile tale</text>
        <text x="33" y="35" fill="#657087" fontFamily="inherit" fontSize="9">Legate de același profil</text>
        <path d="M164 17L172 24L164 31M160 24H172" stroke="#405AE9" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function GlassesIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <path fill="#B9C9FF" d="M0 0H120V120H0z" />
      <circle cx="61" cy="59" r="44" stroke="#E9EEFF" strokeWidth="1" />
      <circle cx="61" cy="59" r="33" stroke="#E9EEFF" strokeWidth="1" />
      <path d="M0 60H120M60 0V120" stroke="#E9EEFF" strokeWidth="1" />
      <g transform="rotate(-12 60 60)" stroke="#242733" strokeWidth="3">
        <rect x="17" y="43" width="36" height="30" rx="12" fill="#FFFDF7" />
        <rect x="65" y="43" width="36" height="30" rx="12" fill="#FFFDF7" />
        <path d="M53 53Q59 47 65 53M17 51H11M101 51H108" strokeLinecap="round" />
        <path d="M26 50L39 64M30 50L43 64M74 50L87 64M78 50L91 64" stroke="#DCE4FF" strokeWidth="2" strokeLinecap="round" />
      </g>
      <path d="M19 20V28M15 24H23M95 89V99M90 94H100" stroke="#405AE9" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ScheduleIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 130 265" fill="none" className={className} aria-hidden="true">
      <path fill="#FFFDF7" d="M0 0H130V265H0z" />
      <text x="15" y="26" fill="#242733" fontFamily="inherit" fontSize="13" fontWeight="700">Program</text>
      <path d="M15 38H115" stroke="#242733" strokeWidth="1" />
      <circle cx="65" cy="76" r="22" fill="#E7ECFE" stroke="#405AE9" strokeWidth="2" />
      <path d="M65 62V76L75 82" stroke="#405AE9" strokeWidth="2" strokeLinecap="round" />
      {[["L", 73], ["M", 62], ["M", 73], ["J", 55], ["V", 42]].map(([day, width], index) => (
        <g key={index} transform={`translate(15 ${122 + index * 23})`}>
          <text y="6" fill="#657087" fontFamily="inherit" fontSize="10">{day}</text>
          <rect x="19" width="81" height="8" rx="4" fill="#E7ECFE" />
          <rect x="19" width={width} height="8" rx="4" fill="#405AE9" opacity={index % 2 ? .55 : .85} />
        </g>
      ))}
      <text x="65" y="250" textAnchor="middle" fill="#657087" fontFamily="inherit" fontSize="9">Ușor de actualizat</text>
    </svg>
  );
}
